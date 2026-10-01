# Content reporting backend

`POST /api/v1/reports` requires a valid access token. Its strict JSON body accepts
`targetType`, `targetId` (UUID), `reason`, and optional trimmed `details` (1–1000
characters). Supported target types are `PLACE`, `REVIEW`, `PLACE_MEDIA`, and
`REVIEW_MEDIA`. Reasons are `INCORRECT_INFORMATION`, `SPAM`,
`ABUSIVE_OR_HARASSING`, `INAPPROPRIATE_MEDIA`, `DUPLICATE`, and `OTHER`.

Only visible, non-deleted content can be reported. Place/review media targets use
the public media asset ID, and the asset must be attached to a visible place or
review of the matching type. A user cannot report their own place or review,
including attached media. For media, both its uploader and its visible parent
owner are treated as owners. Legacy content without a known owner remains
reportable.

One reporter may submit one report per target and reason; the SQL Server unique
constraint enforces this under concurrency and duplicates return 409. Different
users may report the same content. Reporting is limited to five requests per
account and fifteen per IP in 15 minutes; the endpoint does not consume read
budgets. Invalid attempts consume the reporting budget.

Reports start at `OPEN`. The response omits reporter identity and details, and
public place/review/media APIs do not expose reports or counts. Future
moderation statuses require a migration to expand the database status check;
there are no moderation reads, actions, notes, or admin interfaces yet. Because
targets are polymorphic, visibility is checked transactionally in the service;
no database foreign key can point `target_id` at all four target tables. A
future moderation phase must define retention, target-deletion handling, and
reviewer permissions before exposing report data.
