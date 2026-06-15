/**
 * Cliente LLM unificado — chama Anthropic, OpenAI ou Gemini
 * diretamente do service worker, sem backend.
 *
 * Configuração em chrome.storage.local:
 *   llm_provider   : 'anthropic' | 'openai' | 'gemini'
 *   anthropic_api_key
 *   openai_api_key
 *   gemini_api_key
 *   openai_model   (opcional, default: gpt-4o)
 *   gemini_model   (opcional, default: gemini-2.0-flash)
 */

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type Provider = 'anthropic' | 'openai' | 'gemini';

export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
  source?: { type: 'base64'; media_type: 'image/png' | 'image/jpeg'; data: string };
  tool_use_id?: string;
}

export interface Tool {
  name: string;
  description?: string;
  input_schema?: unknown;   // Anthropic format
  parameters?: unknown;     // OpenAI/Gemini format (auto-converted)
  type?: string;            // 'computer_20250124' for Anthropic Computer Use
  display_width_px?: number;
  display_height_px?: number;
}

export interface LLMResponse {
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop';
  usage?: { input_tokens?: number; output_tokens?: number };
  provider: Provider;
}

export interface LLMConfig {
  messages: Message[];
  system?: string;
  tools?: Tool[];
  maxTokens?: number;
  useComputerUseBeta?: boolean;  // Anthropic-only: computer use beta
}

// ── Configuração ───────────────────────────────────────────────────────────────

export interface StoredSettings {
  llm_provider?: Provider;
  anthropic_api_key?: string;
  openai_api_key?: string;
  gemini_api_key?: string;
  openai_model?: string;
  gemini_model?: string;
}

export async function getSettings(): Promise<StoredSettings> {
  return chrome.storage.local.get([
    'llm_provider',
    'anthropic_api_key',
    'openai_api_key',
    'gemini_api_key',
    'openai_model',
    'gemini_model',
  ]) as Promise<StoredSettings>;
}

export async function saveSettings(settings: Partial<StoredSettings>): Promise<void> {
  return chrome.storage.local.set(settings);
}

// ── Entry point unificado ─────────────────────────────────────────────────────

export async function callLLM(opts: LLMConfig): Promise<LLMResponse> {
  const settings = await getSettings();
  const provider: Provider = settings.llm_provider ?? 'anthropic';

  switch (provider) {
    case 'anthropic': return callAnthropic(opts, settings);
    case 'openai':    return callOpenAI(opts, settings);
    case 'gemini':    return callGemini(opts, settings);
    default:          throw new Error(`Provider desconhecido: ${provider}`);
  }
}

// Mantém compatibilidade com agent-loop.ts que importa callClaude
export const callClaude = callLLM;

// ── Anthropic ─────────────────────────────────────────────────────────────────

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL_DEFAULT = 'claude-sonnet-4-6';
const ANTHROPIC_COMPUTER_USE_MODEL = 'claude-opus-4-8';
const ANTHROPIC_COMPUTER_USE_BETA = 'computer-use-2025-01-24';

async function callAnthropic(opts: LLMConfig, settings: StoredSettings): Promise<LLMResponse> {
  const apiKey = settings.anthropic_api_key ?? '';
  if (!apiKey) throw new Error('Anthropic API key não configurada.');

  const model = opts.useComputerUseBeta ? ANTHROPIC_COMPUTER_USE_MODEL : ANTHROPIC_MODEL_DEFAULT;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (opts.useComputerUseBeta) {
    headers['anthropic-beta'] = ANTHROPIC_COMPUTER_USE_BETA;
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 4096,
    messages: opts.messages,
  };
  if (opts.system) body['system'] = opts.system;
  if (opts.tools?.length) body['tools'] = opts.tools;

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    content: ContentBlock[];
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number };
  };

  return {
    content: data.content,
    stop_reason: data.stop_reason as LLMResponse['stop_reason'],
    usage: data.usage,
    provider: 'anthropic',
  };
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI(opts: LLMConfig, settings: StoredSettings): Promise<LLMResponse> {
  const apiKey = settings.openai_api_key ?? '';
  if (!apiKey) throw new Error('OpenAI API key não configurada.');

  const model = settings.openai_model ?? 'gpt-4o';

  // Converte mensagens para o formato OpenAI
  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  for (const msg of opts.messages) {
    messages.push({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? msg.content
        : convertContentToOpenAI(msg.content),
    });
  }

  // Converte tools para o formato OpenAI
  const tools = opts.tools?.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description ?? '',
      parameters: t.parameters ?? t.input_schema ?? { type: 'object', properties: {} },
    },
  }));

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 4096,
    messages,
  };
  if (tools?.length) {
    body['tools'] = tools;
    body['tool_choice'] = 'auto';
  }

  const res = await fetch(OPENAI_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    choices: Array<{
      message: {
        content: string | null;
        tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
      };
      finish_reason: string;
    }>;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const choice = data.choices[0];
  const content: ContentBlock[] = [];

  if (choice.message.content) {
    content.push({ type: 'text', text: choice.message.content });
  }

  for (const tc of choice.message.tool_calls ?? []) {
    let parsedInput: unknown = {};
    try { parsedInput = JSON.parse(tc.function.arguments); } catch {}
    content.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.function.name,
      input: parsedInput,
    });
  }

  const stop = choice.finish_reason === 'tool_calls' ? 'tool_use'
    : choice.finish_reason === 'length' ? 'max_tokens'
    : 'end_turn';

  return {
    content,
    stop_reason: stop,
    usage: { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens },
    provider: 'openai',
  };
}

function convertContentToOpenAI(blocks: ContentBlock[]): unknown[] {
  return blocks.map(b => {
    if (b.type === 'text') return { type: 'text', text: b.text };
    if (b.type === 'image' && b.source) {
      return {
        type: 'image_url',
        image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` },
      };
    }
    if (b.type === 'tool_result') {
      return { type: 'text', text: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) };
    }
    return { type: 'text', text: '' };
  });
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async function callGemini(opts: LLMConfig, settings: StoredSettings): Promise<LLMResponse> {
  const apiKey = settings.gemini_api_key ?? '';
  if (!apiKey) throw new Error('Gemini API key não configurada.');

  const model = settings.gemini_model ?? 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Converte mensagens para o formato Gemini
  const contents = [];
  for (const msg of opts.messages) {
    const parts = typeof msg.content === 'string'
      ? [{ text: msg.content }]
      : convertContentToGemini(msg.content);
    contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts });
  }

  // Converte tools para o formato Gemini
  const functionDeclarations = opts.tools
    ?.filter(t => !t.type)  // ignora computer use tools
    .map(t => ({
      name: t.name,
      description: t.description ?? '',
      parameters: t.parameters ?? t.input_schema ?? { type: 'object', properties: {} },
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 4096,
    },
  };

  if (opts.system) {
    body['systemInstruction'] = { parts: [{ text: opts.system }] };
  }

  if (functionDeclarations?.length) {
    body['tools'] = [{ functionDeclarations }];
    body['toolConfig'] = { functionCallingConfig: { mode: 'AUTO' } };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    candidates: Array<{
      content: { parts: Array<{ text?: string; functionCall?: { name: string; args: unknown } }> };
      finishReason: string;
    }>;
    usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
  };

  const candidate = data.candidates[0];
  const content: ContentBlock[] = [];

  for (const part of candidate.content.parts) {
    if (part.text) {
      content.push({ type: 'text', text: part.text });
    }
    if (part.functionCall) {
      content.push({
        type: 'tool_use',
        id: `gemini-${Date.now()}`,
        name: part.functionCall.name,
        input: part.functionCall.args,
      });
    }
  }

  const finishReason = candidate.finishReason;
  const stop: LLMResponse['stop_reason'] =
    content.some(b => b.type === 'tool_use') ? 'tool_use'
    : finishReason === 'MAX_TOKENS' ? 'max_tokens'
    : 'end_turn';

  return {
    content,
    stop_reason: stop,
    usage: {
      input_tokens: data.usageMetadata?.promptTokenCount,
      output_tokens: data.usageMetadata?.candidatesTokenCount,
    },
    provider: 'gemini',
  };
}

function convertContentToGemini(blocks: ContentBlock[]): unknown[] {
  return blocks.map(b => {
    if (b.type === 'text') return { text: b.text };
    if (b.type === 'image' && b.source) {
      return {
        inlineData: {
          mimeType: b.source.media_type,
          data: b.source.data,
        },
      };
    }
    if (b.type === 'tool_result') {
      return {
        functionResponse: {
          name: 'browser_action',
          response: { result: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) },
        },
      };
    }
    return { text: '' };
  });
}

// Re-export getApiKey para compatibilidade com código anterior
export async function getApiKey(): Promise<string> {
  const s = await getSettings();
  const provider = s.llm_provider ?? 'anthropic';
  if (provider === 'anthropic') return s.anthropic_api_key ?? '';
  if (provider === 'openai') return s.openai_api_key ?? '';
  if (provider === 'gemini') return s.gemini_api_key ?? '';
  return '';
}
