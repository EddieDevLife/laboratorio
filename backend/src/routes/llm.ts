import { Router } from 'express';
import { analyzeWithLLM } from '../llm/client.js';
import { enqueueBatch } from '../mouse/queue.js';
import { recordInteraction } from '../context/store.js';
import type { LLMRequest } from '../llm/types.js';

export const llmRouter = Router();

// POST /llm/analyze — análise de DOM + geração de comandos
llmRouter.post('/analyze', async (req, res) => {
  const start = Date.now();
  const body = req.body as LLMRequest & { apiKey?: string };

  if (!body.sessionId || !body.instruction) {
    res.status(400).json({ error: 'sessionId e instruction são obrigatórios' });
    return;
  }

  try {
    const response = await analyzeWithLLM(body, {
      apiKey: body.apiKey ?? process.env['ANTHROPIC_API_KEY'],
    });

    // Enfileirar comandos gerados automaticamente
    if (response.commands.length > 0) {
      enqueueBatch(body.sessionId, response.commands);
    }

    // Registrar interação
    recordInteraction({
      sessionId: body.sessionId,
      type: 'llm',
      input: body.instruction,
      output: response.narration,
      metadata: {
        model: 'claude-sonnet-4-6',
        commandCount: response.commands.length,
        done: response.done,
      },
      durationMs: Date.now() - start,
    });

    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message });
  }
});

// POST /llm/analyze-screenshot — análise por visão computacional
llmRouter.post('/analyze-screenshot', async (req, res) => {
  const start = Date.now();
  const body = req.body as LLMRequest & { apiKey?: string };

  if (!body.sessionId || !body.instruction || !body.screenshotBase64) {
    res.status(400).json({ error: 'sessionId, instruction e screenshotBase64 são obrigatórios' });
    return;
  }

  try {
    const response = await analyzeWithLLM(body, {
      apiKey: body.apiKey ?? process.env['ANTHROPIC_API_KEY'],
    });

    if (response.commands.length > 0) {
      enqueueBatch(body.sessionId, response.commands);
    }

    recordInteraction({
      sessionId: body.sessionId,
      type: 'llm',
      input: body.instruction,
      output: response.narration,
      metadata: { source: 'screenshot', commandCount: response.commands.length },
      durationMs: Date.now() - start,
    });

    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: message });
  }
});
