import { v4 as uuidv4 } from 'uuid';
import type { MouseCommand, QueuedCommand } from './types.js';

// Per-session command queues — frontend polls and drains these
const queues = new Map<string, QueuedCommand[]>();

function getQueue(sessionId: string): QueuedCommand[] {
  if (!queues.has(sessionId)) queues.set(sessionId, []);
  return queues.get(sessionId)!;
}

export function enqueue(sessionId: string, command: MouseCommand): QueuedCommand {
  const item: QueuedCommand = {
    id: uuidv4(),
    sessionId,
    command,
    queuedAt: new Date().toISOString(),
    status: 'pending',
  };
  getQueue(sessionId).push(item);
  return item;
}

export function enqueueBatch(sessionId: string, commands: MouseCommand[]): QueuedCommand[] {
  return commands.map(cmd => enqueue(sessionId, cmd));
}

export function drain(sessionId: string): QueuedCommand[] {
  const q = getQueue(sessionId);
  const pending = q.filter(c => c.status === 'pending');
  pending.forEach(c => { c.status = 'sent'; });
  return pending;
}

export function peek(sessionId: string): QueuedCommand[] {
  return getQueue(sessionId).filter(c => c.status === 'pending');
}

export function ack(sessionId: string, id: string, error?: string): boolean {
  const item = getQueue(sessionId).find(c => c.id === id);
  if (!item) return false;
  item.status = error ? 'error' : 'done';
  if (error) item.error = error;
  return true;
}

export function clearQueue(sessionId: string): number {
  const q = getQueue(sessionId);
  const count = q.length;
  q.splice(0);
  return count;
}

export function queueStats(sessionId: string) {
  const q = getQueue(sessionId);
  return {
    total: q.length,
    pending: q.filter(c => c.status === 'pending').length,
    sent: q.filter(c => c.status === 'sent').length,
    done: q.filter(c => c.status === 'done').length,
    error: q.filter(c => c.status === 'error').length,
  };
}
