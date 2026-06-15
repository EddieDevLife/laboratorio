// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ARIAAttributes {
  label?: string;
  labelledby?: string;
  describedby?: string;
  description?: string;
  role?: string;
  expanded?: boolean;
  checked?: boolean | 'mixed';
  selected?: boolean;
  disabled?: boolean;
  required?: boolean;
  hidden?: boolean;
  live?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  relevant?: string;
  haspopup?: string;
  invalid?: string | boolean;
  autocomplete?: string;
  multiselectable?: boolean;
  orientation?: string;
  valuemin?: number;
  valuemax?: number;
  valuenow?: number;
  valuetext?: string;
  level?: number;
  setsize?: number;
  posinset?: number;
  controls?: string;
  owns?: string;
  flowto?: string;
  [key: string]: unknown;
}

export type InteractiveReason =
  | 'tag'           // button, a, input, select, textarea
  | 'role'          // aria role implica interatividade
  | 'tabindex'      // tabindex >= 0
  | 'handler'       // onclick, onkeydown presentes
  | 'editable'      // contenteditable
  | 'draggable';    // draggable=true

export interface DOMNode {
  uid: string;
  tag: string;
  id?: string;
  classes: string[];
  role: string;
  name: string;
  description?: string;
  value?: string;
  interactive: boolean;
  interactiveReason?: InteractiveReason;
  focusable: boolean;
  visible: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  aria: ARIAAttributes;
  tabIndex?: number;
  children: DOMNode[];
}

export interface DOMSnapshot {
  capturedAt: string;
  url: string;
  title: string;
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  totalNodes: number;
  interactiveCount: number;
  focusableCount: number;
  tree: DOMNode;
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const INTERACTIVE_TAGS = new Set([
  'a', 'button', 'input', 'select', 'textarea', 'details', 'summary',
]);

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'textbox', 'searchbox', 'combobox', 'listbox',
  'checkbox', 'radio', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'tab', 'option', 'switch', 'slider', 'spinbutton', 'treeitem',
  'gridcell', 'rowheader', 'columnheader',
]);

const TAG_TO_ROLE: Record<string, string> = {
  a: 'link',
  button: 'button',
  input: 'textbox',
  textarea: 'textbox',
  select: 'combobox',
  img: 'img',
  h1: 'heading', h2: 'heading', h3: 'heading',
  h4: 'heading', h5: 'heading', h6: 'heading',
  form: 'form',
  nav: 'navigation',
  main: 'main',
  section: 'region',
  article: 'article',
  header: 'banner',
  footer: 'contentinfo',
  aside: 'complementary',
  ul: 'list', ol: 'list', li: 'listitem',
  table: 'table', tr: 'row', th: 'columnheader', td: 'cell',
  dialog: 'dialog',
  details: 'group',
  summary: 'button',
  figure: 'figure',
  menu: 'menu',
};

const SKIP_TAGS = new Set([
  'script', 'style', 'meta', 'link', 'head', 'noscript', 'template', 'svg', 'path',
]);

let uidCounter = 0;

function makeUID(): string {
  return `dom-${++uidCounter}`;
}

// ── Funções de extração ────────────────────────────────────────────────────────

export function extractARIA(el: HTMLElement): ARIAAttributes {
  const attrs: ARIAAttributes = {};

  // Iterar todos os atributos aria-*
  for (const attr of Array.from(el.attributes)) {
    if (!attr.name.startsWith('aria-')) continue;
    const key = attr.name.slice(5) as keyof ARIAAttributes; // remove "aria-"
    const raw = attr.value;

    // Converter para tipo adequado
    if (key === 'expanded' || key === 'selected' || key === 'disabled'
      || key === 'required' || key === 'hidden' || key === 'atomic'
      || key === 'multiselectable') {
      (attrs as Record<string, unknown>)[key] = raw === 'true';
    } else if (key === 'checked') {
      attrs.checked = raw === 'mixed' ? 'mixed' : raw === 'true';
    } else if (['valuemin', 'valuemax', 'valuenow', 'level', 'setsize', 'posinset'].includes(key as string)) {
      (attrs as Record<string, unknown>)[key] = parseFloat(raw);
    } else {
      (attrs as Record<string, unknown>)[key] = raw;
    }
  }

  return attrs;
}

export function getAccessibleName(el: HTMLElement): string {
  // 1. aria-labelledby (mais alta precedência)
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const parts = labelledby.split(/\s+/)
      .map(id => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(' ');
  }

  // 2. aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return ariaLabel.trim();

  // 3. label element associado (for=id)
  if (el.id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${el.id}"]`);
    if (label) return label.textContent?.trim() ?? '';
  }

  // 4. label wrapper
  const parentLabel = el.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input,select,textarea').forEach(n => n.remove());
    const text = clone.textContent?.trim();
    if (text) return text;
  }

  // 5. title
  const title = el.getAttribute('title');
  if (title?.trim()) return title.trim();

  // 6. alt (imagens)
  if (el instanceof HTMLImageElement && el.alt) return el.alt;

  // 7. placeholder
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.placeholder) return el.placeholder;
    if (el.value) return el.value.substring(0, 80);
  }

  // 8. texto interno (truncado)
  const text = el.textContent?.trim().replace(/\s+/g, ' ');
  return text?.substring(0, 100) ?? '';
}

export function getAccessibleDescription(el: HTMLElement): string | undefined {
  const describedby = el.getAttribute('aria-describedby');
  if (describedby) {
    const parts = describedby.split(/\s+/)
      .map(id => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  const desc = el.getAttribute('aria-description');
  return desc?.trim() || undefined;
}

export function getRole(el: HTMLElement): string {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;

  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type;
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'range') return 'slider';
    if (type === 'number') return 'spinbutton';
    if (type === 'search') return 'searchbox';
    if (type === 'submit' || type === 'reset' || type === 'button') return 'button';
  }

  return TAG_TO_ROLE[tag] ?? 'generic';
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return false;
  const tag = el.tagName.toLowerCase();
  if (INTERACTIVE_TAGS.has(tag) && tag !== 'a') return true;
  if (tag === 'a' && el.hasAttribute('href')) return true;
  const tabIndex = el.getAttribute('tabindex');
  if (tabIndex !== null && parseInt(tabIndex) >= 0) return true;
  if (el.isContentEditable) return true;
  return false;
}

function getInteractiveReason(el: HTMLElement): InteractiveReason | undefined {
  const tag = el.tagName.toLowerCase();
  if (INTERACTIVE_TAGS.has(tag)) return 'tag';
  const role = getRole(el);
  if (INTERACTIVE_ROLES.has(role)) return 'role';
  const tabIndex = el.getAttribute('tabindex');
  if (tabIndex !== null && parseInt(tabIndex) >= 0) return 'tabindex';
  if (el.hasAttribute('onclick') || el.hasAttribute('onkeydown')) return 'handler';
  if (el.isContentEditable) return 'editable';
  if (el.getAttribute('draggable') === 'true') return 'draggable';
  return undefined;
}

function getCurrentValue(el: HTMLElement): string | undefined {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return el.value || undefined;
  }
  return undefined;
}

// ── Construção da árvore ────────────────────────────────────────────────────────

function buildNode(
  el: HTMLElement,
  depth: number,
  stats: { total: number; interactive: number; focusable: number },
): DOMNode | null {
  if (depth > 25) return null;
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return null;

  const visible = isVisible(el);
  const focusable = isFocusable(el);
  const interactiveReason = getInteractiveReason(el);
  const interactive = interactiveReason !== undefined;
  const role = getRole(el);
  const name = getAccessibleName(el);
  const aria = extractARIA(el);
  const rect = el.getBoundingClientRect();
  const tabIndex = el.getAttribute('tabindex') !== null ? el.tabIndex : undefined;

  stats.total++;
  if (interactive) stats.interactive++;
  if (focusable) stats.focusable++;

  const children: DOMNode[] = [];
  for (const child of Array.from(el.children)) {
    const childNode = buildNode(child as HTMLElement, depth + 1, stats);
    if (childNode) children.push(childNode);
  }

  return {
    uid: makeUID(),
    tag,
    id: el.id || undefined,
    classes: Array.from(el.classList),
    role,
    name,
    description: getAccessibleDescription(el),
    value: getCurrentValue(el),
    interactive,
    interactiveReason,
    focusable,
    visible,
    bounds: {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    aria,
    tabIndex,
    children,
  };
}

// ── Hook ────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';

export function useDOMCapture() {
  const [snapshot, setSnapshot] = useState<DOMSnapshot | null>(null);
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback((): DOMSnapshot => {
    setCapturing(true);
    uidCounter = 0;

    const stats = { total: 0, interactive: 0, focusable: 0 };
    const tree = buildNode(document.documentElement, 0, stats)!;

    const snap: DOMSnapshot = {
      capturedAt: new Date().toISOString(),
      url: window.location.href,
      title: document.title,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      totalNodes: stats.total,
      interactiveCount: stats.interactive,
      focusableCount: stats.focusable,
      tree,
    };

    setSnapshot(snap);
    setCapturing(false);
    return snap;
  }, []);

  const serializeToJSON = useCallback((pretty = true): string => {
    if (!snapshot) return '{}';
    return JSON.stringify(snapshot, null, pretty ? 2 : 0);
  }, [snapshot]);

  const downloadJSON = useCallback(() => {
    if (!snapshot) return;
    const json = serializeToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dom-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [snapshot, serializeToJSON]);

  const copyJSON = useCallback(async (): Promise<void> => {
    if (!snapshot) return;
    await navigator.clipboard.writeText(serializeToJSON());
  }, [snapshot, serializeToJSON]);

  const getInteractiveElements = useCallback((): DOMNode[] => {
    if (!snapshot) return [];
    const result: DOMNode[] = [];
    function traverse(node: DOMNode) {
      if (node.interactive && node.visible) result.push(node);
      node.children.forEach(traverse);
    }
    traverse(snapshot.tree);
    return result;
  }, [snapshot]);

  const getFocusableElements = useCallback((): DOMNode[] => {
    if (!snapshot) return [];
    const result: DOMNode[] = [];
    function traverse(node: DOMNode) {
      if (node.focusable && node.visible) result.push(node);
      node.children.forEach(traverse);
    }
    traverse(snapshot.tree);
    return result;
  }, [snapshot]);

  const findByRole = useCallback((role: string): DOMNode[] => {
    if (!snapshot) return [];
    const result: DOMNode[] = [];
    function traverse(node: DOMNode) {
      if (node.role === role) result.push(node);
      node.children.forEach(traverse);
    }
    traverse(snapshot.tree);
    return result;
  }, [snapshot]);

  const findByName = useCallback((query: string): DOMNode[] => {
    if (!snapshot) return [];
    const q = query.toLowerCase();
    const result: DOMNode[] = [];
    function traverse(node: DOMNode) {
      if (node.name.toLowerCase().includes(q)) result.push(node);
      node.children.forEach(traverse);
    }
    traverse(snapshot.tree);
    return result;
  }, [snapshot]);

  return {
    snapshot,
    capturing,
    capture,
    serializeToJSON,
    downloadJSON,
    copyJSON,
    getInteractiveElements,
    getFocusableElements,
    findByRole,
    findByName,
  };
}
