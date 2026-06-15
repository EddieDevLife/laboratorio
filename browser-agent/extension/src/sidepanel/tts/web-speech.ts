import type { TTSService, TTSConfig } from './types.js';
import { AriaFallbackTTS } from './aria-fallback.js';

export class WebSpeechTTS implements TTSService {
  private config: TTSConfig;
  private fallback = new AriaFallbackTTS();

  constructor(config: TTSConfig) {
    this.config = config;
  }

  async speak(text: string, priority: 'polite' | 'assertive' = 'polite'): Promise<void> {
    if (!window.speechSynthesis) {
      return this.fallback.speak(text, priority);
    }

    if (priority === 'assertive') {
      window.speechSynthesis.cancel();
    }

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.config.lang;
      utterance.rate = this.config.rate;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  stop(): void {
    window.speechSynthesis?.cancel();
  }
}
