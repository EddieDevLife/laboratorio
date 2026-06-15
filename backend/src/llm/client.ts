import type { LLMRequest, LLMResponse, LLMConfig } from './types.js';
import type { MouseCommand } from '../mouse/types.js';

const DEFAULT_CONFIG: Omit<LLMConfig, 'apiKey'> = {
  model: 'claude-sonnet-4-6',
  maxTokens: 1024,
  temperature: 0.2,
};

function buildSystemPrompt(): string {
  return `Você é um agente de automação de browser. Dado um objetivo em linguagem natural e o estado atual da interface (DOM e/ou screenshot), você deve responder com um JSON estruturado contendo:

- "reasoning": string — seu raciocínio passo a passo
- "narration": string — texto curto para narrar ao usuário via TTS (máx 60 chars)
- "done": boolean — true se o objetivo foi concluído
- "commands": array de comandos de mouse/teclado

Tipos de comando disponíveis:
- { "type": "move", "x": number, "y": number, "durationMs"?: number }
- { "type": "click", "x": number, "y": number }
- { "type": "doubleClick", "x": number, "y": number }
- { "type": "rightClick", "x": number, "y": number }
- { "type": "type", "text": string, "delayMs"?: number }
- { "type": "key", "key": string, "modifiers"?: ["ctrl","shift","alt","meta"] }
- { "type": "scroll", "x": number, "y": number, "deltaX"?: number, "deltaY"?: number }
- { "type": "wait", "ms": number }

Responda APENAS com o JSON, sem markdown.`;
}

function buildUserMessage(req: LLMRequest): string {
  const parts: string[] = [`Objetivo: ${req.instruction}`];

  if (req.domSnapshot) {
    const snap = req.domSnapshot as { url?: string; title?: string; stats?: unknown };
    parts.push(`\nURL atual: ${snap.url ?? 'desconhecida'}`);
    parts.push(`Título: ${snap.title ?? ''}`);
    parts.push(`Stats DOM: ${JSON.stringify(snap.stats ?? {})}`);
    parts.push(`\nArvore DOM (resumo):\n${JSON.stringify(req.domSnapshot, null, 2).slice(0, 3000)}`);
  }

  if (req.screenshotBase64) {
    parts.push('\n[Screenshot disponível como imagem base64]');
  }

  return parts.join('\n');
}

function parseResponse(text: string): LLMResponse {
  try {
    const json = JSON.parse(text.trim()) as Partial<LLMResponse>;
    return {
      reasoning: json.reasoning ?? '',
      commands: (json.commands ?? []) as MouseCommand[],
      narration: json.narration ?? 'Processando…',
      done: json.done ?? false,
      error: json.error,
    };
  } catch {
    return {
      reasoning: text,
      commands: [],
      narration: 'Resposta inválida do modelo',
      done: false,
      error: 'Falha ao parsear resposta JSON',
    };
  }
}

export async function analyzeWithLLM(
  req: LLMRequest,
  config: Partial<LLMConfig> = {},
): Promise<LLMResponse> {
  const apiKey = config.apiKey ?? process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  const model = config.model ?? DEFAULT_CONFIG.model;
  const maxTokens = config.maxTokens ?? DEFAULT_CONFIG.maxTokens;

  const messages: Array<{ role: string; content: string | Array<unknown> }> = [];

  // History
  if (req.history) {
    for (const h of req.history) {
      messages.push({ role: h.role, content: h.content });
    }
  }

  // User message — with optional image
  if (req.screenshotBase64) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: req.screenshotBase64,
          },
        },
        { type: 'text', text: buildUserMessage(req) },
      ],
    });
  } else {
    messages.push({ role: 'user', content: buildUserMessage(req) });
  }

  const body = {
    model,
    max_tokens: maxTokens,
    system: buildSystemPrompt(),
    messages,
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text?: string }>;
  };

  const textBlock = data.content.find(b => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('Resposta vazia da API');
  }

  return parseResponse(textBlock.text);
}
