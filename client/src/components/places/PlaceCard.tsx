import { Link, useLocation } from 'react-router-dom';
import type { AccessibilityStatus, PlaceSearchResult } from '../../types/api';

const statusPresentation: Record<AccessibilityStatus, { icon: string; label: string }> = {
  SUPPORTED: { icon: '✓', label: 'Supported by community reports' },
  NOT_SUPPORTED: { icon: '–', label: 'Not supported by community reports' },
  CONFLICTING: { icon: '!', label: 'Community reports conflict' },
  UNKNOWN: { icon: '?', label: 'No community reports yet' },
};

interface PlaceCardProps {
  place: PlaceSearchResult;
  imageUrl?: string;
}

export function PlaceCard({ place, imageUrl }: PlaceCardProps) {
  const routeLocation = useLocation();
  const summaries = [...place.accessibility]
    .sort((left, right) => {
      const order: AccessibilityStatus[] = ['SUPPORTED', 'CONFLICTING', 'NOT_SUPPORTED', 'UNKNOWN'];
      return order.indexOf(left.status) - order.indexOf(right.status);
    })
    .slice(0, 4);
  const hasCommunityData = summaries.some((summary) => summary.status !== 'UNKNOWN');
  const placeLocation = [place.city, place.countryCode].filter(Boolean).join(', ');

  return (
    <Link
      className="place-card-link"
      to={`/places/${place.id}`}
      state={{ from: `${routeLocation.pathname}${routeLocation.search}` }}
      aria-label={`View details for ${place.name}`}
    >
      <article className="place-card">
        <div className="place-media">
          {imageUrl ? (
            <img src={imageUrl} alt="" />
          ) : (
            <div className="media-placeholder" role="img" aria-label="No place image available">
              <span aria-hidden="true">⌁</span>
              <small>Photo coming later</small>
            </div>
          )}
        </div>
        <div className="place-content">
          <div className="place-heading">
            <div>
              <p className="place-category">{place.category.displayName}</p>
              <h2>{place.name}</h2>
              <p className="place-location">
                <span aria-hidden="true">●</span>
                {placeLocation || 'Location not provided'}
              </p>
            </div>
            <p className="review-count">
              {place.reviewCount === 0
                ? 'No reviews yet'
                : `${place.reviewCount} ${place.reviewCount === 1 ? 'review' : 'reviews'}`}
            </p>
          </div>
          <div className="accessibility-summary">
            <p className="summary-label">Accessibility snapshot</p>
            {!hasCommunityData ? (
              <p className="no-accessibility-data">
                Community accessibility information is not available yet.
              </p>
            ) : (
              <ul>
                {summaries.map((summary) => {
                  const presentation = statusPresentation[summary.status];
                  return (
                    <li
                      className={`status status--${summary.status.toLowerCase()}`}
                      key={summary.feature.id}
                    >
                      <span className="status-symbol" aria-hidden="true">
                        {presentation.icon}
                      </span>
                      <span>
                        <strong>{summary.feature.displayName}</strong>
                        <span className="sr-only">: {presentation.label}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="community-note">
              Based on community reports — not an accessibility guarantee.
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}
