# Webhook API Sync Demo

[![CI](https://github.com/kenvbx/webhook-api-sync-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/kenvbx/webhook-api-sync-demo/actions/workflows/ci.yml)

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

Slice 1 and Slice 2 are implemented locally: signed receipt, timestamp tolerance, SQLite inbox persistence, duplicate handling, event processing, idempotent downstream mock, bounded retry/backoff, and a polling worker. Slice 3 is implemented with operator API key protection, paginated event listing, failed-event replay, fixed-window rate limits, request IDs, structured JSON logs, a demo sender, and Docker Compose. A Stripe test-mode provider adapter now verifies `Stripe-Signature`, rejects live events, and stores Stripe events in the shared inbox.

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


## Stripe test-mode webhook

The provider adapter accepts Stripe-shaped test events at `POST /webhooks/stripe`. Set `STRIPE_WEBHOOK_SECRET` to a test-mode signing secret. The adapter verifies the Stripe `t=...,v1=...` signature, enforces timestamp tolerance, rejects `livemode: true`, and stores the event with `provider: stripe`. It does not call Stripe or use live credentials.


## PostgreSQL integration test

The normal test suite uses SQLite for fast local runs. GitHub Actions also starts PostgreSQL 16 and runs `test/postgres.integration.test.ts` against a real database. That suite verifies the inbox unique constraint, transaction rollback, retry state, and terminal failure persistence.


## Basic metrics

`GET /ops/metrics` uses the operator API key and returns inbox volume, status counts, pending/failed events, total attempts, retry count, and average processing latency for processed events. These are database-derived operational metrics for the demo; no external metrics backend is configured.
