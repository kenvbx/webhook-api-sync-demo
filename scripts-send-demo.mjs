import crypto from 'node:crypto';
const base = process.env.API_URL ?? 'http://localhost:3010';
const secret = process.env.WEBHOOK_SECRET ?? 'local-demo-secret-change-me';
const timestamp = Math.floor(Date.now() / 1000).toString();
const event = { event_id: `demo_${Date.now()}`, event_type: 'contact.updated', occurred_at: new Date().toISOString(), data: { id: 'contact_demo' } };
const body = JSON.stringify(event); const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
const response = await fetch(`${base}/webhooks/provider`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-webhook-timestamp': timestamp, 'x-webhook-signature': signature }, body });
console.log(JSON.stringify(await response.json(), null, 2));
