import type { AccessibilityStatus, AccessibilitySummary } from '../../types/api';

const statusPresentation: Record<
  AccessibilityStatus,
  { symbol: string; label: string; detail: string }
> = {
  SUPPORTED: {
    symbol: '✓',
    label: 'Supported',
    detail: 'Supported by community reports',
  },
  NOT_SUPPORTED: {
    symbol: '–',
    label: 'Not supported',
    detail: 'Not supported by community reports',
  },
  CONFLICTING: {
    symbol: '!',
    label: 'Conflicting',
    detail: 'Community reports conflict',
  },
  UNKNOWN: {
    symbol: '?',
    label: 'Unknown',
    detail: 'No community information yet',
  },
};

interface PlaceAccessibilityProps {
  summaries: AccessibilitySummary[];
  reportCount: number;
}

export function PlaceAccessibility({ summaries, reportCount }: PlaceAccessibilityProps) {
  return (
    <section className="detail-section accessibility-detail" aria-labelledby="accessibility-title">
      <div className="detail-section-heading">
        <div>
          <p className="section-kicker">Accessibility first</p>
          <h2 id="accessibility-title">Community accessibility snapshot</h2>
        </div>
        <span className="evidence-count">
          {reportCount} {reportCount === 1 ? 'report' : 'reports'}
        </span>
      </div>
      <p className="accessibility-disclaimer">
        These statuses summarize community observations and are not an accessibility guarantee.
        Conditions can change, so confirm critical details directly with the venue.
      </p>

      {summaries.length === 0 ? (
        <div className="detail-empty-state">
          <span aria-hidden="true">?</span>
          <p>No Boolean accessibility features are configured for this category yet.</p>
        </div>
      ) : (
        <ul className="accessibility-status-grid">
          {summaries.map((summary) => {
            const presentation = statusPresentation[summary.status];
            const total = summary.positiveReports + summary.negativeReports;
            return (
              <li
                className={`accessibility-status-card status-card--${summary.status.toLowerCase()}`}
                key={summary.feature.id}
              >
                <span className="detail-status-symbol" aria-hidden="true">
                  {presentation.symbol}
                </span>
                <div>
                  <h3>{summary.feature.displayName}</h3>
                  <p className="detail-status-label">{presentation.detail}</p>
                  {total > 0 ? (
                    <p className="report-tally">
                      {summary.positiveReports} yes · {summary.negativeReports} no
                    </p>
                  ) : null}
                </div>
                <span className="sr-only">Status: {presentation.label}.</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
