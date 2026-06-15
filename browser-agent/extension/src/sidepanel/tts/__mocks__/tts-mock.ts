import type { TTSService } from '../types.js';

export interface MockTTSService extends TTSService {
  spoken: { text: string; priority: 'polite' | 'assertive' }[];
  lastFallback: 'aria' | null;
  stopCount: number;
}

export function createMockTTSService(opts?: { noSpeechSynthesis?: boolean }): MockTTSService {
  const svc: MockTTSService = {
    spoken: [],
    lastFallback: null,
    stopCount: 0,

    async speak(text, priority = 'polite') {
      if (opts?.noSpeechSynthesis) {
        svc.lastFallback = 'aria';
      }
      if (priority === 'assertive') {
        svc.stop();
      }
      svc.spoken.push({ text, priority });
    },

    stop() {
      svc.stopCount++;
    },
  };
  return svc;
}
