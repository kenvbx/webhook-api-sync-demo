import 'dotenv/config';

const positiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  port: positiveInt(process.env.PORT, 3010),
  databasePath: process.env.DATABASE_PATH ?? './data/webhooks.sqlite',
  webhookSecret: process.env.WEBHOOK_SECRET ?? 'local-demo-secret-change-me',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_local-demo-secret',
  timestampToleranceSeconds: positiveInt(process.env.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS, 300),
  maxWebhookBodyBytes: positiveInt(process.env.MAX_WEBHOOK_BODY_BYTES, 262144),
};
