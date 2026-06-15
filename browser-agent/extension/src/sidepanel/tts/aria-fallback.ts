import type { TTSService } from './types.js';

export class AriaFallbackTTS implements TTSService {
  async speak(text: string, priority: 'polite' | 'assertive' = 'polite'): Promise<void> {
    const id = priority === 'assertive' ? 'agent-live-assertive' : 'agent-live-polite';
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = text; });
  }

  stop(): void {
    // ARIA announcements cannot be cancelled — no-op
  }
}
