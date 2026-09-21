import assert from 'node:assert/strict';
import { after, before, it } from 'node:test';
import type { Server } from 'node:http';
import express from 'express';
import {
  likelyDuplicate,
  type DuplicateCandidate,
} from '../src/modules/places/place.duplicates.js';
import { createPlaceBodySchema } from '../src/modules/places/place.validation.js';
import { submitAccessibilityReportBodySchema } from '../src/modules/accessibilityReports/accessibilityReport.validation.js';
import { assertOwner } from '../src/modules/community/community.service.js';
import { writeLimits } from '../src/modules/community/writeLimits.js';

const id = '11111111-1111-4111-8111-111111111111';
const input = {
  name: 'Hilton Hotel Tel Aviv',
  categoryId: id,
  city: 'Tel Aviv',
  countryCode: 'IL',
};
const candidate: DuplicateCandidate = {
  id,
  name: '  HILTON   Tel Aviv ',
  city: 'Tel Aviv',
  countryCode: 'IL',
  address: null,
  latitude: null,
  longitude: null,
};
it('conservatively detects case, whitespace, punctuation and catalog descriptor duplicates', () => {
  assert.equal(likelyDuplicate(input, candidate, 'Hotel'), true);
  assert.equal(likelyDuplicate({ ...input, name: 'Hilton - Tel Aviv' }, candidate, 'Hotel'), true);
  assert.equal(likelyDuplicate({ ...input, name: 'Different Hotel' }, candidate, 'Hotel'), false);
});
it('does not block distinct cities, countries, addresses or distant branches', () => {
  for (const distinct of [
    { ...candidate, city: 'Haifa' },
    { ...candidate, countryCode: 'US' },
    { ...candidate, address: '2 Different St' },
    { ...candidate, latitude: 34, longitude: 34 },
  ]) {
    assert.equal(
      likelyDuplicate(
        { ...input, address: '1 Test St', latitude: 32, longitude: 34 },
        distinct,
        'Hotel',
      ),
      false,
    );
  }
  assert.equal(likelyDuplicate({ ...input, city: undefined }, candidate, 'Hotel'), false);
});
it('rejects client identity, unknown fields and malformed locations', () => {
  for (const extra of [
    { userId: id },
    { createdById: id },
    { latitude: 91, longitude: 0 },
    { longitude: 0 },
    { latitude: '32', longitude: 34 },
  ])
    assert.equal(createPlaceBodySchema.safeParse({ ...input, ...extra }).success, false);
});
it('validates partial false reports and decimal storage bounds without accepting units/identity', () => {
  const answer = { featureId: id, type: 'boolean', value: false };
  assert.equal(submitAccessibilityReportBodySchema.safeParse({ answers: [answer] }).success, true);
  for (const body of [
    { answers: [] },
    { answers: [answer], userId: id },
    { answers: [{ ...answer, value: 'false' }] },
    { answers: [{ featureId: id, type: 'numeric', value: 1e16 }] },
    { answers: [{ featureId: id, type: 'numeric', value: 1.12345 }] },
    { answers: [{ featureId: id, type: 'numeric', value: 80, unit: 'inches' }] },
  ])
    assert.equal(submitAccessibilityReportBodySchema.safeParse(body).success, false);
});
it('ownership distinguishes missing, owner and non-owner including legacy anonymous content', () => {
  assert.doesNotThrow(() => assertOwner({ userId: id }, id));
  assert.throws(() => assertOwner(null, id), { statusCode: 404 });
  assert.throws(() => assertOwner({ userId: 'other' }, id), { statusCode: 403 });
  assert.throws(() => assertOwner({ userId: null }, id), { statusCode: 403 });
});
let server: Server, base: string;
before(async () => {
  const app = express();
  app.post(
    '/write',
    (request, _response, next) => {
      request.auth = { userId: String(request.headers['x-test-user']), familyId: id };
      next();
    },
    ...writeLimits(2, 60000),
    (_request, response) => response.json({ ok: true }),
  );
  app.get('/read', (_request, response) => response.json({ ok: true }));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
it('independently enforces account and IP write budgets without limiting reads', async () => {
  const request = (user: string) =>
    fetch(`${base}/write`, { method: 'POST', headers: { 'x-test-user': user } });
  assert.equal((await request('a')).status, 200);
  assert.equal((await request('a')).status, 200);
  const limited = await request('a');
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.has('retry-after'));
  for (const user of ['b', 'c', 'd']) assert.equal((await request(user)).status, 200);
  assert.equal((await request('e')).status, 429);
  assert.equal((await fetch(`${base}/read`)).status, 200);
});
