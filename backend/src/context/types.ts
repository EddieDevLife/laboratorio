export interface UserPreferences {
  language: string;         // 'pt-BR'
  theme: 'dark' | 'light';
  ttsEnabled: boolean;
  ttsRate: number;
  autoCapture: boolean;     // captura DOM automaticamente ao navegar
  screenshotFormat: 'png' | 'jpeg' | 'webp';
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'pt-BR',
  theme: 'dark',
  ttsEnabled: true,
  ttsRate: 1.1,
  autoCapture: false,
  screenshotFormat: 'png',
};

export interface Interaction {
  id: string;
  sessionId: string;
  timestamp: string;
  type: 'command' | 'click' | 'navigate' | 'capture' | 'screenshot' | 'llm';
  input?: string;
  output?: string;
  metadata?: Record<string, unknown>;
  durationMs?: number;
}

export interface Session {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  label?: string;
  preferences: UserPreferences;
  interactionCount: number;
}
