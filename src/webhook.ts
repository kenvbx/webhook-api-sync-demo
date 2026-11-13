import crypto from 'node:crypto';

export const signatureFor = (rawBody: Buffer | string, timestamp: string, secret: string): string => {
  const signedPayload = `${timestamp}.${Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody}`;
  return crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
};

export const signaturesMatch = (rawBody: Buffer, timestamp: string, signature: string, secret: string): boolean => {
  if (!/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signatureFor(rawBody, timestamp, secret), 'hex');
  const supplied = Buffer.from(signature, 'hex');
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
};
