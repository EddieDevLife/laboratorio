import { useEffect } from 'react';

export interface ShortcutMap {
  'ctrl+enter': () => void;
  'escape': () => void;
  'alt+t': () => void;
  'alt+s': () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        shortcuts['ctrl+enter']();
      } else if (e.key === 'Escape') {
        shortcuts['escape']();
      } else if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        shortcuts['alt+t']();
      } else if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        shortcuts['alt+s']();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [shortcuts]);
}
