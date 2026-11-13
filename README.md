# Webhook API Sync Demo

**Personal Project / Demo Project** — a Node.js + Express + TypeScript service for signed webhook intake, idempotent processing, retries, and operator replay.

## Portfolio goal

This demo provides evidence for Node.js/Express API integration work. It demonstrates at-least-once webhook delivery, HMAC verification, an inbox pattern, idempotency, failure recovery, and a documented downstream boundary.

## Planned stack

- Node.js, Express, TypeScript
- SQLite for local development; PostgreSQL-compatible schema
- Zod or equivalent request validation
- Vitest and Supertest for API/integration tests
- Docker Compose for reproducible local setup

## Current status

Slice 1 and Slice 2 are implemented locally: signed receipt, timestamp tolerance, SQLite inbox persistence, duplicate handling, event processing, idempotent downstream mock, bounded retry/backoff, and a polling worker. Slice 3 is implemented with operator API key protection, paginated event listing, failed-event replay, fixed-window rate limits, request IDs, structured JSON logs, a demo sender, and Docker Compose.

See [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md), [REQUIREMENTS.md](REQUIREMENTS.md), and [ARCHITECTURE.md](ARCHITECTURE.md).

## Honest portfolio boundary

This is a personal/demo project. It does not claim production customers, real provider traffic, revenue, uptime, or exactly-once delivery.


## Operations demo

Set `OPERATOR_API_KEY` in `.env` for operator endpoints. Start the service, then send a signed sample event:

```sh
npm run build
OPERATOR_API_KEY=local-operator-key-change-me npm start
node scripts-send-demo.mjs
```

List events:

```sh
curl -H 'x-operator-key: local-operator-key-change-me' http://localhost:3010/ops/events
```

`POST /ops/events/:id/replay` requeues only failed events. Logs are JSON and include an `x-request-id`; secrets and full payloads are not logged.

Docker Compose builds the compiled app and persists SQLite under the `webhook-data` volume.
