import '@testing-library/jest-dom';
import { vi } from 'vitest';

// html2canvas mock — não disponível em jsdom
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    width: 1280,
    height: 720,
    toDataURL: (mime = 'image/png') => `data:${mime};base64,MOCK`,
  }),
}));

// Navigator clipboard mock
Object.defineProperty(navigator, 'clipboard', {
  value: {
    write: vi.fn().mockResolvedValue(undefined),
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

// ClipboardItem mock
globalThis.ClipboardItem = vi.fn().mockImplementation((items: unknown) => items) as unknown as typeof ClipboardItem;

// ResizeObserver mock
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// requestAnimationFrame mock
globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => { cb(0); return 0; });
