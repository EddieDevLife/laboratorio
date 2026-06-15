import { describe, it, expect } from 'vitest';
import { buildNarration } from '../narration.js';

describe('buildNarration', () => {
  it('click com name', () => {
    expect(buildNarration({ action: 'click', name: 'Pesquisar' })).toBe('Clicando em Pesquisar');
  });

  it('click sem name', () => {
    expect(buildNarration({ action: 'click' })).toBe('Clicando no elemento');
  });

  it('navigate extrai hostname', () => {
    expect(buildNarration({ action: 'navigate', url: 'https://www.google.com/search?q=ia' })).toBe('Navegando para google.com');
  });

  it('navigate URL inválida não lança', () => {
    expect(() => buildNarration({ action: 'navigate', url: 'google' })).not.toThrow();
  });

  it('type com name', () => {
    expect(buildNarration({ action: 'type', name: 'campo de busca' })).toBe('Digitando em campo de busca');
  });

  it('press_key', () => {
    expect(buildNarration({ action: 'press_key', key: 'Enter' })).toBe('Pressionando Enter');
  });

  it('done', () => {
    expect(buildNarration({ action: 'done' })).toBe('Tarefa concluída');
  });

  it('scroll', () => {
    expect(buildNarration({ action: 'scroll' })).toBe('Rolando a página');
  });

  it('ação desconhecida não lança', () => {
    expect(() => buildNarration({ action: 'unknown_action' })).not.toThrow();
    expect(buildNarration({ action: 'unknown_action' })).toBe('Executando unknown_action');
  });
});
