import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScreenshot } from '../hooks/useScreenshot';

describe('useScreenshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('estado inicial correto', () => {
    const { result } = renderHook(() => useScreenshot());
    expect(result.current.screenshots).toHaveLength(0);
    expect(result.current.capturing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('captureViewport adiciona screenshot ao store', async () => {
    const { result } = renderHook(() => useScreenshot());
    await act(async () => {
      await result.current.captureViewport();
    });
    expect(result.current.screenshots).toHaveLength(1);
    expect(result.current.screenshots[0].mode).toBe('viewport');
    expect(result.current.screenshots[0].dataUrl).toContain('data:');
  });

  it('captureFullPage adiciona screenshot com mode fullpage', async () => {
    const { result } = renderHook(() => useScreenshot());
    await act(async () => {
      await result.current.captureFullPage();
    });
    expect(result.current.screenshots[0].mode).toBe('fullpage');
  });

  it('remove deleta screenshot pelo id', async () => {
    const { result } = renderHook(() => useScreenshot());
    await act(async () => { await result.current.captureViewport(); });
    const id = result.current.screenshots[0].id;
    act(() => { result.current.remove(id); });
    expect(result.current.screenshots).toHaveLength(0);
  });

  it('clear remove todos os screenshots', async () => {
    const { result } = renderHook(() => useScreenshot());
    await act(async () => {
      await result.current.captureViewport();
      await result.current.captureViewport();
    });
    act(() => { result.current.clear(); });
    expect(result.current.screenshots).toHaveLength(0);
  });

  it('getById retorna screenshot correto', async () => {
    const { result } = renderHook(() => useScreenshot());
    await act(async () => { await result.current.captureViewport(); });
    const id = result.current.screenshots[0].id;
    const found = result.current.getById(id);
    expect(found?.id).toBe(id);
  });

  it('capturas simultâneas são ignoradas (queue guard)', async () => {
    const { result } = renderHook(() => useScreenshot());
    // Dispara duas capturas "ao mesmo tempo" — a segunda deve ser ignorada
    await act(async () => {
      const p1 = result.current.captureViewport();
      const p2 = result.current.captureViewport();
      await Promise.all([p1, p2]);
    });
    expect(result.current.screenshots).toHaveLength(1);
  });

  it('screenshot contém metadados corretos', async () => {
    const { result } = renderHook(() => useScreenshot());
    await act(async () => { await result.current.captureViewport(); });
    const shot = result.current.screenshots[0];
    expect(shot.width).toBe(1280);
    expect(shot.height).toBe(720);
    expect(shot.format).toBe('png');
    expect(shot.capturedAt).toBeTruthy();
  });
});
