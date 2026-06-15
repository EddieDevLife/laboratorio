// Mapeamento de tags HTML para roles ARIA implícitos
const TAG_ROLE_MAP: Record<string, string> = {
  a: 'link',
  article: 'article',
  aside: 'complementary',
  button: 'button',
  datalist: 'listbox',
  details: 'group',
  dialog: 'dialog',
  fieldset: 'group',
  figure: 'figure',
  footer: 'contentinfo',
  form: 'form',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  header: 'banner',
  hr: 'separator',
  img: 'img',
  input: 'textbox',
  li: 'listitem',
  main: 'main',
  menu: 'menu',
  nav: 'navigation',
  ol: 'list',
  option: 'option',
  output: 'status',
  progress: 'progressbar',
  search: 'search',
  section: 'region',
  select: 'combobox',
  summary: 'button',
  table: 'table',
  tbody: 'rowgroup',
  td: 'cell',
  textarea: 'textbox',
  th: 'columnheader',
  thead: 'rowgroup',
  tr: 'row',
  ul: 'list',
};

// Refinamentos por tipo de input
const INPUT_TYPE_ROLE_MAP: Record<string, string> = {
  button: 'button',
  checkbox: 'checkbox',
  color: 'textbox',
  date: 'textbox',
  email: 'textbox',
  file: 'button',
  image: 'button',
  number: 'spinbutton',
  radio: 'radio',
  range: 'slider',
  reset: 'button',
  search: 'searchbox',
  submit: 'button',
  tel: 'textbox',
  text: 'textbox',
  url: 'textbox',
};

export function getAriaRole(element: HTMLElement): string {
  const explicitRole = element.getAttribute('role');
  if (explicitRole) return explicitRole;

  const tag = element.tagName.toLowerCase();

  if (tag === 'input') {
    const type = (element as HTMLInputElement).type || 'text';
    return INPUT_TYPE_ROLE_MAP[type] || 'textbox';
  }

  return TAG_ROLE_MAP[tag] || 'generic';
}

export function getAccessibleName(element: HTMLElement): string {
  // aria-labelledby tem prioridade máxima
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ');
    if (label) return label;
  }

  // aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel?.trim()) return ariaLabel.trim();

  // <label for="id">
  if (element.id) {
    const labelEl = document.querySelector<HTMLLabelElement>(`label[for="${element.id}"]`);
    if (labelEl?.textContent?.trim()) return labelEl.textContent.trim();
  }

  // placeholder para inputs
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.placeholder) return element.placeholder;
  }

  // alt para imagens
  if (element instanceof HTMLImageElement && element.alt) return element.alt;

  // title
  const title = element.getAttribute('title');
  if (title?.trim()) return title.trim();

  // Conteúdo de texto (truncado)
  const text = element.textContent?.trim().replace(/\s+/g, ' ');
  if (text) return text.substring(0, 150);

  return '';
}

export function getAccessibleDescription(element: HTMLElement): string | undefined {
  const describedBy = element.getAttribute('aria-describedby');
  if (describedBy) {
    const desc = describedBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ');
    if (desc) return desc;
  }

  const ariaDesc = element.getAttribute('aria-description');
  if (ariaDesc?.trim()) return ariaDesc.trim();

  return undefined;
}

export function getCurrentValue(element: HTMLElement): string | undefined {
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') return undefined;
    return element.value || undefined;
  }
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value || undefined;
  }
  const ariaValue = element.getAttribute('aria-valuenow') ?? element.getAttribute('aria-valuetext');
  return ariaValue ?? undefined;
}

export function isChecked(element: HTMLElement): boolean | undefined {
  if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
    return element.checked;
  }
  const ariaChecked = element.getAttribute('aria-checked');
  if (ariaChecked === 'true') return true;
  if (ariaChecked === 'false') return false;
  return undefined;
}

export function isDisabled(element: HTMLElement): boolean {
  if ('disabled' in element && (element as HTMLButtonElement).disabled) return true;
  return element.getAttribute('aria-disabled') === 'true';
}

export function isFocusable(element: HTMLElement): boolean {
  if (isDisabled(element)) return false;
  const tabIndex = element.getAttribute('tabindex');
  if (tabIndex !== null) return parseInt(tabIndex, 10) >= 0;
  const tag = element.tagName.toLowerCase();
  return ['a', 'button', 'input', 'select', 'textarea', 'summary'].includes(tag);
}

export function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function getAriaAttributes(element: HTMLElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    if (attr.name.startsWith('aria-') || attr.name === 'role') {
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}
