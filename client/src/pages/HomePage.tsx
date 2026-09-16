export function HomePage() {
  return (
    <section className="foundation" aria-labelledby="page-title">
      <p className="eyebrow">Foundation in progress</p>
      <h1 id="page-title">Accessibility information, shaped by community experience.</h1>
      <p className="intro">
        Wheel Accesses is being prepared as a dependable place to discover and contribute useful
        accessibility information. Product features will be added in future stages.
      </p>
      <div className="status-card" role="status">
        <span className="status-icon" aria-hidden="true">
          ✓
        </span>
        <div>
          <strong>Technical foundation ready</strong>
          <p>
            The web client and reusable API are separated and ready for incremental development.
          </p>
        </div>
      </div>
    </section>
  );
}
