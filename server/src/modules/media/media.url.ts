import { env } from '../../config/env.js';

export function mediaUrl(id: string, legacyReference?: string) {
  // Preserve existing externally hosted references, never expose opaque storage keys/paths.
  if (legacyReference) {
    try {
      const url = new URL(legacyReference);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password)
        return url.href;
    } catch {
      /* An internal key is resolved through the controlled read endpoint. */
    }
  }
  return `${env.MEDIA_PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}/api/v1/media`}/${encodeURIComponent(id)}`;
}
