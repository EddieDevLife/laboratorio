import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts.js';

function makeShortcuts(overrides: Partial<Parameters<typeof useKeyboardShortcuts>[0]> = {}) {
  return {
    'ctrl+enter': vi.fn(),
    'escape': vi.fn(),
    'alt+t': vi.fn(),
    'alt+s': vi.fn(),
    ...overrides,
  };
}

describe('useKeyboardShortcuts', () => {
  afterEach(() => {
    // cleanup renderHook removes the listeners via useEffect cleanup
  });

  it('Ctrl+Enter chama ctrl+enter callback', () => {
    const shortcuts = makeShortcuts();
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });
    expect(shortcuts['ctrl+enter']).toHaveBeenCalledOnce();
  });

  it('Escape chama escape callback', () => {
    const shortcuts = makeShortcuts();
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(shortcuts['escape']).toHaveBeenCalledOnce();
  });

  it('Alt+T chama alt+t callback', () => {
    const shortcuts = makeShortcuts();
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireEvent.keyDown(document, { key: 't', altKey: true });
    expect(shortcuts['alt+t']).toHaveBeenCalledOnce();
  });

  it('Alt+S chama alt+s callback', () => {
    const shortcuts = makeShortcuts();
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireEvent.keyDown(document, { key: 's', altKey: true });
    expect(shortcuts['alt+s']).toHaveBeenCalledOnce();
  });

  it('teclas comuns não disparam callbacks', () => {
    const shortcuts = makeShortcuts();
    renderHook(() => useKeyboardShortcuts(shortcuts));
    fireEvent.keyDown(document, { key: 'a' });
    fireEvent.keyDown(document, { key: 'Enter' }); // sem Ctrl
    expect(shortcuts['ctrl+enter']).not.toHaveBeenCalled();
    expect(shortcuts['escape']).not.toHaveBeenCalled();
  });
});
