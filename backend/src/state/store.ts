import { v4 as uuidv4 } from 'uuid';
import type { DOMSnapshot, StateChange, StateDiff, StateStore } from './types.js';

const MAX_SNAPSHOTS = 50;
const MAX_CHANGES = 200;

const store: StateStore = {
  snapshots: new Map(),
  changes: [],
};

// ── Snapshots ──────────────────────────────────────────────────────────────────

export function saveSnapshot(
  sessionId: string,
  data: Omit<DOMSnapshot, 'id' | 'sessionId' | 'capturedAt'>,
): DOMSnapshot {
  const snapshot: DOMSnapshot = {
    id: uuidv4(),
    sessionId,
    capturedAt: new Date().toISOString(),
    ...data,
  };

  store.snapshots.set(snapshot.id, snapshot);

  // Enforce size limit — drop oldest
  if (store.snapshots.size > MAX_SNAPSHOTS) {
    const oldest = store.snapshots.keys().next().value;
    if (oldest) store.snapshots.delete(oldest);
  }

  return snapshot;
}

export function getSnapshot(id: string): DOMSnapshot | undefined {
  return store.snapshots.get(id);
}

export function listSnapshots(sessionId?: string): DOMSnapshot[] {
  const all = Array.from(store.snapshots.values());
  return sessionId ? all.filter(s => s.sessionId === sessionId) : all;
}

export function deleteSnapshot(id: string): boolean {
  return store.snapshots.delete(id);
}

export function clearSnapshots(sessionId?: string): number {
  if (!sessionId) {
    const count = store.snapshots.size;
    store.snapshots.clear();
    return count;
  }
  let count = 0;
  for (const [id, snap] of store.snapshots) {
    if (snap.sessionId === sessionId) {
      store.snapshots.delete(id);
      count++;
    }
  }
  return count;
}

// ── Diff / changes ─────────────────────────────────────────────────────────────

export function computeDiff(from: DOMSnapshot | null, to: DOMSnapshot): StateDiff {
  if (!from) {
    return {
      added: [],
      removed: [],
      changed: [],
      summary: `Primeiro snapshot: ${to.stats.total} elementos capturados em ${to.url}`,
    };
  }

  // Simple URL-based diff for now; deep tree diff would require stable UIDs
  const urlChanged = from.url !== to.url;
  const totalDelta = to.stats.total - from.stats.total;
  const interactiveDelta = to.stats.interactive - from.stats.interactive;

  const parts: string[] = [];
  if (urlChanged) parts.push(`URL mudou de ${from.url} para ${to.url}`);
  if (totalDelta > 0) parts.push(`+${totalDelta} elementos`);
  if (totalDelta < 0) parts.push(`${totalDelta} elementos removidos`);
  if (interactiveDelta !== 0) parts.push(`${interactiveDelta > 0 ? '+' : ''}${interactiveDelta} interativos`);
  if (parts.length === 0) parts.push('Sem mudanças detectadas');

  return {
    added: [],
    removed: [],
    changed: [],
    summary: parts.join(' · '),
  };
}

export function recordChange(
  sessionId: string,
  fromSnapshotId: string | null,
  toSnapshotId: string,
  diff: StateDiff,
): StateChange {
  const change: StateChange = {
    id: uuidv4(),
    sessionId,
    timestamp: new Date().toISOString(),
    fromSnapshotId,
    toSnapshotId,
    diff,
  };

  store.changes.push(change);
  if (store.changes.length > MAX_CHANGES) {
    store.changes.splice(0, store.changes.length - MAX_CHANGES);
  }

  return change;
}

export function listChanges(sessionId?: string): StateChange[] {
  return sessionId
    ? store.changes.filter(c => c.sessionId === sessionId)
    : store.changes;
}

export function getLatestSnapshot(sessionId: string): DOMSnapshot | null {
  const snaps = listSnapshots(sessionId);
  if (snaps.length === 0) return null;
  return snaps.reduce((a, b) => (a.capturedAt > b.capturedAt ? a : b));
}
