import assert from 'node:assert/strict';
import { it } from 'node:test';
import { mkdtemp, readdir, rmdir, symlink, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import sharp from 'sharp';
import { normalizeImage, MAX_IMAGE_BYTES } from '../src/modules/media/image.js';
import { LocalDevelopmentStorage, newStorageKey } from '../src/modules/media/storage.js';
import { uploadBoundary } from '../src/modules/media/media.routes.js';
import { ApiError } from '../src/utils/ApiError.js';
import { writeLimits } from '../src/modules/community/writeLimits.js';

const image = () =>
  sharp({ create: { width: 12, height: 10, channels: 3, background: '#009988' } });
for (const format of ['jpeg', 'png', 'webp'] as const)
  it(`valid ${format} becomes a metadata-free WebP`, async () => {
    const bytes = await normalizeImage(
      await image()[format]().toBuffer(),
      `image.${format}`,
      `image/${format}`,
    );
    const result = await sharp(bytes).metadata();
    assert.equal(result.format, 'webp');
    assert.equal(result.width, 12);
    assert.equal(result.exif, undefined);
  });
it('strips EXIF including GPS/device fields and applies orientation', async () => {
  const source = await image()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: { Make: 'Synthetic camera', Model: 'Test device' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '31/1 2/1 3/1' },
    })
    .jpeg()
    .toBuffer();
  assert.ok((await sharp(source).metadata()).exif);
  const result = await sharp(await normalizeImage(source, 'photo.jpg', 'image/jpeg')).metadata();
  assert.equal(result.width, 10);
  assert.equal(result.height, 12);
  for (const key of ['exif', 'icc', 'xmp', 'iptc', 'orientation'] as const)
    assert.equal(result[key], undefined);
});
for (const [name, mime] of [
  ['wrong.png', 'image/jpeg'],
  ['photo.jpg', 'image/png'],
  ['../../photo.jpg', 'image/jpeg'],
  ['C:\\photo.jpg', 'image/jpeg'],
  ['photo.jpg.exe', 'image/jpeg'],
])
  it(`rejects mismatched or unsafe filename/MIME: ${name} ${mime}`, async () => {
    await assert.rejects(normalizeImage(await image().jpeg().toBuffer(), name!, mime!), {
      code: 'UNSUPPORTED_IMAGE',
    });
  });
it('rejects SVG, HTML and executable contents even with image claims', async () => {
  for (const value of [
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
    '<html><script>alert(1)</script>',
    'MZ executable',
  ])
    await assert.rejects(normalizeImage(Buffer.from(value), 'image.png', 'image/png'), {
      code: 'UNSUPPORTED_IMAGE',
    });
});
it('rejects malformed data with a valid magic prefix without exposing decoder errors', async () => {
  await assert.rejects(
    normalizeImage(Buffer.from([255, 216, 255, 0, 0]), 'image.jpg', 'image/jpeg'),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === 'MALFORMED_IMAGE' &&
      !error.message.includes('sharp'),
  );
});
it('rejects oversized bytes before decoding', async () => {
  await assert.rejects(
    normalizeImage(Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image.jpg', 'image/jpeg'),
    { statusCode: 413 },
  );
});
it('rejects excessive dimensions and pixel counts', async () => {
  for (const [width, height] of [
    [8193, 1],
    [4100, 4100],
  ]) {
    const source = await sharp({
      create: { width: width!, height: height!, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    await assert.rejects(normalizeImage(source, 'image.png', 'image/png'));
  }
});
it('downscales to 2048 pixels without upscaling', async () => {
  const source = await sharp({
    create: { width: 3000, height: 1000, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  assert.equal(
    (await sharp(await normalizeImage(source, 'image.png', 'image/png')).metadata()).width,
    2048,
  );
});
it('generated keys, exclusive writes and traversal protection prevent overwriting other files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wheel-media-unit-'));
  const storage = new LocalDevelopmentStorage(root),
    key = newStorageKey();
  try {
    assert.notEqual(key, newStorageKey());
    await storage.put(key, Buffer.from('safe'));
    await assert.rejects(storage.put(key, Buffer.from('overwrite')), {
      message: 'Media storage unavailable',
    });
    assert.equal((await storage.read(key)).toString(), 'safe');
    for (const invalid of ['../file.webp', 'C:\\secret.webp', '/etc/passwd', 'photo.webp']) {
      await assert.rejects(storage.read(invalid), { message: 'Media unavailable' });
      await assert.rejects(storage.put(invalid, Buffer.alloc(1)), {
        message: 'Media storage unavailable',
      });
      await assert.rejects(storage.remove(invalid), { message: 'Media removal unavailable' });
    }
    await storage.remove(key);
    await storage.remove(key);
    assert.deepEqual(await readdir(root), []);
  } finally {
    await storage.remove(key);
    await rmdir(root);
  }
});
it('refuses a symlink as the storage root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wheel-media-link-')),
    link = `${root}-link`;
  try {
    await symlink(root, link, 'junction');
    await assert.rejects(new LocalDevelopmentStorage(link).put(newStorageKey(), Buffer.alloc(1)));
  } finally {
    await unlink(link);
    await rmdir(root);
  }
});
async function multipartServer(work: (base: string) => Promise<void>) {
  const app = express();
  app.post('/', uploadBoundary(), (req, res) =>
    res.json({ bytes: req.file?.size, altText: req.body.altText }),
  );
  app.use(((error: ApiError, _req, res, next) => {
    void next;
    res.status(error.statusCode ?? 500).json({ code: error.code });
  }) as express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    await work(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
it('multipart accepts one image and alt text', async () =>
  multipartServer(async (base) => {
    const body = new FormData();
    body.append('image', new Blob(['fixture']), 'test.jpg');
    body.append('altText', 'Description');
    const response = await fetch(base, { method: 'POST', body });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { bytes: 7, altText: 'Description' });
  }));
it('multipart rejects extra files, fields, oversized fields and oversized file bytes', async () =>
  multipartServer(async (base) => {
    for (const kind of ['files', 'fields', 'text', 'size']) {
      const body = new FormData();
      body.append(
        'image',
        new Blob([kind === 'size' ? new Uint8Array(MAX_IMAGE_BYTES + 1) : 'fixture']),
        'test.jpg',
      );
      if (kind === 'files') body.append('image', new Blob(['extra']), 'extra.jpg');
      if (kind === 'fields') {
        body.append('altText', 'one');
        body.append('userId', 'untrusted');
      }
      if (kind === 'text') body.append('altText', 'x'.repeat(3000));
      assert.equal(
        (await fetch(base, { method: 'POST', body })).status,
        kind === 'size' ? 413 : 400,
      );
    }
  }));
it('media write limiter returns 429 after its user budget', async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { userId: 'synthetic', familyId: 'synthetic' };
    next();
  });
  app.post('/', ...writeLimits(2), (_req, res) => res.sendStatus(204));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    assert.equal((await fetch(base, { method: 'POST' })).status, 204);
    assert.equal((await fetch(base, { method: 'POST' })).status, 204);
    const response = await fetch(base, { method: 'POST' });
    assert.equal(response.status, 429);
    assert.ok(response.headers.get('retry-after'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
