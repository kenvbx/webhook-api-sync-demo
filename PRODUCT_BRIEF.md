# Webhook API Sync Demo — Product brief

**Status:** Discovery / MVP planning  
**Type:** Personal Project / Demo Project

## Problem

Small SaaS integrations need to receive webhook events safely, avoid duplicate processing, retry temporary failures, and expose a clear history when synchronization fails. This demo shows that workflow in a compact Node.js service.

## Target user

A developer integrating one SaaS provider with an internal API or database. The user can register a signing secret, inspect received events, replay failed events, and verify the sync result.

## MVP outcome

A reproducible Express API that accepts signed webhook events, stores an immutable event record, processes supported events idempotently, calls a small downstream mock API, retries transient failures with backoff, and exposes an operator view/API for status and replay.

## Proposed integration

The provider is represented by a Stripe-like generic webhook sender so the project can run without real credentials. Payloads use an `event_id`, `event_type`, and `occurred_at`; HMAC SHA-256 signs the raw request body. A local mock downstream API demonstrates the sync boundary.

## Scope

### MVP

- Express + TypeScript HTTP API.
- HMAC signature and timestamp validation.
- Durable event inbox with unique provider/event ID.
- Supported event mapping to a downstream sync action.
- Idempotent processing and duplicate delivery handling.
- Bounded retry with exponential backoff and failed state.
- Manual replay endpoint for failed events.
- Health endpoint and structured JSON logs with correlation IDs.
- SQLite for local reproducibility; PostgreSQL-compatible schema where practical.
- Docker Compose, `.env.example`, seed/demo sender, README, and English walkthrough.

### Follow-up

- Background worker process instead of an in-process poller.
- Real provider adapter (for example Stripe or GitHub) after the generic flow is verified.
- Prometheus metrics and an operator UI.
- PostgreSQL deployment smoke test.

### Out of scope

- Production credentials, real customer data, billing, multi-region delivery, and guaranteed exactly-once external side effects.
- A full SaaS admin product.

## Success criteria

- A fresh checkout can run the API and demo sender locally.
- A valid event is accepted once and reaches `processed`.
- The same event delivered repeatedly creates one inbox record and one downstream effect.
- Invalid signatures and stale timestamps are rejected before persistence.
- A simulated downstream 5xx moves the event through bounded retries to `failed`, and replay can recover it.
- The README explains the consistency trade-off: at-least-once delivery with idempotent consumers, rather than exactly-once delivery.
