import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
const shouldRun = Boolean(connectionString);
const suite = shouldRun ? describe : describe.skip;

suite('PostgreSQL inbox integration', () => {
  const pool = new pg.Pool({ connectionString });

  beforeAll(async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inbox_events (
        id BIGSERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        payload_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'ignored', 'processed', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMPTZ,
        last_error TEXT,
        processed_at TIMESTAMPTZ,
        downstream_ref TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        UNIQUE(provider, event_id)
      );
      TRUNCATE inbox_events RESTART IDENTITY;
    `);
  });

  afterAll(async () => { await pool.end(); });

  it('enforces provider/event uniqueness and preserves the first payload', async () => {
    await pool.query(`INSERT INTO inbox_events (provider,event_id,event_type,occurred_at,payload,payload_hash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`, ['stripe', 'evt_pg_1', 'customer.created', new Date(), { id: 'evt_pg_1' }, 'hash-a']);
    await expect(pool.query(`INSERT INTO inbox_events (provider,event_id,event_type,occurred_at,payload,payload_hash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`, ['stripe', 'evt_pg_1', 'customer.created', new Date(), { id: 'evt_pg_1', changed: true }, 'hash-b'])).rejects.toMatchObject({ code: '23505' });
    const result = await pool.query(`SELECT payload, payload_hash FROM inbox_events WHERE provider = $1 AND event_id = $2`, ['stripe', 'evt_pg_1']);
    expect(result.rows[0]).toEqual({ payload: { id: 'evt_pg_1' }, payload_hash: 'hash-a' });
  });

  it('rolls back a failed multi-step state update', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO inbox_events (provider,event_id,event_type,occurred_at,payload,payload_hash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`, ['generic', 'evt_pg_rollback', 'contact.updated', new Date(), { id: 'evt_pg_rollback' }, 'hash']);
      await client.query(`UPDATE inbox_events SET attempts = attempts + 1 WHERE event_id = $1`, ['evt_pg_rollback']);
      throw new Error('simulated downstream failure before commit');
    } catch (error) {
      await client.query('ROLLBACK');
      expect((error as Error).message).toContain('simulated');
    } finally { client.release(); }
    const result = await pool.query(`SELECT count(*)::int AS count FROM inbox_events WHERE event_id = $1`, ['evt_pg_rollback']);
    expect(result.rows[0].count).toBe(0);
  });

  it('persists retry state and terminal failure', async () => {
    const inserted = await pool.query(`INSERT INTO inbox_events (provider,event_id,event_type,occurred_at,payload,payload_hash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING id`, ['generic', 'evt_pg_retry', 'contact.updated', new Date(), { id: 'evt_pg_retry' }, 'hash']);
    await pool.query(`UPDATE inbox_events SET attempts = 3, status = 'failed', last_error = $1, updated_at = NOW() WHERE id = $2`, ['downstream unavailable', inserted.rows[0].id]);
    const result = await pool.query(`SELECT status, attempts, last_error FROM inbox_events WHERE id = $1`, [inserted.rows[0].id]);
    expect(result.rows[0]).toEqual({ status: 'failed', attempts: 3, last_error: 'downstream unavailable' });
  });
});
