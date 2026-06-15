import { moveCursor } from '../overlay/cursor.js';
import { delay, CLICK_EVENT_DELAY_MS, DOUBLE_CLICK_DELAY_MS } from '../../shared/timing.js';

function dispatchMouseEvent(el: HTMLElement, type: string, x: number, y: number, button = 0) {
  el.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      buttons: button === 0 ? 1 : 0,
      button,
    })
  );
}

export async function clickAt(x: number, y: number, button: 'left' | 'right' | 'middle' = 'left'): Promise<void> {
  await moveCursor(x, y, 300);

  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return;

  el.focus();

  const btn = button === 'left' ? 0 : button === 'right' ? 2 : 1;
  dispatchMouseEvent(el, 'mousedown', x, y, btn);
  await delay(CLICK_EVENT_DELAY_MS);
  dispatchMouseEvent(el, 'mouseup', x, y, btn);
  await delay(CLICK_EVENT_DELAY_MS);
  dispatchMouseEvent(el, 'click', x, y, btn);

  // Para inputs e textareas, seleciona o conteúdo
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus();
    if ('select' in el) (el as HTMLInputElement).select();
  } else if (el instanceof HTMLAnchorElement || el instanceof HTMLButtonElement) {
    // Aciona o comportamento nativo também
    el.click();
  }
}

export async function doubleClickAt(x: number, y: number): Promise<void> {
  await clickAt(x, y);
  await delay(DOUBLE_CLICK_DELAY_MS);
  await clickAt(x, y);
}

export async function rightClickAt(x: number, y: number): Promise<void> {
  await clickAt(x, y, 'right');
}

export async function dragFrom(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  durationMs = 500
): Promise<void> {
  const el = document.elementFromPoint(fromX, fromY) as HTMLElement | null;
  if (!el) return;

  dispatchMouseEvent(el, 'mousedown', fromX, fromY);
  await moveCursor(toX, toY, durationMs);
  const target = document.elementFromPoint(toX, toY) as HTMLElement | null;
  (target ?? el).dispatchEvent(
    new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: toX, clientY: toY })
  );
}
