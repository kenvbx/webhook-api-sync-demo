import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { mapEvent } from './db/database.js';
import { processPendingOnce, type MockDownstreamAdapter } from './processor.js';

type SqliteDatabase = any;

type Bucket = { count: number; resetAt: number };
export class FixedWindowLimiter {
  private readonly buckets = new Map<string, Bucket>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}
  allow(key: string): boolean {
    const now = Date.now(); const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) { this.buckets.set(key, { count: 1, resetAt: now + this.windowMs }); return true; }
    if (current.count >= this.limit) return false; current.count += 1; return true;
  }
}

const fail = (res: Response, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });
const operatorAuth = (req: Request, res: Response, next: () => void) => {
  const expected = process.env.OPERATOR_API_KEY;
  if (!expected || req.header('x-operator-key') !== expected) return fail(res, 401, 'operator_unauthorized', 'A valid operator API key is required.');
  next();
};

export const opsRouter = (db: SqliteDatabase, downstream: MockDownstreamAdapter): Router => {
  const router = Router(); const limiter = new FixedWindowLimiter(20, 60_000);
  router.use(operatorAuth);
  router.get('/events', (req, res) => {
    if (!limiter.allow(`list:${req.ip}`)) return fail(res, 429, 'rate_limited', 'Too many operator requests.');
    const page = Math.max(1, Number(req.query.page) || 1); const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 25));
    const clauses: string[] = []; const values: unknown[] = [];
    if (typeof req.query.status === 'string') { clauses.push('status = ?'); values.push(req.query.status); }
    if (typeof req.query.type === 'string') { clauses.push('event_type = ?'); values.push(req.query.type); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = Number((db.prepare(`SELECT count(*) AS count FROM inbox_events ${where}`).get(...values) as { count: number }).count);
    const rows = db.prepare(`SELECT * FROM inbox_events ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...values, perPage, (page - 1) * perPage).map(mapEvent);
    return res.json({ data: rows, meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) } });
  });
  router.post('/events/:id/replay', async (req, res) => {
    if (!limiter.allow(`replay:${req.ip}`)) return fail(res, 429, 'rate_limited', 'Too many operator requests.');
    const id = Number(req.params.id); if (!Number.isInteger(id) || id < 1) return fail(res, 400, 'invalid_event_id', 'Event ID must be a positive integer.');
    const row = db.prepare('SELECT * FROM inbox_events WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return fail(res, 404, 'event_not_found', 'Event was not found.');
    if (row.status !== 'failed') return fail(res, 409, 'event_not_failed', 'Only failed events can be replayed.');
    const now = new Date().toISOString(); db.prepare("UPDATE inbox_events SET status = 'received', attempts = 0, next_attempt_at = NULL, last_error = NULL, updated_at = ? WHERE id = ?").run(now, id);
    const [processed] = await processPendingOnce(db, downstream);
    return res.status(202).json({ data: processed ?? mapEvent(db.prepare('SELECT * FROM inbox_events WHERE id = ?').get(id)), replayed: true });
  });
  return router;
};

export const requestId = (req: Request, res: Response, next: () => void) => {
  const id = req.header('x-request-id')?.slice(0, 100) || crypto.randomUUID(); res.setHeader('x-request-id', id); res.locals.requestId = id; next();
};
