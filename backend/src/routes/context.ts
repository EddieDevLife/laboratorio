import { Router } from 'express';
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

export const contextRouter = Router();

// ── Sessions ───────────────────────────────────────────────────────────────────

contextRouter.post('/sessions', (req, res) => {
  const { label } = req.body as { label?: string };
  res.status(201).json(createSession(label));
});

contextRouter.get('/sessions', (_req, res) => {
  res.json(listSessions());
});

contextRouter.get('/sessions/:id', (req, res) => {
  const s = getSession(req.params['id']!);
  if (!s) { res.status(404).json({ error: 'Sessão não encontrada' }); return; }
  res.json(s);
});

contextRouter.delete('/sessions/:id', (req, res) => {
  const ok = deleteSession(req.params['id']!);
  res.json({ ok });
});

// ── Preferences ────────────────────────────────────────────────────────────────

contextRouter.get('/sessions/:id/preferences', (req, res) => {
  res.json(getPreferences(req.params['id']!));
});

contextRouter.patch('/sessions/:id/preferences', (req, res) => {
  const prefs = updatePreferences(req.params['id']!, req.body);
  res.json(prefs);
});

// ── Interactions ───────────────────────────────────────────────────────────────

contextRouter.post('/sessions/:id/interactions', (req, res) => {
  const { type, input, output, metadata, durationMs } = req.body as {
    type: 'command' | 'click' | 'navigate' | 'capture' | 'screenshot' | 'llm';
    input?: string;
    output?: string;
    metadata?: Record<string, unknown>;
    durationMs?: number;
  };
  const interaction = recordInteraction({
    sessionId: req.params['id']!,
    type,
    input,
    output,
    metadata,
    durationMs,
  });
  res.status(201).json(interaction);
});

contextRouter.get('/sessions/:id/interactions', (req, res) => {
  const limit = parseInt((req.query['limit'] as string) ?? '50', 10);
  res.json(listInteractions(req.params['id']!, limit));
});

contextRouter.delete('/sessions/:id/interactions', (req, res) => {
  const count = clearInteractions(req.params['id']!);
  res.json({ deleted: count });
});
