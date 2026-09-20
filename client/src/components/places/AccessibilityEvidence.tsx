import type { AccessibilityAnswerValue, PaginatedAccessibilityReports } from '../../types/api';

function answerText(value: AccessibilityAnswerValue): string {
  switch (value.type) {
    case 'boolean':
      return value.value ? 'Yes' : 'No';
    case 'numeric':
      return `${value.value}${value.unit ? ` ${value.unit}` : ''}`;
    case 'select':
      return value.option.displayName;
    case 'text':
      return value.value;
  }
}

function formattedDate(value: string | null): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(value ?? Date.now()),
  );
}

interface AccessibilityEvidenceProps {
  reports: PaginatedAccessibilityReports | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function AccessibilityEvidence({
  reports,
  loading,
  error,
  onRetry,
  onPrevious,
  onNext,
}: AccessibilityEvidenceProps) {
  const reportTotal = reports?.pagination.totalItems ?? 0;

  return (
    <details className="accessibility-evidence">
      <summary>
        <span>View community accessibility reports</span>
        {reportTotal > 0 ? <span>{reportTotal}</span> : null}
      </summary>
      <div className="evidence-content">
        {loading ? (
          <p className="section-loading" role="status">
            Loading accessibility reports…
          </p>
        ) : error ? (
          <div className="inline-error" role="alert">
            <p>Community reports could not be loaded. The summary above is still available.</p>
            <button className="text-button" type="button" onClick={onRetry}>
              Try reports again
            </button>
          </div>
        ) : reports?.data.length === 0 ? (
          <div className="detail-empty-state">
            <span aria-hidden="true">○</span>
            <p>No community accessibility information yet.</p>
          </div>
        ) : (
          <>
            <ol className="evidence-list">
              {reports?.data.map((report) => (
                <li key={report.id}>
                  <div className="evidence-heading">
                    <h3>Community observation</h3>
                    <time dateTime={report.observedAt ?? report.createdAt}>
                      {formattedDate(report.observedAt ?? report.createdAt)}
                    </time>
                  </div>
                  <dl className="answer-list">
                    {report.answers.map((answer) => (
                      <div key={answer.feature.id}>
                        <dt>{answer.feature.displayName}</dt>
                        <dd>{answerText(answer.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ol>
            {reports ? (
              <nav className="section-pagination" aria-label="Accessibility report pages">
                <button
                  type="button"
                  onClick={onPrevious}
                  disabled={!reports.pagination.hasPreviousPage}
                  aria-label="Previous accessibility reports page"
                >
                  ← Previous
                </button>
                <span aria-current="page">
                  Page {reports.pagination.page} of {reports.pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!reports.pagination.hasNextPage}
                  aria-label="Next accessibility reports page"
                >
                  Next →
                </button>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </details>
  );
}
