import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AccessibilityEvidence } from '../components/places/AccessibilityEvidence';
import { PlaceAccessibility } from '../components/places/PlaceAccessibility';
import { PlaceDetailsSkeleton } from '../components/places/PlaceDetailsSkeleton';
import { PlaceGallery } from '../components/places/PlaceGallery';
import { PlaceHeader } from '../components/places/PlaceHeader';
import { ReviewList } from '../components/reviews/ReviewList';
import { usePlaceAccessibilityReports, usePlaceDetails, usePlaceReviews } from '../hooks';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function PlaceDetailsPage() {
  const { placeId = '' } = useParams();
  const location = useLocation();
  const [reviewPage, setReviewPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const validPlaceId = uuidPattern.test(placeId);
  const place = usePlaceDetails(placeId, validPlaceId);
  const reviews = usePlaceReviews(placeId, reviewPage, Boolean(place.data));
  const reports = usePlaceAccessibilityReports(placeId, reportPage, Boolean(place.data));
  const routeState = location.state as { from?: unknown } | null;
  const backTo =
    typeof routeState?.from === 'string' && routeState.from.startsWith('/search')
      ? routeState.from
      : '/search';

  if (!validPlaceId) {
    return (
      <div className="place-details-page">
        <div className="state-card state-card--error" role="alert">
          <span className="state-icon" aria-hidden="true">
            !
          </span>
          <h1>Invalid place link</h1>
          <p>This place address is not valid. Return to search to choose another place.</p>
          <Link className="button button--secondary" to="/search">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  if (place.loading) return <PlaceDetailsSkeleton />;

  if (place.error || !place.data) {
    const missing = place.error?.status === 404;
    return (
      <div className="place-details-page">
        <div className="state-card state-card--error" role="alert">
          <span className="state-icon" aria-hidden="true">
            {missing ? '?' : '!'}
          </span>
          <h1>{missing ? 'Place not found' : 'We couldn’t load this place'}</h1>
          <p>
            {missing
              ? 'This place may no longer be available.'
              : 'There was a problem reaching Wheel Accesses. Please try again.'}
          </p>
          {missing ? (
            <Link className="button button--secondary" to="/search">
              Back to search
            </Link>
          ) : (
            <button className="button button--secondary" type="button" onClick={place.retry}>
              Try place again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <article className="place-details-page">
      <PlaceHeader place={place.data} backTo={backTo} />
      <PlaceGallery media={place.data.media} placeName={place.data.name} />
      <PlaceAccessibility
        summaries={place.data.accessibility}
        reportCount={place.data.accessibilityReportCount}
      />
      <AccessibilityEvidence
        reports={reports.data}
        loading={reports.loading}
        error={reports.error?.message ?? null}
        onRetry={reports.retry}
        onPrevious={() => setReportPage((page) => Math.max(1, page - 1))}
        onNext={() => setReportPage((page) => page + 1)}
      />
      <ReviewList
        reviews={reviews.data}
        loading={reviews.loading}
        error={reviews.error?.message ?? null}
        onRetry={reviews.retry}
        onPrevious={() => setReviewPage((page) => Math.max(1, page - 1))}
        onNext={() => setReviewPage((page) => page + 1)}
      />
      <section className="future-review" aria-labelledby="share-experience-title">
        <div>
          <p className="section-kicker">Share your experience</p>
          <h2 id="share-experience-title">Help the next visitor</h2>
          <p>
            Review publishing will become available after secure sign-in is introduced. No
            unauthenticated submissions are accepted.
          </p>
        </div>
        <button type="button" className="button button--secondary" disabled>
          Review sharing coming soon
        </button>
      </section>
    </article>
  );
}
