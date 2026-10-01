import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../services/apiClient';
import {
  listOwnedMedia,
  removeMedia,
  uploadImages,
  type MediaTarget,
  type SelectedImage,
} from '../../services/mediaService';
import { writeError } from '../../services/communityService';
import type { PublicMedia } from '../../types/api';
import { ImagePicker } from './ImagePicker';

export function MediaManager({
  target,
  id,
  onSaved,
}: {
  target: MediaTarget;
  id: string;
  onSaved: (message: string) => void;
}) {
  const { user } = useAuth();
  const [media, setMedia] = useState<PublicMedia[] | null>(null);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    void listOwnedMedia(target, id)
      .then((result) => {
        if (live) setMedia(result.data);
      })
      .catch((reason: unknown) => {
        if (live && !(reason instanceof ApiError && [401, 403, 404].includes(reason.status)))
          setError('Image controls could not be loaded. Reload the page to try again.');
      });
    return () => {
      live = false;
    };
  }, [target, id, user]);
  if (!user || !media) return error ? <p role="alert">{error}</p> : null;
  const remaining = Math.max(0, (target === 'places' ? 6 : 3) - media.length);
  async function remove(imageId: string) {
    setBusy(true);
    setError('');
    try {
      await removeMedia(imageId);
      onSaved('Image removed.');
    } catch (reason) {
      setError(writeError(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="media-manager write-form"
      aria-label={`Manage ${target === 'places' ? 'place' : 'review'} images`}
    >
      <h3>Your {target === 'places' ? 'place' : 'review'} images</h3>
      {media.map((image, index) => (
        <div key={image.id} className="media-remove">
          <span>{image.altText || `Image ${index + 1}`}</span>
          {confirmId === image.id ? (
            <>
              <span>Remove this public image?</span>
              <button type="button" disabled={busy} onClick={() => void remove(image.id)}>
                Confirm remove image {index + 1}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmId(null)}>
                Keep image
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmId(image.id)}>
              Remove image {index + 1}
            </button>
          )}
        </div>
      ))}
      {remaining > 0 && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (busy || !images.length) return;
            setBusy(true);
            void uploadImages(target, id, images)
              .then((message) => {
                setImages([]);
                onSaved(message);
              })
              .finally(() => setBusy(false));
          }}
        >
          <ImagePicker images={images} onChange={setImages} limit={remaining} disabled={busy} />
          <button className="button" disabled={busy || !images.length}>
            {busy ? 'Uploading…' : 'Upload selected images'}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
