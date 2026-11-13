import { createApp } from './app.js';
import { config } from './config.js';

const { app } = createApp();
const processPending = app.locals.processPendingOnce as () => Promise<unknown>;
const worker = setInterval(() => { void processPending().catch((error) => console.error(JSON.stringify({ level: 'error', message: 'worker_failed', error: String(error) }))); }, 1000);
worker.unref();
app.listen(config.port, () => console.log(`Webhook API listening on http://localhost:${config.port}`));
