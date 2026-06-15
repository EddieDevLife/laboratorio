import { captureSnapshot } from './accessibility/tree-builder.js';
import { resolveNode, getElementCenter } from './accessibility/node-resolver.js';
import { clickAt, doubleClickAt, rightClickAt, dragFrom } from './actions/click.js';
import { typeText, pressKey, clearField } from './actions/type.js';
import { scrollBy, scrollElementIntoView } from './actions/scroll.js';
import { removeCursor } from './overlay/cursor.js';
import { delay, ACTION_BETWEEN_DELAY_MS, isValidHttpUrl } from '../shared/timing.js';
import type { InternalMessage, ActionPlan, ActionResult } from '../shared/types.js';

// O tabId é fornecido pelo service worker na primeira mensagem CAPTURE_TREE;
// enquanto isso, usamos um ID local baseado em timestamp para gerar nodeIds únicos.
let currentTabId = Date.now() % 1000000;

// ─── Listener de mensagens vindas do service worker ───────────────────────────

chrome.runtime.onMessage.addListener(
  (message: InternalMessage & { type: string; payload?: unknown }, _sender, sendResponse) => {
    const type = message.type;

    // CAPTURE_TREE é tratado de forma síncrona para garantir que sendResponse
    // seja chamado antes de qualquer yield (problema comum com handlers async no MV3)
    if (type === 'CAPTURE_TREE') {
      try {
        const p = message.payload as { tabId?: number } | undefined;
        if (p?.tabId) currentTabId = p.tabId;
        const snapshot = captureSnapshot(currentTabId, 'dom');
        // Broadcast para o side panel ver a árvore
        chrome.runtime.sendMessage({ type: 'TREE_CAPTURED', payload: snapshot } as InternalMessage)
          .catch(() => {});
        // Responde diretamente ao chamador (agent-loop via chrome.tabs.sendMessage)
        sendResponse({ ok: true, snapshot });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return true;
    }

    // Demais mensagens vão para o handler async
    handleMessage(message, sendResponse);
    return true;
  }
);

async function handleMessage(
  message: InternalMessage & { type: string; payload?: unknown },
  sendResponse: (r?: unknown) => void
) {
  switch (message.type) {
    case 'CAPTURE_TREE': {
      // Não deve chegar aqui (tratado acima de forma síncrona)
      sendResponse({ ok: false, error: 'unreachable' });
      break;
    }

    case 'GET_PAGE_ELEMENTS': {
      // Get interactive elements for direct mode
      const elements = getPageElements();
      sendResponse({ elements });
      break;
    }

    case 'ENRICH_SNAPSHOT': {
      // CDP tree recebida do SW — enriquece com scroll e viewport
      const snapshot = message.payload as import('../shared/types.js').PageSnapshot;
      snapshot.scrollX = window.scrollX;
      snapshot.scrollY = window.scrollY;
      snapshot.viewportWidth = window.innerWidth;
      snapshot.viewportHeight = window.innerHeight;
      chrome.runtime.sendMessage({ type: 'TREE_CAPTURED', payload: snapshot } as InternalMessage);
      sendResponse({ ok: true });
      break;
    }

    case 'EXECUTE_PLAN': {
      const plan = message.payload as ActionPlan;
      const results = await executePlan(plan);
      sendResponse({ ok: true, results });
      break;
    }

    // Ações individuais do agent-loop (sem plano completo)
    case 'EXECUTE_ACTION': {
      const result = await executeAction(message.payload as Record<string, unknown>);
      sendResponse(result);
      break;
    }

    case '__PING__':
      sendResponse({ ok: true });
      break;

    default:
      sendResponse({ error: `Content script: tipo desconhecido ${message.type}` });
  }
}

// Get interactive elements from page
function getPageElements(): string {
  const elements: string[] = [];
  const selectors = [
    'a[href]',
    'button',
    'input',
    'textarea',
    'select',
    '[role="button"]',
    '[role="link"]',
    '[role="textbox"]',
    '[onclick]'
  ];
  
  const found = document.querySelectorAll(selectors.join(','));
  
  found.forEach((el, index) => {
    if (index >= 50) return; // Limit to 50 elements
    
    const rect = el.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0 &&
                     rect.top < window.innerHeight && rect.bottom > 0;
    
    if (!isVisible) return;
    
    const tagName = el.tagName.toLowerCase();
    const text = el.textContent?.trim().substring(0, 50) || '';
    const type = el.getAttribute('type') || '';
    const role = el.getAttribute('role') || tagName;
    const ariaLabel = el.getAttribute('aria-label') || '';
    const placeholder = el.getAttribute('placeholder') || '';
    const name = ariaLabel || text || placeholder || `${role}_${index}`;
    
    elements.push(
      `- ${role}: "${name}" (pos: ${Math.round(rect.x)},${Math.round(rect.y)})`
    );
  });
  
  return elements.length > 0
    ? elements.join('\n')
    : 'No interactive elements found on page.';
}

// ─── Executor de plano de ações ───────────────────────────────────────────────

async function executePlan(plan: ActionPlan): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of plan.actions) {
    const result: ActionResult = {
      actionId: action.actionId,
      success: false,
      newSnapshotAvailable: false,
    };

    try {
      switch (action.type) {
        case 'click': {
          const el = resolveNode(action.target ?? {});
          if (!el) throw new Error('stale_node');
          const { x, y } = getElementCenter(el);
          scrollElementIntoView(el);
          await delay(150);
          await clickAt(x, y);
          result.success = true;
          result.newSnapshotAvailable = true;
          break;
        }

        case 'type': {
          const el = resolveNode(action.target ?? {});
          if (!el) throw new Error('stale_node');
          scrollElementIntoView(el);
          await delay(100);
          await typeText(el, action.params?.text ?? '', true);
          result.success = true;
          break;
        }

        case 'clear': {
          const el = resolveNode(action.target ?? {});
          if (!el) throw new Error('stale_node');
          clearField(el);
          result.success = true;
          break;
        }

        case 'focus': {
          const el = resolveNode(action.target ?? {});
          if (!el) throw new Error('stale_node');
          el.focus();
          result.success = true;
          break;
        }

        case 'press_key': {
          const el = resolveNode(action.target ?? {}) ?? document.activeElement as HTMLElement;
          if (!el) throw new Error('stale_node');
          await pressKey(el, action.params?.key ?? 'Enter');
          result.success = true;
          result.newSnapshotAvailable = true;
          break;
        }

        case 'scroll': {
          scrollBy(action.params?.deltaX ?? 0, action.params?.deltaY ?? 0);
          result.success = true;
          break;
        }

        case 'navigate': {
          const navUrl = action.params?.url;
          if (navUrl && isValidHttpUrl(navUrl)) {
            window.location.href = navUrl;
            result.success = true;
            result.newSnapshotAvailable = true;
          } else if (navUrl) {
            throw new Error(`URL inválida ou protocolo não permitido: ${navUrl}`);
          }
          break;
        }

        case 'wait': {
          await delay(action.params?.ms ?? 1000);
          result.success = true;
          break;
        }

        case 'extract': {
          const selector = action.params?.selector;
          if (selector) {
            const els = Array.from(document.querySelectorAll(selector));
            result.extractedData = els.map((el) => el.textContent?.trim());
          }
          result.success = true;
          break;
        }

        case 'screenshot': {
          chrome.runtime.sendMessage({
            type: 'TAKE_SCREENSHOT',
            payload: { snapshotId: action.snapshotId },
          } as InternalMessage);
          result.success = true;
          break;
        }

        case 'done':
          result.success = true;
          removeCursor();
          break;

        default:
          throw new Error(`Ação desconhecida: ${action.type}`);
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
    }

    // Reporta resultado ao service worker
    chrome.runtime.sendMessage({ type: 'ACTION_RESULT', payload: result } as InternalMessage);
    results.push(result);

    if (!result.success) break;
    await delay(ACTION_BETWEEN_DELAY_MS);
  }

  return results;
}

// ─── Executor de ação individual (usado pelo agent-loop) ──────────────────────

async function executeAction(
  input: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const action = input['action'] as string;

  try {
    switch (action) {
      case 'click': {
        const target = { nodeId: input['nodeId'] as string, name: input['name'] as string, role: input['role'] as string };
        const el = resolveNode(target);
        if (!el) throw new Error('Elemento não encontrado');
        scrollElementIntoView(el);
        await delay(100);
        const { x, y } = getElementCenter(el);
        await clickAt(x, y);
        break;
      }

      case 'click_coordinate': {
        const btn = (input['button'] as 'left' | 'right' | 'middle') ?? 'left';
        if (input['double']) {
          await doubleClickAt(input['x'] as number, input['y'] as number);
        } else {
          await clickAt(input['x'] as number, input['y'] as number, btn);
        }
        break;
      }

      case 'type': {
        const target = { nodeId: input['nodeId'] as string, name: input['name'] as string, role: input['role'] as string };
        const el = resolveNode(target) ?? (document.activeElement as HTMLElement);
        if (!el) throw new Error('Elemento não encontrado');
        scrollElementIntoView(el);
        await delay(80);
        await typeText(el, (input['text'] as string) ?? '', true);
        break;
      }

      case 'press_key': {
        const el = document.activeElement as HTMLElement ?? document.body;
        await pressKey(el, (input['key'] as string) ?? 'Enter');
        break;
      }

      case 'scroll': {
        const deltaY = (input['deltaY'] as number) ?? 0;
        scrollBy(0, deltaY);
        break;
      }

      case 'navigate': {
        const url = input['url'] as string;
        if (url && isValidHttpUrl(url)) {
          window.location.href = url;
        } else if (url) {
          throw new Error(`URL inválida ou protocolo não permitido: ${url}`);
        }
        break;
      }

      case 'wait': {
        await delay((input['ms'] as number) ?? 1000);
        break;
      }

      case 'done':
        removeCursor();
        break;

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

