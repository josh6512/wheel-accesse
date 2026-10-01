import assert from 'node:assert/strict';
import { after, before, it } from 'node:test';
import type { Server } from 'node:http';
import express from 'express';
import { createApp } from '../src/app.js';
import { writeLimits } from '../src/modules/community/writeLimits.js';
import { submitContentReport } from '../src/modules/contentReports/contentReport.service.js';
import type { ContentReportRepository } from '../src/modules/contentReports/contentReport.types.js';
import {
  createContentReportBodySchema,
  targetTypes,
} from '../src/modules/contentReports/contentReport.validation.js';

const owner = '11111111-1111-4111-8111-111111111111';
const reporter = '22222222-2222-4222-8222-222222222222';
const targetId = '33333333-3333-4333-8333-333333333333';
const input = { targetType: 'REVIEW' as const, targetId, reason: 'SPAM' as const };

it('accepts only supported target types, reasons and UUIDs, trims bounded details', () => {
  assert.equal(
    createContentReportBodySchema.parse({ ...input, details: '  issue  ' }).details,
    'issue',
  );
  for (const invalid of [
    { targetType: 'USER' },
    { targetType: 'ACCESSIBILITY_REPORT' },
    { targetType: 'review' },
    { targetId: 'not-an-id' },
    { reason: 'OTHER_REASON' },
    { details: 'x'.repeat(1001) },
    { details: '   ' },
    { reporterUserId: reporter },
    { status: 'RESOLVED' },
  ])
    assert.equal(createContentReportBodySchema.safeParse({ ...input, ...invalid }).success, false);
});

it('supports each public content target without returning reporter identity', async () => {
  for (const targetType of targetTypes) {
    const calls: string[] = [];
    const repo: ContentReportRepository = {
      async findVisibleTarget(value) {
        calls.push(value.targetType);
        return { ownerIds: [owner] };
      },
      async create(value, userId) {
        assert.equal(userId, reporter);
        return { id: targetId, ...value, status: 'OPEN', createdAt: new Date() };
      },
    };
    const result = await submitContentReport({ ...input, targetType }, reporter, repo);
    assert.deepEqual(calls, [targetType]);
    assert.equal(result.status, 'OPEN');
    assert.equal('reporterUserId' in result, false);
  }
});

it('rejects nonexistent/deleted/hidden targets and self-owned content', async () => {
  const repo: ContentReportRepository = {
    findVisibleTarget: async () => null,
    create: async () => {
      throw new Error('must not insert');
    },
  };
  await assert.rejects(submitContentReport(input, reporter, repo), { statusCode: 404 });
  repo.findVisibleTarget = async () => ({ ownerIds: [owner, reporter] });
  await assert.rejects(submitContentReport(input, reporter, repo), { statusCode: 403 });
});

let server: Server;
let base: string;
before(async () => {
  const app = express();
  app.post(
    '/limited',
    (request, _response, next) => {
      request.auth = { userId: String(request.headers['x-test-user']), familyId: targetId };
      next();
    },
    ...writeLimits(5, 60000),
    (_request, response) => response.json({ ok: true }),
  );
  app.get('/read', (_request, response) => response.json({ ok: true }));
  app.use(createApp());
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
it('requires authentication before reporting', async () => {
  const response = await fetch(`${base}/api/v1/reports`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  assert.equal(response.status, 401);
});
it('rate limits reporting writes without limiting reads', async () => {
  for (let index = 0; index < 5; index++)
    assert.equal(
      (await fetch(`${base}/limited`, { method: 'POST', headers: { 'x-test-user': reporter } }))
        .status,
      200,
    );
  assert.equal(
    (await fetch(`${base}/limited`, { method: 'POST', headers: { 'x-test-user': reporter } }))
      .status,
    429,
  );
  assert.equal((await fetch(`${base}/read`)).status, 200);
});
