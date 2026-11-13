# Requirements and acceptance criteria

## MVP stories

### R1 — Receive and authenticate a webhook

**Actor:** Provider  
**Acceptance criteria:**

- `POST /webhooks/provider` accepts the raw JSON body and required signature headers.
- HMAC SHA-256 is checked against the configured secret using a timing-safe comparison.
- A timestamp tolerance rejects stale or far-future requests.
- Invalid requests return a consistent 4xx error and are not stored.

### R2 — Store an inbox event

**Actor:** Webhook service  
**Acceptance criteria:**

- A valid event stores provider, event ID, type, received time, payload hash, status, and attempt count.
- `(provider, event_id)` is unique.
- A duplicate delivery returns an idempotent response and does not create a second event.

### R3 — Process a supported event

**Actor:** Worker  
**Acceptance criteria:**

- Supported event types map to an explicit downstream action.
- Processing is safe to retry and records `processed_at` plus the downstream reference.
- Unsupported events are recorded as ignored with a reason.
- A correlation ID appears in logs for receipt and processing.

### R4 — Retry transient downstream errors

**Actor:** Worker  
**Acceptance criteria:**

- Timeout and 5xx responses are retryable; validation and authorization errors are not.
- Retries are bounded and use increasing delays.
- Exhausted events become `failed` with a safe error summary.
- No secret or full sensitive payload is written to logs.

### R5 — Replay a failed event

**Actor:** Operator  
**Acceptance criteria:**

- `POST /events/:id/replay` only requeues a failed event.
- Replay increments a replay marker and resets the attempt state safely.
- A replayed event cannot create a duplicate downstream effect.

### R6 — Inspect operations

**Actor:** Operator  
**Acceptance criteria:**

- `GET /health` reports service and database readiness.
- `GET /events` supports status/type/date pagination.
- Responses use a documented error shape and never expose signing secrets.

## Security and reliability constraints

- Secrets come from environment variables and are absent from logs and repository files.
- Body size is bounded; JSON schema validation rejects malformed payloads.
- Rate limiting applies to the public webhook route and replay endpoint.
- At-least-once delivery is explicit; idempotency protects the downstream action.
