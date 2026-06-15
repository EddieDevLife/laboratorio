import '@testing-library/jest-dom';

// Stub chrome APIs used in tests
const chromeStorageData: Record<string, unknown> = {};

globalThis.chrome = {
  storage: {
    local: {
      get: (_keys: unknown, cb: (r: Record<string, unknown>) => void) => cb(chromeStorageData),
      set: (data: Record<string, unknown>, cb?: () => void) => {
        Object.assign(chromeStorageData, data);
        cb?.();
      },
    },
  },
  runtime: {
    lastError: undefined,
    sendMessage: () => Promise.resolve(),
  },
} as unknown as typeof chrome;
