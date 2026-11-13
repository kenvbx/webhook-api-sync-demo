import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
type SqliteDatabase = any;
import { config } from '../config.js';
import { mapEvent } from '../db/database.js';
import { signaturesMatch } from '../webhook.js';
import { FixedWindowLimiter } from '../ops.js';

const eventSchema = z.object({
  event_id: z.string().min(1).max(200),
  event_type: z.string().min(1).max(200),
  occurred_at: z.string().datetime({ offset: true }),
}).passthrough();

const error = (res: Response, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });

export const webhookRouter = (db: SqliteDatabase): Router => {
  const router = Router();
  const limiter = new FixedWindowLimiter(60, 60_000);
  router.post('/provider', (req: Request, res: Response, next) => {
    if (!limiter.allow(`webhook:${req.ip}`)) return error(res, 429, 'rate_limited', 'Too many webhook requests.');
    next();
  }, (req: Request, res: Response) => {
    const rawBody = req.body as Buffer;
    const timestamp = req.header('x-webhook-timestamp');
    const signature = req.header('x-webhook-signature');
    if (!Buffer.isBuffer(rawBody) || !timestamp || !signature) return error(res, 400, 'invalid_signature', 'Webhook signature headers are required.');
    const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
    if (!Number.isFinite(age) || age > config.timestampToleranceSeconds) return error(res, 400, 'stale_timestamp', 'Webhook timestamp is outside the allowed tolerance.');
    if (!signaturesMatch(rawBody, timestamp, signature, config.webhookSecret)) return error(res, 400, 'invalid_signature', 'Webhook signature is invalid.');

    let parsed: unknown;
    try { parsed = JSON.parse(rawBody.toString('utf8')); } catch { return error(res, 400, 'invalid_json', 'Webhook body must be valid JSON.'); }
    const event = eventSchema.safeParse(parsed);
    if (!event.success) return error(res, 400, 'invalid_event', 'Webhook event shape is invalid.');
    const payload = rawBody.toString('utf8');
    const now = new Date().toISOString();
    const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
    const insert = db.prepare(`INSERT INTO inbox_events (provider, event_id, event_type, occurred_at, payload, payload_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'received', ?, ?)`);
    try {
      const result = insert.run('generic', event.data.event_id, event.data.event_type, event.data.occurred_at, payload, payloadHash, now, now);
      const row = db.prepare('SELECT * FROM inbox_events WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
      return res.status(202).json({ data: mapEvent(row), duplicate: false });
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes('UNIQUE constraint failed')) {
        const row = db.prepare('SELECT * FROM inbox_events WHERE provider = ? AND event_id = ?').get('generic', event.data.event_id) as Record<string, unknown>;
        return res.status(202).json({ data: mapEvent(row), duplicate: true });
      }
      throw cause;
    }
  });
  return router;
};
