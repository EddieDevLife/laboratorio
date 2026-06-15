import { useState, useCallback } from 'react';

export type ActionType = 'dom' | 'vision' | 'mouse' | 'llm' | 'screenshot' | 'capture' | 'command';

export interface ActionEntry {
  id: string;
  type: ActionType;
  label: string;
  detail?: string;
  timestamp: string;
  durationMs?: number;
}

const MAX = 100;

export function useActionHistory() {
  const [actions, setActions] = useState<ActionEntry[]>([]);

  const push = useCallback((entry: Omit<ActionEntry, 'id' | 'timestamp'>) => {
    setActions(prev => {
      const next: ActionEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        ...entry,
      };
      const updated = [next, ...prev];
      return updated.length > MAX ? updated.slice(0, MAX) : updated;
    });
  }, []);

  const clear = useCallback(() => setActions([]), []);

  return { actions, push, clear };
}
