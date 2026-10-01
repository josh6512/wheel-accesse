// Explicit opt-in: real SQL Server, synthetic records only, cleaned in after().
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, it } from 'node:test';
import type { Server } from 'node:http';
import { Prisma } from '@prisma/client';
import { prisma } from '../../src/db/prisma.js';
import { createApp } from '../../src/app.js';
import { authService } from '../../src/modules/auth/auth.service.js';
import { createContentReport } from '../../src/modules/contentReports/contentReport.service.js';
import type { CreateContentReportInput } from '../../src/modules/contentReports/contentReport.validation.js';

const run = randomUUID();
const categoryId = randomUUID(),
  placeId = randomUUID(),
  reviewId = randomUUID();
const placeMediaId = randomUUID(),
  reviewMediaId = randomUUID();
const deletedReviewId = randomUUID(),
  deletedMediaId = randomUUID(),
  hiddenPlaceId = randomUUID();
const emails: string[] = [],
  userIds: string[] = [];
let owner: { id: string; token: string },
  reporter: { id: string; token: string },
  other: { id: string; token: string };
let server: Server, base: string;

async function account() {
  const email = `report-test-${randomUUID()}@example.test`;
  emails.push(email);
  const result = await authService.register({
    email,
    password: `Synthetic only ${randomUUID()}`,
    displayName: 'Synthetic Report Test',
  });
  userIds.push(result.body.user.id);
  return { id: result.body.user.id, token: result.body.accessToken };
}
const report = (
  targetType: CreateContentReportInput['targetType'],
  targetId: string,
  reason: CreateContentReportInput['reason'] = 'SPAM',
): CreateContentReportInput => ({ targetType, targetId, reason });
async function post(body: unknown, token?: string) {
  return fetch(`${base}/api/v1/reports`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

before(async () => {
  owner = await account();
  reporter = await account();
  other = await account();
  await prisma.category.create({
    data: { id: categoryId, code: `R_${run}`, displayName: 'Synthetic report category' },
  });
  await prisma.place.createMany({
    data: [
      { id: placeId, name: 'Synthetic report place', categoryId, createdById: owner.id },
      {
        id: hiddenPlaceId,
        name: 'Hidden synthetic report place',
        categoryId,
        deletedAt: new Date(),
      },
    ],
  });
  await prisma.review.createMany({
    data: [
      { id: reviewId, placeId, userId: owner.id, body: 'Synthetic review' },
      {
        id: deletedReviewId,
        placeId,
        userId: owner.id,
        body: 'Deleted synthetic review',
        deletedAt: new Date(),
      },
    ],
  });
  await prisma.mediaAsset.createMany({
    data: [
      {
        id: placeMediaId,
        storageKey: `reports/${run}/place.webp`,
        mimeType: 'image/webp',
        uploaderId: owner.id,
      },
      {
        id: reviewMediaId,
        storageKey: `reports/${run}/review.webp`,
        mimeType: 'image/webp',
        uploaderId: owner.id,
      },
      {
        id: deletedMediaId,
        storageKey: `reports/${run}/deleted.webp`,
        mimeType: 'image/webp',
        uploaderId: owner.id,
        deletedAt: new Date(),
      },
    ],
  });
  await prisma.placeMedia.createMany({
    data: [
      { placeId, mediaAssetId: placeMediaId },
      { placeId, mediaAssetId: deletedMediaId },
    ],
  });
  await prisma.reviewMedia.create({ data: { reviewId, mediaAssetId: reviewMediaId } });
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  const users = await prisma.userCredential.findMany({
    where: { normalizedEmail: { in: emails } },
    select: { userId: true },
  });
  const ids = [...new Set([...userIds, ...users.map((user) => user.userId)])];
  await prisma.$transaction(async (tx) => {
    await tx.contentReport.deleteMany({ where: { reporterUserId: { in: ids } } });
    await tx.placeMedia.deleteMany({ where: { placeId: { in: [placeId, hiddenPlaceId] } } });
    await tx.reviewMedia.deleteMany({ where: { reviewId: { in: [reviewId, deletedReviewId] } } });
    await tx.mediaAsset.deleteMany({
      where: { id: { in: [placeMediaId, reviewMediaId, deletedMediaId] } },
    });
    await tx.review.deleteMany({ where: { id: { in: [reviewId, deletedReviewId] } } });
    await tx.place.deleteMany({ where: { id: { in: [placeId, hiddenPlaceId] } } });
    await tx.category.deleteMany({ where: { id: categoryId } });
    await tx.refreshSession.deleteMany({ where: { userId: { in: ids } } });
    await tx.userCredential.deleteMany({ where: { userId: { in: ids } } });
    await tx.user.deleteMany({ where: { id: { in: ids } } });
  });
  assert.equal(await prisma.contentReport.count({ where: { reporterUserId: { in: ids } } }), 0);
  await prisma.$disconnect();
});

it('reports all four visible target types with only safe response fields', async () => {
  for (const [type, id] of [
    ['PLACE', placeId],
    ['REVIEW', reviewId],
    ['PLACE_MEDIA', placeMediaId],
    ['REVIEW_MEDIA', reviewMediaId],
  ] as const) {
    const created = await createContentReport(report(type, id), reporter.id);
    assert.equal(created.targetType, type);
    assert.equal(created.status, 'OPEN');
    assert.equal('reporterUserId' in created, false);
    assert.equal('details' in created, false);
  }
});
it('rejects hidden, deleted, nonexistent and cross-target content', async () => {
  for (const input of [
    report('PLACE', hiddenPlaceId),
    report('REVIEW', deletedReviewId),
    report('PLACE_MEDIA', deletedMediaId),
    report('REVIEW_MEDIA', placeMediaId),
    report('PLACE', randomUUID()),
  ])
    await assert.rejects(createContentReport(input, other.id), { statusCode: 404 });
});
it('rejects own place, review and associated media', async () => {
  for (const input of [
    report('PLACE', placeId),
    report('REVIEW', reviewId),
    report('PLACE_MEDIA', placeMediaId),
    report('REVIEW_MEDIA', reviewMediaId),
  ])
    await assert.rejects(createContentReport(input, owner.id), { statusCode: 403 });
});
it('enforces same-reason uniqueness under a race but permits another reporter', async () => {
  const input = report('PLACE', placeId, 'OTHER');
  const race = await Promise.allSettled([
    createContentReport(input, reporter.id),
    createContentReport(input, reporter.id),
  ]);
  assert.equal(race.filter((item) => item.status === 'fulfilled').length, 1);
  const rejected = race.find((item) => item.status === 'rejected');
  assert.equal(rejected?.status, 'rejected');
  if (rejected?.status === 'rejected') assert.equal(rejected.reason.statusCode, 409);
  assert.equal(
    await prisma.contentReport.count({
      where: {
        reporterUserId: reporter.id,
        targetType: 'PLACE',
        targetId: placeId,
        reason: 'OTHER',
      },
    }),
    1,
  );
  await createContentReport(input, other.id);
  assert.equal(
    await prisma.contentReport.count({
      where: { targetType: 'PLACE', targetId: placeId, reason: 'OTHER' },
    }),
    2,
  );
  await assert.rejects(
    prisma.contentReport.create({
      data: {
        reporterUserId: reporter.id,
        targetType: 'PLACE',
        targetId: placeId,
        reason: 'OTHER',
      },
    }),
    (error: unknown) =>
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002',
  );
});
it('HTTP rejects unauthenticated and spoofed identity; public place omits reports', async () => {
  assert.equal((await post(report('REVIEW', reviewId))).status, 401);
  assert.equal(
    (await post({ ...report('REVIEW', reviewId), reporterUserId: owner.id }, other.token)).status,
    400,
  );
  const response = await post(report('REVIEW', reviewId, 'OTHER'), other.token);
  assert.equal(response.status, 201);
  const text = await response.text();
  assert.equal(text.includes('reporterUserId'), false);
  assert.equal(text.includes(owner.id), false);
  const publicText = await (await fetch(`${base}/api/v1/places/${placeId}`)).text();
  assert.equal(publicText.includes('contentReport'), false);
  assert.equal(publicText.includes('reporterUserId'), false);
  assert.equal(publicText.includes('reportCount'), false);
});
