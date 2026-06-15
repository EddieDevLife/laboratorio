import type { Request, Response, NextFunction } from 'express';

export function requireJson(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const ct = req.headers['content-type'] ?? '';
    if (!ct.includes('application/json')) {
      res.status(415).json({ error: 'Content-Type deve ser application/json' });
      return;
    }
  }
  next();
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Rota não encontrada' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[error]', message);
  res.status(500).json({ error: message });
}
