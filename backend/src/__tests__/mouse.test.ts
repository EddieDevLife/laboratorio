import { describe, it, expect, beforeEach } from 'vitest';
import {
  enqueue,
  enqueueBatch,
  drain,
  peek,
  ack,
  clearQueue,
  queueStats,
} from '../mouse/queue.js';

const SESSION = 'mouse-test-session';

beforeEach(() => clearQueue(SESSION));

describe('mouse queue', () => {
  it('enqueue retorna item com id e status pending', () => {
    const item = enqueue(SESSION, { type: 'move', x: 100, y: 200 });
    expect(item.id).toBeTruthy();
    expect(item.status).toBe('pending');
    expect(item.command.type).toBe('move');
  });

  it('peek retorna pendentes sem alterar status', () => {
    enqueue(SESSION, { type: 'click', x: 10, y: 20 });
    const pending = peek(SESSION);
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('pending');
  });

  it('drain marca itens como sent', () => {
    enqueue(SESSION, { type: 'click', x: 0, y: 0 });
    const drained = drain(SESSION);
    expect(drained).toHaveLength(1);
    expect(drained[0].status).toBe('sent');
    expect(peek(SESSION)).toHaveLength(0);
  });

  it('drain chamado duas vezes não duplica', () => {
    enqueue(SESSION, { type: 'click', x: 0, y: 0 });
    drain(SESSION);
    expect(drain(SESSION)).toHaveLength(0);
  });

  it('ack marca item como done', () => {
    const item = enqueue(SESSION, { type: 'type', text: 'hello' });
    drain(SESSION);
    expect(ack(SESSION, item.id)).toBe(true);
    expect(queueStats(SESSION).done).toBe(1);
  });

  it('ack com error marca como error', () => {
    const item = enqueue(SESSION, { type: 'key', key: 'Enter' });
    drain(SESSION);
    ack(SESSION, item.id, 'elemento não encontrado');
    expect(queueStats(SESSION).error).toBe(1);
  });

  it('ack retorna false para id inexistente', () => {
    expect(ack(SESSION, 'ghost')).toBe(false);
  });

  it('enqueueBatch enfileira múltiplos comandos', () => {
    const items = enqueueBatch(SESSION, [
      { type: 'move', x: 0, y: 0 },
      { type: 'click', x: 0, y: 0 },
      { type: 'type', text: 'abc' },
    ]);
    expect(items).toHaveLength(3);
    expect(queueStats(SESSION).pending).toBe(3);
  });

  it('clearQueue esvazia e retorna contagem', () => {
    enqueueBatch(SESSION, [
      { type: 'click', x: 1, y: 1 },
      { type: 'click', x: 2, y: 2 },
    ]);
    expect(clearQueue(SESSION)).toBe(2);
    expect(queueStats(SESSION).total).toBe(0);
  });

  it('queueStats retorna contagens corretas', () => {
    const i1 = enqueue(SESSION, { type: 'move', x: 0, y: 0 });
    const i2 = enqueue(SESSION, { type: 'click', x: 0, y: 0 });
    drain(SESSION);
    ack(SESSION, i1.id);
    const stats = queueStats(SESSION);
    expect(stats.done).toBe(1);
    expect(stats.sent).toBe(1);
    expect(stats.pending).toBe(0);
    void i2;
  });
});
