import { v4 as uuidv4 } from 'uuid';
import type {
  VisionRequest,
  VisionAnalysis,
  DetectedElement,
  OCRBlock,
  ColorInfo,
  BoundingBox,
  ElementKind,
} from './types.js';

// ── Prompt ─────────────────────────────────────────────────────────────────────

function buildPrompt(tasks: string[]): string {
  const doElements = tasks.includes('detect_elements');
  const doOcr = tasks.includes('ocr');
  const doColors = tasks.includes('colors');
  const doPatterns = tasks.includes('patterns');

  return `Analise esta screenshot de interface web e responda APENAS com um JSON no seguinte formato (sem markdown):

{
  "imageWidth": <número de pixels de largura>,
  "imageHeight": <número de pixels de altura>,
  "summary": "<descrição geral da interface em 1-2 frases>",
  ${doElements ? `"elements": [
    {
      "kind": "<button|input|link|image|text|select|checkbox|other>",
      "label": "<texto visível ou descrição>",
      "confidence": <0.0 a 1.0>,
      "bounds": { "x": <px>, "y": <px>, "width": <px>, "height": <px>, "centerX": <px>, "centerY": <px> },
      "attributes": { "<chave>": "<valor>" }
    }
  ],` : '"elements": [],'}
  ${doOcr ? `"ocr": [
    {
      "text": "<texto extraído>",
      "bounds": { "x": <px>, "y": <px>, "width": <px>, "height": <px>, "centerX": <px>, "centerY": <px> },
      "confidence": <0.0 a 1.0>,
      "language": "<código ISO>"
    }
  ],` : '"ocr": [],'}
  ${doColors ? `"dominantColors": [
    { "hex": "#rrggbb", "rgb": [r, g, b], "name": "<nome da cor>", "coverage": <0.0 a 1.0> }
  ],` : '"dominantColors": [],'}
  ${doPatterns ? `"patterns": ["<padrão UI detectado>"]` : '"patterns": []'}
}

Instruções:
- Detecte TODOS os elementos interativos visíveis: botões, inputs, links, imagens, checkboxes, selects.
- As coordenadas são em pixels absolutos relativos ao canto superior esquerdo da imagem.
- Para OCR, extraia todo texto visível preservando a posição aproximada.
- Para cores dominantes, liste no máximo 5, em ordem de área coberta.
- Padrões UI exemplos: "login-form", "navigation-bar", "modal", "data-table", "card-grid", "search-bar", "dashboard".
- confidence deve refletir sua certeza real (0.0–1.0).
- Responda SOMENTE o JSON, sem texto adicional.`;
}

// ── Parser ─────────────────────────────────────────────────────────────────────

interface RawAnalysis {
  imageWidth?: number;
  imageHeight?: number;
  summary?: string;
  elements?: Array<{
    kind?: string;
    label?: string;
    confidence?: number;
    bounds?: Partial<BoundingBox>;
    attributes?: Record<string, string>;
  }>;
  ocr?: Array<{
    text?: string;
    bounds?: Partial<BoundingBox>;
    confidence?: number;
    language?: string;
  }>;
  dominantColors?: Array<{
    hex?: string;
    rgb?: [number, number, number];
    name?: string;
    coverage?: number;
  }>;
  patterns?: string[];
}

function completeBounds(b: Partial<BoundingBox>): BoundingBox {
  const x = b.x ?? 0;
  const y = b.y ?? 0;
  const width = b.width ?? 0;
  const height = b.height ?? 0;
  return {
    x, y, width, height,
    centerX: b.centerX ?? Math.round(x + width / 2),
    centerY: b.centerY ?? Math.round(y + height / 2),
  };
}

const VALID_KINDS = new Set<string>([
  'button', 'input', 'link', 'image', 'text', 'select', 'checkbox', 'other',
]);

function parseAnalysis(raw: RawAnalysis, sessionId: string): VisionAnalysis {
  const elements: DetectedElement[] = (raw.elements ?? []).map(el => ({
    id: uuidv4(),
    kind: (VALID_KINDS.has(el.kind ?? '') ? el.kind : 'other') as ElementKind,
    label: el.label ?? '',
    confidence: Math.min(1, Math.max(0, el.confidence ?? 0.5)),
    bounds: completeBounds(el.bounds ?? {}),
    attributes: el.attributes,
  }));

  const ocr: OCRBlock[] = (raw.ocr ?? []).map(block => ({
    text: block.text ?? '',
    bounds: completeBounds(block.bounds ?? {}),
    confidence: Math.min(1, Math.max(0, block.confidence ?? 0.5)),
    language: block.language,
  }));

  const dominantColors: ColorInfo[] = (raw.dominantColors ?? []).slice(0, 5).map(c => ({
    hex: c.hex ?? '#000000',
    rgb: c.rgb ?? [0, 0, 0],
    name: c.name ?? 'desconhecida',
    coverage: Math.min(1, Math.max(0, c.coverage ?? 0)),
  }));

  return {
    id: uuidv4(),
    sessionId,
    analyzedAt: new Date().toISOString(),
    imageWidth: raw.imageWidth ?? 0,
    imageHeight: raw.imageHeight ?? 0,
    elements,
    ocr,
    dominantColors,
    patterns: raw.patterns ?? [],
    summary: raw.summary ?? '',
  };
}

// ── In-memory store ────────────────────────────────────────────────────────────

const analyses = new Map<string, VisionAnalysis>();
const MAX_ANALYSES = 20;

export function getAnalysis(id: string): VisionAnalysis | undefined {
  return analyses.get(id);
}

export function listAnalyses(sessionId?: string): VisionAnalysis[] {
  const all = Array.from(analyses.values());
  return sessionId ? all.filter(a => a.sessionId === sessionId) : all;
}

export function deleteAnalysis(id: string): boolean {
  return analyses.delete(id);
}

// ── Main analyzer ──────────────────────────────────────────────────────────────

export async function analyzeScreenshot(req: VisionRequest): Promise<VisionAnalysis> {
  const apiKey = req.apiKey ?? process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada');

  const tasks = req.tasks ?? ['detect_elements', 'ocr', 'colors', 'patterns'];
  const mimeType = req.mimeType ?? 'image/png';

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: req.screenshotBase64 },
          },
          { type: 'text', text: buildPrompt(tasks) },
        ],
      },
    ],
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

  const data = await res.json() as { content: Array<{ type: string; text?: string }> };
  const textBlock = data.content.find(b => b.type === 'text');
  if (!textBlock?.text) throw new Error('Resposta vazia da API');

  let raw: RawAnalysis;
  try {
    // Strip possible markdown code fences
    const cleaned = textBlock.text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    raw = JSON.parse(cleaned) as RawAnalysis;
  } catch {
    throw new Error(`Falha ao parsear JSON da API: ${textBlock.text.slice(0, 200)}`);
  }

  const analysis = parseAnalysis(raw, req.sessionId);
  analysis.rawResponse = textBlock.text;

  analyses.set(analysis.id, analysis);
  if (analyses.size > MAX_ANALYSES) {
    const oldest = analyses.keys().next().value;
    if (oldest) analyses.delete(oldest);
  }

  return analysis;
}

// ── Query helpers (used by route) ──────────────────────────────────────────────

export function getElementsByKind(analysisId: string, kind: string) {
  const a = analyses.get(analysisId);
  if (!a) return null;
  return a.elements.filter(el => el.kind === kind);
}

export function findElementAt(analysisId: string, x: number, y: number) {
  const a = analyses.get(analysisId);
  if (!a) return null;
  return a.elements.find(el => {
    const { bounds: b } = el;
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }) ?? null;
}

export function searchOCR(analysisId: string, query: string) {
  const a = analyses.get(analysisId);
  if (!a) return null;
  const q = query.toLowerCase();
  return a.ocr.filter(b => b.text.toLowerCase().includes(q));
}
