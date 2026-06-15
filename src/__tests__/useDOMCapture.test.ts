import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDOMCapture } from '../hooks/useDOMCapture';

function setupDOM() {
  document.body.innerHTML = `
    <main>
      <h1 id="title">Página de teste</h1>
      <nav aria-label="Menu principal">
        <a href="/home">Home</a>
        <a href="/about">Sobre</a>
      </nav>
      <form>
        <label for="name">Nome</label>
        <input id="name" type="text" placeholder="Digite seu nome" required />
        <button type="submit" aria-label="Enviar formulário">Enviar</button>
        <input type="checkbox" id="terms" aria-label="Aceitar termos" />
      </form>
      <img src="logo.png" alt="Logo da empresa" />
    </main>
  `;
}

describe('useDOMCapture', () => {
  beforeEach(setupDOM);

  it('inicia sem snapshot', () => {
    const { result } = renderHook(() => useDOMCapture());
    expect(result.current.snapshot).toBeNull();
  });

  it('capture() popula snapshot', () => {
    const { result } = renderHook(() => useDOMCapture());
    act(() => { result.current.capture(); });
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.snapshot!.url).toBeTruthy();
  });

  it('capture encontra elementos interativos (a, button, input)', () => {
    const { result } = renderHook(() => useDOMCapture());
    act(() => { result.current.capture(); });
    // Percorre a árvore completa buscando elementos interativos (independe de visible em jsdom)
    function flatten(node: ReturnType<typeof result.current.getInteractiveElements>[0]): typeof node[] {
      return [node, ...node.children.flatMap(flatten)];
    }
    const all = flatten(result.current.snapshot!.tree);
    const interactiveTags = all.filter(n => n.interactive).map(n => n.tag);
    expect(interactiveTags).toContain('a');
    expect(interactiveTags).toContain('button');
    expect(interactiveTags).toContain('input');
  });

  it('getFocusableElements não inclui elementos ocultos', () => {
    document.body.innerHTML += '<button style="display:none">Oculto</button>';
    const { result } = renderHook(() => useDOMCapture());
    act(() => { result.current.capture(); });
    const focusable = result.current.getFocusableElements();
    expect(focusable.every(e => e.visible)).toBe(true);
  });

  it('findByRole("button") retorna os botões', () => {
    const { result } = renderHook(() => useDOMCapture());
    act(() => { result.current.capture(); });
    const buttons = result.current.findByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every(b => b.role === 'button')).toBe(true);
  });

  it('findByName busca por nome acessível', () => {
    const { result } = renderHook(() => useDOMCapture());
    act(() => { result.current.capture(); });
    const found = result.current.findByName('Enviar');
    expect(found.length).toBeGreaterThan(0);
  });

  it('serializeToJSON retorna string JSON válida', () => {
    const { result } = renderHook(() => useDOMCapture());
    act(() => { result.current.capture(); });
    const json = result.current.serializeToJSON();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('snapshot.interactiveCount > 0', () => {
    const { result } = renderHook(() => useDOMCapture());
    act(() => { result.current.capture(); });
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.snapshot!.interactiveCount).toBeGreaterThan(0);
  });
});
