/**
 * Cliente LLM unificado — chama OpenAI, Gemini ou qualquer provedor
 * compatível com OpenAI diretamente do service worker, sem backend.
 *
 * Configuração em chrome.storage.local:
 *   llm_provider          : id do provedor (ex: 'openai', 'gemini', 'custom')
 *   {id}_api_key          : chave de API do provedor
 *   {id}_model            : modelo (opcional, usa o padrão do provedor)
 *   custom_name           : nome exibido para provedor personalizado
 *   custom_base_url       : URL base OpenAI-compatível para provedor personalizado
 */

// ── Provedores predefinidos ────────────────────────────────────────────────────

export interface ProviderDef {
  id: string;
  name: string;
  baseUrl: string;          // vazio para Gemini (tem formato próprio) e custom
  defaultModel: string;
  apiKeyPlaceholder: string;
  openAICompat: boolean;    // false = usa API nativa Gemini
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    apiKeyPlaceholder: 'sk-...',
    openAICompat: true,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: '',
    defaultModel: 'gemini-2.0-flash',
    apiKeyPlaceholder: 'AIzaSy...',
    openAICompat: false,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    apiKeyPlaceholder: 'seu-api-key',
    openAICompat: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    apiKeyPlaceholder: 'gsk_...',
    openAICompat: true,
  },
  {
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3-70b-chat-hf',
    apiKeyPlaceholder: 'seu-api-key',
    openAICompat: true,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'sonar-pro',
    apiKeyPlaceholder: 'pplx-...',
    openAICompat: true,
  },
  {
    id: 'custom',
    name: 'Personalizado',
    baseUrl: '',
    defaultModel: '',
    apiKeyPlaceholder: 'seu-api-key',
    openAICompat: true,
  },
];

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type Provider = string;  // id de qualquer provedor acima

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
  input_schema?: unknown;   // formato Anthropic (convertido internamente)
  parameters?: unknown;     // formato OpenAI/Gemini
  type?: string;
  display_width_px?: number;
  display_height_px?: number;
}

export interface LLMResponse {
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop';
  usage?: { input_tokens?: number; output_tokens?: number };
  provider: string;
}

export interface LLMConfig {
  messages: Message[];
  system?: string;
  tools?: Tool[];
  maxTokens?: number;
  useComputerUseBeta?: boolean;  // ignorado (era exclusivo Anthropic)
}

// ── Configuração em storage ────────────────────────────────────────────────────

export interface StoredSettings {
  llm_provider?: string;
  custom_name?: string;
  custom_base_url?: string;
  [key: string]: string | undefined;   // {id}_api_key, {id}_model
}

const ALL_STORAGE_KEYS: string[] = [
  'llm_provider',
  'custom_name',
  'custom_base_url',
  ...PROVIDERS.flatMap((p) => [`${p.id}_api_key`, `${p.id}_model`]),
];

export async function getSettings(): Promise<StoredSettings> {
  return chrome.storage.local.get(ALL_STORAGE_KEYS) as Promise<StoredSettings>;
}

export async function saveSettings(settings: Partial<StoredSettings>): Promise<void> {
  return chrome.storage.local.set(settings);
}

// ── Helpers de settings ───────────────────────────────────────────────────────

function providerApiKey(settings: StoredSettings, id: string): string {
  return settings[`${id}_api_key`] ?? '';
}

function providerModel(settings: StoredSettings, provDef: ProviderDef): string {
  return settings[`${provDef.id}_model`] || provDef.defaultModel;
}

// ── Entry point unificado ─────────────────────────────────────────────────────

export async function callLLM(opts: LLMConfig): Promise<LLMResponse> {
  const settings = await getSettings();
  const providerId = settings.llm_provider ?? 'openai';
  const provDef = PROVIDERS.find((p) => p.id === providerId);

  if (!provDef) throw new Error(`Provedor desconhecido: ${providerId}`);

  if (provDef.id === 'gemini') return callGemini(opts, settings, provDef);

  // OpenAI-compatível (openai, mistral, groq, together, perplexity, custom)
  const baseUrl = provDef.id === 'custom'
    ? (settings.custom_base_url ?? '').replace(/\/$/, '')
    : provDef.baseUrl;

  if (!baseUrl) throw new Error(`URL base não configurada para "${provDef.name}".`);

  const apiKey = providerApiKey(settings, provDef.id);
  if (!apiKey) throw new Error(`API key não configurada para "${provDef.name}".`);

  const model = providerModel(settings, provDef);
  if (!model) throw new Error(`Modelo não configurado para "${provDef.name}".`);

  return callOpenAICompat(opts, apiKey, baseUrl, model, provDef.id);
}

// Mantém compatibilidade com agent-loop.ts que importa callClaude
export const callClaude = callLLM;

// ── Retry on 429 ─────────────────────────────────────────────────────────────

function parseRetryAfterMs(body: string, headers: Headers): number {
  // Groq devolve o tempo no JSON: "Please try again in 16.3s"
  const match = body.match(/try again in ([\d.]+)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 500;
  // Cabeçalho padrão Retry-After (segundos)
  const hdr = headers.get('retry-after');
  if (hdr) return (parseInt(hdr, 10) || 10) * 1000 + 500;
  return 15_000;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  providerId: string,
  maxRetries = 3,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, init);
    if (res.status !== 429 || attempt >= maxRetries) return res;

    const body = await res.text();
    const waitMs = parseRetryAfterMs(body, res.headers);
    console.warn(`[LLM] ${providerId} rate-limit — aguardando ${(waitMs / 1000).toFixed(1)}s...`);
    await new Promise((r) => setTimeout(r, waitMs));
    attempt++;
  }
}

// ── OpenAI-compatível (OpenAI, Mistral, Groq, Together, Perplexity, Custom) ──

async function callOpenAICompat(
  opts: LLMConfig,
  apiKey: string,
  baseUrl: string,
  model: string,
  providerId: string,
): Promise<LLMResponse> {
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

  const tools = opts.tools?.map((t) => ({
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

  const res = await fetchWithRetry(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  }, providerId);

  if (!res.ok) throw new Error(`${providerId} ${res.status}: ${await res.text()}`);

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
    try { parsedInput = JSON.parse(tc.function.arguments); } catch { /* mantém {} */ }
    content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input: parsedInput });
  }

  const stop = choice.finish_reason === 'tool_calls' ? 'tool_use'
    : choice.finish_reason === 'length' ? 'max_tokens'
    : 'end_turn';

  return {
    content,
    stop_reason: stop,
    usage: { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens },
    provider: providerId,
  };
}

function convertContentToOpenAI(blocks: ContentBlock[]): unknown[] {
  return blocks.map((b) => {
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

async function callGemini(
  opts: LLMConfig,
  settings: StoredSettings,
  provDef: ProviderDef,
): Promise<LLMResponse> {
  const apiKey = providerApiKey(settings, 'gemini');
  if (!apiKey) throw new Error('Gemini API key não configurada.');

  const model = providerModel(settings, provDef);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = [];
  for (const msg of opts.messages) {
    const parts = typeof msg.content === 'string'
      ? [{ text: msg.content }]
      : convertContentToGemini(msg.content);
    contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts });
  }

  const functionDeclarations = opts.tools
    ?.filter((t) => !t.type)
    .map((t) => ({
      name: t.name,
      description: t.description ?? '',
      parameters: t.parameters ?? t.input_schema ?? { type: 'object', properties: {} },
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: opts.maxTokens ?? 4096 },
  };

  if (opts.system) body['systemInstruction'] = { parts: [{ text: opts.system }] };

  if (functionDeclarations?.length) {
    body['tools'] = [{ functionDeclarations }];
    body['toolConfig'] = { functionCallingConfig: { mode: 'AUTO' } };
  }

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, 'gemini');

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
    if (part.text) content.push({ type: 'text', text: part.text });
    if (part.functionCall) {
      content.push({
        type: 'tool_use',
        id: `gemini-${Date.now()}`,
        name: part.functionCall.name,
        input: part.functionCall.args,
      });
    }
  }

  const stop: LLMResponse['stop_reason'] =
    content.some((b) => b.type === 'tool_use') ? 'tool_use'
    : candidate.finishReason === 'MAX_TOKENS' ? 'max_tokens'
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
  return blocks.map((b) => {
    if (b.type === 'text') return { text: b.text };
    if (b.type === 'image' && b.source) {
      return { inlineData: { mimeType: b.source.media_type, data: b.source.data } };
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

// ── Compatibilidade retroativa ────────────────────────────────────────────────

export async function getApiKey(): Promise<string> {
  const s = await getSettings();
  const id = s.llm_provider ?? 'openai';
  return providerApiKey(s, id);
}
