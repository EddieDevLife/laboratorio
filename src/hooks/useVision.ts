import { useState, useCallback } from 'react';

// ── Tipos (espelho do backend) ─────────────────────────────────────────────────

export type ElementKind = 'button' | 'input' | 'link' | 'image' | 'text' | 'select' | 'checkbox' | 'other';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface DetectedElement {
  id: string;
  kind: ElementKind;
  label: string;
  confidence: number;
  bounds: BoundingBox;
  attributes?: Record<string, string>;
}

export interface OCRBlock {
  text: string;
  bounds: BoundingBox;
  confidence: number;
  language?: string;
}

export interface ColorInfo {
  hex: string;
  rgb: [number, number, number];
  name: string;
  coverage: number;
}

export interface VisionAnalysis {
  id: string;
  sessionId: string;
  analyzedAt: string;
  imageWidth: number;
  imageHeight: number;
  elements: DetectedElement[];
  ocr: OCRBlock[];
  dominantColors: ColorInfo[];
  patterns: string[];
  summary: string;
}

export type VisionTask = 'detect_elements' | 'ocr' | 'colors' | 'patterns';

// ── Hook ───────────────────────────────────────────────────────────────────────

const BACKEND = 'http://localhost:3001';

export interface UseVisionReturn {
  analysis: VisionAnalysis | null;
  analyzing: boolean;
  error: string | null;
  analyze: (opts: {
    screenshotBase64: string;
    sessionId: string;
    mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
    tasks?: VisionTask[];
    apiKey?: string;
  }) => Promise<VisionAnalysis | null>;
  analyzeFromDataUrl: (opts: {
    dataUrl: string;
    sessionId: string;
    tasks?: VisionTask[];
    apiKey?: string;
  }) => Promise<VisionAnalysis | null>;
  getElementsByKind: (kind: ElementKind) => DetectedElement[];
  searchOCR: (query: string) => OCRBlock[];
  findAt: (x: number, y: number) => DetectedElement | null;
  clear: () => void;
}

function dataUrlToBase64(dataUrl: string): { base64: string; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' } {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header?.match(/data:([^;]+)/);
  const mime = (mimeMatch?.[1] ?? 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp';
  return { base64: base64 ?? '', mimeType: mime };
}

export function useVision(): UseVisionReturn {
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (opts: {
    screenshotBase64: string;
    sessionId: string;
    mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
    tasks?: VisionTask[];
    apiKey?: string;
  }): Promise<VisionAnalysis | null> => {
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch(`${BACKEND}/vision/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: opts.sessionId,
          screenshotBase64: opts.screenshotBase64,
          mimeType: opts.mimeType ?? 'image/png',
          tasks: opts.tasks ?? ['detect_elements', 'ocr', 'colors', 'patterns'],
          apiKey: opts.apiKey,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const result = await res.json() as VisionAnalysis;
      setAnalysis(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const analyzeFromDataUrl = useCallback(async (opts: {
    dataUrl: string;
    sessionId: string;
    tasks?: VisionTask[];
    apiKey?: string;
  }): Promise<VisionAnalysis | null> => {
    const { base64, mimeType } = dataUrlToBase64(opts.dataUrl);
    return analyze({ ...opts, screenshotBase64: base64, mimeType });
  }, [analyze]);

  const getElementsByKind = useCallback((kind: ElementKind): DetectedElement[] => {
    return analysis?.elements.filter(el => el.kind === kind) ?? [];
  }, [analysis]);

  const searchOCR = useCallback((query: string): OCRBlock[] => {
    if (!analysis) return [];
    const q = query.toLowerCase();
    return analysis.ocr.filter(b => b.text.toLowerCase().includes(q));
  }, [analysis]);

  const findAt = useCallback((x: number, y: number): DetectedElement | null => {
    if (!analysis) return null;
    return analysis.elements.find(el => {
      const { bounds: b } = el;
      return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
    }) ?? null;
  }, [analysis]);

  const clear = useCallback(() => {
    setAnalysis(null);
    setError(null);
  }, []);

  return { analysis, analyzing, error, analyze, analyzeFromDataUrl, getElementsByKind, searchOCR, findAt, clear };
}
