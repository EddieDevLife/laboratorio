// Cursor visual para debug — portado de useMouseControl.ts
let cursorEl: HTMLDivElement | null = null;

export function createCursor(): void {
  // Remove cursor anterior órfão (caso o script tenha sido re-injetado)
  const orphan = document.getElementById('__browser_agent_cursor__');
  if (orphan && orphan !== cursorEl) orphan.remove();

  if (cursorEl) return;

  cursorEl = document.createElement('div');
  cursorEl.id = '__browser_agent_cursor__';
  cursorEl.style.cssText = `
    position: fixed;
    width: 20px;
    height: 20px;
    border: 2px solid #ff3b30;
    border-radius: 50%;
    pointer-events: none;
    z-index: 2147483647;
    display: none;
    box-shadow: 0 0 6px rgba(255, 59, 48, 0.6);
    background: rgba(255, 59, 48, 0.15);
    transition: left 0.08s ease-out, top 0.08s ease-out;
  `;
  document.body.appendChild(cursorEl);
}

export function moveCursor(x: number, y: number, durationMs = 400): Promise<void> {
  return new Promise((resolve) => {
    createCursor();
    if (!cursorEl) { resolve(); return; }

    cursorEl.style.display = 'block';

    const startX = parseFloat(cursorEl.style.left || '0');
    const startY = parseFloat(cursorEl.style.top || '0');
    const startTime = performance.now();

    function animate(now: number) {
      if (!cursorEl) { resolve(); return; }

      const elapsed = now - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      // ease-out-cubic
      const ease = 1 - Math.pow(1 - t, 3);

      cursorEl.style.left = `${startX + (x - startX) * ease - 10}px`;
      cursorEl.style.top = `${startY + (y - startY) * ease - 10}px`;

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}

export function hideCursor(): void {
  if (cursorEl) cursorEl.style.display = 'none';
}

export function removeCursor(): void {
  cursorEl?.remove();
  cursorEl = null;
}
