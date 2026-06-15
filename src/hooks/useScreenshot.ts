import { useState, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type ScreenshotMode = 'viewport' | 'fullpage';
export type ScreenshotFormat = 'png' | 'jpeg' | 'webp';

export interface ScreenshotOptions {
  mode?: ScreenshotMode;
  format?: ScreenshotFormat;
  quality?: number;       // 0–1, só para jpeg/webp
  scale?: number;         // 1 = 100%, 2 = retina
  backgroundColor?: string;
  target?: HTMLElement;   // capturar elemento específico em vez da página inteira
  label?: string;
}

export interface Screenshot {
  id: string;
  dataUrl: string;
  mode: ScreenshotMode;
  format: ScreenshotFormat;
  width: number;
  height: number;
  capturedAt: string;
  url: string;
  title: string;
  fileSizeKB: number;
  label?: string;
}

export interface UseScreenshotReturn {
  screenshots: Screenshot[];
  capturing: boolean;
  error: string | null;
  capture: (opts?: ScreenshotOptions) => Promise<Screenshot | null>;
  captureViewport: () => Promise<Screenshot | null>;
  captureFullPage: () => Promise<Screenshot | null>;
  captureElement: (el: HTMLElement, label?: string) => Promise<Screenshot | null>;
  remove: (id: string) => void;
  clear: () => void;
  download: (id: string) => void;
  downloadAll: () => void;
  copyToClipboard: (id: string) => Promise<void>;
  getById: (id: string) => Screenshot | undefined;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeId(): string {
  return `ss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function dataUrlToKB(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.round((base64.length * 3) / 4 / 1024);
}

async function runHtml2Canvas(
  target: HTMLElement,
  opts: ScreenshotOptions,
): Promise<HTMLCanvasElement> {
  const isFullPage = opts.mode === 'fullpage';
  const scale = opts.scale ?? window.devicePixelRatio ?? 1;

  const canvas = await html2canvas(target, {
    // Captura a página inteira ou só o viewport
    height: isFullPage ? document.documentElement.scrollHeight : window.innerHeight,
    width: isFullPage ? document.documentElement.scrollWidth : window.innerWidth,
    windowHeight: isFullPage ? document.documentElement.scrollHeight : window.innerHeight,
    windowWidth: isFullPage ? document.documentElement.scrollWidth : window.innerWidth,
    y: isFullPage ? 0 : window.scrollY,
    x: isFullPage ? 0 : window.scrollX,
    scrollX: isFullPage ? 0 : -window.scrollX,
    scrollY: isFullPage ? 0 : -window.scrollY,
    useCORS: true,
    allowTaint: false,
    scale,
    backgroundColor: opts.backgroundColor ?? '#ffffff',
    logging: false,
    imageTimeout: 10000,
    removeContainer: true,
  });

  return canvas;
}

function canvasToDataUrl(
  canvas: HTMLCanvasElement,
  format: ScreenshotFormat,
  quality: number,
): string {
  const mime = format === 'png' ? 'image/png'
    : format === 'jpeg' ? 'image/jpeg'
    : 'image/webp';
  return canvas.toDataURL(mime, format === 'png' ? undefined : quality);
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function useScreenshot(): UseScreenshotReturn {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captureQueueRef = useRef(false);

  const capture = useCallback(async (opts: ScreenshotOptions = {}): Promise<Screenshot | null> => {
    if (captureQueueRef.current) return null; // evita capturas simultâneas
    captureQueueRef.current = true;
    setCapturing(true);
    setError(null);

    try {
      const mode: ScreenshotMode = opts.mode ?? 'viewport';
      const format: ScreenshotFormat = opts.format ?? 'png';
      const quality = opts.quality ?? 0.92;
      const target = opts.target ?? document.documentElement;

      const canvas = await runHtml2Canvas(target, { ...opts, mode });
      const dataUrl = canvasToDataUrl(canvas, format, quality);

      const shot: Screenshot = {
        id: makeId(),
        dataUrl,
        mode,
        format,
        width: canvas.width,
        height: canvas.height,
        capturedAt: new Date().toISOString(),
        url: window.location.href,
        title: document.title,
        fileSizeKB: dataUrlToKB(dataUrl),
        label: opts.label,
      };

      setScreenshots(prev => [shot, ...prev]);
      return shot;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Falha na captura: ${msg}`);
      return null;
    } finally {
      setCapturing(false);
      captureQueueRef.current = false;
    }
  }, []);

  const captureViewport = useCallback(
    () => capture({ mode: 'viewport' }),
    [capture],
  );

  const captureFullPage = useCallback(
    () => capture({ mode: 'fullpage' }),
    [capture],
  );

  const captureElement = useCallback(
    (el: HTMLElement, label?: string) =>
      capture({ mode: 'viewport', target: el, label }),
    [capture],
  );

  const remove = useCallback((id: string) => {
    setScreenshots(prev => prev.filter(s => s.id !== id));
  }, []);

  const clear = useCallback(() => setScreenshots([]), []);

  const download = useCallback((id: string) => {
    const shot = screenshots.find(s => s.id === id);
    if (!shot) return;
    const a = document.createElement('a');
    a.href = shot.dataUrl;
    a.download = `screenshot-${shot.mode}-${Date.now()}.${shot.format}`;
    a.click();
  }, [screenshots]);

  const downloadAll = useCallback(() => {
    screenshots.forEach((shot, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = shot.dataUrl;
        a.download = `screenshot-${i + 1}-${shot.mode}.${shot.format}`;
        a.click();
      }, i * 300); // espaçamento para evitar bloqueio do browser
    });
  }, [screenshots]);

  const copyToClipboard = useCallback(async (id: string): Promise<void> => {
    const shot = screenshots.find(s => s.id === id);
    if (!shot) return;

    const res = await fetch(shot.dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob }),
    ]);
  }, [screenshots]);

  const getById = useCallback(
    (id: string) => screenshots.find(s => s.id === id),
    [screenshots],
  );

  return {
    screenshots,
    capturing,
    error,
    capture,
    captureViewport,
    captureFullPage,
    captureElement,
    remove,
    clear,
    download,
    downloadAll,
    copyToClipboard,
    getById,
  };
}
