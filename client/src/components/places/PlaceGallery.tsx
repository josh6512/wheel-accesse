import type { PublicMedia } from '../../types/api';

function publicImageSource(reference: string): string | null {
  try {
    const url = new URL(reference);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

interface PlaceGalleryProps {
  media: PublicMedia[];
  placeName: string;
}

export function PlaceGallery({ media, placeName }: PlaceGalleryProps) {
  const images = media
    .filter(({ mimeType }) => mimeType.startsWith('image/'))
    .map((item) => ({ ...item, source: publicImageSource(item.storageReference) }))
    .filter((item): item is typeof item & { source: string } => item.source !== null);

  if (images.length === 0) {
    return (
      <div className="place-gallery place-gallery--empty">
        <div
          className="place-gallery-placeholder"
          role="img"
          aria-label={`No photos for ${placeName}`}
        >
          <span className="brand-mark place-gallery-mark" aria-hidden="true">
            <span>W</span>
          </span>
          <strong>Community photos will appear here</strong>
          <p>No place images have been shared yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`place-gallery${images.length === 1 ? ' place-gallery--single' : ''}`}>
      {images.map((image, index) => (
        <figure className={index === 0 ? 'gallery-primary' : 'gallery-supporting'} key={image.id}>
          <img
            src={image.source}
            alt={image.altText?.trim() || `${placeName} community photo ${index + 1}`}
          />
        </figure>
      ))}
    </div>
  );
}
