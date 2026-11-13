import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { processEventById, processPendingOnce, MockDownstreamAdapter } from '../src/processor.js';

const apps: Array<ReturnType<typeof createApp>> = [];
const make = () => { const instance = createApp(':memory:'); apps.push(instance); return instance; };
const insert = (db: any, eventType: string, id: string) => {
  const now = new Date().toISOString();
  db.prepare('INSERT INTO inbox_events (provider,event_id,event_type,occurred_at,payload,payload_hash,status,created_at,updated_at) VALUES (?,?,?,?,?,?,\'received\',?,?)').run('generic', id, eventType, now, JSON.stringify({ event_id: id, event_type: eventType, occurred_at: now }), 'hash', now, now);
};
afterEach(() => apps.splice(0).forEach(({ db }) => db.close()));

describe('processor', () => {
  it('processes supported events and is idempotent', async () => {
    const { db } = make(); insert(db, 'contact.updated', 'evt_a'); const adapter = new MockDownstreamAdapter();
    const first = await processPendingOnce(db, adapter); const second = await processPendingOnce(db, adapter);
    expect(first[0].status).toBe('processed'); expect(first[0].downstreamRef).toMatch(/^sync_/); expect(second).toHaveLength(0);
  });
  it('processes only the requested event by id', async () => {
    const { db } = make(); insert(db, 'contact.updated', 'evt_target'); insert(db, 'contact.created', 'evt_other'); const adapter = new MockDownstreamAdapter();
    const target = db.prepare("SELECT id FROM inbox_events WHERE event_id = 'evt_target'").get() as { id: number };
    const result = await processEventById(db, adapter, target.id);
    const other = db.prepare("SELECT status FROM inbox_events WHERE event_id = 'evt_other'").get() as { status: string };
    expect(result?.eventId).toBe('evt_target'); expect(other.status).toBe('received');
  });
  it('marks unsupported events ignored', async () => {
    const { db } = make(); insert(db, 'invoice.deleted', 'evt_b');
    const [result] = await processPendingOnce(db, new MockDownstreamAdapter());
    expect(result.status).toBe('ignored'); expect(result.lastError).toContain('Unsupported');
  });
  it('retries transient failures and eventually processes', async () => {
    const { db } = make(); insert(db, 'contact.created', 'evt_c'); const adapter = new MockDownstreamAdapter(); adapter.failNext('generic:evt_c', 1);
    const [failedAttempt] = await processPendingOnce(db, adapter); expect(failedAttempt.status).toBe('received'); expect(failedAttempt.attempts).toBe(1);
    db.prepare('UPDATE inbox_events SET next_attempt_at = ?').run(new Date(Date.now() - 1000).toISOString());
    const [processed] = await processPendingOnce(db, adapter); expect(processed.status).toBe('processed'); expect(processed.attempts).toBe(2);
  });
  it('moves a repeated transient failure to failed after three attempts', async () => {
    const { db } = make(); insert(db, 'contact.updated', 'evt_d'); const adapter = new MockDownstreamAdapter(); adapter.failNext('generic:evt_d', 5);
    for (let i = 0; i < 3; i++) { db.prepare('UPDATE inbox_events SET next_attempt_at = ?').run(new Date(Date.now() - 1000).toISOString()); await processPendingOnce(db, adapter); }
    const row = db.prepare('SELECT status, attempts FROM inbox_events').get(); expect(row).toEqual({ status: 'failed', attempts: 3 });
  });
});
