import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { signatureFor } from '../src/webhook.js';

const apps: Array<ReturnType<typeof createApp>> = [];
const makeRequest = () => { const instance = createApp(':memory:'); apps.push(instance); return instance; };
const payload = JSON.stringify({ event_id: 'evt_123', event_type: 'contact.updated', occurred_at: '2026-11-13T08:00:00Z', data: { id: 'contact_1' } });
const signed = (body = payload, timestamp = Math.floor(Date.now() / 1000).toString()) => ({ body, timestamp, signature: signatureFor(body, timestamp, config.webhookSecret) });

afterEach(() => apps.splice(0).forEach(({ db }) => db.close()));

describe('POST /webhooks/provider', () => {
  it('accepts a valid signed event', async () => {
    const { app } = makeRequest(); const data = signed();
    const response = await request(app).post('/webhooks/provider').set('content-type', 'application/json').set('x-webhook-timestamp', data.timestamp).set('x-webhook-signature', data.signature).send(data.body);
    expect(response.status).toBe(202); expect(response.body.duplicate).toBe(false); expect(response.body.data.eventId).toBe('evt_123');
  });
  it('rejects invalid signatures without storing the event', async () => {
    const { app, db } = makeRequest(); const data = signed();
    const response = await request(app).post('/webhooks/provider').set('content-type', 'application/json').set('x-webhook-timestamp', data.timestamp).set('x-webhook-signature', '0'.repeat(64)).send(data.body);
    expect(response.status).toBe(400); expect(db.prepare('SELECT count(*) as count FROM inbox_events').get()).toEqual({ count: 0 });
  });
  it('rejects stale timestamps', async () => {
    const { app } = makeRequest(); const data = signed(payload, String(Math.floor(Date.now() / 1000) - 301));
    const response = await request(app).post('/webhooks/provider').set('content-type', 'application/json').set('x-webhook-timestamp', data.timestamp).set('x-webhook-signature', data.signature).send(data.body);
    expect(response.status).toBe(400); expect(response.body.error.code).toBe('stale_timestamp');
  });
  it('deduplicates repeated event deliveries', async () => {
    const { app, db } = makeRequest(); const data = signed(); const send = () => request(app).post('/webhooks/provider').set('content-type', 'application/json').set('x-webhook-timestamp', data.timestamp).set('x-webhook-signature', data.signature).send(data.body);
    const first = await send(); const second = await send();
    expect(first.body.duplicate).toBe(false); expect(second.body.duplicate).toBe(true); expect(db.prepare('SELECT count(*) as count FROM inbox_events').get()).toEqual({ count: 1 });
  });
});
