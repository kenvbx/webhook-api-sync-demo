import Database from 'better-sqlite3';
type SqliteDatabase = any;
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export type InboxEvent = {
  id: number;
  provider: string;
  eventId: string;
  eventType: string;
  occurredAt: string;
  payload: string;
  payloadHash: string;
  status: 'received' | 'ignored' | 'processed' | 'failed';
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  processedAt: string | null;
  downstreamRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export const createDatabase = (databasePath = config.databasePath): SqliteDatabase => {
  if (databasePath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS inbox_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'ignored', 'processed', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      last_error TEXT,
      processed_at TEXT,
      downstream_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(provider, event_id)
    );
    CREATE INDEX IF NOT EXISTS idx_inbox_events_status_created ON inbox_events(status, created_at);
  `);
  return db;
};

export const mapEvent = (row: Record<string, unknown>): InboxEvent => ({
  id: Number(row.id), provider: String(row.provider), eventId: String(row.event_id), eventType: String(row.event_type),
  occurredAt: String(row.occurred_at), payload: String(row.payload), payloadHash: String(row.payload_hash),
  status: row.status as InboxEvent['status'], attempts: Number(row.attempts), nextAttemptAt: row.next_attempt_at ? String(row.next_attempt_at) : null,
  lastError: row.last_error ? String(row.last_error) : null, processedAt: row.processed_at ? String(row.processed_at) : null,
  downstreamRef: row.downstream_ref ? String(row.downstream_ref) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});
