import { describe, it, expect, beforeEach } from 'vitest';
import { useAnnouncer } from '../useAnnouncer.js';

describe('useAnnouncer', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="agent-live-polite" role="status" aria-live="polite"></div>
      <div id="agent-live-assertive" role="alert" aria-live="assertive"></div>
    `;
  });

  it('atualiza #agent-live-polite com texto anunciado', async () => {
    const { announce } = useAnnouncer();
    announce('Passo 3: clicou em Login');
    await new Promise(r => setTimeout(r, 50));
    expect(document.getElementById('agent-live-polite')?.textContent).toBe('Passo 3: clicou em Login');
  });

  it('atualiza #agent-live-assertive para priority assertive', async () => {
    const { announce } = useAnnouncer();
    announce('Confirmação necessária', 'assertive');
    await new Promise(r => setTimeout(r, 50));
    expect(document.getElementById('agent-live-assertive')?.textContent).toBe('Confirmação necessária');
  });

  it('não lança erro quando os divs não existem', () => {
    document.body.innerHTML = '';
    const { announce } = useAnnouncer();
    expect(() => announce('texto')).not.toThrow();
  });
});
