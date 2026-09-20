import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import express from 'express';
import { decodeJwt, SignJWT } from 'jose';

process.env.AUTH_ACCESS_SECRET = randomBytes(48).toString('base64url');
process.env.NODE_ENV = 'test';
const { registerSchema, loginSchema } = await import('../src/modules/auth/auth.validation.js');
const { hashPassword, verifyPassword } = await import('../src/modules/auth/password.js');
const { signAccess, verifyAccess, newRefresh, parseRefresh } =
  await import('../src/modules/auth/tokens.js');
const { authLimiter, cookieOptions } = await import('../src/modules/auth/auth.routes.js');
const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');

describe('authentication validation and cryptography', () => {
  it('normalizes login email without provider-specific transformations', () => {
    const input = registerSchema.parse({
      email: '  Test+tag@EXAMPLE.test ',
      displayName: '  Visitor  ',
      password: 'long passphrase for tests',
    });
    assert.equal(input.email, 'test+tag@example.test');
    assert.equal(input.displayName, 'Visitor');
    assert.equal(
      loginSchema.parse({ email: 'TEST@example.test', password: 'x' }).email,
      'test@example.test',
    );
  });
  it('rejects weak passwords, invalid names/emails and ownership/unknown fields', () => {
    const valid = {
      email: 'test@example.test',
      displayName: 'Visitor',
      password: 'long passphrase for tests',
    };
    for (const input of [
      { ...valid, password: 'short' },
      { ...valid, password: 'a'.repeat(129) },
      { ...valid, displayName: ' ' },
      { ...valid, displayName: 'a'.repeat(101) },
      { ...valid, displayName: 'hello\u0000' },
      { ...valid, email: 'bad' },
      { ...valid, email: 'té@example.test' },
      { ...valid, userId: randomUUID() },
    ])
      assert.equal(registerSchema.safeParse(input).success, false);
  });
  it('uses salted Argon2id and verifies both real and dummy credential paths', async () => {
    const password = 'long passphrase for tests';
    const hash = await hashPassword(password);
    assert.ok(hash.startsWith('$argon2id$v=19$'));
    assert.deepEqual(hash.split('$')[3]!.split(',').sort(), ['m=65536', 'p=1', 't=3']);
    assert.equal(hash.includes(password), false);
    assert.ok(await verifyPassword(hash, password));
    assert.equal(await verifyPassword(hash, 'wrong'), false);
    assert.equal(await verifyPassword(undefined, password), false);
    assert.notEqual(hash, await hashPassword(password));
  });
  it('access claims contain only identity/session and standard metadata', async () => {
    const userId = randomUUID(),
      familyId = randomUUID();
    const token = await signAccess(userId, familyId);
    assert.deepEqual(await verifyAccess(token), { userId, familyId });
    assert.deepEqual(Object.keys(decodeJwt(token)).sort(), [
      'aud',
      'exp',
      'iat',
      'iss',
      'sid',
      'sub',
    ]);
    assert.equal(Number(decodeJwt(token).exp) - Number(decodeJwt(token).iat), 600);
  });
  it('rejects tampering, expiry, wrong issuer/audience and wrong signature', async () => {
    const base = () =>
      new SignJWT({ sid: randomUUID() })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(randomUUID())
        .setIssuedAt()
        .setIssuer(env.AUTH_ISSUER)
        .setAudience(env.AUTH_AUDIENCE)
        .setExpirationTime('10m');
    const key = new TextEncoder().encode(env.AUTH_ACCESS_SECRET!);
    for (const token of [
      'bad',
      await base().setExpirationTime('0s').sign(key),
      await base().setIssuer('other').sign(key),
      await base().setAudience('other').sign(key),
      await base().sign(randomBytes(48)),
    ])
      await assert.rejects(verifyAccess(token), { statusCode: 401 });
  });
  it('refresh credentials have unpredictable secrets and only a SHA-256 representation for storage', () => {
    const first = newRefresh(),
      second = newRefresh();
    assert.notEqual(first.raw, second.raw);
    assert.equal(first.tokenHash.length, 64);
    assert.deepEqual(parseRefresh(first.raw), { id: first.id, tokenHash: first.tokenHash });
    assert.equal(parseRefresh('bad'), null);
    assert.equal(parseRefresh(undefined), null);
  });
  it('web cookies are host-only, HttpOnly, Strict and scoped to auth', () => {
    assert.equal(cookieOptions.httpOnly, true);
    assert.equal(cookieOptions.sameSite, 'strict');
    assert.equal(cookieOptions.path, '/api/v1/auth');
    assert.equal(cookieOptions.domain, undefined);
  });
});

describe('HTTP authentication boundaries', () => {
  let server: Server, base: string;
  before(async () => {
    const app = createApp();
    app.get('/rate-test', authLimiter(2, 60000), (_req, res) => res.json({ ok: true }));
    // Separate app so this test does not depend on normal not-found routing.
    const host = express();
    host.get('/rate-test', authLimiter(2, 60000), (_req, res) => res.json({ ok: true }));
    host.use(app);
    server = host.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  it('rejects missing and malformed access credentials before touching the database', async () => {
    for (const authorization of ['', 'Bearer bad']) {
      const response = await fetch(`${base}/api/v1/auth/me`, { headers: { authorization } });
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  });
  it('rejects missing/foreign/null Origin on every cookie-changing endpoint', async () => {
    for (const route of ['register', 'login', 'refresh', 'logout']) {
      for (const origin of ['', 'https://attacker.example', 'null']) {
        const response = await fetch(`${base}/api/v1/auth/${route}`, {
          method: 'POST',
          headers: origin ? { origin } : {},
        });
        assert.equal(response.status, 403);
        assert.equal(response.headers.get('access-control-allow-origin'), null);
      }
    }
  });
  it('allows only configured credentialed CORS and rejects cross-site Fetch Metadata', async () => {
    const good = await fetch(`${base}/api/v1/auth/me`, {
      method: 'OPTIONS',
      headers: { origin: env.CLIENT_ORIGIN, 'access-control-request-method': 'GET' },
    });
    assert.equal(good.headers.get('access-control-allow-origin'), env.CLIENT_ORIGIN);
    assert.equal(good.headers.get('access-control-allow-credentials'), 'true');
    const bad = await fetch(`${base}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { origin: env.CLIENT_ORIGIN, 'sec-fetch-site': 'cross-site' },
    });
    assert.equal(bad.status, 403);
  });
  it('rejects unsafe registration input without echoing passwords', async () => {
    const secret = 'do-not-echo';
    const response = await fetch(`${base}/api/v1/auth/register`, {
      method: 'POST',
      headers: { origin: env.CLIENT_ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'x', email: 'bad', password: secret }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.text()).includes(secret), false);
  });
  it('returns predictable rate-limit responses and Retry-After', async () => {
    assert.equal((await fetch(`${base}/rate-test`)).status, 200);
    assert.equal((await fetch(`${base}/rate-test`)).status, 200);
    const response = await fetch(`${base}/rate-test`);
    assert.equal(response.status, 429);
    assert.ok(response.headers.has('retry-after'));
    assert.equal(
      ((await response.json()) as { error: { code: string } }).error.code,
      'AUTH_RATE_LIMITED',
    );
  });
  it('keeps place, review and accessibility-report creation routes unexposed', async () => {
    for (const path of [
      '/places',
      '/reviews',
      '/accessibility-reports',
      `/places/${randomUUID()}/reviews`,
      `/places/${randomUUID()}/accessibility-reports`,
    ]) {
      const response = await fetch(`${base}/api/v1${path}`, {
        method: 'POST',
        headers: { origin: env.CLIENT_ORIGIN, 'content-type': 'application/json' },
        body: '{}',
      });
      assert.equal(response.status, 404);
    }
  });
});
