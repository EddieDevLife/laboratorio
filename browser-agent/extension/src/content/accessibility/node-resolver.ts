import type { AccessibilityNode, ActionTarget } from '../../shared/types.js';
import { getAriaRole, getAccessibleName } from './aria-utils.js';
import { nodeRegistry } from './tree-builder.js';

// Resolve um nodeId de volta para o HTMLElement vivo na página.
// Estratégia 1: lookup direto pelo nodeRegistry (WeakRef).
// Estratégia 2: varredura fuzzy por role + name.
export function resolveNode(target: ActionTarget): HTMLElement | null {
  if (!target.nodeId && !target.role && !target.name) return null;

  // Lookup direto pelo registry (muito mais rápido e preciso)
  if (target.nodeId) {
    const ref = nodeRegistry.get(target.nodeId);
    const el = ref?.deref();
    if (el && document.contains(el)) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) return el;
    }
  }

  const candidates = Array.from(document.querySelectorAll<HTMLElement>('*'));

  // 1ª tentativa: match exato por role + name
  if (target.role || target.name) {
    for (const el of candidates) {
      const role = getAriaRole(el);
      const name = getAccessibleName(el);

      const roleMatch = !target.role || role === target.role;
      const nameMatch = !target.name || name.toLowerCase().includes(target.name.toLowerCase());

      if (roleMatch && nameMatch) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return el;
      }
    }
  }

  // 2ª tentativa: apenas pelo name (busca mais ampla)
  if (target.name) {
    for (const el of candidates) {
      const name = getAccessibleName(el);
      if (name.toLowerCase().includes(target.name.toLowerCase())) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return el;
      }
    }
  }

  return null;
}

// Retorna o ponto central de um elemento
export function getElementCenter(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
  };
}

// Encontra nó na árvore pelo nodeId
export function findNodeById(tree: AccessibilityNode, nodeId: string): AccessibilityNode | null {
  if (tree.nodeId === nodeId) return tree;
  for (const child of tree.children) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}
