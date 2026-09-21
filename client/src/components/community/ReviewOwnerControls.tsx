import { useState } from 'react';
import type { PublicReview } from '../../types/api';
import { deleteReview, editReview, writeError } from '../../services/communityService';

export function ReviewOwnerControls({
  review,
  onSaved,
}: {
  review: PublicReview;
  onSaved: (message: string) => void;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [body, setBody] = useState(review.body);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (mode === 'edit' && !body.trim()) {
      setError('Your review cannot be blank.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (mode === 'edit') await editReview(review.id, body.trim());
      else await deleteReview(review.id);
      onSaved(mode === 'edit' ? 'Review updated.' : 'Review deleted.');
      setMode('view');
    } catch (reason) {
      setError(writeError(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="review-owner-controls write-form">
      {mode === 'view' ? (
        <div className="write-actions">
          <button
            type="button"
            onClick={() => {
              setMode('edit');
              setBody(review.body);
            }}
          >
            Edit
          </button>
          <button type="button" onClick={() => setMode('delete')}>
            Delete
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {mode === 'edit' ? (
            <label>
              Edit your review
              <textarea
                autoFocus
                value={body}
                maxLength={4000}
                required
                disabled={busy}
                onChange={(event) => setBody(event.target.value)}
                aria-invalid={Boolean(error)}
              />
            </label>
          ) : (
            <p>Delete this review? It will no longer appear publicly.</p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="write-actions">
            <button className="button" disabled={busy}>
              {mode === 'edit' ? 'Save review' : 'Confirm delete review'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode('view');
                setError('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
