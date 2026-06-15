import { delay, TYPE_CHAR_DELAY_MS, KEY_EVENT_DELAY_MS } from '../../shared/timing.js';

export async function typeText(el: HTMLElement, text: string, clearFirst = true): Promise<void> {
  el.focus();

  if (clearFirst && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  for (const char of text) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const start = el.selectionStart ?? el.value.length;
      el.value = el.value.substring(0, start) + char + el.value.substring(el.selectionEnd ?? start);
      el.selectionStart = el.selectionEnd = start + 1;
    }

    el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));

    await delay(TYPE_CHAR_DELAY_MS);
  }

  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function pressKey(el: HTMLElement, key: string): Promise<void> {
  el.focus();
  const opts: KeyboardEventInit = { key, bubbles: true, cancelable: true };
  if (key === 'Enter') opts.keyCode = 13;
  if (key === 'Tab') opts.keyCode = 9;
  if (key === 'Escape') opts.keyCode = 27;

  el.dispatchEvent(new KeyboardEvent('keydown', opts));
  await delay(KEY_EVENT_DELAY_MS);
  el.dispatchEvent(new KeyboardEvent('keyup', opts));

  if (key === 'Enter' && (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement)) {
    el.click();
  }
}

export function clearField(el: HTMLElement): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus();
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
