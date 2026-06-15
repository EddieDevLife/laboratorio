export interface Announcer {
  announce(text: string, priority?: 'polite' | 'assertive'): void;
}

export function useAnnouncer(): Announcer {
  function announce(text: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const id = priority === 'assertive' ? 'agent-live-assertive' : 'agent-live-polite';
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = text; });
  }

  return { announce };
}
