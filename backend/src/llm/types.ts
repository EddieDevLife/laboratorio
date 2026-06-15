import type { MouseCommand } from '../mouse/types.js';

export interface LLMRequest {
  sessionId: string;
  instruction: string;     // linguagem natural do usuário
  domSnapshot?: unknown;   // DOMSnapshot serializado
  screenshotBase64?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface LLMResponse {
  reasoning: string;
  commands: MouseCommand[];
  narration: string;       // texto para TTS
  done: boolean;
  error?: string;
}

export interface LLMConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}
