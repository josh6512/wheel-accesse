import { Link } from 'react-router-dom';
import type { PlaceDetails } from '../../types/api';

interface PlaceHeaderProps {
  place: PlaceDetails;
  backTo: string;
}

export function PlaceHeader({ place, backTo }: PlaceHeaderProps) {
  const location = [place.city, place.region, place.countryCode].filter(Boolean).join(', ');

  return (
    <header className="place-detail-header">
      <Link className="back-link" to={backTo}>
        <span aria-hidden="true">←</span> Back to search
      </Link>
      <p className="place-category">{place.category.displayName}</p>
      <div className="place-detail-title-row">
        <div>
          <h1>{place.name}</h1>
          <p className="place-detail-location">
            <span aria-hidden="true">●</span>
            {location || 'Location not provided'}
          </p>
          {place.address ? <address>{place.address}</address> : null}
        </div>
        <p className="place-review-total">
          <strong>{place.reviewCount}</strong>
          {place.reviewCount === 1 ? ' review' : ' reviews'}
        </p>
      </div>
    </header>
  );
}
