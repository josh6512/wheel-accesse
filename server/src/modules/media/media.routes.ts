import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { writeLimits } from '../community/writeLimits.js';
import { imageError, MAX_IMAGE_BYTES } from './image.js';
import {
  authorizeMedia,
  mediaService,
  type createMediaService,
  type MediaTarget,
} from './media.service.js';

const multipart = multer({
  storage: multer.memoryStorage(),
  preservePath: true,
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
    fields: 1,
    fieldSize: 2000,
    fieldNameSize: 20,
    parts: 2,
    headerPairs: 20,
  },
}).single('image');

export function uploadBoundary(maxConcurrent = 2): RequestHandler {
  let active = 0;
  return (request, response, next) => {
    if (!request.is('multipart/form-data'))
      return next(imageError('INVALID_UPLOAD', 'Send one image using multipart/form-data.'));
    const limit = MAX_IMAGE_BYTES + 16 * 1024;
    if (Number(request.headers['content-length'] ?? 0) > limit)
      return next(imageError('IMAGE_TOO_LARGE', 'Upload exceeds the request size limit.', 413));
    if (active >= maxConcurrent)
      return next(imageError('MEDIA_BUSY', 'Image processing is busy. Try again shortly.', 503));
    active++;
    let total = 0,
      rejected = false,
      released = false;
    const reject = (code: string, message: string, status: number) => {
      if (rejected || response.headersSent) return;
      rejected = true;
      request.pause();
      response.setHeader('Connection', 'close');
      response.once('finish', () => request.destroy());
      next(imageError(code, message, status));
    };
    const count = (chunk: Buffer) => {
      total += chunk.length;
      if (total > limit) reject('IMAGE_TOO_LARGE', 'Upload exceeds the request size limit.', 413);
    };
    const timer = setTimeout(() => reject('UPLOAD_TIMEOUT', 'Upload timed out.', 408), 30_000);
    const release = () => {
      if (released) return;
      released = true;
      active--;
      clearTimeout(timer);
      request.off('data', count);
    };
    response.once('finish', release);
    response.once('close', release);
    request.on('data', count);
    multipart(request, response, (error: unknown) => {
      clearTimeout(timer);
      if (rejected || response.headersSent) return;
      if (error)
        return next(
          imageError(
            'INVALID_UPLOAD',
            error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
              ? 'Images must be at most 5 MiB.'
              : 'Send one valid image and optional alt text within the upload limits.',
            error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
          ),
        );
      next();
    });
  };
}
export function createMediaRouter(service: ReturnType<typeof createMediaService> = mediaService) {
  const router = Router();
  const uploadLimits = writeLimits(10),
    deleteLimits = writeLimits(30),
    boundary = uploadBoundary();
  const id: RequestHandler = (request, _response, next) => {
    if (!z.uuid().safeParse(request.params.id).success)
      return next(imageError('INVALID_ID', 'A valid resource ID is required.'));
    next();
  };
  const enabled: RequestHandler = (_request, _response, next) => {
    if (env.NODE_ENV === 'production')
      return next(
        imageError('MEDIA_NOT_CONFIGURED', 'Production media storage is not configured.', 503),
      );
    next();
  };
  for (const target of ['places', 'reviews'] as MediaTarget[]) {
    router.get(`/${target}/:id/media`, requireAuth, id, async (request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      response.json({
        data: await service.list(target, String(request.params.id), request.auth!.userId),
      });
    });
    router.post(
      `/${target}/:id/media`,
      requireAuth,
      id,
      enabled,
      ...uploadLimits,
      async (request, _response, next) => {
        await authorizeMedia(target, String(request.params.id), request.auth!.userId);
        next();
      },
      boundary,
      async (request, response) => {
        const body = z
          .object({ altText: z.string().trim().max(500).optional() })
          .strict()
          .safeParse(request.body);
        if (!body.success || !request.file)
          throw imageError(
            'INVALID_UPLOAD',
            'Supply one image and optional alt text up to 500 characters.',
          );
        const data = await service.upload(
          target,
          String(request.params.id),
          request.auth!.userId,
          request.file,
          body.data.altText || null,
        );
        response.status(201).json({ data });
      },
    );
  }
  router.get('/media/:id', id, enabled, async (request, response) => {
    const bytes = await service.read(String(request.params.id));
    response
      .set({
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Cache-Control': 'no-store',
        'Content-Disposition': 'inline',
      })
      .send(bytes);
  });
  router.delete(
    '/media/:id',
    requireAuth,
    id,
    enabled,
    ...deleteLimits,
    async (request, response) => {
      await service.remove(String(request.params.id), request.auth!.userId);
      response.status(204).end();
    },
  );
  return router;
}
export const mediaRouter = createMediaRouter();
