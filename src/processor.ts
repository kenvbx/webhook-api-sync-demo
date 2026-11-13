import crypto from 'node:crypto';
import { mapEvent, type InboxEvent } from './db/database.js';

type SqliteDatabase = any;

export type DownstreamResult = { reference: string };
export interface DownstreamAdapter {
  sync(event: InboxEvent, idempotencyKey: string): Promise<DownstreamResult>;
}

export class DownstreamError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

/** Deterministic local adapter used by the demo and tests. */
export class MockDownstreamAdapter implements DownstreamAdapter {
  private readonly completed = new Map<string, DownstreamResult>();
  private readonly failures = new Map<string, number>();

  failNext(idempotencyKey: string, count = 1) { this.failures.set(idempotencyKey, count); }

  async sync(_event: InboxEvent, idempotencyKey: string): Promise<DownstreamResult> {
    const existing = this.completed.get(idempotencyKey);
    if (existing) return existing;
    const remaining = this.failures.get(idempotencyKey) ?? 0;
    if (remaining > 0) {
      this.failures.set(idempotencyKey, remaining - 1);
      throw new DownstreamError('Mock downstream unavailable.', true);
    }
    const result = { reference: `sync_${crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16)}` };
    this.completed.set(idempotencyKey, result);
    return result;
  }
}

const supportedTypes = new Set(['contact.updated', 'contact.created']);
const maxAttempts = 3;
const retryDelaySeconds = (attempt: number) => Math.min(60, 2 ** Math.max(0, attempt - 1));

export const processOne = async (db: SqliteDatabase, adapter: DownstreamAdapter, row: InboxEvent): Promise<InboxEvent> => {
  const now = new Date().toISOString();
  const attempt = row.attempts + 1;
  db.prepare("UPDATE inbox_events SET attempts = ?, updated_at = ? WHERE id = ? AND status = 'received'").run(attempt, now, row.id);
  if (!supportedTypes.has(row.eventType)) {
    db.prepare("UPDATE inbox_events SET status = 'ignored', last_error = ?, updated_at = ? WHERE id = ? AND status = 'received'").run(`Unsupported event type: ${row.eventType}`, now, row.id);
    return mapEvent(db.prepare('SELECT * FROM inbox_events WHERE id = ?').get(row.id));
  }
  try {
    const result = await adapter.sync(row, `${row.provider}:${row.eventId}`);
    db.prepare("UPDATE inbox_events SET status = 'processed', processed_at = ?, downstream_ref = ?, next_attempt_at = NULL, last_error = NULL, updated_at = ? WHERE id = ? AND status = 'received'").run(now, result.reference, now, row.id);
  } catch (cause) {
    const retryable = cause instanceof DownstreamError ? cause.retryable : true;
    const exhausted = !retryable || attempt >= maxAttempts;
    const nextAttemptAt = exhausted ? null : new Date(Date.now() + retryDelaySeconds(attempt) * 1000).toISOString();
    const status = exhausted ? 'failed' : 'received';
    const message = cause instanceof Error ? cause.message : 'Downstream processing failed.';
    db.prepare('UPDATE inbox_events SET status = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE id = ? AND status = \'received\'').run(status, nextAttemptAt, message.slice(0, 500), now, row.id);
  }
  return mapEvent(db.prepare('SELECT * FROM inbox_events WHERE id = ?').get(row.id));
};

export const processPendingOnce = async (db: SqliteDatabase, adapter: DownstreamAdapter): Promise<InboxEvent[]> => {
  const now = new Date().toISOString();
  const rows = db.prepare("SELECT * FROM inbox_events WHERE status = 'received' AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY id").all(now) as Record<string, unknown>[];
  const results: InboxEvent[] = [];
  for (const raw of rows) results.push(await processOne(db, adapter, mapEvent(raw)));
  return results;
};
