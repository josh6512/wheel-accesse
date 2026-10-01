// Explicit opt-in: real SQL Server plus a uniquely scoped, temporary storage root.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { after, before, it } from 'node:test';
import type { Server } from 'node:http';
import sharp from 'sharp';
const root = await mkdtemp(join(tmpdir(), 'wheel-media-sql-'));
process.env.MEDIA_LOCAL_ROOT = root;
const { prisma } = await import('../../src/db/prisma.js');
const { createApp } = await import('../../src/app.js');
const { authService } = await import('../../src/modules/auth/auth.service.js');
const { mediaService, createMediaService } =
  await import('../../src/modules/media/media.service.js');
const { LocalDevelopmentStorage } = await import('../../src/modules/media/storage.js');
const { changeReview } = await import('../../src/modules/community/community.service.js');
const users: string[] = [],
  places: string[] = [];
let owner: Awaited<ReturnType<typeof account>>,
  other: typeof owner,
  placeId: string,
  reviewId: string;
let server: Server, base: string, firstMedia: string;
const storage = new LocalDevelopmentStorage(root);
async function account() {
  const result = await authService.register({
    email: `media-sql-${randomUUID()}@example.test`,
    password: `Synthetic only ${randomUUID()}`,
    displayName: 'Synthetic media test',
  });
  users.push(result.body.user.id);
  return { id: result.body.user.id, token: result.body.accessToken };
}
async function newPlace() {
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
  const place = await prisma.place.create({
    data: { name: `Media fixture ${randomUUID()}`, categoryId: category.id, createdById: owner.id },
  });
  places.push(place.id);
  return place.id;
}
async function fixture(format: 'jpeg' | 'png' | 'webp' = 'png') {
  return sharp({ create: { width: 16, height: 12, channels: 3, background: '#007755' } })
    .withExif({
      IFD0: { Make: 'Private synthetic device' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '31/1 2/1 3/1' },
    })
    [format]()
    .toBuffer();
}
async function upload(
  target: 'places' | 'reviews',
  id: string,
  actor: typeof owner | null,
  format: 'jpeg' | 'png' | 'webp' = 'png',
) {
  const form = new FormData();
  form.append(
    'image',
    new Blob([new Uint8Array(await fixture(format))], { type: `image/${format}` }),
    `untrusted-name.${format}`,
  );
  form.append('altText', 'Synthetic safe image');
  return fetch(`${base}/${target}/${id}/media`, {
    method: 'POST',
    body: form,
    headers: actor ? { Authorization: `Bearer ${actor.token}` } : {},
  });
}
async function request(path: string, method = 'GET', actor?: typeof owner) {
  return fetch(`${base}${path}`, {
    method,
    headers: actor ? { Authorization: `Bearer ${actor.token}` } : {},
  });
}
before(async () => {
  owner = await account();
  other = await account();
  placeId = await newPlace();
  reviewId = (
    await prisma.review.create({
      data: { placeId, userId: owner.id, body: 'Synthetic media review' },
    })
  ).id;
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
});
after(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const media = { uploaderId: { in: users } };
      await tx.placeMedia.deleteMany({ where: { mediaAsset: media } });
      await tx.reviewMedia.deleteMany({ where: { mediaAsset: media } });
      await tx.mediaAsset.deleteMany({ where: media });
      await tx.review.deleteMany({ where: { placeId: { in: places } } });
      await tx.place.deleteMany({ where: { id: { in: places } } });
      await tx.refreshSession.deleteMany({ where: { userId: { in: users } } });
      await tx.userCredential.deleteMany({ where: { userId: { in: users } } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
    });
    for (const count of [
      await prisma.user.count({ where: { id: { in: users } } }),
      await prisma.userCredential.count({ where: { userId: { in: users } } }),
      await prisma.refreshSession.count({ where: { userId: { in: users } } }),
      await prisma.place.count({ where: { id: { in: places } } }),
      await prisma.review.count({ where: { placeId: { in: places } } }),
      await prisma.mediaAsset.count({ where: { uploaderId: { in: users } } }),
    ])
      assert.equal(count, 0);
    // Only files inside this run's mkdtemp directory; no recursive/broad deletion.
    for (const entry of await readdir(root, { withFileTypes: true })) {
      assert.ok(entry.isFile());
      await unlink(join(root, entry.name));
    }
    assert.deepEqual(await readdir(root), []);
    await rmdir(root);
    console.log(
      'Media cleanup verified: zero synthetic users, credentials, sessions, places, reviews, attachments, assets or files; permanent catalog untouched.',
    );
  } finally {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
it('uploads and deletion require authentication; private management rejects other users', async () => {
  assert.equal((await upload('places', placeId, null)).status, 401);
  assert.equal((await upload('reviews', reviewId, null)).status, 401);
  assert.equal((await request(`/media/${randomUUID()}`, 'DELETE')).status, 401);
  assert.equal((await request(`/places/${placeId}/media`, 'GET', other)).status, 403);
});
for (const format of ['jpeg', 'png', 'webp'] as const)
  it(`real ${format} binary upload, sanitized storage, public retrieval and safe metadata`, async () => {
    const response = await upload(
      format === 'webp' ? 'reviews' : 'places',
      format === 'webp' ? reviewId : placeId,
      owner,
      format,
    );
    assert.equal(response.status, 201);
    const { data } = (await response.json()) as {
      data: {
        id: string;
        storageReference: string;
        mimeType: string;
        altText: string;
        displayOrder: number;
      };
    };
    assert.deepEqual(
      Object.keys(data).sort(),
      ['id', 'storageReference', 'mimeType', 'altText', 'displayOrder'].sort(),
    );
    assert.equal(data.mimeType, 'image/webp');
    assert.match(data.storageReference, /^http:\/\/localhost:3000\/api\/v1\/media\//);
    const stored = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: data.id } });
    assert.equal(stored.uploaderId, owner.id);
    assert.equal(stored.storageKey.includes('untrusted'), false);
    const read = await request(`/media/${data.id}`);
    assert.equal(read.status, 200);
    assert.equal(read.headers.get('content-type'), 'image/webp');
    assert.equal(read.headers.get('cache-control'), 'no-store');
    const bytes = Buffer.from(await read.arrayBuffer());
    assert.deepEqual(bytes, await storage.read(stored.storageKey));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.xmp, undefined);
    if (!firstMedia) firstMedia = data.id;
  });
it('cross-user place/review uploads and deletion are forbidden and leave data unchanged', async () => {
  assert.equal((await upload('places', placeId, other)).status, 403);
  assert.equal((await upload('reviews', reviewId, other)).status, 403);
  assert.equal((await request(`/media/${firstMedia}`, 'DELETE', other)).status, 403);
  assert.equal((await request(`/media/${firstMedia}`)).status, 200);
});
it('missing/deleted parents and malformed IDs are rejected safely', async () => {
  assert.equal((await upload('places', randomUUID(), owner)).status, 404);
  const response = await request('/media/..%5Csecret');
  assert.equal(response.status, 400);
  const text = await response.text();
  assert.equal(text.includes(root), false);
  assert.equal(text.includes('stack'), false);
});
it('deletion hides public attachment, removes binary, and is safely repeatable', async () => {
  const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: firstMedia } });
  assert.equal((await request(`/media/${firstMedia}`, 'DELETE', owner)).status, 204);
  assert.equal((await request(`/media/${firstMedia}`)).status, 404);
  assert.equal((await request(`/media/${firstMedia}`, 'DELETE', owner)).status, 204);
  await assert.rejects(storage.read(asset.storageKey));
  assert.ok((await prisma.mediaAsset.findUniqueOrThrow({ where: { id: firstMedia } })).deletedAt);
  const details = (await (await request(`/places/${placeId}`)).json()) as {
    data: { media: { id: string }[] };
  };
  assert.equal(
    details.data.media.some((item) => item.id === firstMedia),
    false,
  );
});
it('concurrent uploads enforce place/review counts transactionally and clean rejected objects', async () => {
  const file = { buffer: await fixture(), originalname: 'test.png', mimetype: 'image/png' };
  for (const target of ['places', 'reviews'] as const) {
    const place = await newPlace();
    const parent =
      target === 'places'
        ? place
        : (
            await prisma.review.create({
              data: { placeId: place, userId: owner.id, body: 'Synthetic count test' },
            })
          ).id;
    const limit = target === 'places' ? 6 : 3;
    for (let i = 0; i < limit - 1; i++)
      await mediaService.upload(target, parent, owner.id, file, null);
    const before = (await readdir(root)).length;
    const race = await Promise.allSettled([
      mediaService.upload(target, parent, owner.id, file, null),
      mediaService.upload(target, parent, owner.id, file, null),
    ]);
    assert.equal(race.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal((await mediaService.list(target, parent, owner.id)).length, limit);
    assert.equal((await readdir(root)).length, before + 1);
  }
});
it('concurrent review deletion/upload never exposes media of a deleted parent', async () => {
  const review = await prisma.review.create({
    data: { placeId, userId: owner.id, body: 'Synthetic delete race' },
  });
  const race = await Promise.allSettled([
    mediaService.upload(
      'reviews',
      review.id,
      owner.id,
      { buffer: await fixture(), originalname: 'test.png', mimetype: 'image/png' },
      null,
    ),
    changeReview(review.id, owner.id, null),
  ]);
  assert.equal(race[1]!.status, 'fulfilled');
  if (race[0]!.status === 'fulfilled')
    assert.equal((await request(`/media/${race[0]!.value.id}`)).status, 404);
  await assert.rejects(
    mediaService.upload(
      'reviews',
      review.id,
      owner.id,
      { buffer: await fixture(), originalname: 'test.png', mimetype: 'image/png' },
      null,
    ),
    { statusCode: 404 },
  );
});
it('storage failure is safe and failed removal hides media before retry', async () => {
  const broken = createMediaService({
    put: async () => {
      throw new Error('secret filesystem path');
    },
    read: storage.read.bind(storage),
    remove: storage.remove.bind(storage),
  });
  await assert.rejects(
    broken.upload(
      'places',
      placeId,
      owner.id,
      { buffer: await fixture(), originalname: 'test.png', mimetype: 'image/png' },
      null,
    ),
    {
      code: 'MEDIA_STORAGE_FAILED',
      message: 'Image storage is unavailable. No attachment was saved.',
    },
  );
  const asset = await mediaService.upload(
    'places',
    placeId,
    owner.id,
    { buffer: await fixture(), originalname: 'test.png', mimetype: 'image/png' },
    null,
  );
  const removeFailure = createMediaService({
    put: storage.put.bind(storage),
    read: storage.read.bind(storage),
    remove: async () => {
      throw new Error('private');
    },
  });
  await assert.rejects(removeFailure.remove(asset.id, owner.id), { code: 'MEDIA_REMOVAL_PENDING' });
  assert.equal((await request(`/media/${asset.id}`)).status, 404);
  await mediaService.remove(asset.id, owner.id);
});
