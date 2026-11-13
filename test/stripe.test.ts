import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { stripeHeaderFor } from '../src/providers/stripe.js';

const apps: Array<ReturnType<typeof createApp>> = [];
const make = () => { const instance = createApp(':memory:'); apps.push(instance); return instance; };
const body = JSON.stringify({ id: 'evt_stripe_1', type: 'customer.created', created: Math.floor(Date.now() / 1000), livemode: false, data: { object: { id: 'cus_1' } } });
const headers = () => { const timestamp = Math.floor(Date.now() / 1000).toString(); return { timestamp, signature: stripeHeaderFor(body, timestamp, config.stripeWebhookSecret) }; };
afterEach(() => apps.splice(0).forEach(({ db }) => db.close()));

describe('POST /webhooks/stripe', () => {
  it('accepts a signed test-mode Stripe event', async () => { const { app } = make(); const h = headers(); const response = await request(app).post('/webhooks/stripe').set('content-type', 'application/json').set('stripe-signature', h.signature).send(body); expect(response.status).toBe(202); expect(response.body.data.provider).toBe('stripe'); });
  it('deduplicates the same Stripe event', async () => { const { app, db } = make(); const h = headers(); const send = () => request(app).post('/webhooks/stripe').set('content-type', 'application/json').set('stripe-signature', h.signature).send(body); expect((await send()).body.duplicate).toBe(false); expect((await send()).body.duplicate).toBe(true); expect(db.prepare('SELECT count(*) AS count FROM inbox_events').get()).toEqual({ count: 1 }); });
  it('rejects live-mode events', async () => { const { app } = make(); const live = JSON.stringify({ id: 'evt_live', type: 'customer.created', created: Math.floor(Date.now() / 1000), livemode: true }); const timestamp = Math.floor(Date.now() / 1000).toString(); const response = await request(app).post('/webhooks/stripe').set('content-type', 'application/json').set('stripe-signature', stripeHeaderFor(live, timestamp, config.stripeWebhookSecret)).send(live); expect(response.status).toBe(400); expect(response.body.error.code).toBe('live_event_rejected'); });
});
