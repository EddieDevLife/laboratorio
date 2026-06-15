import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import cors from 'cors';
import { stateRouter } from '../routes/state.js';
import { contextRouter } from '../routes/context.js';
import { mouseRouter } from '../routes/mouse.js';
import { requireJson, notFound, errorHandler } from '../middleware/validate.js';

// Monta app sem iniciar servidor
const app = express();
app.use(cors());
app.use(express.json());
app.use(requireJson);
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/state', stateRouter);
app.use('/context', contextRouter);
app.use('/mouse', mouseRouter);
app.use(notFound);
app.use(errorHandler);

const req = supertest(app);

// ── Health ─────────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('retorna 200 com status ok', async () => {
    const res = await req.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ── State ──────────────────────────────────────────────────────────────────────
describe('state routes', () => {
  let snapshotId: string;

  it('POST /state/snapshots cria snapshot e retorna 201', async () => {
    const res = await req.post('/state/snapshots').send({
      sessionId: 'int-test',
      url: 'https://example.com',
      title: 'Exemplo',
      tree: { tag: 'body', children: [] },
      stats: { total: 5, interactive: 2, focusable: 3, withAria: 1 },
    });
    expect(res.status).toBe(201);
    expect(res.body.snapshot.id).toBeTruthy();
    snapshotId = res.body.snapshot.id;
  });

  it('GET /state/snapshots lista snapshots', async () => {
    const res = await req.get('/state/snapshots?sessionId=int-test');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /state/snapshots/:id retorna snapshot correto', async () => {
    const res = await req.get(`/state/snapshots/${snapshotId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(snapshotId);
  });

  it('GET /state/snapshots/:id com id inválido retorna 404', async () => {
    const res = await req.get('/state/snapshots/nope-id');
    expect(res.status).toBe(404);
  });

  it('GET /state/changes retorna array', async () => {
    const res = await req.get('/state/changes?sessionId=int-test');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /state/compare compara dois snapshots', async () => {
    const res = await req.post('/state/compare').send({ fromId: null, toId: snapshotId });
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeTruthy();
  });

  it('DELETE /state/snapshots/:id remove snapshot', async () => {
    const res = await req.delete(`/state/snapshots/${snapshotId}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── Context ────────────────────────────────────────────────────────────────────
describe('context routes', () => {
  let sessionId: string;

  it('POST /context/sessions cria sessão', async () => {
    const res = await req.post('/context/sessions').send({ label: 'test-label' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    sessionId = res.body.id;
  });

  it('GET /context/sessions lista sessões', async () => {
    const res = await req.get('/context/sessions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /context/sessions/:id retorna sessão', async () => {
    const res = await req.get(`/context/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('test-label');
  });

  it('PATCH /context/sessions/:id/preferences atualiza prefs', async () => {
    const res = await req.patch(`/context/sessions/${sessionId}/preferences`)
      .send({ ttsRate: 1.5, theme: 'light' });
    expect(res.status).toBe(200);
    expect(res.body.ttsRate).toBe(1.5);
  });

  it('POST /context/sessions/:id/interactions registra interação', async () => {
    const res = await req.post(`/context/sessions/${sessionId}/interactions`)
      .send({ type: 'command', input: 'Tab', output: 'ok', durationMs: 10 });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('command');
  });

  it('GET /context/sessions/:id/interactions retorna lista', async () => {
    const res = await req.get(`/context/sessions/${sessionId}/interactions`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('DELETE /context/sessions/:id remove sessão', async () => {
    const res = await req.delete(`/context/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ── Mouse ──────────────────────────────────────────────────────────────────────
describe('mouse routes', () => {
  const SID = 'mouse-int-test';

  it('POST /mouse/:id/batch enfileira comandos', async () => {
    const res = await req.post(`/mouse/${SID}/batch`).send({
      commands: [
        { type: 'move', x: 100, y: 200 },
        { type: 'click', x: 100, y: 200 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.queued).toBe(2);
  });

  it('GET /mouse/:id/queue drena comandos pendentes', async () => {
    const res = await req.get(`/mouse/${SID}/queue`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every((c: { status: string }) => c.status === 'sent')).toBe(true);
  });

  it('GET /mouse/:id/peek retorna 0 após drain', async () => {
    const res = await req.get(`/mouse/${SID}/peek`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('GET /mouse/:id/stats retorna contagens', async () => {
    const res = await req.get(`/mouse/${SID}/stats`);
    expect(res.status).toBe(200);
    expect(typeof res.body.sent).toBe('number');
    expect(typeof res.body.done).toBe('number');
  });

  it('POST /mouse/:id/move enfileira comando move', async () => {
    const res = await req.post(`/mouse/${SID}/move`).send({ x: 50, y: 80 });
    expect(res.status).toBe(201);
    expect(res.body.command.type).toBe('move');
  });

  it('POST /mouse/:id/type enfileira comando type', async () => {
    const res = await req.post(`/mouse/${SID}/type`).send({ text: 'hello' });
    expect(res.status).toBe(201);
    expect(res.body.command.text).toBe('hello');
  });

  it('POST /mouse/:id/key enfileira comando key', async () => {
    const res = await req.post(`/mouse/${SID}/key`).send({ key: 'Tab' });
    expect(res.status).toBe(201);
    expect(res.body.command.key).toBe('Tab');
  });

  it('DELETE /mouse/:id/queue limpa fila', async () => {
    await req.post(`/mouse/${SID}/move`).send({ x: 0, y: 0 });
    const res = await req.delete(`/mouse/${SID}/queue`);
    expect(res.status).toBe(200);
    expect(res.body.cleared).toBeGreaterThan(0);
  });

  it('404 para rota inexistente', async () => {
    const res = await req.get('/nope');
    expect(res.status).toBe(404);
  });
});
