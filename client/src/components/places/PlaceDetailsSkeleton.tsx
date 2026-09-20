export function PlaceDetailsSkeleton() {
  return (
    <div className="place-details-page" aria-busy="true">
      <p className="sr-only" role="status">
        Loading place details.
      </p>
      <div className="place-detail-loading">
        <span className="skeleton skeleton--eyebrow" />
        <span className="skeleton skeleton--title" />
        <span className="skeleton skeleton--line skeleton--short" />
      </div>
      <div className="skeleton detail-gallery-skeleton" />
      <div className="detail-section detail-card-skeleton">
        <span className="skeleton skeleton--title" />
        <span className="skeleton skeleton--line" />
        <span className="skeleton skeleton--line" />
      </div>
    </div>
  );
}
