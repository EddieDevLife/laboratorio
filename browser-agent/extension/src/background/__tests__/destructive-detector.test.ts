import { describe, it, expect } from 'vitest';
import { isDestructive } from '../destructive-detector.js';
import type { BrowserAction } from '../narration.js';

describe('isDestructive', () => {
  it.each<[BrowserAction, boolean]>([
    [{ action: 'click', name: 'Confirmar pedido' }, true],
    [{ action: 'click', name: 'Comprar agora' }, true],
    [{ action: 'click', name: 'Finalizar compra' }, true],
    [{ action: 'click', name: 'Pesquisar' }, false],
    [{ action: 'navigate', url: 'https://checkout.mercadolivre.com.br/checkout' }, true],
    [{ action: 'navigate', url: 'https://mercadolivre.com.br/produto/1' }, false],
    [{ action: 'type', name: 'campo de busca' }, false],
    [{ action: 'click', name: 'Delete account', role: 'button' }, true],
    [{ action: 'press_key', key: 'Enter', reasoning: 'submit the form to pay' }, true],
  ])('classifica %o como %s', (action, expected) => {
    expect(isDestructive(action)).toBe(expected);
  });
});
