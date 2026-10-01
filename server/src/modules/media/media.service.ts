import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { writeTransaction } from '../community/writeTransaction.js';
import { imageError, MEDIA_COUNTS, normalizeImage } from './image.js';
import {
  LocalDevelopmentStorage,
  newStorageKey,
  isStorageKey,
  type MediaStorageService,
} from './storage.js';
import { mediaUrl } from './media.url.js';

export type MediaTarget = 'places' | 'reviews';
const visiblePlace = { deletedAt: null, category: { isActive: true } };
const safeSelect = { id: true, storageKey: true, mimeType: true, altText: true } as const;
function publicMedia(
  asset: { id: string; storageKey: string; mimeType: string; altText: string | null },
  displayOrder: number,
) {
  return {
    id: asset.id,
    storageReference: mediaUrl(asset.id),
    mimeType: asset.mimeType,
    altText: asset.altText,
    displayOrder,
  };
}
export async function authorizeMedia(
  target: MediaTarget,
  id: string,
  userId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  const owner =
    target === 'places'
      ? await tx.place
          .findFirst({ where: { id, ...visiblePlace }, select: { createdById: true } })
          .then((row) => row && row.createdById)
      : await tx.review
          .findFirst({
            where: { id, deletedAt: null, place: visiblePlace },
            select: { userId: true },
          })
          .then((row) => row && row.userId);
  if (owner === null)
    throw imageError('MEDIA_PARENT_NOT_FOUND', 'The place or review is unavailable.', 404);
  if (owner !== userId)
    throw imageError('MEDIA_FORBIDDEN', 'Only the creator can manage these images.', 403);
}
export function createMediaService(storage: MediaStorageService) {
  return {
    async list(target: MediaTarget, id: string, userId: string) {
      await authorizeMedia(target, id, userId);
      const rows =
        target === 'places'
          ? await prisma.placeMedia.findMany({
              where: { placeId: id, mediaAsset: { deletedAt: null } },
              select: { displayOrder: true, mediaAsset: { select: safeSelect } },
              orderBy: { displayOrder: 'asc' },
            })
          : await prisma.reviewMedia.findMany({
              where: { reviewId: id, mediaAsset: { deletedAt: null } },
              select: { displayOrder: true, mediaAsset: { select: safeSelect } },
              orderBy: { displayOrder: 'asc' },
            });
      return rows.map((row) => publicMedia(row.mediaAsset, row.displayOrder));
    },
    async upload(
      target: MediaTarget,
      parentId: string,
      userId: string,
      file: { buffer: Buffer; originalname: string; mimetype: string },
      altText: string | null,
    ) {
      await authorizeMedia(target, parentId, userId);
      const bytes = await normalizeImage(file.buffer, file.originalname, file.mimetype);
      const key = newStorageKey(),
        id = randomUUID();
      try {
        await storage.put(key, bytes);
      } catch {
        throw imageError(
          'MEDIA_STORAGE_FAILED',
          'Image storage is unavailable. No attachment was saved.',
          503,
        );
      }
      try {
        return await writeTransaction(async (tx) => {
          await authorizeMedia(target, parentId, userId, tx);
          const rows =
            target === 'places'
              ? await tx.placeMedia.findMany({
                  where: { placeId: parentId, mediaAsset: { deletedAt: null } },
                  select: { displayOrder: true },
                })
              : await tx.reviewMedia.findMany({
                  where: { reviewId: parentId, mediaAsset: { deletedAt: null } },
                  select: { displayOrder: true },
                });
          if (rows.length >= MEDIA_COUNTS[target])
            throw imageError(
              'MEDIA_COUNT_LIMIT',
              `At most ${MEDIA_COUNTS[target]} images are allowed.`,
              409,
            );
          const displayOrder = Math.max(-1, ...rows.map((row) => row.displayOrder)) + 1;
          const asset = await tx.mediaAsset.create({
            data: { id, storageKey: key, mimeType: 'image/webp', uploaderId: userId, altText },
            select: safeSelect,
          });
          if (target === 'places')
            await tx.placeMedia.create({
              data: { placeId: parentId, mediaAssetId: id, displayOrder },
            });
          else
            await tx.reviewMedia.create({
              data: { reviewId: parentId, mediaAssetId: id, displayOrder },
            });
          return publicMedia(asset, displayOrder);
        });
      } catch (error) {
        // Do not delete a possibly committed object if the commit acknowledgement was lost.
        const committed = await prisma.mediaAsset.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!committed) {
          try {
            await storage.remove(key);
          } catch {
            throw imageError(
              'MEDIA_CLEANUP_PENDING',
              'Upload was not confirmed. Storage cleanup requires operator attention.',
              503,
            );
          }
        }
        throw error;
      }
    },
    async read(id: string) {
      const asset = await prisma.mediaAsset.findFirst({
        where: {
          id,
          deletedAt: null,
          OR: [
            { places: { some: { place: visiblePlace } } },
            { reviews: { some: { review: { deletedAt: null, place: visiblePlace } } } },
          ],
        },
        select: { storageKey: true },
      });
      if (!asset || !isStorageKey(asset.storageKey))
        throw imageError('MEDIA_NOT_FOUND', 'Image not found.', 404);
      try {
        return await storage.read(asset.storageKey);
      } catch {
        throw imageError('MEDIA_NOT_FOUND', 'Image not found.', 404);
      }
    },
    async remove(id: string, userId: string) {
      const key = await writeTransaction(async (tx) => {
        const asset = await tx.mediaAsset.findUnique({
          where: { id },
          include: {
            places: { select: { place: { select: { createdById: true } } } },
            reviews: { select: { review: { select: { userId: true } } } },
          },
        });
        if (!asset || !isStorageKey(asset.storageKey))
          throw imageError('MEDIA_NOT_FOUND', 'Image not found.', 404);
        if (
          asset.uploaderId !== userId ||
          asset.places.some((item) => item.place.createdById !== userId) ||
          asset.reviews.some((item) => item.review.userId !== userId)
        )
          throw imageError('MEDIA_FORBIDDEN', 'Only the owner can remove this image.', 403);
        await tx.mediaAsset.update({
          where: { id },
          data: { deletedAt: asset.deletedAt ?? new Date() },
        });
        return asset.storageKey;
      });
      try {
        await storage.remove(key);
      } catch {
        throw imageError(
          'MEDIA_REMOVAL_PENDING',
          'Image is hidden, but storage removal is pending. Retry removal.',
          503,
        );
      }
    },
  };
}
// Production intentionally has no silent local-disk fallback.
const localStorage = new LocalDevelopmentStorage(env.MEDIA_LOCAL_ROOT ?? '.data/media');
export const mediaService = createMediaService(localStorage);
