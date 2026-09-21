import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useCategoryFeatures } from '../../hooks/useApiResources';
import { publishReport, deleteReport, writeError } from '../../services/communityService';
import { AccessibilityFields } from './AccessibilityFields';
import { reportAnswers } from '../../services/reportAnswers';

export function AccessibilityContribution({
  placeId,
  categoryId,
  onSaved,
  recentReportId,
  onReportCreated,
}: {
  placeId: string;
  categoryId: string;
  onSaved: (message: string) => void;
  recentReportId: string | null;
  onReportCreated: (id: string | null) => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const features = useCategoryFeatures(open && user ? categoryId : '');
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    const answers = reportAnswers(features.data, values);
    if (!answers.length) {
      setError('Please answer at least one observation, or cancel.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await publishReport(placeId, answers);
      onReportCreated(result.data.id);
      setValues({});
      setOpen(false);
      onSaved('Accessibility information saved.');
    } catch (reason) {
      setError(writeError(reason));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!recentReportId) return;
    setBusy(true);
    setError('');
    try {
      await deleteReport(recentReportId);
      onReportCreated(null);
      setConfirmDelete(false);
      onSaved('Accessibility report deleted.');
    } catch (reason) {
      setError(writeError(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-section write-form" aria-labelledby="contribution-title">
      <h2 id="contribution-title">Share accessibility information</h2>
      <p>
        Share observations separately from your review. You can answer just the features you know.
      </p>
      {!user ? (
        <Link className="button" to={`/login?returnTo=${encodeURIComponent(`/places/${placeId}`)}`}>
          Sign in to share accessibility information
        </Link>
      ) : (
        <>
          <button
            className="button"
            type="button"
            aria-expanded={open}
            disabled={busy}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Cancel accessibility report' : 'Add accessibility observation'}
          </button>
          {open && (
            <form onSubmit={(event) => void submit(event)} aria-busy={busy}>
              {features.loading ? (
                <p role="status">Loading accessibility questions…</p>
              ) : features.error ? (
                <p role="alert">
                  Questions could not be loaded.{' '}
                  <button type="button" onClick={features.retry}>
                    Retry questions
                  </button>
                </p>
              ) : (
                <fieldset disabled={busy}>
                  <AccessibilityFields
                    features={features.data}
                    values={values}
                    onChange={(id, value) =>
                      setValues((previous) => ({ ...previous, [id]: value }))
                    }
                  />
                </fieldset>
              )}
              <button
                className="button button--primary"
                disabled={busy || features.loading || Boolean(features.error)}
              >
                Save accessibility information
              </button>
            </form>
          )}
          {recentReportId && (
            <div className="write-actions">
              {confirmDelete ? (
                <>
                  <p>Delete your most recent report from this visit to the page?</p>
                  <button type="button" disabled={busy} onClick={() => void remove()}>
                    Confirm delete report
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)}>
                  Delete my latest report
                </button>
              )}
            </div>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
