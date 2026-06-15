import { Router } from 'express';
import {
  analyzeScreenshot,
  getAnalysis,
  listAnalyses,
  deleteAnalysis,
  getElementsByKind,
  findElementAt,
  searchOCR,
} from '../vision/analyzer.js';
import { recordInteraction } from '../context/store.js';
import type { VisionRequest } from '../vision/types.js';

export const visionRouter = Router();

// POST /vision/analyze — análise completa de screenshot
visionRouter.post('/analyze', async (req, res) => {
  const start = Date.now();
  const body = req.body as VisionRequest;

  if (!body.sessionId || !body.screenshotBase64) {
    res.status(400).json({ error: 'sessionId e screenshotBase64 são obrigatórios' });
    return;
  }

  try {
    const analysis = await analyzeScreenshot(body);

    recordInteraction({
      sessionId: body.sessionId,
      type: 'screenshot',
      output: analysis.summary,
      metadata: {
        analysisId: analysis.id,
        elementCount: analysis.elements.length,
        ocrBlocks: analysis.ocr.length,
        patterns: analysis.patterns,
        tasks: body.tasks,
      },
      durationMs: Date.now() - start,
    });

    // Strip rawResponse from response by default to save bandwidth
    const { rawResponse: _, ...clean } = analysis;
    res.status(201).json(clean);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message });
  }
});

// GET /vision/analyses — listar análises
visionRouter.get('/analyses', (req, res) => {
  const { sessionId } = req.query as { sessionId?: string };
  const all = listAnalyses(sessionId).map(({ rawResponse: _, ...a }) => a);
  res.json(all);
});

// GET /vision/analyses/:id
visionRouter.get('/analyses/:id', (req, res) => {
  const a = getAnalysis(req.params['id']!);
  if (!a) { res.status(404).json({ error: 'Não encontrado' }); return; }
  const { rawResponse: _, ...clean } = a;
  res.json(clean);
});

// DELETE /vision/analyses/:id
visionRouter.delete('/analyses/:id', (req, res) => {
  res.json({ ok: deleteAnalysis(req.params['id']!) });
});

// GET /vision/analyses/:id/elements — todos os elementos detectados
visionRouter.get('/analyses/:id/elements', (req, res) => {
  const a = getAnalysis(req.params['id']!);
  if (!a) { res.status(404).json({ error: 'Não encontrado' }); return; }
  res.json(a.elements);
});

// GET /vision/analyses/:id/elements/:kind — filtrar por tipo
visionRouter.get('/analyses/:id/elements/:kind', (req, res) => {
  const result = getElementsByKind(req.params['id']!, req.params['kind']!);
  if (!result) { res.status(404).json({ error: 'Análise não encontrada' }); return; }
  res.json(result);
});

// GET /vision/analyses/:id/at?x=&y= — elemento na posição
visionRouter.get('/analyses/:id/at', (req, res) => {
  const x = Number(req.query['x']);
  const y = Number(req.query['y']);
  if (isNaN(x) || isNaN(y)) {
    res.status(400).json({ error: 'x e y são obrigatórios' });
    return;
  }
  const result = findElementAt(req.params['id']!, x, y);
  if (!result) { res.status(404).json({ error: 'Nenhum elemento na posição' }); return; }
  res.json(result);
});

// GET /vision/analyses/:id/ocr — blocos OCR
visionRouter.get('/analyses/:id/ocr', (req, res) => {
  const a = getAnalysis(req.params['id']!);
  if (!a) { res.status(404).json({ error: 'Não encontrado' }); return; }
  res.json(a.ocr);
});

// GET /vision/analyses/:id/ocr/search?q= — busca no texto OCR
visionRouter.get('/analyses/:id/ocr/search', (req, res) => {
  const q = (req.query['q'] as string) ?? '';
  if (!q) { res.status(400).json({ error: 'q é obrigatório' }); return; }
  const result = searchOCR(req.params['id']!, q);
  if (!result) { res.status(404).json({ error: 'Análise não encontrada' }); return; }
  res.json(result);
});

// GET /vision/analyses/:id/colors
visionRouter.get('/analyses/:id/colors', (req, res) => {
  const a = getAnalysis(req.params['id']!);
  if (!a) { res.status(404).json({ error: 'Não encontrado' }); return; }
  res.json(a.dominantColors);
});

// GET /vision/analyses/:id/patterns
visionRouter.get('/analyses/:id/patterns', (req, res) => {
  const a = getAnalysis(req.params['id']!);
  if (!a) { res.status(404).json({ error: 'Não encontrado' }); return; }
  res.json(a.patterns);
});
