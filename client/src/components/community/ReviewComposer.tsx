import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { publishReview, writeError } from '../../services/communityService';

export function ReviewComposer({
  placeId,
  onSaved,
}: {
  placeId: string;
  onSaved: (message: string) => void;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setError('Write a review before publishing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await publishReview(placeId, body.trim());
      setBody('');
      onSaved('Review published.');
    } catch (reason) {
      setError(writeError(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-section write-form" aria-labelledby="review-compose-title">
      <h2 id="review-compose-title">Share your experience</h2>
      {user ? (
        <form onSubmit={(event) => void submit(event)} aria-busy={busy}>
          <label htmlFor="review-body">Your review</label>
          <textarea
            id="review-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={4000}
            required
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'review-error' : undefined}
          />
          <p>Plain-text comments only. Avoid personal or sensitive information.</p>
          {error && (
            <p id="review-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button--primary" disabled={busy}>
            {busy ? 'Publishing…' : 'Publish review'}
          </button>
        </form>
      ) : (
        <Link className="button" to={`/login?returnTo=${encodeURIComponent(`/places/${placeId}`)}`}>
          Sign in to write a review
        </Link>
      )}
    </section>
  );
}
