import express from 'express';
import cors from 'cors';
import { stateRouter } from './routes/state.js';
import { contextRouter } from './routes/context.js';
import { mouseRouter } from './routes/mouse.js';
import { llmRouter } from './routes/llm.js';
import { visionRouter } from './routes/vision.js';
import { requireJson, notFound, errorHandler } from './middleware/validate.js';

const app = express();
const PORT = Number(process.env['PORT'] ?? 3001);

// ── Middleware global ──────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' })); // screenshots podem ser grandes
app.use(requireJson);

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Rotas ──────────────────────────────────────────────────────────────────────
app.use('/state', stateRouter);
app.use('/context', contextRouter);
app.use('/mouse', mouseRouter);
app.use('/llm', llmRouter);
app.use('/vision', visionRouter);

// ── 404 / error ────────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[backend] Rodando em http://localhost:${PORT}`);
  console.log('  GET  /health');
  console.log('  POST /state/snapshots');
  console.log('  GET  /state/snapshots');
  console.log('  GET  /state/changes');
  console.log('  POST /context/sessions');
  console.log('  GET  /context/sessions');
  console.log('  POST /mouse/:sessionId/batch');
  console.log('  GET  /mouse/:sessionId/queue  (poll)');
  console.log('  POST /llm/analyze');
  console.log('  POST /llm/analyze-screenshot');
  console.log('  POST /vision/analyze');
  console.log('  GET  /vision/analyses/:id/elements/:kind');
  console.log('  GET  /vision/analyses/:id/ocr/search?q=');
  console.log('  GET  /vision/analyses/:id/colors');
});
