export function PlaceCardSkeleton() {
  return (
    <div className="place-card place-card--skeleton" aria-hidden="true">
      <div className="skeleton skeleton--media" />
      <div className="place-content">
        <div className="skeleton skeleton--eyebrow" />
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--line" />
        <div className="skeleton skeleton--line skeleton--short" />
      </div>
    </div>
  );
}
