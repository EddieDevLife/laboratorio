import { describe, it, expect, vi } from 'vitest';
import { createMockTTSService } from '../__mocks__/tts-mock.js';

describe('TTS — contrato do MockTTSService', () => {
  it('speak() resolve sem erro', async () => {
    const svc = createMockTTSService();
    await expect(svc.speak('Navegando para google.com')).resolves.toBeUndefined();
  });

  it('registra texto falado', async () => {
    const svc = createMockTTSService();
    await svc.speak('Clicando em Pesquisar');
    expect(svc.spoken[0]).toEqual({ text: 'Clicando em Pesquisar', priority: 'polite' });
  });

  it('speak() com priority assertive chama stop() antes', async () => {
    const svc = createMockTTSService();
    const stopSpy = vi.spyOn(svc, 'stop');
    await svc.speak('texto longo');
    await svc.speak('urgente', 'assertive');
    expect(stopSpy).toHaveBeenCalledOnce();
  });

  it('fallback para aria quando speechSynthesis ausente', async () => {
    const svc = createMockTTSService({ noSpeechSynthesis: true });
    await svc.speak('texto');
    expect(svc.lastFallback).toBe('aria');
  });

  it('stop() não lança erro', () => {
    const svc = createMockTTSService();
    expect(() => svc.stop()).not.toThrow();
  });
});
