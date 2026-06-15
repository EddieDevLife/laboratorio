export type ElementKind = 'button' | 'input' | 'link' | 'image' | 'text' | 'select' | 'checkbox' | 'other';

export interface BoundingBox {
  x: number;       // pixels from left
  y: number;       // pixels from top
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface DetectedElement {
  id: string;
  kind: ElementKind;
  label: string;          // visible text or description
  confidence: number;     // 0–1
  bounds: BoundingBox;
  attributes?: Record<string, string>;
}

export interface ColorInfo {
  hex: string;
  rgb: [number, number, number];
  name: string;           // best-match color name
  coverage: number;       // % of image area
}

export interface OCRBlock {
  text: string;
  bounds: BoundingBox;
  confidence: number;
  language?: string;
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
  patterns: string[];     // detected UI patterns ("modal", "form", "table", etc.)
  summary: string;        // natural language description
  rawResponse?: string;
}

export interface VisionRequest {
  sessionId: string;
  screenshotBase64: string;  // PNG/JPEG base64 (no data: prefix)
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
  tasks?: Array<'detect_elements' | 'ocr' | 'colors' | 'patterns'>;
  apiKey?: string;
}
