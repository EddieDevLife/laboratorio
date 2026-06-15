import { Router } from 'express';
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

export const stateRouter = Router();

// POST /state/snapshots — salvar novo snapshot
stateRouter.post('/snapshots', (req, res) => {
  const { sessionId, url, title, tree, stats } = req.body as {
    sessionId: string;
    url: string;
    title: string;
    tree: unknown;
    stats: { total: number; interactive: number; focusable: number; withAria: number };
  };

  if (!sessionId || !url) {
    res.status(400).json({ error: 'sessionId e url são obrigatórios' });
    return;
  }

  const latest = getLatestSnapshot(sessionId);
  const snapshot = saveSnapshot(sessionId, { url, title, tree, stats });
  const diff = computeDiff(latest, snapshot);
  const change = recordChange(sessionId, latest?.id ?? null, snapshot.id, diff);

  res.status(201).json({ snapshot, change });
});

// GET /state/snapshots — listar snapshots
stateRouter.get('/snapshots', (req, res) => {
  const { sessionId } = req.query as { sessionId?: string };
  res.json(listSnapshots(sessionId));
});

// GET /state/snapshots/:id — buscar snapshot
stateRouter.get('/snapshots/:id', (req, res) => {
  const snap = getSnapshot(req.params['id']!);
  if (!snap) { res.status(404).json({ error: 'Não encontrado' }); return; }
  res.json(snap);
});

// DELETE /state/snapshots/:id
stateRouter.delete('/snapshots/:id', (req, res) => {
  const ok = deleteSnapshot(req.params['id']!);
  res.json({ ok });
});

// DELETE /state/snapshots — limpar todos (opcional: ?sessionId=xxx)
stateRouter.delete('/snapshots', (req, res) => {
  const { sessionId } = req.query as { sessionId?: string };
  const count = clearSnapshots(sessionId);
  res.json({ deleted: count });
});

// GET /state/changes — histórico de mudanças
stateRouter.get('/changes', (req, res) => {
  const { sessionId } = req.query as { sessionId?: string };
  res.json(listChanges(sessionId));
});

// POST /state/compare — comparar dois snapshots
stateRouter.post('/compare', (req, res) => {
  const { fromId, toId } = req.body as { fromId: string | null; toId: string };
  const from = fromId ? getSnapshot(fromId) ?? null : null;
  const to = getSnapshot(toId);
  if (!to) { res.status(404).json({ error: 'Snapshot destino não encontrado' }); return; }
  res.json(computeDiff(from, to));
});
