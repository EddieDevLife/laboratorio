import type { BrowserAction } from './narration.js';

const DESTRUCTIVE_PATTERNS = [
  /\b(comprar|confirmar|pagar|deletar|excluir|enviar|checkout|finalizar)\b/i,
  /\b(buy|purchase|confirm|delete|send|pay|submit|place.?order)\b/i,
  /checkout\./i,
  /\/checkout/i,
  /\/pagamento/i,
  /\/confirmar/i,
];

export function isDestructive(action: BrowserAction): boolean {
  const label = [action.name ?? '', action.role ?? '', action.reasoning ?? '', action.url ?? ''].join(' ');
  return DESTRUCTIVE_PATTERNS.some(p => p.test(label));
}
