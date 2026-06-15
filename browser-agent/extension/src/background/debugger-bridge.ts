import type { AccessibilityNode } from '../shared/types.js';

// Mapeia tabId → se o debugger está anexado
const attachedTabs = new Set<number>();

export async function attachDebugger(tabId: number): Promise<void> {
  if (attachedTabs.has(tabId)) return;
  await chrome.debugger.attach({ tabId }, '1.3');
  attachedTabs.add(tabId);
  chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId === tabId) attachedTabs.delete(tabId);
  });
}

export async function detachDebugger(tabId: number): Promise<void> {
  if (!attachedTabs.has(tabId)) return;
  await chrome.debugger.detach({ tabId });
  attachedTabs.delete(tabId);
}

interface CDPAXNode {
  nodeId: { value: number };
  ignored?: boolean;
  role?: { value: string };
  name?: { value: string };
  description?: { value: string };
  value?: { value: string };
  properties?: Array<{ name: string; value: { value: unknown } }>;
  childIds?: Array<{ value: number }>;
}

interface CDPAXTreeResult {
  nodes: CDPAXNode[];
}

export async function getCDPAccessibilityTree(tabId: number): Promise<AccessibilityNode | null> {
  try {
    await attachDebugger(tabId);

    const result = await chrome.debugger.sendCommand(
      { tabId },
      'Accessibility.getFullAXTree',
      {}
    ) as CDPAXTreeResult;

    if (!result?.nodes?.length) return null;

    // Indexar por nodeId numérico para construção rápida da árvore
    const nodeMap = new Map<number, CDPAXNode>();
    for (const node of result.nodes) {
      nodeMap.set(node.nodeId.value, node);
    }

    function convertNode(cdpNode: CDPAXNode, depth: number): AccessibilityNode | null {
      if (depth > 30) return null;
      if (cdpNode.ignored) return null;

      const role = cdpNode.role?.value ?? 'generic';
      if (role === 'none' || role === 'generic') {
        const hasChildren = (cdpNode.childIds?.length ?? 0) > 0;
        if (!hasChildren) return null;
      }

      const props: Record<string, unknown> = {};
      for (const p of cdpNode.properties ?? []) {
        props[p.name] = p.value?.value;
      }

      const children: AccessibilityNode[] = [];
      for (const childRef of cdpNode.childIds ?? []) {
        const childNode = nodeMap.get(childRef.value);
        if (childNode) {
          const converted = convertNode(childNode, depth + 1);
          if (converted) children.push(converted);
        }
      }

      return {
        nodeId: `ax-cdp-${cdpNode.nodeId.value}`,
        role,
        name: cdpNode.name?.value ?? '',
        description: cdpNode.description?.value,
        value: cdpNode.value?.value,
        checked: props['checked'] as boolean | undefined,
        disabled: props['disabled'] === true,
        focused: props['focused'] === true,
        visible: props['hidden'] !== true,
        bounds: { x: 0, y: 0, width: 0, height: 0 }, // CDP não fornece bounds no AX tree
        attributes: {},
        children,
      };
    }

    // O primeiro nó costuma ser o root do documento
    const rootNode = result.nodes[0];
    if (!rootNode) return null;

    return convertNode(rootNode, 0);
  } catch (err) {
    console.warn('[debugger-bridge] CDP falhou, usando fallback DOM:', err);
    return null;
  }
}
