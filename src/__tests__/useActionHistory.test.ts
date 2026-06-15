import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionHistory } from '../hooks/useActionHistory';

describe('useActionHistory', () => {
  it('inicia com lista vazia', () => {
    const { result } = renderHook(() => useActionHistory());
    expect(result.current.actions).toHaveLength(0);
  });

  it('push adiciona entrada com id e timestamp', () => {
    const { result } = renderHook(() => useActionHistory());
    act(() => {
      result.current.push({ type: 'dom', label: 'DOM capturado' });
    });
    expect(result.current.actions).toHaveLength(1);
    expect(result.current.actions[0].type).toBe('dom');
    expect(result.current.actions[0].label).toBe('DOM capturado');
    expect(result.current.actions[0].id).toBeTruthy();
    expect(result.current.actions[0].timestamp).toBeTruthy();
  });

  it('entradas mais recentes aparecem primeiro', () => {
    const { result } = renderHook(() => useActionHistory());
    act(() => {
      result.current.push({ type: 'dom', label: 'primeiro' });
      result.current.push({ type: 'vision', label: 'segundo' });
    });
    expect(result.current.actions[0].label).toBe('segundo');
    expect(result.current.actions[1].label).toBe('primeiro');
  });

  it('clear esvazia o histórico', () => {
    const { result } = renderHook(() => useActionHistory());
    act(() => {
      result.current.push({ type: 'screenshot', label: 'img' });
      result.current.clear();
    });
    expect(result.current.actions).toHaveLength(0);
  });

  it('preserva detail e durationMs opcionais', () => {
    const { result } = renderHook(() => useActionHistory());
    act(() => {
      result.current.push({ type: 'llm', label: 'análise', detail: 'ok', durationMs: 320 });
    });
    const entry = result.current.actions[0];
    expect(entry.detail).toBe('ok');
    expect(entry.durationMs).toBe(320);
  });

  it('limita a 100 entradas (MAX)', () => {
    const { result } = renderHook(() => useActionHistory());
    act(() => {
      for (let i = 0; i < 110; i++) {
        result.current.push({ type: 'command', label: `cmd-${i}` });
      }
    });
    expect(result.current.actions).toHaveLength(100);
    // Mais recente deve ser o último inserido
    expect(result.current.actions[0].label).toBe('cmd-109');
  });
});
