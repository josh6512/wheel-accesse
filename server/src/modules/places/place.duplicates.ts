import type { CreatePlaceInput } from './place.validation.js';
import { ApiError } from '../../utils/ApiError.js';

export interface DuplicateCandidate {
  id: string;
  name: string;
  city: string | null;
  countryCode: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}
export const normalizePlaceText = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export function likelyDuplicate(
  input: CreatePlaceInput,
  candidate: DuplicateCandidate,
  categoryName: string,
): boolean {
  if (!input.city || !input.countryCode || !candidate.city || !candidate.countryCode) return false;
  if (
    normalizePlaceText(input.city) !== normalizePlaceText(candidate.city) ||
    input.countryCode !== candidate.countryCode
  )
    return false;
  const descriptor = normalizePlaceText(categoryName);
  const name = (value: string) =>
    normalizePlaceText(value)
      .split(' ')
      .filter((word) => word !== descriptor)
      .join(' ');
  if (!name(input.name) || name(input.name) !== name(candidate.name)) return false;
  // A different known address or a separation over ~100 m can identify distinct branches.
  if (
    input.address &&
    candidate.address &&
    normalizePlaceText(input.address) !== normalizePlaceText(candidate.address)
  )
    return false;
  if (
    input.latitude !== undefined &&
    input.longitude !== undefined &&
    candidate.latitude !== null &&
    candidate.longitude !== null
  ) {
    const radians = Math.PI / 180;
    const a =
      Math.sin(((input.latitude - candidate.latitude) * radians) / 2) ** 2 +
      Math.cos(input.latitude * radians) *
        Math.cos(candidate.latitude * radians) *
        Math.sin(((input.longitude - candidate.longitude) * radians) / 2) ** 2;
    if (6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) > 100) return false;
  }
  return true;
}

export class DuplicatePlaceError extends ApiError {
  constructor(readonly matches: DuplicateCandidate[]) {
    super(409, 'POSSIBLE_DUPLICATE_PLACE', 'We found similar places');
  }
}
