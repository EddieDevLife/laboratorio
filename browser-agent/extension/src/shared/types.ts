// ─── Accessibility Tree ──────────────────────────────────────────────────────

export interface AccessibilityNode {
  nodeId: string;
  role: string;
  name: string;
  description?: string;
  value?: string;
  checked?: boolean;
  disabled: boolean;
  focused: boolean;
  visible: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  attributes: Record<string, string>;
  children: AccessibilityNode[];
}

export interface PageSnapshot {
  snapshotId: string;
  tabId: number;
  url: string;
  title: string;
  timestamp: number;
  tree: AccessibilityNode;
  source: 'cdp' | 'dom';
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type ActionType =
  | 'click'
  | 'type'
  | 'clear'
  | 'focus'
  | 'press_key'
  | 'scroll'
  | 'navigate'
  | 'wait'
  | 'extract'
  | 'screenshot'
  | 'done'
  | 'error';

export type AutonomyLevel = 'reactive' | 'semi' | 'full';

export interface ActionTarget {
  nodeId?: string;
  role?: string;
  name?: string;
  index?: number;
}

export interface ActionParams {
  text?: string;
  key?: string;
  url?: string;
  deltaX?: number;
  deltaY?: number;
  ms?: number;
  selector?: string;
}

export interface Action {
  actionId: string;
  snapshotId: string;
  type: ActionType;
  target?: ActionTarget;
  params?: ActionParams;
  reasoning?: string;
  confidence: number;
}

export interface ActionPlan {
  planId: string;
  taskId: string;
  actions: Action[];
  autonomyLevel: AutonomyLevel;
  requiresConfirmation: boolean;
}

export interface ActionResult {
  actionId: string;
  success: boolean;
  error?: string;
  extractedData?: unknown;
  newSnapshotAvailable: boolean;
}

// ─── WebSocket Message Protocol ───────────────────────────────────────────────

export interface DOMEvent {
  eventType: 'focus' | 'blur' | 'input' | 'click' | 'change' | 'navigation';
  nodeId?: string;
  value?: string;
  url?: string;
  timestamp: number;
}

// Extension → Backend
export type ExtensionMessage =
  | { type: 'snapshot'; payload: PageSnapshot }
  | { type: 'event'; payload: DOMEvent }
  | { type: 'action_result'; payload: ActionResult }
  | { type: 'task_start'; payload: { taskId: string; objective: string; autonomyLevel: AutonomyLevel } }
  | { type: 'task_cancel'; payload: { taskId: string } }
  | { type: 'screenshot'; payload: { snapshotId: string; imageBase64: string } }
  | { type: 'ping' };

// Backend → Extension
export type BackendMessage =
  | { type: 'action_plan'; payload: ActionPlan }
  | { type: 'request_snapshot' }
  | { type: 'request_screenshot'; payload: { reason: string } }
  | { type: 'task_complete'; payload: { taskId: string; summary: string } }
  | { type: 'task_error'; payload: { taskId: string; error: string } }
  | { type: 'pong' };

// ─── Internal Extension Messages (between content/sw/sidepanel) ──────────────

export type InternalMessage =
  // Pedido do side panel ao service worker para capturar a árvore
  | { type: 'CAPTURE_TREE_FOR_TAB'; payload: { tabId: number } }
  // Pedido do service worker ao content script (fallback DOM)
  | { type: 'CAPTURE_TREE'; payload?: { tabId?: number } }
  // Get page elements for direct mode (service worker → content script)
  | { type: 'GET_PAGE_ELEMENTS' }
  | { type: 'TREE_CAPTURED'; payload: PageSnapshot }
  | { type: 'ENRICH_SNAPSHOT'; payload: PageSnapshot }
  | { type: 'EXECUTE_PLAN'; payload: ActionPlan }
  | { type: 'ACTION_RESULT'; payload: ActionResult }
  | { type: 'STATUS_UPDATE'; payload: { status: AgentStatus; message?: string } }
  | { type: 'TAKE_SCREENSHOT'; payload: { snapshotId: string } }
  | { type: 'CAPTURE_ERROR'; payload: { error: string } }
  // Controle de conexão WebSocket (do side panel → service worker)
  | { type: 'WS_CONNECT' }
  | { type: 'WS_DISCONNECT' }
  | { type: 'WS_SEND_SNAPSHOT'; payload: { tabId: number } }
  | { type: 'WS_ENVIAR_COMANDO'; payload: { tarefaId: string; comando: string; tabId: number } }
  | { type: 'WS_STATUS'; payload: { connected: boolean } }
  // Mensagens de conclusão de tarefa
  | { type: 'TAREFA_CONCLUIDA'; payload: { tarefaId: string; resumo: string } }
  | { type: 'TAREFA_ERRO'; payload: { tarefaId: string; erro: string } }
  // Direct Gemini integration (no backend)
  | { type: 'USER_COMMAND'; payload: { command: string; snapshot: PageSnapshot; screenshot?: string } }
  | { type: 'GET_API_KEY_STATUS' }
  | { type: 'SET_API_KEY'; payload: { apiKey: string } }
  | { type: 'EXECUTE_ACTION'; payload: Record<string, unknown> }
  | { type: '__PING__' }
  | { type: 'AGENT_STATE'; payload: AgentState }
  | { type: 'CONFIRM_ACTION'; payload: { confirmed: boolean } }
  | { type: 'HUMAN_INPUT'; payload: { answer: string } };

export type AgentStatus = 'idle' | 'scanning' | 'running' | 'waiting' | 'done' | 'error';

export interface AgentState {
  status: AgentStatus;
  step: number;
  lastAction?: string;
  lastReasoning?: string;
  narration: string;
  isDestructive?: boolean;
  error?: string;
  humanInputRequest?: string;   // pergunta do agente aguardando resposta humana
}

export interface ChatMessage {
  role: 'agent' | 'user';
  text: string;
  time: string;
}

// ─── Utilitários compartilhados ───────────────────────────────────────────────

const FOCUSABLE_ROLES = new Set([
  'button', 'link', 'textbox', 'checkbox', 'radio', 'combobox',
  'searchbox', 'spinbutton', 'slider', 'menuitem', 'tab', 'option',
]);

export function collectFocusable(tree: AccessibilityNode): AccessibilityNode[] {
  const result: AccessibilityNode[] = [];
  function traverse(node: AccessibilityNode) {
    if (node.visible && !node.disabled && FOCUSABLE_ROLES.has(node.role)) {
      result.push(node);
    }
    for (const child of node.children) traverse(child);
  }
  traverse(tree);
  return result;
}
