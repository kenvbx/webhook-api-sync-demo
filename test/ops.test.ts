import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const apps: Array<ReturnType<typeof createApp>> = [];
const previousKey = process.env.OPERATOR_API_KEY;
const make = () => { process.env.OPERATOR_API_KEY = 'test-operator-key'; const instance = createApp(':memory:'); apps.push(instance); return instance; };
const insert = (db: any, status: string, attempts: number, created: string, processed: string | null) => db.prepare('INSERT INTO inbox_events (provider,event_id,event_type,occurred_at,payload,payload_hash,status,attempts,created_at,updated_at,processed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('generic', `evt_${Math.random()}`, 'contact.updated', created, '{}', 'hash', status, attempts, created, processed ?? created, processed);
afterEach(() => { apps.splice(0).forEach(({ db }) => db.close()); if (previousKey === undefined) delete process.env.OPERATOR_API_KEY; else process.env.OPERATOR_API_KEY = previousKey; });

describe('GET /ops/metrics', () => {
  it('returns status, retry, volume, and latency metrics for operators', async () => {
    const { app, db } = make(); const created = '2026-11-14T10:00:00.000Z'; const processed = '2026-11-14T10:00:01.500Z';
    insert(db, 'processed', 2, created, processed); insert(db, 'received', 1, created, null); insert(db, 'failed', 3, created, null);
    const response = await request(app).get('/ops/metrics').set('x-operator-key', 'test-operator-key');
    expect(response.status).toBe(200); expect(response.body.data.totalEvents).toBe(3); expect(response.body.data.pendingEvents).toBe(1); expect(response.body.data.failedEvents).toBe(1); expect(response.body.data.totalAttempts).toBe(6); expect(response.body.data.retries).toBe(3); expect(response.body.data.averageProcessingLatencyMs).toBe(1500);
  });
  it('requires operator authentication', async () => { const { app } = make(); const response = await request(app).get('/ops/metrics'); expect(response.status).toBe(401); });
});
