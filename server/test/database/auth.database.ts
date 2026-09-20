// Explicit opt-in integration suite. Creates only synthetic accounts and removes them in after().
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, it } from 'node:test';
import type { Server } from 'node:http';
import { decodeJwt } from 'jose';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { env } from '../../src/config/env.js';
import { authService } from '../../src/modules/auth/auth.service.js';
import { verifyPassword } from '../../src/modules/auth/password.js';
import { cookieName } from '../../src/modules/auth/auth.routes.js';

let server: Server, base: string;
const ids: string[] = [];
const emails: string[] = [];
const password = `Synthetic passphrase ${randomUUID()}`;
interface AuthBody {
  user: { id: string; displayName: string; email: string };
  accessToken: string;
  expiresIn: number;
}
async function request(route: string, body?: unknown, cookie?: string, token?: string) {
  return fetch(`${base}/api/v1/auth/${route}`, {
    method: route === 'me' ? 'GET' : 'POST',
    headers: {
      origin: env.CLIENT_ORIGIN,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(route === 'me' ? {} : { body: JSON.stringify(body ?? {}) }),
  });
}
const cookieFrom = (response: Response) => response.headers.get('set-cookie')!.split(';')[0]!;
async function register() {
  const email = `auth-test-${randomUUID()}@example.test`;
  emails.push(email);
  const response = await request('register', {
    email: ` ${email.toUpperCase()} `,
    password,
    displayName: 'Synthetic Auth Test',
  });
  assert.equal(response.status, 201);
  const body = (await response.json()) as AuthBody;
  ids.push(body.user.id);
  return { body, cookie: cookieFrom(response), email };
}
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
  // Also recover IDs if an assertion failed immediately after account creation.
  const credentials = await prisma.userCredential.findMany({
    where: { normalizedEmail: { in: emails } },
    select: { userId: true },
  });
  const cleanupIds = [...new Set([...ids, ...credentials.map((item) => item.userId)])];
  await prisma.$transaction(async (tx) => {
    await tx.refreshSession.deleteMany({ where: { userId: { in: cleanupIds } } });
    await tx.userCredential.deleteMany({ where: { userId: { in: cleanupIds } } });
    await tx.user.deleteMany({ where: { id: { in: cleanupIds } } });
  });
  assert.equal(await prisma.user.count({ where: { id: { in: cleanupIds } } }), 0);
  assert.equal(await prisma.refreshSession.count({ where: { userId: { in: cleanupIds } } }), 0);
  console.log('Synthetic authentication accounts and sessions: zero remaining.');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});
it('registers atomically with normalized unique identity and hashed credentials; /me stays private', async () => {
  const account = await register();
  assert.equal(account.body.user.email, account.email);
  assert.deepEqual(Object.keys(account.body).sort(), ['accessToken', 'expiresIn', 'user']);
  assert.equal(JSON.stringify(account.body).includes(password), false);
  const credential = await prisma.userCredential.findUniqueOrThrow({
    where: { userId: account.body.user.id },
  });
  assert.ok(await verifyPassword(credential.passwordHash, password));
  const session = await prisma.refreshSession.findFirstOrThrow({
    where: { userId: account.body.user.id },
  });
  assert.equal(session.tokenHash.length, 64);
  assert.equal(account.cookie.includes(session.tokenHash), false);
  const me = await request('me', undefined, undefined, account.body.accessToken);
  assert.equal(me.status, 200);
  assert.deepEqual(Object.keys((await me.json()) as object).sort(), ['displayName', 'email', 'id']);
  const duplicate = await request('register', {
    email: account.email.toUpperCase(),
    password,
    displayName: 'Duplicate',
  });
  assert.equal(duplicate.status, 409);
});
it('login succeeds and wrong/unknown/deleted accounts have identical generic failures', async () => {
  const account = await register();
  const login = await request('login', { email: account.email, password });
  assert.equal(login.status, 200);
  const errors: string[] = [];
  for (const email of [account.email, `absent-${randomUUID()}@example.test`]) {
    const response = await request('login', { email, password: 'wrong password' });
    assert.equal(response.status, 401);
    const body = (await response.json()) as { error: { message: string } };
    errors.push(body.error.message);
  }
  await prisma.user.update({
    where: { id: account.body.user.id },
    data: { deletedAt: new Date() },
  });
  const deleted = await request('login', { email: account.email, password });
  assert.equal(deleted.status, 401);
  errors.push(((await deleted.json()) as { error: { message: string } }).error.message);
  assert.ok(errors.every((message) => message === errors[0]));
  assert.equal((await request('me', undefined, undefined, account.body.accessToken)).status, 401);
  assert.equal((await request('refresh', undefined, account.cookie)).status, 401);
});
it('rotates refresh secrets, preserves absolute expiry and revokes family on replay', async () => {
  const account = await register();
  const initial = await prisma.refreshSession.findFirstOrThrow({
    where: { userId: account.body.user.id },
  });
  const refreshed = await request('refresh', undefined, account.cookie);
  assert.equal(refreshed.status, 200);
  const nextCookie = cookieFrom(refreshed);
  assert.notEqual(nextCookie, account.cookie);
  const body = (await refreshed.json()) as AuthBody;
  assert.deepEqual(Object.keys(decodeJwt(body.accessToken)).sort(), [
    'aud',
    'exp',
    'iat',
    'iss',
    'sid',
    'sub',
  ]);
  const next = await prisma.refreshSession.findFirstOrThrow({
    where: { userId: account.body.user.id, revokedAt: null },
  });
  assert.equal(next.expiresAt.getTime(), initial.expiresAt.getTime());
  assert.equal((await request('refresh', undefined, account.cookie)).status, 401);
  assert.equal((await request('refresh', undefined, nextCookie)).status, 401);
  assert.equal((await request('me', undefined, undefined, body.accessToken)).status, 401);
});
it('rejects expired and forged refresh credentials without revoking unrelated active sessions', async () => {
  const account = await register();
  const forged = account.cookie.slice(0, -4) + 'AAAA';
  assert.equal((await request('refresh', undefined, forged)).status, 401);
  assert.equal((await request('me', undefined, undefined, account.body.accessToken)).status, 200);
  await prisma.refreshSession.updateMany({
    where: { userId: account.body.user.id },
    data: { expiresAt: new Date(0) },
  });
  assert.equal((await request('refresh', undefined, account.cookie)).status, 401);
});
it('logout clears cookie, revokes the session immediately, and service supports logout-all', async () => {
  const account = await register();
  const logout = await request('logout', undefined, account.cookie);
  assert.equal(logout.status, 204);
  assert.ok(logout.headers.get('set-cookie')?.startsWith(`${cookieName}=;`));
  assert.equal((await request('me', undefined, undefined, account.body.accessToken)).status, 401);
  assert.equal((await request('refresh', undefined, account.cookie)).status, 401);
  const login = await request('login', { email: account.email, password });
  assert.equal(login.status, 200);
  await authService.logoutAll(account.body.user.id);
  assert.equal((await request('refresh', undefined, cookieFrom(login))).status, 401);
});
it('concurrent reuse cannot leave an active refresh session', async () => {
  const account = await register();
  const responses = await Promise.all([
    request('refresh', undefined, account.cookie),
    request('refresh', undefined, account.cookie),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 401]);
  assert.equal(
    await prisma.refreshSession.count({ where: { userId: account.body.user.id, revokedAt: null } }),
    0,
  );
});
it('logout racing refresh leaves the family revoked and rejects subsequent access', async () => {
  const account = await register();
  for (let attempt = 0; attempt < 5; attempt++) {
    const login = await request('login', { email: account.email, password });
    assert.equal(login.status, 200);
    const cookie = cookieFrom(login);
    const loginBody = (await login.json()) as AuthBody;
    const familyId = decodeJwt(loginBody.accessToken).sid as string;
    const [refresh, logout] = await Promise.all([
      request('refresh', undefined, cookie),
      request('logout', undefined, cookie),
    ]);
    assert.equal(logout.status, 204);
    assert.ok(refresh.status === 200 || refresh.status === 401);
    assert.equal(await prisma.refreshSession.count({ where: { familyId, revokedAt: null } }), 0);
    assert.equal((await request('me', undefined, undefined, loginBody.accessToken)).status, 401);
    if (refresh.status === 200) {
      const refreshedBody = (await refresh.json()) as AuthBody;
      assert.equal(
        (await request('me', undefined, undefined, refreshedBody.accessToken)).status,
        401,
      );
      assert.equal((await request('refresh', undefined, cookieFrom(refresh))).status, 401);
    }
  }
});
