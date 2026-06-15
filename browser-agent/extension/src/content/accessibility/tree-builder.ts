import type { AccessibilityNode, PageSnapshot } from '../../shared/types.js';
import {
  getAriaRole,
  getAccessibleName,
  getAccessibleDescription,
  getCurrentValue,
  isChecked,
  isDisabled,
  isFocusable,
  isVisible,
  getAriaAttributes,
} from './aria-utils.js';

// Roles que não vale a pena incluir se não tiverem nome nem filhos interativos
const SKIP_ROLES = new Set(['generic', 'none', 'presentation']);

// Tags que são puramente estruturais e não têm semântica de acessibilidade
const SKIP_TAGS = new Set(['script', 'style', 'meta', 'link', 'head', 'noscript', 'template']);

let nodeCounter = 0;

// Mapa de nodeId → elemento DOM vivo (usado pelo executor de ações)
export const nodeRegistry = new Map<string, WeakRef<HTMLElement>>();

function makeNodeId(tabId: number): string {
  return `ax-${tabId}-${++nodeCounter}`;
}

function buildNode(element: HTMLElement, tabId: number, depth: number): AccessibilityNode | null {
  if (depth > 30) return null;

  const tag = element.tagName?.toLowerCase();
  if (!tag || SKIP_TAGS.has(tag)) return null;

  const role = getAriaRole(element);
  const name = getAccessibleName(element);
  const visible = isVisible(element);
  const focusable = isFocusable(element);
  const rect = element.getBoundingClientRect();

  const children: AccessibilityNode[] = [];
  for (const child of Array.from(element.children)) {
    const childNode = buildNode(child as HTMLElement, tabId, depth + 1);
    if (childNode) children.push(childNode);
  }

  // Pular nós genéricos sem nome e sem filhos interativos
  if (SKIP_ROLES.has(role) && !name && children.length === 0) return null;
  if (!visible && !focusable) return null;

  const nodeId = makeNodeId(tabId);
  // Registra referência fraca para lookup direto pelo executor
  nodeRegistry.set(nodeId, new WeakRef(element));

  return {
    nodeId,
    role,
    name,
    description: getAccessibleDescription(element),
    value: getCurrentValue(element),
    checked: isChecked(element),
    disabled: isDisabled(element),
    focused: document.activeElement === element,
    visible,
    bounds: {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    attributes: getAriaAttributes(element),
    children,
  };
}

export function buildDOMTree(tabId: number): AccessibilityNode {
  nodeCounter = 0;
  nodeRegistry.clear();
  const root = document.documentElement;
  const rootRole = 'document';

  const children: AccessibilityNode[] = [];
  for (const child of Array.from(root.children)) {
    const node = buildNode(child as HTMLElement, tabId, 0);
    if (node) children.push(node);
  }

  return {
    nodeId: `ax-${tabId}-root`,
    role: rootRole,
    name: document.title || '',
    disabled: false,
    focused: false,
    visible: true,
    bounds: {
      x: 0,
      y: 0,
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    },
    attributes: {},
    children,
  };
}

export function captureSnapshot(tabId: number, source: 'cdp' | 'dom' = 'dom'): PageSnapshot {
  const tree = buildDOMTree(tabId);
  return {
    snapshotId: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tabId,
    url: window.location.href,
    title: document.title,
    timestamp: Date.now(),
    tree,
    source,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

export function collectFocusable(tree: AccessibilityNode): AccessibilityNode[] {
  const result: AccessibilityNode[] = [];
  function traverse(node: AccessibilityNode) {
    if (node.visible && !node.disabled) {
      const focusableRoles = new Set(['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'searchbox', 'spinbutton', 'slider', 'menuitem', 'tab', 'option']);
      if (focusableRoles.has(node.role)) result.push(node);
    }
    for (const child of node.children) traverse(child);
  }
  traverse(tree);
  return result;
}
