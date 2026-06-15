import { Router } from 'express';
import {
  enqueue,
  enqueueBatch,
  drain,
  peek,
  ack,
  clearQueue,
  queueStats,
} from '../mouse/queue.js';
import type { MouseCommand } from '../mouse/types.js';

export const mouseRouter = Router();

// POST /mouse/:sessionId/move
mouseRouter.post('/:sessionId/move', (req, res) => {
  const { x, y, durationMs } = req.body as { x: number; y: number; durationMs?: number };
  const cmd = enqueue(req.params['sessionId']!, { type: 'move', x, y, durationMs });
  res.status(201).json(cmd);
});

// POST /mouse/:sessionId/click
mouseRouter.post('/:sessionId/click', (req, res) => {
  const { x, y, type = 'click' } = req.body as {
    x: number;
    y: number;
    type?: 'click' | 'doubleClick' | 'rightClick';
  };
  const cmd = enqueue(req.params['sessionId']!, { type, x, y });
  res.status(201).json(cmd);
});

// POST /mouse/:sessionId/type
mouseRouter.post('/:sessionId/type', (req, res) => {
  const { text, delayMs } = req.body as { text: string; delayMs?: number };
  if (!text) { res.status(400).json({ error: 'text é obrigatório' }); return; }
  const cmd = enqueue(req.params['sessionId']!, { type: 'type', text, delayMs });
  res.status(201).json(cmd);
});

// POST /mouse/:sessionId/key
mouseRouter.post('/:sessionId/key', (req, res) => {
  const { key, modifiers } = req.body as {
    key: string;
    modifiers?: Array<'ctrl' | 'shift' | 'alt' | 'meta'>;
  };
  if (!key) { res.status(400).json({ error: 'key é obrigatório' }); return; }
  const cmd = enqueue(req.params['sessionId']!, { type: 'key', key, modifiers });
  res.status(201).json(cmd);
});

// POST /mouse/:sessionId/scroll
mouseRouter.post('/:sessionId/scroll', (req, res) => {
  const { x, y, deltaX, deltaY } = req.body as {
    x: number; y: number; deltaX?: number; deltaY?: number;
  };
  const cmd = enqueue(req.params['sessionId']!, { type: 'scroll', x, y, deltaX, deltaY });
  res.status(201).json(cmd);
});

// POST /mouse/:sessionId/batch — múltiplos comandos de uma vez
mouseRouter.post('/:sessionId/batch', (req, res) => {
  const { commands } = req.body as { commands: MouseCommand[] };
  if (!Array.isArray(commands) || commands.length === 0) {
    res.status(400).json({ error: 'commands[] é obrigatório' });
    return;
  }
  const items = enqueueBatch(req.params['sessionId']!, commands);
  res.status(201).json({ queued: items.length, items });
});

// GET /mouse/:sessionId/queue — frontend poll (drena pendentes e marca como 'sent')
mouseRouter.get('/:sessionId/queue', (req, res) => {
  const commands = drain(req.params['sessionId']!);
  res.json(commands);
});

// GET /mouse/:sessionId/peek — apenas visualiza sem alterar status
mouseRouter.get('/:sessionId/peek', (req, res) => {
  res.json(peek(req.params['sessionId']!));
});

// POST /mouse/:sessionId/ack/:commandId — confirma execução
mouseRouter.post('/:sessionId/ack/:commandId', (req, res) => {
  const { error } = req.body as { error?: string };
  const ok = ack(req.params['sessionId']!, req.params['commandId']!, error);
  if (!ok) { res.status(404).json({ error: 'Comando não encontrado' }); return; }
  res.json({ ok });
});

// DELETE /mouse/:sessionId/queue — limpar fila
mouseRouter.delete('/:sessionId/queue', (req, res) => {
  const count = clearQueue(req.params['sessionId']!);
  res.json({ cleared: count });
});

// GET /mouse/:sessionId/stats
mouseRouter.get('/:sessionId/stats', (req, res) => {
  res.json(queueStats(req.params['sessionId']!));
});
