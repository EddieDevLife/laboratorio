import { v4 as uuidv4 } from 'uuid';
import type { Interaction, Session, UserPreferences } from './types.js';
import { DEFAULT_PREFERENCES } from './types.js';

const MAX_INTERACTIONS = 500;

const sessions = new Map<string, Session>();
const interactions: Interaction[] = [];

// ── Sessions ───────────────────────────────────────────────────────────────────

export function createSession(label?: string): Session {
  const now = new Date().toISOString();
  const session: Session = {
    id: uuidv4(),
    createdAt: now,
    lastActivityAt: now,
    label,
    preferences: { ...DEFAULT_PREFERENCES },
    interactionCount: 0,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function listSessions(): Session[] {
  return Array.from(sessions.values()).sort(
    (a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt),
  );
}

export function touchSession(id: string): void {
  const s = sessions.get(id);
  if (s) s.lastActivityAt = new Date().toISOString();
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id);
}

// ── Preferences ────────────────────────────────────────────────────────────────

export function getPreferences(sessionId: string): UserPreferences {
  return sessions.get(sessionId)?.preferences ?? { ...DEFAULT_PREFERENCES };
}

export function updatePreferences(
  sessionId: string,
  patch: Partial<UserPreferences>,
): UserPreferences {
  let session = sessions.get(sessionId);
  if (!session) {
    session = createSession();
  }
  session.preferences = { ...session.preferences, ...patch };
  return session.preferences;
}

// ── Interactions ───────────────────────────────────────────────────────────────

export function recordInteraction(
  data: Omit<Interaction, 'id' | 'timestamp'>,
): Interaction {
  const interaction: Interaction = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...data,
  };

  interactions.push(interaction);
  if (interactions.length > MAX_INTERACTIONS) {
    interactions.splice(0, interactions.length - MAX_INTERACTIONS);
  }

  touchSession(data.sessionId);
  const s = sessions.get(data.sessionId);
  if (s) s.interactionCount++;

  return interaction;
}

export function listInteractions(sessionId?: string, limit = 50): Interaction[] {
  const all = sessionId
    ? interactions.filter(i => i.sessionId === sessionId)
    : interactions;
  return all.slice(-limit).reverse();
}

export function clearInteractions(sessionId?: string): number {
  if (!sessionId) {
    const count = interactions.length;
    interactions.splice(0);
    return count;
  }
  let count = 0;
  for (let i = interactions.length - 1; i >= 0; i--) {
    if (interactions[i].sessionId === sessionId) {
      interactions.splice(i, 1);
      count++;
    }
  }
  return count;
}
