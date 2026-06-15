/**
 * Agent loop — roda inteiramente no service worker.
 * Sem backend, sem WebSocket.
 *
 * Fluxo por step:
 *   1. Captura AX tree via content script
 *   2. Serializa em formato [index]<role>name (browser-use style)
 *   3. Chama Claude com tool "browser_action"
 *   4. Executa a ação no content script
 *   5. Se N falhas consecutivas → screenshot → Computer Use
 *   6. Repete até "done" ou limite
 */

import { callClaude, getSettings, type Message, type ContentBlock, type Tool } from './llm-client.js';
import type { InternalMessage, AccessibilityNode, PageSnapshot } from '../shared/types.js';
import { buildNarration } from './narration.js';
import { isDestructive } from './destructive-detector.js';
import { CAPTURE_TIMEOUT_MS, SCRIPT_INJECT_DELAY_MS } from '../shared/timing.js';

const MAX_STEPS = 30;
const COMPUTER_USE_THRESHOLD = 3;


// ── Tool definitions ──────────────────────────────────────────────────────────

const BROWSER_ACTION_TOOL: Tool = {
  name: 'browser_action',
  description: 'Execute an action in the browser tab.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['click', 'type', 'press_key', 'scroll', 'navigate', 'wait', 'screenshot', 'done'],
        description: 'Action to take. Use "done" when the task is complete.',
      },
      index: { type: 'number', description: 'Interactive element index from the page state (preferred).' },
      name: { type: 'string', description: 'Accessible name of the element (fallback if no index).' },
      role: { type: 'string', description: 'ARIA role of the element (fallback).' },
      text: { type: 'string', description: 'Text to type (for "type" action).' },
      key: { type: 'string', description: 'Key to press, e.g. "Enter", "Tab", "Escape".' },
      url: { type: 'string', description: 'URL to navigate to.' },
      deltaY: { type: 'number', description: 'Pixels to scroll vertically (positive=down).' },
      ms: { type: 'number', description: 'Milliseconds to wait.' },
      reasoning: { type: 'string', description: 'Why this action is needed.' },
    },
    required: ['action', 'reasoning'],
  },
};

function makeComputerTool(w: number, h: number): Tool {
  return { type: 'computer_20250124', name: 'computer', display_width_px: w, display_height_px: h };
}

// ── AX tree → [index] text (browser-use format) ───────────────────────────────

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'textbox', 'searchbox', 'combobox',
  'checkbox', 'radio', 'menuitem', 'tab', 'option',
  'slider', 'spinbutton', 'switch',
]);

interface IndexedNode { index: number; node: AccessibilityNode }

function serializeTree(
  node: AccessibilityNode,
  counter: { n: number },
  lines: string[],
  indexMap: Map<number, AccessibilityNode>,
  depth = 0,
  limit = { count: 0 },
): void {
  if (depth > 12 || limit.count > 200) return;
  if (!node.visible) return;

  const indent = '\t'.repeat(depth);
  const role = node.role;

  if (INTERACTIVE_ROLES.has(role) && !node.disabled) {
    const idx = ++counter.n;
    indexMap.set(idx, node);
    limit.count++;
    const attrs = node.value ? ` value="${node.value.substring(0, 60)}"` : '';
    const checked = node.checked === true ? ' checked' : '';
    lines.push(`${indent}[${idx}]<${role}${attrs}${checked} />`);
    if (node.name) lines.push(`${indent}\t${node.name.substring(0, 120)}`);
  } else if (node.name && ['heading', 'paragraph', 'label'].includes(role)) {
    lines.push(`${indent}${node.name.substring(0, 120)}`);
  }

  for (const child of node.children) {
    serializeTree(child, counter, lines, indexMap, depth + 1, limit);
  }
}

function buildPageState(snapshot: PageSnapshot): { text: string; indexMap: Map<number, AccessibilityNode> } {
  const lines: string[] = [];
  const indexMap = new Map<number, AccessibilityNode>();
  const counter = { n: 0 };
  const limit = { count: 0 };

  serializeTree(snapshot.tree, counter, lines, indexMap, 0, limit);

  const text =
    `Current URL: ${snapshot.url}\n` +
    `Title: ${snapshot.title}\n` +
    `Viewport: ${snapshot.viewportWidth}×${snapshot.viewportHeight}, ` +
    `scroll: (${snapshot.scrollX}, ${snapshot.scrollY})\n\n` +
    `Interactive Elements:\n` +
    (lines.join('\n') || '(none found)');

  return { text, indexMap };
}

// ── Agent Loop ─────────────────────────────────────────────────────────────────

export type LoopStatus = 'idle' | 'running' | 'done' | 'error';

export interface LoopState {
  status: LoopStatus;
  step: number;
  lastAction?: string;
  lastReasoning?: string;
  narration: string;
  isDestructive?: boolean;
  error?: string;
}

export class AgentLoop {
  private tabId: number;
  private objective: string;
  private messages: Message[] = [];
  private step = 0;
  private consecutiveFailures = 0;
  private indexMap = new Map<number, AccessibilityNode>();
  private lastPageText: string | null = null;
  private onStatusChange: (s: LoopState) => void;
  private stopped = false;
  private confirmationResolve: ((confirmed: boolean) => void) | null = null;

  constructor(opts: {
    tabId: number;
    objective: string;
    onStatusChange: (s: LoopState) => void;
  }) {
    this.tabId = opts.tabId;
    this.objective = opts.objective;
    this.onStatusChange = opts.onStatusChange;
  }

  stop() {
    this.stopped = true;
    this.confirmationResolve?.(false);
  }

  resolveConfirmation(confirmed: boolean) {
    this.confirmationResolve?.(confirmed);
    this.confirmationResolve = null;
  }

  private waitForConfirmation(actionLabel: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmationResolve = resolve;
      this.emitFull('running', this.step, actionLabel, undefined, undefined, true);
    });
  }

  async run(): Promise<void> {
    this.emit('running', 0, 'Iniciando...');

    while (!this.stopped && this.step < MAX_STEPS) {
      this.step++;
      const useComputerUse = this.consecutiveFailures >= COMPUTER_USE_THRESHOLD;

      try {
        // 1. Captura estado da página
        const snapshot = await this.captureSnapshot();
        if (!snapshot) { this.emit('error', this.step, undefined, 'Não foi possível capturar a página'); return; }

        let done = false;

        if (useComputerUse) {
          // 2b. Screenshot + Computer Use
          done = await this.stepComputerUse(snapshot);
        } else {
          // 2a. AX tree + Claude tool use
          done = await this.stepAXTree(snapshot);
        }

        if (done) {
          this.emit('done', this.step, 'Tarefa concluída');
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.emit('error', this.step, undefined, msg);
        return;
      }
    }

    if (!this.stopped) this.emit('done', this.step, 'Limite de passos atingido');
  }

  // ── Passo via AX tree ───────────────────────────────────────────────────────

  private async stepAXTree(snapshot: PageSnapshot): Promise<boolean> {
    const { text, indexMap } = buildPageState(snapshot);
    this.indexMap = indexMap;
    this.lastPageText = text;

    const userContent = `<browser_state>\n${text}\n</browser_state>\n\n<user_request>${this.objective}</user_request>`;

    this.messages.push({ role: 'user', content: userContent });

    const response = await callClaude({
      system: SYSTEM_PROMPT,
      messages: this.messages,
      tools: [BROWSER_ACTION_TOOL],
      maxTokens: 2048,
    });

    // Registra resposta do assistente no histórico
    this.messages.push({ role: 'assistant', content: response.content });

    const toolUse = response.content.find(b => b.type === 'tool_use' && b.name === 'browser_action');

    if (!toolUse || response.stop_reason === 'end_turn') {
      // Sem tool call → Claude disse que terminou
      return true;
    }

    const input = toolUse.input as Record<string, unknown>;
    const action = input['action'] as string;
    const reasoning = (input['reasoning'] as string) ?? '';

    const narration = buildNarration({ action, ...input });
    this.emitFull('running', this.step, action, undefined, reasoning, false, narration);

    if (action === 'done') return true;
    if (action === 'screenshot') {
      // Claude quer um screenshot → sinaliza para acionar computer use no próximo step
      this.consecutiveFailures = COMPUTER_USE_THRESHOLD;
      this.pushToolResult(toolUse.id!, 'Screenshot will be taken in the next step.');
      return false;
    }

    // Verifica se a ação é destrutiva — pausa e aguarda confirmação do usuário
    const enriched = this.enrichWithNodeInfo(input);
    if (isDestructive({ action, name: enriched['name'] as string, role: enriched['role'] as string, url: enriched['url'] as string, reasoning })) {
      const confirmed = await this.waitForConfirmation(narration);
      if (!confirmed) {
        this.pushToolResult(toolUse.id!, 'User cancelled this action. Plan an alternative.');
        return false;
      }
    }

    // Executa a ação no content script
    // Enriquece com name+role do indexMap para que resolveNode funcione
    const nodeId = this.resolveNodeId(enriched);
    const result = await this.executeAction({ action, input: enriched, nodeId });

    this.pushToolResult(toolUse.id!, result.success ? 'Action executed successfully.' : `Error: ${result.error}`);

    if (result.success) {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
    }

    return false;
  }

  // ── Passo via Computer Use ──────────────────────────────────────────────────

  private async stepComputerUse(snapshot: PageSnapshot): Promise<boolean> {
    this.emit('running', this.step, 'computer_use', undefined, 'Usando visão (muitas falhas consecutivas)');

    // Computer Use nativo só funciona com Anthropic.
    // Para outros providers, usa visão com GPT-4o / Gemini via descrição da página.
    const settings = await getSettings();
    const isAnthropic = (settings.llm_provider ?? 'anthropic') === 'anthropic';

    const screenshot = await this.takeScreenshot();
    if (!screenshot) {
      // Sem screenshot, reseta falhas e tenta de novo com AX tree
      this.consecutiveFailures = 0;
      return false;
    }

    const w = snapshot.viewportWidth || 1280;
    const h = snapshot.viewportHeight || 800;

    if (!isAnthropic) {
      // Fallback para providers sem Computer Use: envia screenshot como contexto visual
      // e pede uma ação em texto usando o mesmo tool browser_action
      const userMsg: Message = {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
          {
            type: 'text',
            text: [
              `You are a browser automation agent. The screenshot shows the current page.`,
              `Objective: ${this.objective}`,
              `URL: ${snapshot.url}`,
              ``,
              `IMPORTANT: You MUST call the browser_action tool NOW. Do NOT describe steps. Take ONE concrete action.`,
              `If the objective requires navigating to another site, use action="navigate" with the URL.`,
              ``,
              `Available page elements:`,
              this.lastPageText?.substring(0, 3000) ?? '(see screenshot)',
            ].join('\n'),
          },
        ],
      };

      const response = await callClaude({
        system: SYSTEM_PROMPT,
        messages: [userMsg],
        tools: [BROWSER_ACTION_TOOL],
        maxTokens: 1024,
      });

      // Processa como se fosse um step normal da AX tree
      const toolUse = response.content.find(b => b.type === 'tool_use' && b.name === 'browser_action');
      if (!toolUse) {
        // Modelo retornou texto sem tool — força navigate se houver URL no objetivo
        const urlMatch = this.objective.match(/https?:\/\/\S+|google\.com|youtube\.com/i);
        if (urlMatch) {
          await this.executeAction({ action: 'navigate', input: { url: `https://${urlMatch[0].replace(/^https?:\/\//, '')}` } });
        }
        this.consecutiveFailures = 0;
        return false;
      }

      const input = toolUse.input as Record<string, unknown>;
      const action = input['action'] as string;
      if (action === 'done') return true;

      const enriched = this.enrichWithNodeInfo(input);
      const result = await this.executeAction({ action, input: enriched });
      if (result.success) this.consecutiveFailures = 0;
      return false;
    }

    // Anthropic Computer Use
    const userMsg: Message = {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
        { type: 'text', text: `Objective: ${this.objective}\nURL: ${snapshot.url}\n\nWhat is the next action?` },
      ],
    };

    const response = await callClaude({
      system: COMPUTER_USE_SYSTEM,
      messages: [userMsg],
      tools: [makeComputerTool(w, h)],
      maxTokens: 4096,
      useComputerUseBeta: true,
    });

    const toolUse = response.content.find(b => b.type === 'tool_use' && b.name === 'computer');
    const textBlock = response.content.find(b => b.type === 'text');

    if (!toolUse) {
      // Sem tool call — Claude disse que terminou
      const summary = (textBlock?.text ?? 'Concluído via Computer Use').substring(0, 200);
      this.emit('running', this.step, 'done', undefined, summary);
      return true;
    }

    const cuInput = toolUse.input as Record<string, unknown>;
    const cuAction = cuInput['action'] as string;

    if (cuAction === 'screenshot') {
      // Claude pediu outro screenshot — deixa continuar o loop
      return false;
    }

    // Converte ação do Computer Use para o nosso executor
    const result = await this.executeComputerUseAction(cuAction, cuInput, snapshot.snapshotId);

    if (result.success) {
      this.consecutiveFailures = 0;
    }
    // Não incrementamos falhas do computer use (usa coordenadas absolutas)

    if (cuAction === 'done' || response.stop_reason === 'end_turn') return true;
    return false;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private resolveNodeId(input: Record<string, unknown>): string | undefined {
    const idx = typeof input['index'] === 'number' ? input['index'] : undefined;
    if (idx !== undefined) {
      const node = this.indexMap.get(idx);
      return node?.nodeId;
    }
    return undefined;
  }

  // Garante que name e role estejam no payload, buscando do indexMap quando necessário
  private enrichWithNodeInfo(input: Record<string, unknown>): Record<string, unknown> {
    const idx = typeof input['index'] === 'number' ? input['index'] : undefined;
    if (idx === undefined) return input;
    const node = this.indexMap.get(idx);
    if (!node) return input;
    return {
      ...input,
      name: input['name'] ?? node.name,
      role: input['role'] ?? node.role,
      nodeId: node.nodeId,
    };
  }

  private pushToolResult(toolUseId: string, content: string) {
    this.messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content }],
    });
  }

  private async captureSnapshot(): Promise<PageSnapshot | null> {
    await this.ensureContentScript();

    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), CAPTURE_TIMEOUT_MS);

      chrome.tabs.sendMessage(
        this.tabId,
        { type: 'CAPTURE_TREE', payload: { tabId: this.tabId } } as InternalMessage,
        (response: { ok?: boolean; snapshot?: PageSnapshot; error?: string } | undefined) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response?.snapshot ?? null);
        }
      );
    });
  }

  private async ensureContentScript(): Promise<void> {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        this.tabId,
        { type: '__PING__' } as unknown as InternalMessage,
        (res) => {
          if (chrome.runtime.lastError || !res) {
            chrome.scripting
              .executeScript({ target: { tabId: this.tabId }, files: ['content/index.js'] })
              .then(() => setTimeout(resolve, SCRIPT_INJECT_DELAY_MS))
              .catch((err) => {
                console.error('[AgentLoop] Falha ao injetar content script:', err);
                resolve();
              });
          } else {
            resolve();
          }
        }
      );
    });
  }

  private async takeScreenshot(): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.tabs.get(this.tabId, (tab) => {
        if (!tab?.windowId) { resolve(null); return; }
        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) { resolve(null); return; }
          resolve(dataUrl.split(',')[1]);
        });
      });
    });
  }

  private async executeAction(opts: {
    action: string;
    input: Record<string, unknown>;
    nodeId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        this.tabId,
        {
          type: 'EXECUTE_ACTION',
          payload: { ...opts.input, nodeId: opts.nodeId },
        } as unknown as InternalMessage,
        (res: { success: boolean; error?: string } | undefined) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(res ?? { success: false, error: 'Sem resposta do content script' });
        }
      );
    });
  }

  private async executeComputerUseAction(
    cuAction: string,
    cuInput: Record<string, unknown>,
    snapshotId: string,
  ): Promise<{ success: boolean }> {
    const coordinate = cuInput['coordinate'] as [number, number] | undefined;
    const text = cuInput['text'] as string | undefined;
    const key = cuInput['key'] as string | undefined;
    const direction = cuInput['direction'] as string | undefined;
    const amount = (cuInput['amount'] as number) ?? 3;

    let payload: Record<string, unknown> = { action: cuAction };

    if (coordinate) {
      payload = { action: 'click_coordinate', x: coordinate[0], y: coordinate[1] };
      if (cuAction === 'double_click') payload['double'] = true;
      if (cuAction === 'right_click') payload['button'] = 'right';
    } else if (text) {
      payload = { action: 'type', text };
    } else if (key) {
      payload = { action: 'press_key', key };
    } else if (direction) {
      const deltaY = direction === 'down' ? amount * 100 : direction === 'up' ? -(amount * 100) : 0;
      payload = { action: 'scroll', deltaY };
    }

    return this.executeAction({ action: payload['action'] as string, input: payload });
  }

  private emit(
    status: LoopStatus,
    step: number,
    lastAction?: string,
    error?: string,
    lastReasoning?: string,
  ) {
    this.emitFull(status, step, lastAction, error, lastReasoning, false, lastAction ?? '');
  }

  private emitFull(
    status: LoopStatus,
    step: number,
    lastAction?: string,
    error?: string,
    lastReasoning?: string,
    isDestructiveAction = false,
    narration = '',
  ) {
    const state: LoopState = { status, step, lastAction, lastReasoning, narration, isDestructive: isDestructiveAction, error };
    this.onStatusChange(state);
    broadcast({
      type: 'AGENT_STATE',
      payload: state,
    } as unknown as InternalMessage);
    broadcast({
      type: 'STATUS_UPDATE',
      payload: {
        status: status === 'running' ? 'running' : status === 'done' ? 'idle' : 'error',
        message: error ?? narration ?? lastAction ?? '',
      },
    });
  }
}

function broadcast(msg: InternalMessage) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

// ── System prompts ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a browser automation agent. You control a real Chrome browser tab.

At each step you receive:
- <browser_state>: the current URL, title, and interactive elements in [index] format
- <user_request>: the goal to accomplish

Rules:
- Use the "browser_action" tool for EVERY response.
- Prefer using element index (more reliable than name/role).
- One action per step.
- If the task is complete, call browser_action with action="done".
- If you need to see the page visually, call action="screenshot".
- Always include clear "reasoning".
`;

const COMPUTER_USE_SYSTEM = `\
You are a browser automation agent controlling a real Chrome browser via screenshot.
Use the computer tool to click, type, scroll, and navigate.
When the task is complete, respond with text "Task complete: <summary>" without using any tool.
`;
