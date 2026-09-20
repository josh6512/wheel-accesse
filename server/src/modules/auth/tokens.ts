import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';

export const unauthorized = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
function key() {
  if (!env.AUTH_ACCESS_SECRET)
    throw new Error('AUTH_ACCESS_SECRET must be configured before authentication is available.');
  return new TextEncoder().encode(env.AUTH_ACCESS_SECRET);
}
export async function signAccess(userId: string, familyId: string) {
  return new SignJWT({ sid: familyId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${env.AUTH_ACCESS_SECONDS}s`)
    .setIssuer(env.AUTH_ISSUER)
    .setAudience(env.AUTH_AUDIENCE)
    .sign(key());
}
export async function verifyAccess(token: string): Promise<{ userId: string; familyId: string }> {
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ['HS256'],
      issuer: env.AUTH_ISSUER,
      audience: env.AUTH_AUDIENCE,
      requiredClaims: ['sub', 'sid', 'iat', 'exp'],
      typ: 'JWT',
    });
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      !uuid.test(payload.sub) ||
      !uuid.test(payload.sid)
    )
      throw unauthorized();
    return { userId: payload.sub, familyId: payload.sid };
  } catch {
    throw unauthorized();
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function newRefresh() {
  const id = randomUUID();
  const raw = `${id}.${randomBytes(32).toString('base64url')}`;
  return { id, raw, tokenHash: tokenHash(raw) };
}
export function parseRefresh(raw: string | undefined) {
  if (!raw || !/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/.test(raw) || !uuid.test(raw.slice(0, 36)))
    return null;
  return { id: raw.slice(0, 36), tokenHash: tokenHash(raw) };
}
