# Architecture and trade-offs

## Boundary

The MVP is a modular monolith: an Express HTTP process, a relational inbox database, a processor module, and a local mock downstream API. A small polling worker is acceptable for the first vertical slice; a separate worker is a follow-up when deployment needs independent scaling.

```text
Provider -> Express webhook route -> Inbox (SQLite)
                                      |
                                      v
                              Processor / retry policy
                                      |
                                      v
                             Mock downstream API
```

## Data model

- `inbox_events`: provider, event_id, event_type, occurred_at, payload, payload_hash, status, attempts, next_attempt_at, last_error, processed_at, downstream_ref, created_at, updated_at.
- Unique index on `(provider, event_id)`.
- Optional `processing_locks` or a status transition transaction for the local worker.

## Consistency

Delivery is at least once. The inbox unique key handles duplicate receipt, and the downstream adapter uses an idempotency key derived from provider and event ID. Exactly once cannot be guaranteed across an external network boundary without cooperation from the downstream system.

## Retry policy

Retry network timeouts and HTTP 5xx responses up to three times with bounded exponential backoff. Mark 4xx validation/auth failures as terminal. Persist the next attempt time so a process restart does not lose work.

## Security

Verify the signature over the raw body before parsing, enforce a timestamp tolerance, cap request size, validate event shape, rate-limit public routes, and redact secrets/payload fields in logs. Operator endpoints use a local API key in the MVP.

## Initial workload assumptions

- Demo traffic: fewer than 10 webhook requests per second.
- Fewer than 100,000 inbox events in the local database.
- Receipt latency target: under 300 ms when persistence is healthy.
- Recovery objective: failed events remain inspectable and replayable after restart.

SQLite keeps setup simple and makes the demo reproducible. PostgreSQL compatibility is preferred for deployment, but no production scale or availability claim is made.
