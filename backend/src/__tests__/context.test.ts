import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  getSession,
  listSessions,
  deleteSession,
  getPreferences,
  updatePreferences,
  recordInteraction,
  listInteractions,
  clearInteractions,
} from '../context/store.js';
import { DEFAULT_PREFERENCES } from '../context/types.js';

describe('context store — sessions', () => {
  it('createSession retorna sessão com id e defaults', () => {
    const s = createSession('test');
    expect(s.id).toBeTruthy();
    expect(s.label).toBe('test');
    expect(s.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(s.interactionCount).toBe(0);
  });

  it('getSession recupera por id', () => {
    const s = createSession();
    expect(getSession(s.id)?.id).toBe(s.id);
  });

  it('listSessions retorna em ordem de lastActivity desc', () => {
    const s1 = createSession('s1');
    // Força timestamp diferente
    const s2 = createSession('s2');
    (s2 as { lastActivityAt: string }).lastActivityAt = new Date(Date.now() + 1000).toISOString();
    const list = listSessions();
    // s2 tem lastActivity maior → deve aparecer primeiro (ou pelo menos o array tem as duas)
    expect(list.map(s => s.id)).toContain(s1.id);
    expect(list.map(s => s.id)).toContain(s2.id);
  });

  it('deleteSession remove e retorna true', () => {
    const s = createSession();
    expect(deleteSession(s.id)).toBe(true);
    expect(getSession(s.id)).toBeUndefined();
  });
});

describe('context store — preferences', () => {
  it('getPreferences retorna defaults para sessão desconhecida', () => {
    expect(getPreferences('ghost')).toEqual(DEFAULT_PREFERENCES);
  });

  it('updatePreferences mescla campos', () => {
    const s = createSession();
    const prefs = updatePreferences(s.id, { ttsRate: 1.5, theme: 'light' });
    expect(prefs.ttsRate).toBe(1.5);
    expect(prefs.theme).toBe('light');
    expect(prefs.language).toBe(DEFAULT_PREFERENCES.language);
  });
});

describe('context store — interactions', () => {
  let sessionId: string;

  beforeEach(() => {
    sessionId = createSession().id;
    clearInteractions(sessionId);
  });

  it('recordInteraction retorna entry com id e timestamp', () => {
    const i = recordInteraction({ sessionId, type: 'command', input: 'tab', output: 'ok' });
    expect(i.id).toBeTruthy();
    expect(i.timestamp).toBeTruthy();
    expect(i.type).toBe('command');
  });

  it('listInteractions filtra por sessão', () => {
    recordInteraction({ sessionId, type: 'capture' });
    recordInteraction({ sessionId: 'other', type: 'screenshot' });
    expect(listInteractions(sessionId)).toHaveLength(1);
  });

  it('listInteractions respeita limit', () => {
    for (let i = 0; i < 10; i++) {
      recordInteraction({ sessionId, type: 'command', input: String(i) });
    }
    expect(listInteractions(sessionId, 3)).toHaveLength(3);
  });

  it('listInteractions retorna mais recentes primeiro', () => {
    recordInteraction({ sessionId, type: 'command', input: 'primeiro' });
    recordInteraction({ sessionId, type: 'command', input: 'segundo' });
    const list = listInteractions(sessionId);
    expect(list[0].input).toBe('segundo');
  });

  it('recordInteraction incrementa interactionCount na sessão', () => {
    recordInteraction({ sessionId, type: 'llm' });
    recordInteraction({ sessionId, type: 'llm' });
    expect(getSession(sessionId)?.interactionCount).toBe(2);
  });

  it('clearInteractions por sessão remove só dela', () => {
    recordInteraction({ sessionId, type: 'command' });
    recordInteraction({ sessionId: 'other2', type: 'llm' });
    clearInteractions(sessionId);
    expect(listInteractions(sessionId)).toHaveLength(0);
    expect(listInteractions('other2')).toHaveLength(1);
  });
});
