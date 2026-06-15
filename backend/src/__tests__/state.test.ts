import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveSnapshot,
  getSnapshot,
  listSnapshots,
  deleteSnapshot,
  clearSnapshots,
  computeDiff,
  recordChange,
  listChanges,
  getLatestSnapshot,
} from '../state/store.js';

const SESSION = 'test-session';

const STATS = { total: 10, interactive: 3, focusable: 5, withAria: 2 };

function makeSnap(url = 'https://example.com', title = 'Test') {
  return saveSnapshot(SESSION, { url, title, tree: { tag: 'body' }, stats: STATS });
}

describe('state store', () => {
  beforeEach(() => clearSnapshots());

  it('saveSnapshot retorna snapshot com id e timestamps', () => {
    const snap = makeSnap();
    expect(snap.id).toBeTruthy();
    expect(snap.sessionId).toBe(SESSION);
    expect(snap.capturedAt).toBeTruthy();
    expect(snap.url).toBe('https://example.com');
  });

  it('getSnapshot recupera por id', () => {
    const snap = makeSnap();
    expect(getSnapshot(snap.id)).toEqual(snap);
  });

  it('getSnapshot retorna undefined para id inexistente', () => {
    expect(getSnapshot('nope')).toBeUndefined();
  });

  it('listSnapshots filtra por sessionId', () => {
    makeSnap();
    saveSnapshot('other-session', { url: 'x', title: 'x', tree: {}, stats: STATS });
    expect(listSnapshots(SESSION)).toHaveLength(1);
  });

  it('deleteSnapshot remove e retorna true', () => {
    const snap = makeSnap();
    expect(deleteSnapshot(snap.id)).toBe(true);
    expect(getSnapshot(snap.id)).toBeUndefined();
  });

  it('deleteSnapshot retorna false para id inexistente', () => {
    expect(deleteSnapshot('ghost')).toBe(false);
  });

  it('clearSnapshots sem sessionId remove todos', () => {
    makeSnap();
    makeSnap('https://b.com');
    const count = clearSnapshots();
    expect(count).toBe(2);
    expect(listSnapshots()).toHaveLength(0);
  });

  it('clearSnapshots com sessionId remove só da sessão', () => {
    makeSnap();
    saveSnapshot('other', { url: 'x', title: 'x', tree: {}, stats: STATS });
    clearSnapshots(SESSION);
    expect(listSnapshots(SESSION)).toHaveLength(0);
    expect(listSnapshots('other')).toHaveLength(1);
  });

  it('getLatestSnapshot retorna o mais recente', () => {
    const s1 = makeSnap('https://a.com');
    const s2 = makeSnap('https://b.com');
    const latest = getLatestSnapshot(SESSION);
    expect(latest?.id).toBe(s2.id);
    void s1;
  });

  it('computeDiff com from=null descreve primeiro snapshot', () => {
    const snap = makeSnap();
    const diff = computeDiff(null, snap);
    expect(diff.summary).toContain('Primeiro snapshot');
  });

  it('computeDiff detecta mudança de URL', () => {
    const s1 = makeSnap('https://a.com');
    const s2 = makeSnap('https://b.com');
    const diff = computeDiff(s1, s2);
    expect(diff.summary).toContain('URL mudou');
  });

  it('recordChange e listChanges', () => {
    const s1 = makeSnap();
    const s2 = makeSnap('https://b.com');
    const diff = computeDiff(s1, s2);
    recordChange(SESSION, s1.id, s2.id, diff);
    const changes = listChanges(SESSION);
    expect(changes).toHaveLength(1);
    expect(changes[0].fromSnapshotId).toBe(s1.id);
  });
});
