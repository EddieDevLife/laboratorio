import type { AccessibilityNode } from '../shared/types.js';

// chrome.automation dá acesso à mesma AX tree que leitores de tela (VoiceOver, NVDA, JAWS).
// Não precisa de content script nem CDP; funciona direto no service worker.
// Fonte mais fiel à experiência de tecnologia assistiva.

declare namespace chrome {
  namespace automation {
    interface AutomationNode {
      role: string;
      name?: string;
      description?: string;
      value?: string;
      checked?: string;
      location?: { left: number; top: number; width: number; height: number };
      children: AutomationNode[];
      state?: Record<string, boolean>;
      htmlAttributes?: Record<string, string>;
      restriction?: string;
    }
    function getTree(tabId: number, callback: (rootNode: AutomationNode) => void): void;
    function getTree(callback: (rootNode: AutomationNode) => void): void;
  }
}

function convertNode(node: chrome.automation.AutomationNode, tabId: number, counter: { n: number }, depth: number): AccessibilityNode | null {
  if (depth > 30) return null;
  const role = node.role ?? 'generic';

  // Ignora nós puramente estruturais sem nome nem filhos interativos
  if ((role === 'none' || role === 'generic' || role === 'ignored') && !node.name) {
    const interactiveChildren: AccessibilityNode[] = [];
    for (const child of node.children ?? []) {
      const c = convertNode(child, tabId, counter, depth + 1);
      if (c) interactiveChildren.push(c);
    }
    if (interactiveChildren.length === 0) return null;
    // Nó sem nome mas com filhos — retorna um container genérico
    return {
      nodeId: `ax-aut-${tabId}-${++counter.n}`,
      role: 'group',
      name: '',
      disabled: false,
      focused: false,
      visible: true,
      bounds: node.location
        ? { x: node.location.left, y: node.location.top, width: node.location.width, height: node.location.height }
        : { x: 0, y: 0, width: 0, height: 0 },
      attributes: {},
      children: interactiveChildren,
    };
  }

  const children: AccessibilityNode[] = [];
  for (const child of node.children ?? []) {
    const c = convertNode(child, tabId, counter, depth + 1);
    if (c) children.push(c);
  }

  const state = node.state ?? {};
  const loc = node.location;

  return {
    nodeId: `ax-aut-${tabId}-${++counter.n}`,
    role,
    name: node.name ?? '',
    description: node.description,
    value: node.value,
    checked: node.checked === 'true' ? true : node.checked === 'false' ? false : undefined,
    disabled: state['disabled'] === true || node.restriction === 'disabled',
    focused: state['focused'] === true,
    visible: state['invisible'] !== true && state['offscreen'] !== true,
    bounds: loc
      ? { x: loc.left, y: loc.top, width: loc.width, height: loc.height }
      : { x: 0, y: 0, width: 0, height: 0 },
    attributes: {},
    children,
  };
}

export function getAutomationTree(tabId: number): Promise<AccessibilityNode | null> {
  return new Promise((resolve) => {
    // Verifica se chrome.automation está disponível
    if (!chrome.automation) {
      resolve(null);
      return;
    }

    const timeout = setTimeout(() => resolve(null), 5000);

    try {
      chrome.automation.getTree(tabId, (rootNode) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError || !rootNode) {
          resolve(null);
          return;
        }
        const counter = { n: 0 };
        resolve(convertNode(rootNode, tabId, counter, 0));
      });
    } catch {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}
