import type { PaginatedReviews, PublicMedia, PublicReview } from '../../types/api';
import { useAuth } from '../../auth/useAuth';
import { ReviewOwnerControls } from '../community/ReviewOwnerControls';
import { MediaManager } from '../media/MediaManager';
import { SafeMediaImage } from '../media/SafeMediaImage';
import { ReportAction } from '../reporting/ReportAction';

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function publicImageSource(media: PublicMedia): string | null {
  try {
    const url = new URL(media.storageReference);
    return media.mimeType.startsWith('image/') && ['http:', 'https:'].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function ReviewItem({
  review,
  onSaved,
}: {
  review: PublicReview;
  onSaved?: (message: string) => void;
}) {
  const { user } = useAuth();
  const ownReview = Boolean(user && review.author?.id === user.id);
  const authorName = review.author?.displayName?.trim() || 'a community member';
  const images = review.media
    .map((media) => ({ media, source: publicImageSource(media) }))
    .filter((item): item is typeof item & { source: string } => item.source !== null);

  return (
    <article className="review-item">
      <header>
        <span className="review-avatar" aria-hidden="true">
          {(review.author?.displayName?.trim() || 'C').charAt(0).toUpperCase()}
        </span>
        <div>
          <h3>{review.author?.displayName?.trim() || 'Community member'}</h3>
          <time dateTime={review.createdAt}>{formattedDate(review.createdAt)}</time>
        </div>
      </header>
      <p>{review.body}</p>
      {!ownReview && (
        <ReportAction
          placeId={review.place.id}
          targetType="REVIEW"
          targetId={review.id}
          label={`Report review by ${authorName}`}
        />
      )}
      {user && review.author?.id === user.id && onSaved && (
        <ReviewOwnerControls review={review} onSaved={onSaved} />
      )}
      {images.length > 0 ? (
        <div className="review-media" aria-label="Review photos">
          {images.map(({ media, source }, index) => (
            <div key={media.id} className="review-media-item">
              <SafeMediaImage
                src={source}
                alt={media.altText?.trim() || `Review photo ${index + 1}`}
              />
              {!ownReview && (
                <ReportAction
                  placeId={review.place.id}
                  targetType="REVIEW_MEDIA"
                  targetId={media.id}
                  label={`Report photo ${index + 1} in review by ${authorName}`}
                />
              )}
            </div>
          ))}
        </div>
      ) : null}
      {user && review.author?.id === user.id && onSaved && (
        <MediaManager
          key={`${review.id}-${user.id}`}
          target="reviews"
          id={review.id}
          onSaved={onSaved}
        />
      )}
    </article>
  );
}

interface ReviewListProps {
  reviews: PaginatedReviews | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSaved?: (message: string) => void;
}

export function ReviewList({
  reviews,
  loading,
  error,
  onRetry,
  onPrevious,
  onNext,
  onSaved,
}: ReviewListProps) {
  return (
    <section className="detail-section reviews-section" aria-labelledby="reviews-title">
      <div className="detail-section-heading">
        <div>
          <p className="section-kicker">From the community</p>
          <h2 id="reviews-title">Reviews</h2>
        </div>
        {reviews ? <span className="evidence-count">{reviews.pagination.totalItems}</span> : null}
      </div>

      {loading ? (
        <div className="review-loading" role="status" aria-label="Loading reviews">
          <span className="skeleton skeleton--line" />
          <span className="skeleton skeleton--line skeleton--short" />
        </div>
      ) : error ? (
        <div className="inline-error" role="alert">
          <p>Reviews could not be loaded. The rest of this place page is still available.</p>
          <button className="text-button" type="button" onClick={onRetry}>
            Try reviews again
          </button>
        </div>
      ) : reviews?.data.length === 0 ? (
        <div className="detail-empty-state">
          <span aria-hidden="true">✦</span>
          <div>
            <h3>No reviews yet</h3>
            <p>Be the first to share your experience.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="review-list">
            {reviews?.data.map((review) => (
              <ReviewItem key={review.id} review={review} {...(onSaved ? { onSaved } : {})} />
            ))}
          </div>
          {reviews ? (
            <nav className="section-pagination" aria-label="Review pages">
              <button
                type="button"
                onClick={onPrevious}
                disabled={!reviews.pagination.hasPreviousPage}
                aria-label="Previous reviews page"
              >
                ← Previous
              </button>
              <span aria-current="page">
                Page {reviews.pagination.page} of {reviews.pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={onNext}
                disabled={!reviews.pagination.hasNextPage}
                aria-label="Next reviews page"
              >
                Next →
              </button>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}
