# Demo walkthrough script

## 75-second recording

**0–10s — Context**  
Show the repository README and the CI badge. Say: “This is a personal Node.js and Express demo for signed webhook intake and reliable API synchronization.”

**10–25s — Receipt**  
Run the demo sender. Show the accepted event in `/operator`. Point out the provider, event type, status, and attempt count.

**25–40s — Idempotency**  
Send the same event again. Show that the inbox keeps one provider/event record and the downstream reference remains deterministic.

**40–55s — Operations**  
Show metrics, status/type filters, and a failed event with the Replay button. Explain that replay targets one event ID.

**55–68s — Provider and database evidence**  
Show `src/providers/stripe.ts` and the PostgreSQL integration test. Mention that Stripe is test-mode only and the CI job runs PostgreSQL 16.

**68–75s — Verification**  
Open the successful GitHub Actions run showing Build and test, PostgreSQL integration, and Docker image build.

## Recording hygiene

Use synthetic event IDs and local test keys. Hide shell history, environment files, personal paths, and any browser password manager UI.
