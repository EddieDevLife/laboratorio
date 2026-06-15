import { useState, useCallback, useRef } from 'react';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type KeySimulated = 'Tab' | 'Enter' | 'Escape' | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Space';

export interface FocusedElement {
  uid: string;
  tag: string;
  role: string;
  name: string;
  tabIndex: number;
  order: number;           // posição na ordem de tab (1-based)
  path: string;            // CSS-selector-like path
  bounds: { x: number; y: number; width: number; height: number } | null;
  state: ElementState;
}

export interface ElementState {
  focused: boolean;
  disabled: boolean;
  checked?: boolean;
  selected?: boolean;
  expanded?: boolean;
  pressed?: boolean;
  readonly: boolean;
  required: boolean;
  invalid: boolean;
  hidden: boolean;
  value?: string;
  placeholder?: string;
}

export interface KeyEvent {
  id: string;
  key: KeySimulated;
  timestamp: string;
  fromElement: FocusedElement | null;
  toElement: FocusedElement | null;
  effect: string;
}

export interface UseKeyboardNavReturn {
  currentFocus: FocusedElement | null;
  tabOrder: FocusedElement[];
  keyHistory: KeyEvent[];
  navigating: boolean;
  // Navegação
  pressTab: (shift?: boolean) => void;
  pressEnter: () => void;
  pressEscape: () => void;
  pressArrow: (direction: 'up' | 'down' | 'left' | 'right') => void;
  pressSpace: () => void;
  focusElement: (uid: string) => void;
  // Análise
  buildTabOrder: () => FocusedElement[];
  getElementState: (el: Element) => ElementState;
  clearHistory: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeId() {
  return `kev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

function getPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body && parts.length < 4) {
    let seg = cur.tagName.toLowerCase();
    if (cur.id) { seg += `#${cur.id}`; parts.unshift(seg); break; }
    const cls = Array.from(cur.classList).slice(0, 2).join('.');
    if (cls) seg += `.${cls}`;
    parts.unshift(seg);
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}

function getRole(el: Element): string {
  const aria = el.getAttribute('aria-role') ?? el.getAttribute('role');
  if (aria) return aria;
  const tag = el.tagName.toLowerCase();
  const type = (el as HTMLInputElement).type?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    button: 'button', a: 'link', select: 'combobox',
    textarea: 'textbox', h1: 'heading', h2: 'heading',
    h3: 'heading', nav: 'navigation', main: 'main',
    ul: 'list', ol: 'list', li: 'listitem',
    table: 'table', tr: 'row', td: 'cell', th: 'columnheader',
  };
  if (tag === 'input') {
    const inputMap: Record<string, string> = {
      checkbox: 'checkbox', radio: 'radio', range: 'slider',
      search: 'searchbox', submit: 'button', button: 'button',
      reset: 'button', number: 'spinbutton',
    };
    return inputMap[type] ?? 'textbox';
  }
  return map[tag] ?? tag;
}

function getAccessibleName(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const names = labelledBy.split(' ')
      .map(id => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (names.length) return names.join(' ');
  }
  const htmlEl = el as HTMLElement;
  if (el.id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${el.id}"]`);
    if (label) return label.textContent?.trim() ?? '';
  }
  const title = el.getAttribute('title');
  if (title) return title;
  const alt = (el as HTMLImageElement).alt;
  if (alt) return alt;
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) return placeholder;
  return htmlEl.textContent?.trim().slice(0, 60) ?? '';
}

function getElementState(el: Element): ElementState {
  const htmlEl = el as HTMLInputElement;
  const computedStyle = window.getComputedStyle(el);
  const ariaHidden = el.getAttribute('aria-hidden') === 'true';
  return {
    focused: document.activeElement === el,
    disabled: htmlEl.disabled ?? el.getAttribute('aria-disabled') === 'true',
    checked: htmlEl.type === 'checkbox' || htmlEl.type === 'radio'
      ? htmlEl.checked
      : el.getAttribute('aria-checked') !== null
        ? el.getAttribute('aria-checked') === 'true'
        : undefined,
    selected: el.getAttribute('aria-selected') !== null
      ? el.getAttribute('aria-selected') === 'true'
      : undefined,
    expanded: el.getAttribute('aria-expanded') !== null
      ? el.getAttribute('aria-expanded') === 'true'
      : undefined,
    pressed: el.getAttribute('aria-pressed') !== null
      ? el.getAttribute('aria-pressed') === 'true'
      : undefined,
    readonly: (htmlEl as HTMLInputElement).readOnly ?? el.getAttribute('aria-readonly') === 'true',
    required: (htmlEl as HTMLInputElement).required ?? el.getAttribute('aria-required') === 'true',
    invalid: el.getAttribute('aria-invalid') === 'true',
    hidden: computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || ariaHidden,
    value: htmlEl.value !== undefined ? htmlEl.value : undefined,
    placeholder: (htmlEl as HTMLInputElement).placeholder || undefined,
  };
}

const FOCUSABLE_SELECTORS = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])', '[contenteditable="true"]',
  'details > summary',
].join(', ');

function buildTabOrder(): FocusedElement[] {
  const candidates = Array.from(document.querySelectorAll<Element>(FOCUSABLE_SELECTORS))
    .filter(el => {
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    });

  // Sort: explicit tabindex > 0 first (ascending), then tabindex === 0 in DOM order
  const withIndex = candidates.map(el => ({
    el,
    ti: parseInt(el.getAttribute('tabindex') ?? '0', 10) || 0,
  }));

  withIndex.sort((a, b) => {
    if (a.ti > 0 && b.ti > 0) return a.ti - b.ti;
    if (a.ti > 0) return -1;
    if (b.ti > 0) return 1;
    return 0;  // keep DOM order for ti === 0
  });

  return withIndex.map(({ el }, i) => {
    const rect = el.getBoundingClientRect();
    return {
      uid: el.id || `tab-${i}`,
      tag: el.tagName.toLowerCase(),
      role: getRole(el),
      name: getAccessibleName(el),
      tabIndex: parseInt(el.getAttribute('tabindex') ?? '0', 10) || 0,
      order: i + 1,
      path: getPath(el),
      bounds: rect.width > 0 ? { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } : null,
      state: getElementState(el),
    };
  });
}

function snapshotFocused(order: number): FocusedElement | null {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const rect = el.getBoundingClientRect();
  return {
    uid: el.id || `focused`,
    tag: el.tagName.toLowerCase(),
    role: getRole(el),
    name: getAccessibleName(el),
    tabIndex: parseInt(el.getAttribute('tabindex') ?? '0', 10) || 0,
    order,
    path: getPath(el),
    bounds: rect.width > 0 ? { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } : null,
    state: getElementState(el),
  };
}

function describeEffect(key: KeySimulated, from: FocusedElement | null, to: FocusedElement | null): string {
  if (key === 'Tab') {
    if (!to) return 'Foco saiu da página';
    return to.order > (from?.order ?? 0)
      ? `Foco moveu para ${to.role} "${to.name || to.tag}" (ordem ${to.order})`
      : `Foco voltou para ${to.role} "${to.name || to.tag}" (ordem ${to.order})`;
  }
  if (key === 'Enter') {
    if (from?.role === 'button' || from?.role === 'link') return `Ativou ${from.role} "${from.name}"`;
    if (from?.role === 'textbox' || from?.role === 'searchbox') return 'Submeteu formulário / próxima linha';
    return 'Enter pressionado';
  }
  if (key === 'Escape') return 'Escape: fechou diálogo / cancelou';
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) {
    return to ? `Seta: moveu para "${to.name || to.tag}"` : `Seta ${key} pressionada`;
  }
  if (key === 'Space') {
    if (from?.role === 'checkbox') return `Checkbox ${from.state.checked ? 'desmarcado' : 'marcado'}`;
    if (from?.role === 'button') return `Botão "${from.name}" ativado`;
    return 'Space pressionado';
  }
  return `${key} pressionado`;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useKeyboardNav(): UseKeyboardNavReturn {
  const [currentFocus, setCurrentFocus] = useState<FocusedElement | null>(null);
  const [tabOrder, setTabOrder] = useState<FocusedElement[]>([]);
  const [keyHistory, setKeyHistory] = useState<KeyEvent[]>([]);
  const [navigating, setNavigating] = useState(false);
  const orderRef = useRef(0);

  const pushEvent = useCallback((key: KeySimulated, from: FocusedElement | null, to: FocusedElement | null) => {
    const ev: KeyEvent = {
      id: makeId(),
      key,
      timestamp: new Date().toISOString(),
      fromElement: from,
      toElement: to,
      effect: describeEffect(key, from, to),
    };
    setKeyHistory(prev => [ev, ...prev].slice(0, 50));
    if (to) setCurrentFocus(to);
  }, []);

  const dispatchKey = useCallback((key: string, opts: KeyboardEventInit = {}) => {
    const target = document.activeElement ?? document.body;
    ['keydown', 'keyup'].forEach(type => {
      target.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...opts }));
    });
  }, []);

  const pressTab = useCallback((shift = false) => {
    const from = snapshotFocused(orderRef.current);
    dispatchKey('Tab', { shiftKey: shift });

    // Let the browser move focus, then read new activeElement
    setTimeout(() => {
      orderRef.current += shift ? -1 : 1;
      const to = snapshotFocused(orderRef.current);
      pushEvent('Tab', from, to);
    }, 30);
  }, [dispatchKey, pushEvent]);

  const pressEnter = useCallback(() => {
    const from = snapshotFocused(orderRef.current);
    dispatchKey('Enter');
    setTimeout(() => {
      const to = snapshotFocused(orderRef.current);
      pushEvent('Enter', from, to);
    }, 50);
  }, [dispatchKey, pushEvent]);

  const pressEscape = useCallback(() => {
    const from = snapshotFocused(orderRef.current);
    dispatchKey('Escape');
    setTimeout(() => {
      const to = snapshotFocused(orderRef.current);
      pushEvent('Escape', from, to);
    }, 50);
  }, [dispatchKey, pushEvent]);

  const pressArrow = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const keyMap = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const;
    const key = keyMap[direction];
    const from = snapshotFocused(orderRef.current);
    dispatchKey(key);
    setTimeout(() => {
      const to = snapshotFocused(orderRef.current);
      pushEvent(key, from, to);
    }, 30);
  }, [dispatchKey, pushEvent]);

  const pressSpace = useCallback(() => {
    const from = snapshotFocused(orderRef.current);
    dispatchKey(' ');
    setTimeout(() => {
      const to = snapshotFocused(orderRef.current);
      pushEvent('Space', from, to);
    }, 30);
  }, [dispatchKey, pushEvent]);

  const focusElement = useCallback((uid: string) => {
    const el = document.getElementById(uid) ?? document.querySelector(`[data-uid="${uid}"]`);
    if (!el) return;
    (el as HTMLElement).focus();
    setTimeout(() => {
      const focused = snapshotFocused(orderRef.current);
      if (focused) setCurrentFocus(focused);
    }, 30);
  }, []);

  const buildTabOrderFn = useCallback((): FocusedElement[] => {
    setNavigating(true);
    const order = buildTabOrder();
    setTabOrder(order);
    orderRef.current = 0;
    setNavigating(false);
    return order;
  }, []);

  const getElementStateFn = useCallback((el: Element): ElementState => getElementState(el), []);

  const clearHistory = useCallback(() => setKeyHistory([]), []);

  return {
    currentFocus,
    tabOrder,
    keyHistory,
    navigating,
    pressTab,
    pressEnter,
    pressEscape,
    pressArrow,
    pressSpace,
    focusElement,
    buildTabOrder: buildTabOrderFn,
    getElementState: getElementStateFn,
    clearHistory,
  };
}
