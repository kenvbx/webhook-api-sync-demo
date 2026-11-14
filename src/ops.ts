import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { mapEvent } from './db/database.js';
import { processEventById, type MockDownstreamAdapter } from './processor.js';

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
  router.get('/metrics', (req, res) => {
    if (!limiter.allow(`metrics:${req.ip}`)) return fail(res, 429, 'rate_limited', 'Too many operator requests.');
    const total = Number((db.prepare('SELECT count(*) AS count FROM inbox_events').get() as { count: number }).count);
    const statusRows = db.prepare('SELECT status, count(*) AS count FROM inbox_events GROUP BY status').all() as Array<{ status: string; count: number }>;
    const byStatus = Object.fromEntries(statusRows.map((row) => [row.status, Number(row.count)]));
    const attempts = Number((db.prepare('SELECT COALESCE(SUM(attempts), 0) AS total FROM inbox_events').get() as { total: number }).total);
    const processed = Number((db.prepare("SELECT count(*) AS count FROM inbox_events WHERE status = 'processed'").get() as { count: number }).count);
    const latency = db.prepare("SELECT AVG((julianday(processed_at) - julianday(created_at)) * 86400000.0) AS average_ms FROM inbox_events WHERE processed_at IS NOT NULL").get() as { average_ms: number | null };
    return res.json({ data: { totalEvents: total, byStatus, pendingEvents: byStatus.received ?? 0, failedEvents: byStatus.failed ?? 0, processedEvents: processed, totalAttempts: attempts, retries: Math.max(0, attempts - total), averageProcessingLatencyMs: latency.average_ms === null ? null : Math.round(latency.average_ms) } });
  });
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
    const processed = await processEventById(db, downstream, id);
    return res.status(202).json({ data: processed ?? mapEvent(db.prepare('SELECT * FROM inbox_events WHERE id = ?').get(id)), replayed: true });
  });
  return router;
};

export const requestId = (req: Request, res: Response, next: () => void) => {
  const id = req.header('x-request-id')?.slice(0, 100) || crypto.randomUUID(); res.setHeader('x-request-id', id); res.locals.requestId = id; next();
};
