import { apiRequest, ApiError } from './apiClient';
import type { PublicMedia } from '../types/api';

export interface SelectedImage {
  id: string;
  file: File;
  altText: string;
}
export type MediaTarget = 'places' | 'reviews';
export const listOwnedMedia = (target: MediaTarget, id: string) =>
  apiRequest<{ data: PublicMedia[] }>(`/${target}/${id}/media`, undefined, true);
export const removeMedia = (id: string) =>
  apiRequest<void>(`/media/${id}`, { method: 'DELETE' }, true);
export async function uploadImages(target: MediaTarget, id: string, images: SelectedImage[]) {
  let uploaded = 0;
  const errors = new Set<string>();
  for (const image of images) {
    const form = new FormData();
    form.append('image', image.file);
    form.append('altText', image.altText);
    try {
      await apiRequest<{ data: PublicMedia }>(
        `/${target}/${id}/media`,
        { method: 'POST', body: form },
        true,
      );
      uploaded++;
    } catch (reason) {
      errors.add(reason instanceof ApiError ? reason.message : 'Connection interrupted.');
    }
  }
  return `${uploaded} of ${images.length} images confirmed uploaded.${uploaded < images.length ? ` Some uploads were not confirmed. ${[...errors].join(' ')} Check the gallery before retrying missing images.` : ''}`;
}
