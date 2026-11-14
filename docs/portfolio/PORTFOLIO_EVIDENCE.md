# Portfolio evidence — Webhook API Sync Demo

> **Personal Project / Demo Project**
>
> This project is portfolio evidence for Node.js, Express, TypeScript, webhook integration, idempotent processing, retries, and operator tooling. It is not client work and does not claim production traffic, revenue, uptime, or exactly-once delivery.

## Portfolio title

**Webhook API Sync Demo | Node.js, Express, TypeScript, Stripe Test Mode**

## Short description

A personal Node.js and Express demo that receives signed webhooks, stores an inbox event once, processes supported events with an idempotent downstream adapter, retries temporary failures, and gives an operator a small UI to inspect metrics and replay failed events. It includes a Stripe-shaped test-mode adapter, PostgreSQL integration tests, Docker Compose, and GitHub Actions CI.

## What the reviewer can verify

| Capability | Evidence | How to check |
| --- | --- | --- |
| Signed generic webhooks | `src/routes/webhooks.ts`, `src/webhook.ts` | Send a signed request to `POST /webhooks/provider`; invalid or stale signatures return 4xx. |
| Stripe test-mode adapter | `src/providers/stripe.ts`, `test/stripe.test.ts` | Use a `t=...,v1=...` signature; `livemode: true` is rejected. No live Stripe credentials are needed. |
| Inbox deduplication | `src/db/database.ts`, webhook tests | Deliver the same provider/event ID twice; the second response is marked `duplicate`. |
| Idempotent downstream sync | `src/processor.ts`, processor tests | The same idempotency key returns the same downstream reference. |
| Retry and failure states | `src/processor.ts`, processor tests | Simulate downstream failures; attempts are bounded and exhausted events become `failed`. |
| Replay isolation | `src/ops.ts`, processor tests | Replay a failed ID; another pending event remains untouched. |
| Operator metrics | `GET /ops/metrics`, `test/ops.test.ts` | Authenticate with `x-operator-key`; inspect volume, status, retry, and latency metrics. |
| Operator UI | `public/operator/index.html` | Open `/operator`, enter the key, filter events, and replay a failed event. |
| PostgreSQL behavior | `test/postgres.integration.test.ts`, CI workflow | GitHub Actions starts PostgreSQL 16 and checks unique constraints, rollback, retry state, and failure persistence. |
| Reproducible delivery | `.github/workflows/ci.yml`, `Dockerfile` | CI runs build/tests, PostgreSQL integration, and Docker image build. |

## Suggested walkthrough video

Record a 60–90 second screen capture with this sequence:

1. Open `/operator` and enter the local operator key.
2. Show the empty or current metrics cards.
3. Run `node scripts-send-demo.mjs` in the terminal.
4. Refresh the UI and show the received/processed event.
5. Send the same event again and show duplicate handling in the API response or event list.
6. Show the Stripe test-mode endpoint or the test file that verifies `Stripe-Signature`.
7. Open the GitHub Actions run and show the build/test, PostgreSQL, and Docker jobs passing.

Use synthetic local data only. Do not display real keys, customer data, or credentials.

## Suggested screenshots

- `operator-overview.png`: `/operator` with metrics and event table.
- `operator-failed-replay.png`: failed event row with the Replay action and the resulting status.
- `github-actions-ci.png`: successful CI run showing all three jobs.
- `stripe-test-webhook.png`: terminal/API request showing a test-mode Stripe event accepted.

Store screenshots in this folder only after capturing them from the local demo. Do not use placeholder images in the portfolio.

## Technical highlights

- Node.js 22, Express 5, TypeScript, Zod.
- SQLite local inbox with PostgreSQL integration coverage.
- HMAC signature verification and timestamp tolerance.
- At-least-once delivery model with idempotent downstream keys.
- Bounded retry with persisted attempts and next retry time.
- Operator API key, rate limits, request IDs, and structured JSON logs.
- Static operator UI served by Express.
- GitHub Actions CI and Docker image build.

## Known limitations to disclose

- The downstream integration is a deterministic local mock; the Stripe adapter verifies and normalizes test-mode webhook payloads but does not call Stripe.
- The demo does not claim exactly-once external side effects.
- SQLite is the default local database; PostgreSQL is verified in CI integration tests, not deployed as a live service.
- No production deployment, real customer data, malware scanning, external metrics backend, or uptime claim is included.

## Upwork portfolio copy

```text
Personal demo built with Node.js, Express, and TypeScript for reliable webhook/API integrations. It verifies signed generic and Stripe test-mode webhooks, stores events in an inbox with provider/event deduplication, processes them through an idempotent downstream adapter, retries temporary failures with bounded backoff, and supports operator metrics and failed-event replay. Includes a small operator UI, PostgreSQL integration tests, Docker Compose, and GitHub Actions CI. Test-mode/personal project; no production usage or revenue claims.
```

## Links

- Repository: https://github.com/kenvbx/webhook-api-sync-demo
- CI: https://github.com/kenvbx/webhook-api-sync-demo/actions
- Operator UI path in a local run: `/operator`
