import crypto from 'crypto';

export const OURA_AUTHORIZE_URL = 'https://cloud.ouraring.com/oauth/authorize';
export const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';
export const OURA_API_BASE_URL = 'https://api.ouraring.com';

const STATE_TTL_MS = 60 * 60 * 1000;

export function getOuraConfig() {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  const redirectUri = process.env.OURA_REDIRECT_URI;
  const stateSecret = process.env.OURA_OAUTH_STATE_SECRET;

  if (!clientId || !clientSecret || !redirectUri || !stateSecret) {
    throw new Error('Missing Oura OAuth environment variables');
  }

  return { clientId, clientSecret, redirectUri, stateSecret };
}

export function createOuraState(userId: string, secret: string) {
  const payload = {
    userId,
    ts: Date.now(),
    nonce: crypto.randomUUID(),
  };

  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifyOuraState(state: string, secret: string) {
  const [encoded, signature] = state.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded, secret);
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, signatureBuf)) return null;

  const payloadJson = base64UrlDecode(encoded);
  if (!payloadJson) return null;

  try {
    const payload = JSON.parse(payloadJson) as { userId: string; ts: number };
    if (!payload.userId || !payload.ts) return null;
    if (Date.now() - payload.ts > STATE_TTL_MS) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

function sign(encoded: string, secret: string) {
  return base64UrlEncode(
    crypto.createHmac('sha256', secret).update(encoded).digest()
  );
}

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string) {
  const padded = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(input.length / 4) * 4, '=');
  try {
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
}
