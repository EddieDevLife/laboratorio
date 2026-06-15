import type { TTSConfig, TTSService } from './types.js';
import { WebSpeechTTS } from './web-speech.js';
import { AriaFallbackTTS } from './aria-fallback.js';

export type { TTSConfig, TTSService, TTSBackend } from './types.js';

const DEFAULT_CONFIG: TTSConfig = {
  backend: 'web_speech',
  rate: 1.1,
  lang: 'pt-BR',
};

let _service: TTSService | null = null;

async function getService(): Promise<TTSService> {
  if (_service) return _service;
  const config = await getTTSConfig();

  if (config.backend === 'aria_only') {
    _service = new AriaFallbackTTS();
  } else {
    // web_speech and external_api both use WebSpeechTTS
    // (external_api placeholder — future implementation)
    _service = new WebSpeechTTS(config);
  }
  return _service;
}

export async function speak(text: string, priority?: 'polite' | 'assertive'): Promise<void> {
  const svc = await getService();
  return svc.speak(text, priority);
}

export function stopSpeech(): void {
  _service?.stop();
}

export async function getTTSConfig(): Promise<TTSConfig> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['tts_backend', 'tts_rate', 'tts_lang', 'tts_api_key'], (result) => {
      resolve({
        backend: (result['tts_backend'] as TTSConfig['backend']) ?? DEFAULT_CONFIG.backend,
        rate: (result['tts_rate'] as number) ?? DEFAULT_CONFIG.rate,
        lang: (result['tts_lang'] as string) ?? DEFAULT_CONFIG.lang,
        apiKey: result['tts_api_key'] as string | undefined,
      });
    });
  });
}

export async function saveTTSConfig(config: Partial<TTSConfig>): Promise<void> {
  _service = null; // reset so next call re-creates with new config
  const data: Record<string, unknown> = {};
  if (config.backend !== undefined) data['tts_backend'] = config.backend;
  if (config.rate !== undefined) data['tts_rate'] = config.rate;
  if (config.lang !== undefined) data['tts_lang'] = config.lang;
  if (config.apiKey !== undefined) data['tts_api_key'] = config.apiKey;
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}
