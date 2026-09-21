// Explicit opt-in: real SQL Server, synthetic records only, cleanup in finally/after.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, it } from 'node:test';
import type { Server } from 'node:http';
import { prisma } from '../../src/db/prisma.js';
import { createApp } from '../../src/app.js';
import { authService } from '../../src/modules/auth/auth.service.js';

const run = randomUUID();
const emails: string[] = [],
  userIds: string[] = [];
const categoryId = randomUUID(),
  inactiveCategoryId = randomUUID(),
  placeId = randomUUID();
const featureIds = Array.from({ length: 6 }, () => randomUUID());
const optionId = randomUUID(),
  inactiveOptionId = randomUUID();
let owner: Awaited<ReturnType<typeof account>>,
  other: Awaited<ReturnType<typeof account>>,
  server: Server,
  base: string;
async function account() {
  const email = `community-test-${randomUUID()}@example.test`;
  emails.push(email);
  const result = await authService.register({
    email,
    password: `Synthetic only ${randomUUID()}`,
    displayName: 'Synthetic Community Test',
  });
  userIds.push(result.body.user.id);
  return { id: result.body.user.id, token: result.body.accessToken };
}
async function request(path: string, method = 'GET', body?: unknown, actor?: typeof owner) {
  return fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(actor ? { authorization: `Bearer ${actor.token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function data<T>(response: Response, status: number): Promise<T> {
  assert.equal(response.status, status);
  const text = await response.text();
  for (const privateKey of [
    'passwordHash',
    'normalizedEmail',
    'refreshSession',
    'tokenHash',
    'familyId',
    'mobilityTypes',
    'email',
    'createdById',
    '_count',
  ])
    assert.equal(text.includes(`"${privateKey}"`), false);
  return (JSON.parse(text) as { data: T }).data;
}
before(async () => {
  owner = await account();
  other = await account();
  await prisma.category.create({
    data: { id: categoryId, code: `TEST_${run}`, displayName: 'Hotel' },
  });
  await prisma.category.create({
    data: {
      id: inactiveCategoryId,
      code: `OFF_${run}`,
      displayName: 'Inactive synthetic',
      isActive: false,
    },
  });
  for (let index = 0; index < featureIds.length; index++) {
    const id = featureIds[index]!;
    await prisma.accessibilityFeature.create({
      data: {
        id,
        code: `T${index}_${run}`,
        displayName: `Synthetic feature ${index}`,
        valueType: ['boolean', 'numeric', 'select', 'text', 'boolean', 'boolean'][index]!,
        isActive: index !== 4,
        unit: index === 1 ? 'cm' : null,
      },
    });
    if (index !== 5) await prisma.categoryFeature.create({ data: { categoryId, featureId: id } });
  }
  await prisma.accessibilityFeatureOption.createMany({
    data: [
      { id: optionId, featureId: featureIds[2]!, code: 'VALID', displayName: 'Valid' },
      {
        id: inactiveOptionId,
        featureId: featureIds[2]!,
        code: 'INACTIVE',
        displayName: 'Inactive',
        isActive: false,
      },
    ],
  });
  await prisma.place.create({
    data: { id: placeId, name: `Community fixture ${run}`, categoryId, createdById: owner.id },
  });
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
  try {
    const users = await prisma.userCredential.findMany({
      where: { normalizedEmail: { in: emails } },
      select: { userId: true },
    });
    const ids = [...new Set([...userIds, ...users.map((user) => user.userId)])];
    await prisma.$transaction(async (tx) => {
      const reportWhere = { place: { categoryId: { in: [categoryId, inactiveCategoryId] } } };
      await tx.placeAccessibilityAnswer.deleteMany({ where: { report: reportWhere } });
      await tx.placeAccessibilityReport.deleteMany({ where: reportWhere });
      await tx.review.deleteMany({
        where: { place: { categoryId: { in: [categoryId, inactiveCategoryId] } } },
      });
      await tx.place.deleteMany({
        where: { categoryId: { in: [categoryId, inactiveCategoryId] } },
      });
      await tx.categoryFeature.deleteMany({ where: { categoryId } });
      await tx.accessibilityFeatureOption.deleteMany({ where: { featureId: { in: featureIds } } });
      await tx.accessibilityFeature.deleteMany({ where: { id: { in: featureIds } } });
      await tx.category.deleteMany({ where: { id: { in: [categoryId, inactiveCategoryId] } } });
      await tx.refreshSession.deleteMany({ where: { userId: { in: ids } } });
      await tx.userCredential.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });
    for (const count of [
      await prisma.user.count({ where: { id: { in: ids } } }),
      await prisma.userCredential.count({ where: { userId: { in: ids } } }),
      await prisma.refreshSession.count({ where: { userId: { in: ids } } }),
      await prisma.place.count({ where: { categoryId } }),
      await prisma.accessibilityFeature.count({ where: { id: { in: featureIds } } }),
    ])
      assert.equal(count, 0);
    console.log(
      'Community synthetic users, credentials, sessions, content and test-only catalog: zero remaining. Permanent catalog untouched.',
    );
  } finally {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
it('every community mutation requires bearer authentication (cookies alone are insufficient)', async () => {
  for (const [method, path] of [
    ['POST', '/places'],
    ['POST', `/places/${placeId}/reviews`],
    ['PATCH', `/reviews/${randomUUID()}`],
    ['DELETE', `/reviews/${randomUUID()}`],
    ['POST', `/places/${placeId}/accessibility-reports`],
    ['DELETE', `/accessibility-reports/${randomUUID()}`],
  ])
    assert.equal((await request(path!, method!, {})).status, 401);
});
it('creates a place with trusted ownership and rejects invalid category, identity and location', async () => {
  const actor = await account();
  const input = { name: `Created ${run}`, categoryId, city: 'Synthetic city', countryCode: 'IL' };
  const created = await data<{ id: string }>(await request('/places', 'POST', input, actor), 201);
  assert.equal(
    (await prisma.place.findUniqueOrThrow({ where: { id: created.id } })).createdById,
    actor.id,
  );
  for (const extra of [
    { categoryId: randomUUID() },
    { categoryId: inactiveCategoryId },
    { userId: other.id },
    { latitude: 91, longitude: 0 },
  ])
    assert.equal((await request('/places', 'POST', { ...input, ...extra }, actor)).status, 400);
});
it('concurrent duplicate creation yields exactly one insert and a safe conflict', async () => {
  const input = { name: `Hilton ${run} Tel Aviv`, categoryId, city: 'Tel Aviv', countryCode: 'IL' };
  const responses = await Promise.all([
    request('/places', 'POST', input, owner),
    request('/places', 'POST', { ...input, name: `Hilton Hotel ${run} Tel Aviv` }, other),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const conflict = (await responses.find((r) => r.status === 409)!.json()) as {
    error: { code: string; matches: { id: string }[] };
  };
  assert.equal(conflict.error.code, 'POSSIBLE_DUPLICATE_PLACE');
  assert.equal(conflict.error.matches.length, 1);
  assert.equal(await prisma.place.count({ where: { categoryId, city: 'Tel Aviv' } }), 1);
});
it('review creation, author edit, non-author rejection and soft deletion preserve plain text and privacy', async () => {
  const route = `/places/${placeId}/reviews`;
  const review = await data<{ id: string; body: string; author: { id: string } }>(
    await request(route, 'POST', { body: '  <script>not trusted HTML</script>  ' }, owner),
    201,
  );
  assert.equal(review.body, '<script>not trusted HTML</script>');
  assert.equal(review.author.id, owner.id);
  assert.equal(
    (await request(route, 'POST', { body: 'spoof', userId: other.id }, owner)).status,
    400,
  );
  assert.equal(
    (await request(`/reviews/${review.id}`, 'PATCH', { body: 'stolen' }, other)).status,
    403,
  );
  assert.equal((await request(`/reviews/${review.id}`, 'DELETE', undefined, other)).status, 403);
  const edited = await data<{ body: string }>(
    await request(`/reviews/${review.id}`, 'PATCH', { body: ' edited ' }, owner),
    200,
  );
  assert.equal(edited.body, 'edited');
  assert.equal(
    (await request(`/reviews/${review.id}`, 'PATCH', { body: 'moved', placeId }, owner)).status,
    400,
  );
  assert.equal((await request(`/reviews/${review.id}`, 'DELETE', undefined, owner)).status, 204);
  assert.ok((await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).deletedAt);
  assert.equal((await request(`/reviews/${review.id}`)).status, 404);
  const list = await data<{ id: string }[]>(await request(route), 200);
  assert.equal(
    list.some((r) => r.id === review.id),
    false,
  );
});
it('review edit/delete race cannot resurrect deleted content', async () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const review = await data<{ id: string }>(
      await request(`/places/${placeId}/reviews`, 'POST', { body: 'race' }, owner),
      201,
    );
    const [edit, deletion] = await Promise.all([
      request(`/reviews/${review.id}`, 'PATCH', { body: 'changed' }, owner),
      request(`/reviews/${review.id}`, 'DELETE', undefined, owner),
    ]);
    assert.equal(deletion.status, 204);
    assert.ok([200, 404].includes(edit.status));
    assert.ok((await prisma.review.findUniqueOrThrow({ where: { id: review.id } })).deletedAt);
  }
});
it('validates typed reports, units, active mappings/options, duplicates and identity', async () => {
  const route = `/places/${placeId}/accessibility-reports`;
  const valid = {
    answers: [
      { featureId: featureIds[0], type: 'boolean', value: false },
      { featureId: featureIds[1], type: 'numeric', value: 82.5 },
      { featureId: featureIds[2], type: 'select', optionId },
      { featureId: featureIds[3], type: 'text', value: 'Plain observation' },
    ],
  };
  const report = await data<{ id: string; author: null }>(
    await request(route, 'POST', valid, owner),
    201,
  );
  assert.equal(report.author, null);
  assert.equal(JSON.stringify(report).includes(owner.id), false);
  assert.equal(
    (await prisma.placeAccessibilityReport.findUniqueOrThrow({ where: { id: report.id } })).userId,
    owner.id,
  );
  const numeric = await prisma.placeAccessibilityAnswer.findUniqueOrThrow({
    where: { reportId_featureId: { reportId: report.id, featureId: featureIds[1]! } },
  });
  assert.equal(numeric.numericUnit, 'cm');
  for (const body of [
    { ...valid, userId: other.id },
    { answers: [valid.answers[0], valid.answers[0]] },
    { answers: [{ featureId: featureIds[4], type: 'boolean', value: true }] },
    { answers: [{ featureId: featureIds[5], type: 'boolean', value: true }] },
    { answers: [{ featureId: featureIds[0], type: 'text', value: 'wrong' }] },
    { answers: [{ featureId: featureIds[2], type: 'select', optionId: randomUUID() }] },
    { answers: [{ featureId: featureIds[2], type: 'select', optionId: inactiveOptionId }] },
    { answers: [{ featureId: featureIds[1], type: 'numeric', value: 82, unit: 'in' }] },
  ])
    assert.equal((await request(route, 'POST', body, owner)).status, 400);
});
it('preserves concurrent partial conflicting reports and permits owner-only soft deletion', async () => {
  const route = `/places/${placeId}/accessibility-reports`;
  const reports = await Promise.all(
    [owner, other].map(async (actor, index) =>
      data<{ id: string }>(
        await request(
          route,
          'POST',
          { answers: [{ featureId: featureIds[0], type: 'boolean', value: index === 0 }] },
          actor,
        ),
        201,
      ),
    ),
  );
  const stored = await prisma.placeAccessibilityAnswer.findMany({
    where: { reportId: { in: reports.map((r) => r.id) } },
  });
  assert.equal(stored.length, 2);
  assert.deepEqual(stored.map((a) => a.booleanValue).sort(), [false, true]);
  assert.equal(
    (await request(`/accessibility-reports/${reports[0]!.id}`, 'DELETE', undefined, other)).status,
    403,
  );
  assert.equal(
    (await request(`/accessibility-reports/${reports[0]!.id}`, 'DELETE', undefined, owner)).status,
    204,
  );
  assert.equal((await request(`/accessibility-reports/${reports[0]!.id}`)).status, 404);
  assert.equal((await request(`/accessibility-reports/${reports[1]!.id}`)).status, 200);
  assert.equal(
    await prisma.placeAccessibilityAnswer.count({ where: { reportId: reports[0]!.id } }),
    1,
  );
});
it('missing or unavailable places reject contributions and missing mutations return 404', async () => {
  const hidden = await prisma.place.create({
    data: { name: `Hidden ${run}`, categoryId, createdById: owner.id, deletedAt: new Date() },
  });
  for (const id of [randomUUID(), hidden.id]) {
    assert.equal(
      (await request(`/places/${id}/reviews`, 'POST', { body: 'hello' }, other)).status,
      404,
    );
    assert.equal(
      (
        await request(
          `/places/${id}/accessibility-reports`,
          'POST',
          { answers: [{ featureId: featureIds[0], type: 'boolean', value: true }] },
          other,
        )
      ).status,
      404,
    );
  }
  assert.equal(
    (await request(`/reviews/${randomUUID()}`, 'PATCH', { body: 'hello' }, owner)).status,
    404,
  );
  assert.equal(
    (await request(`/accessibility-reports/${randomUUID()}`, 'DELETE', undefined, owner)).status,
    404,
  );
});
it('each creation route rate-limits authenticated writes while read traffic remains available', async () => {
  const actor = await account();
  for (const [path, limit] of [
    ['/places', 5],
    [`/places/${placeId}/reviews`, 20],
    [`/places/${placeId}/accessibility-reports`, 20],
  ] as const) {
    for (let index = 0; index < limit; index++)
      assert.equal((await request(path, 'POST', {}, actor)).status, 400);
    const response = await request(path, 'POST', {}, actor);
    assert.equal(response.status, 429);
    assert.ok(response.headers.has('retry-after'));
  }
  assert.equal((await request(`/places/${placeId}`)).status, 200);
});
