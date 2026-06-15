export type TTSBackend = 'web_speech' | 'external_api' | 'aria_only';

export interface TTSConfig {
  backend: TTSBackend;
  rate: number;
  lang: string;
  apiKey?: string;
}

export interface TTSService {
  speak(text: string, priority?: 'polite' | 'assertive'): Promise<void>;
  stop(): void;
}
