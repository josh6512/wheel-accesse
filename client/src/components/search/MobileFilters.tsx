import { useEffect, useRef, type KeyboardEvent, type PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';

interface MobileFiltersProps extends PropsWithChildren {
  open: boolean;
  selectedCount: number;
  onOpen: () => void;
  onClose: () => void;
}

export function MobileFilters({
  open,
  selectedCount,
  onOpen,
  onClose,
  children,
}: MobileFiltersProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const background = Array.from(
      document.querySelectorAll<HTMLElement>('.site-header, .app-shell > main'),
    );
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    background.forEach((element) => element.setAttribute('inert', ''));
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((element) => element.removeAttribute('inert'));
      opener?.focus();
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <>
      <button
        ref={openerRef}
        className="button button--secondary mobile-filter-button"
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden="true">☷</span>
        Filters
        {selectedCount > 0 ? <span className="button-count">{selectedCount}</span> : null}
      </button>
      {open
        ? createPortal(
            <div className="filter-overlay" role="presentation" onMouseDown={onClose}>
              <div
                className="filter-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-filter-title"
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={handleKeyDown}
              >
                <div className="drawer-header">
                  <div>
                    <p className="section-kicker">Refine your search</p>
                    <h2 id="mobile-filter-title">Filters</h2>
                  </div>
                  <button
                    ref={closeButtonRef}
                    className="icon-button"
                    type="button"
                    onClick={onClose}
                    aria-label="Close filters"
                  >
                    ×
                  </button>
                </div>
                <div className="drawer-content">{children}</div>
                <div className="drawer-footer">
                  <button className="button button--primary" type="button" onClick={onClose}>
                    Show results
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
