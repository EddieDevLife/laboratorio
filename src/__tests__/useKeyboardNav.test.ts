import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNav } from '../hooks/useKeyboardNav';

function setupFocusableDOM() {
  document.body.innerHTML = `
    <button id="btn1">Botão 1</button>
    <a href="#" id="link1">Link</a>
    <input id="input1" type="text" placeholder="Nome" required />
    <input id="chk1" type="checkbox" aria-label="Aceitar" />
    <button id="btn2" disabled>Desabilitado</button>
    <select id="sel1"><option>A</option><option>B</option></select>
  `;
}

describe('useKeyboardNav', () => {
  beforeEach(setupFocusableDOM);

  it('buildTabOrder retorna elementos focáveis na ordem DOM', () => {
    const { result } = renderHook(() => useKeyboardNav());
    let order: ReturnType<typeof result.current.buildTabOrder>;
    act(() => { order = result.current.buildTabOrder(); });
    // Deve incluir btn1, link1, input1, chk1, sel1 (btn2 disabled pode ser incluído dependendo do browser)
    expect(order!.length).toBeGreaterThanOrEqual(4);
    expect(order![0].tag).toBe('button');
  });

  it('tabOrder atualiza state após buildTabOrder', () => {
    const { result } = renderHook(() => useKeyboardNav());
    act(() => { result.current.buildTabOrder(); });
    expect(result.current.tabOrder.length).toBeGreaterThan(0);
  });

  it('pressTab dispara evento de teclado e registra no histórico', async () => {
    const { result } = renderHook(() => useKeyboardNav());
    act(() => { result.current.buildTabOrder(); });
    document.getElementById('btn1')!.focus();

    await act(async () => {
      result.current.pressTab();
      await new Promise(r => setTimeout(r, 60));
    });

    expect(result.current.keyHistory.length).toBeGreaterThan(0);
    expect(result.current.keyHistory[0].key).toBe('Tab');
  });

  it('pressEnter registra evento Enter', async () => {
    const { result } = renderHook(() => useKeyboardNav());
    document.getElementById('btn1')!.focus();
    await act(async () => {
      result.current.pressEnter();
      await new Promise(r => setTimeout(r, 60));
    });
    expect(result.current.keyHistory[0].key).toBe('Enter');
  });

  it('pressEscape registra evento Escape', async () => {
    const { result } = renderHook(() => useKeyboardNav());
    document.getElementById('btn1')!.focus();
    await act(async () => {
      result.current.pressEscape();
      await new Promise(r => setTimeout(r, 60));
    });
    expect(result.current.keyHistory[0].key).toBe('Escape');
  });

  it('pressArrow registra evento de seta correta', async () => {
    const { result } = renderHook(() => useKeyboardNav());
    document.getElementById('btn1')!.focus();
    await act(async () => {
      result.current.pressArrow('down');
      await new Promise(r => setTimeout(r, 60));
    });
    expect(result.current.keyHistory[0].key).toBe('ArrowDown');
  });

  it('clearHistory esvazia o histórico', async () => {
    const { result } = renderHook(() => useKeyboardNav());
    document.getElementById('btn1')!.focus();
    await act(async () => {
      result.current.pressTab();
      await new Promise(r => setTimeout(r, 60));
    });
    act(() => { result.current.clearHistory(); });
    expect(result.current.keyHistory).toHaveLength(0);
  });

  it('getElementState detecta campo required', () => {
    const { result } = renderHook(() => useKeyboardNav());
    const input = document.getElementById('input1')!;
    const state = result.current.getElementState(input);
    expect(state.required).toBe(true);
    expect(state.disabled).toBe(false);
  });

  it('keyHistory tem no máximo 50 entradas', async () => {
    const { result } = renderHook(() => useKeyboardNav());
    document.getElementById('btn1')!.focus();
    for (let i = 0; i < 55; i++) {
      await act(async () => {
        result.current.pressEscape();
        await new Promise(r => setTimeout(r, 10));
      });
    }
    expect(result.current.keyHistory.length).toBeLessThanOrEqual(50);
  });
});
