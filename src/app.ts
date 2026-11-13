import express from 'express';
import { createDatabase } from './db/database.js';
import { config } from './config.js';
import { webhookRouter } from './routes/webhooks.js';
import { MockDownstreamAdapter, processPendingOnce } from './processor.js';
import { opsRouter, requestId } from './ops.js';
import { log } from './logger.js';

export const createApp = (databasePath = config.databasePath) => {
  const db = createDatabase(databasePath);
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use((req, _res, next) => { log('info', 'request_received', { requestId: _res.locals.requestId, method: req.method, path: req.path }); next(); });
  const downstream = new MockDownstreamAdapter();
  app.get('/health', (_req, res) => res.json({ data: { status: 'ok', database: 'ready' } }));
  app.locals.processPendingOnce = () => processPendingOnce(db, downstream);
  app.use('/webhooks', express.raw({ type: 'application/json', limit: config.maxWebhookBodyBytes }), webhookRouter(db));
  app.use(express.json({ limit: '64kb' }));
  app.use('/ops', opsRouter(db, downstream));
  app.use((_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Route not found.' } }));
  return { app, db };
};
