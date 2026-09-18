import { useId } from 'react';
import type { CategoryFeature } from '../../types/api';

interface AccessibilityFiltersProps {
  features: CategoryFeature[];
  selectedIds: string[];
  loading: boolean;
  error: string | null;
  onToggle: (featureId: string, selected: boolean) => void;
  onRetry: () => void;
}

export function AccessibilityFilters({
  features,
  selectedIds,
  loading,
  error,
  onToggle,
  onRetry,
}: AccessibilityFiltersProps) {
  const headingId = useId();

  return (
    <section className="filter-section" aria-labelledby={headingId}>
      <div className="filter-heading">
        <div>
          <p className="section-kicker">Accessibility</p>
          <h2 id={headingId}>Community-supported features</h2>
        </div>
        {selectedIds.length > 0 ? <span className="filter-count">{selectedIds.length}</span> : null}
      </div>
      <p className="filter-help">Select every feature you need. All selected filters must match.</p>

      {loading ? (
        <p className="filter-state" role="status">
          Loading accessibility filters…
        </p>
      ) : error ? (
        <div className="filter-state" role="alert">
          <p>Accessibility filters could not be loaded.</p>
          <button className="text-button" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : features.length === 0 ? (
        <p className="filter-state">No Boolean accessibility filters are configured here yet.</p>
      ) : (
        <fieldset className="checkbox-list">
          <legend className="sr-only">Accessibility requirements</legend>
          {features.map((feature) => (
            <label className="checkbox-row" key={feature.id}>
              <input
                type="checkbox"
                checked={selectedIds.includes(feature.id)}
                onChange={(event) => onToggle(feature.id, event.target.checked)}
              />
              <span className="custom-checkbox" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>{feature.displayName}</strong>
                {feature.description ? <small>{feature.description}</small> : null}
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </section>
  );
}
