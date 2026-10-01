import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../services/apiClient';
import {
  reportReasons,
  submitContentReport,
  type ReportReason,
  type ReportTargetType,
} from '../../services/contentReportService';

interface ReportActionProps {
  placeId: string;
  targetType: ReportTargetType;
  targetId: string;
  label: string;
  className?: string;
}

function reportError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 403:
        return 'You cannot report this content.';
      case 404:
        return 'This content is no longer available.';
      case 409:
        return 'You already reported this content for that reason.';
      case 429:
        return 'Too many reports. Please try again later.';
      case 400:
        return 'Check the reason and details, then try again.';
      default:
        return 'We could not submit your report. Please try again.';
    }
  }
  return 'We could not submit your report. Please check your connection and try again.';
}

export function ReportAction({
  placeId,
  targetType,
  targetId,
  label,
  className,
}: ReportActionProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const reasonSelect = useRef<HTMLSelectElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const headingId = useId();
  const reasonId = useId();
  const detailsId = useId();
  const errorId = useId();
  const signInPath = `/login?returnTo=${encodeURIComponent(`/places/${placeId}`)}`;

  useEffect(() => {
    if (open) reasonSelect.current?.focus();
    else if (wasOpen.current) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);

  function close() {
    if (submitting) return;
    setOpen(false);
    setError('');
  }

  function onDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    if (event.key !== 'Tab') return;
    const controls = dialog.current?.querySelectorAll<HTMLElement>(
      'select:not(:disabled), textarea:not(:disabled), button:not(:disabled)',
    );
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await submitContentReport({
        targetType,
        targetId,
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      setOpen(false);
      setReason('');
      setDetails('');
      setSuccess('Thanks. Your report was submitted.');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        void navigate(signInPath);
        return;
      }
      setError(reportError(failure));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={className ? `report-action ${className}` : 'report-action'}>
      {user ? (
        <button
          ref={trigger}
          className="report-trigger text-button"
          type="button"
          aria-label={label}
          onClick={() => {
            setReason('');
            setDetails('');
            setError('');
            setSuccess('');
            setOpen(true);
          }}
        >
          Report
        </button>
      ) : (
        <Link
          className="report-trigger text-button"
          aria-label={`${label}; sign in`}
          to={signInPath}
        >
          Report
        </Link>
      )}
      <span className="report-confirmation" role="status">
        {success}
      </span>
      {open &&
        createPortal(
          <div className="report-overlay">
            <div
              ref={dialog}
              className="report-dialog write-form"
              role="dialog"
              aria-modal="true"
              aria-labelledby={headingId}
              aria-describedby={error ? errorId : undefined}
              onKeyDown={onDialogKeyDown}
            >
              <h2 id={headingId}>{label}</h2>
              <p>Tell us why this content needs attention.</p>
              <form onSubmit={(event) => void onSubmit(event)}>
                <label htmlFor={reasonId}>Reason</label>
                <select
                  ref={reasonSelect}
                  id={reasonId}
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ReportReason | '')}
                >
                  <option value="">Choose a reason</option>
                  {reportReasons.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <label htmlFor={detailsId}>Details (optional)</label>
                <textarea
                  id={detailsId}
                  value={details}
                  maxLength={1000}
                  rows={4}
                  onChange={(event) => setDetails(event.target.value)}
                />
                {error && (
                  <p id={errorId} role="alert">
                    {error}
                  </p>
                )}
                <div className="write-actions">
                  <button type="submit" disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                  <button type="button" onClick={close} disabled={submitting}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
