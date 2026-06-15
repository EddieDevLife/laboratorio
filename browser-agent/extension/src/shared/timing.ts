export const CAPTURE_TIMEOUT_MS = 8000;
export const SCRIPT_INJECT_DELAY_MS = 400;
export const ACTION_BETWEEN_DELAY_MS = 200;
export const CLICK_EVENT_DELAY_MS = 40;
export const TYPE_CHAR_DELAY_MS = 30;
export const KEY_EVENT_DELAY_MS = 30;
export const DOUBLE_CLICK_DELAY_MS = 100;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
