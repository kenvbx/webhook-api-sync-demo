# Delivery checklist

## Slice 1 — receipt

- [x] Initialize TypeScript/Express project and configuration.
- [x] Add SQLite migrations and inbox repository.
- [x] Implement raw-body HMAC verification and timestamp tolerance.
- [x] Add valid, invalid, stale, and duplicate receipt tests.

## Slice 2 — processing

- [x] Add event mapping and downstream mock adapter.
- [x] Implement idempotent processing and status transitions.
- [x] Add retry/backoff and restart-safe polling worker.
- [x] Add transient failure and terminal failure tests.

## Slice 3 — operations

- [x] Add health, paginated event list, and replay endpoint.
- [x] Add operator API key, rate limits, structured logs, and redaction.
- [x] Add demo sender and Docker Compose.
- [x] Add Stripe test-mode provider adapter with signature verification and live-mode rejection.
- [x] Add PostgreSQL integration test for inbox constraints, rollback, and retry state.
- [x] Add operator metrics endpoint for volume, status, retries, and processing latency.
- [x] Add small operator UI for metrics, event filters, and failed-event replay.
- [x] Add portfolio evidence map, walkthrough script, screenshots plan, and Upwork copy.
- [x] Write English setup, walkthrough, limitations, and portfolio copy.
