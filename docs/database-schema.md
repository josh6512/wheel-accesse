# Initial database schema

This stage adds the relational model only. No feature APIs, authentication, frontend changes,
catalog seeds, uploads, aggregation, or moderation workflows are implemented.

## Models and relationships

Prisma uses singular PascalCase models and camelCase fields, mapped to plural snake_case SQL
tables and snake_case columns. `code` is the stable catalog key; display names can change.

| Prisma model                 | SQL table                       | Purpose                                                                                                                            |
| ---------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `User`                       | `users`                         | Minimal identity/contact record; nullable display name and email allow later erasure. No authentication secrets. Email is private. |
| `MobilityType`               | `mobility_types`                | Editable mobility catalog; code, label, description, active flag, ordering.                                                        |
| `UserMobilityType`           | `user_mobility_types`           | Private user-to-mobility association, optional primary flag and explicit public-review disclosure preference, default false.       |
| `Category`                   | `categories`                    | Editable place category catalog.                                                                                                   |
| `Place`                      | `places`                        | Name, single category, optional address/location, nullable creator attribution.                                                    |
| `AccessibilityFeature`       | `accessibility_features`        | Editable attribute definition with a technical value kind and optional numeric unit.                                               |
| `AccessibilityFeatureOption` | `accessibility_feature_options` | Named, ordered select options owned by a specific feature.                                                                         |
| `CategoryFeature`            | `category_features`             | Which features apply to each category, with activation, priority, and ordering.                                                    |
| `PlaceAccessibilityReport`   | `place_accessibility_reports`   | One structured contribution to a place, author, optional observation time, and lifecycle timestamps.                               |
| `PlaceAccessibilityAnswer`   | `place_accessibility_answers`   | One typed feature value in one report, with numeric unit snapshot.                                                                 |
| `Review`                     | `reviews`                       | Independent free-text community comment on a place.                                                                                |
| `MediaAsset`                 | `media_assets`                  | External storage key, MIME type, nullable uploader, alt text, and lifecycle timestamps. No binary images or signed URLs.           |
| `PlaceMedia`                 | `place_media`                   | Explicit ordered place-to-media relationship.                                                                                      |
| `ReviewMedia`                | `review_media`                  | Explicit ordered review-to-media relationship.                                                                                     |

```text
User --< UserMobilityType >-- MobilityType
User --< Place (creator, optional)
Category --< Place
Category --< CategoryFeature >-- AccessibilityFeature
AccessibilityFeature --< AccessibilityFeatureOption
Place --< PlaceAccessibilityReport >-- User (author, optional)
PlaceAccessibilityReport --< PlaceAccessibilityAnswer >-- AccessibilityFeature
PlaceAccessibilityAnswer >-- AccessibilityFeatureOption (select values only)
Place --< Review >-- User (author, optional)
User --< MediaAsset (uploader, optional)
Place --< PlaceMedia >-- MediaAsset
Review --< ReviewMedia >-- MediaAsset
```

`--<` means one-to-many. Join models implement many-to-many relationships explicitly.

## IDs and timestamps

Entities use Prisma-generated UUIDs stored as SQL Server `uniqueidentifier`. This keeps IDs
consistent and portable across web/mobile clients without using a central integer sequence.
Join/answer rows use the participating UUIDs as composite primary keys, avoiding redundant IDs.
UUIDs are identifiers, not authorization. Random UUID clustered keys can fragment at scale;
revisit index layout after measuring actual workloads, without changing external IDs.

All times are UTC in `datetime2`. `createdAt` uses SQL Server's `SYSUTCDATETIME()` independently of
the host's local time zone; `updatedAt` is maintained by Prisma, not a database trigger. Raw SQL
writers must set/update timestamps themselves. Immutable attachment creation metadata has no
unnecessary `updatedAt`; ordering changes do not have a dedicated timestamp yet.

## Structured values and review text

A review is a text comment. It has no answers, rating, questionnaire, or mandatory report link.
A structured report owns individual answers used by future filtering/aggregation. Different authors,
and repeat observations from one author, can disagree without overwriting each other. No consensus
value is stored on `Place`. A missing answer means unknown/unreported, not false or zero.

Features use four technical kinds: `boolean`, `numeric`, `text`, and `select`. These are storage
semantics, not hard-coded product categories, mobility types, or accessibility names. SQL Server
does not support Prisma enums, so a bounded string plus a SQL CHECK defines this small domain.
Adding another feature of an existing kind requires rows, not columns or a migration. An entirely
new kind (such as multi-select) would require a deliberate schema/validation extension.

Answers have separate nullable typed columns, not an unvalidated JSON blob or numeric strings.
`decimal(18,4)` stores precise measurements. An answer snapshots the unit used when submitted so
changing the catalog's unit cannot reinterpret old numbers. Future submission validation must copy
the current unit and perform any conversion explicitly; aggregation must compare compatible units.

The composite feature FK `(featureId, valueType)` makes kind mismatches impossible. The composite
option FK `(optionId, featureId)` prevents selecting another feature's option. The supplemental
CHECK ensures exactly one matching value is supplied, with false and zero accepted. Existing answers
block changes to a feature's value kind. Retire and replace a definition if its meaning/type changes;
likewise do not repurpose an option code to mean something else after it is used.

## Integrity and indexing

- Unique catalog codes: category, mobility type, feature. Option codes are unique within a feature.
- Composite primary keys prevent duplicate category-feature, user-mobility, and media attachments,
  and duplicate answers to a feature within a report.
- A filtered unique index permits at most one primary mobility type per user, including users with
  several non-primary associations. Zero primary types is allowed.
- Places have category/deletion, city, country/city, name, and creator indexes. These are ordinary
  B-tree indexes, not full-text or geospatial search; arbitrary substring search is not optimized.
- Reports and reviews have `(placeId, deletedAt, createdAt)` indexes for future chronological lists
  and separate author indexes for deletion/privacy workflows.
- Reverse association, answer-feature, answer-option, and uploader indexes support FK checks and
  relationship lookups. Composite unique keys also support their leftmost prefix lookups.
- Coordinates must be both absent or both present and within latitude/longitude bounds.
- `countryCode` is an optional two-character country code; validate actual codes in future APIs.
- Email is nullable and indexed, deliberately not unique before authentication/identity rules exist.
  Do not use this field as a login identifier until that policy is designed. This also avoids SQL
  Server's single-NULL limitation on ordinary unique constraints.

`constraints.sql` is the reviewed source for SQL Server checks and the filtered index that this
Prisma schema cannot declare. They are included inside the initial migration transaction.
**`prisma db push` alone is insufficient.** The applied constraints were verified on the live local
development database with rollback-only test rows.

## Deletion, privacy, and moderation boundaries

Every FK explicitly uses `NoAction` for deletes and updates. SQL Server blocks removal of referenced
parents; there are no automatic cascades or implicit anonymization. This also avoids multiple
cascade paths. Cleanup must be an explicit reviewed transaction in a future service.

User, place, review, report, and media asset records have `deletedAt`. Catalogs/options/mappings use
deactivation to preserve history. Association rows can be deliberately removed; no blanket soft
deletion fields are added to them. Soft deletion is a lifecycle marker, not erasure or an automatic
Prisma filter. Future read paths must exclude deleted content and respect parent visibility.

For account deletion, a future policy may clear name/email, delete private mobility associations,
detach nullable creator/author/uploader links, and then remove or anonymize the user. This can
preserve legitimate community contributions where appropriate without automatically deleting them.
Detaching an author does not remove personal information embedded in review text, free-text answers,
images, or alt text; future erasure/retention workflows must review those separately and delete
external objects when required. Soft deletion alone does not fulfill erasure requirements.

Mobility information is logically isolated in its own relation and never copied into reviews.
Disclosure defaults to false. Future APIs must check the current preference before returning it;
there is no public historical snapshot that survives preference withdrawal. User-controlled text
can still reveal sensitive information and requires separate future handling. Do not collect medical
diagnoses. No schema separation alone enforces authorization or legal compliance.

Stable UUIDs and separate content records allow moderation/reporting/audit tables to be added later.
No moderation states, permissions, retention policy, or workflows are implemented in this task.

## Deliberate initial assumptions

- Each place has one category; add an explicit join later if multi-category places become necessary.
- Report provenance is currently its author and observation/creation timestamps. External-source
  ingestion would add explicit source metadata later rather than introducing unused source tables now.
- Author FKs are nullable to support erasure, not to authorize anonymous submissions. Future create
  endpoints must require an authorized author where appropriate.
- Category-feature relevance, active flags, allowed options, unit copying, normalized catalog codes,
  and reasonable observation dates need future server validation in addition to database constraints.
  Historical reports do not depend on today's category mappings, so recategorization/deactivation
  does not invalidate past observations.
- Text limits: review body 4,000 characters, structured text 2,000, display name 100. Adjust these
  deliberately when content policies are defined. No revision history is implemented yet.
- One configured object-storage namespace is assumed. Stable storage keys are unique; media can be
  attached explicitly to multiple places/reviews. Future access rules must authorize each attachment.
  External file deletion is a separate lifecycle operation, never a relational cascade.

## Future-scenario review

| Scenario                                | Supported approach                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1. New place category (e.g. Airport)    | Insert a `Category`; no schema change.                                                                     |
| 2. New accessibility feature            | Insert an `AccessibilityFeature` using an existing value kind.                                             |
| 3. Feature only for selected categories | Insert/activate the chosen `CategoryFeature` pairs.                                                        |
| 4. Sixth mobility type                  | Insert a `MobilityType`; no enum or application constant.                                                  |
| 5. Multiple mobility types for one user | Multiple private `UserMobilityType` rows.                                                                  |
| 6. Category-specific accessibility data | Category mappings and typed answers; no place-specific columns.                                            |
| 7. Conflicting observations             | Separate reports/answers preserve both values; aggregation is deferred.                                    |
| 8. Numeric measurement                  | Exact decimal value plus unit snapshot.                                                                    |
| 9. Select values                        | Feature-owned option rows and composite FK validation.                                                     |
| 10. Hide mobility data without deleting | Set `showPubliclyWithReviews` false; future API honors it.                                                 |
| 11. React Native                        | Same independent backend and schema; no frontend coupling.                                                 |
| 12. Add moderation                      | Stable content IDs and lifecycle fields support later moderation relations.                                |
| 13. User deletion/anonymization         | Clear private data and explicitly detach nullable attribution, with content retention reviewed separately. |

None of these scenarios requires a major redesign. The future API must enforce the policies above;
the schema does not implement them automatically.

## SQL Server and migration status

The local installation is SQL Server 2022's default `MSSQLSERVER` instance. The service was running,
but TCP/IP was disabled while `DATABASE_URL` targeted TCP port 1433, which caused `ESOCKET`.
TCP is now enabled only for `127.0.0.1` and `::1` on static port 1433; all LAN/public addresses remain
disabled, SQL Browser remains disabled, and no firewall rule was added. The instance remains in
Windows-authentication-only mode. `wheel_accesses_dev` was created as an empty local development
database and the ignored local `.env` uses Windows integrated security without stored credentials.

The reviewed create-only migration is:

```text
server/prisma/migrations/20260916122623_initial_schema/migration.sql
```

It contains the six supplemental rules from `constraints.sql` before its single `COMMIT TRAN`, so
table creation and custom integrity are atomic. Prisma applied it successfully and reports the
database in sync. No catalog seed or application data was inserted.

The project uses matching Prisma CLI and Client version 6.19.3 with Prisma's built-in SQL Server
query engine. The Prisma 7 `@prisma/adapter-mssql` dependency was removed because its runtime driver
could not use the current Windows token and returned `ELOGIN`; SQL Server authentication was not
weakened to work around that regression. Runtime verification through the application's Prisma
singleton now succeeds with Windows integrated security. Re-evaluate the MSSQL adapter's Windows
authentication support before a future Prisma 7 upgrade.

For subsequent changes, keep these SQL-only rules in migration history; Prisma diff does not model
them. Do not edit applied migrations or repeatedly append the same constraints.

## Verification performed

- Prisma format, validation, client generation, create-only migration, and migration application
  passed. The current Prisma 6.19.3 runtime also passed `SELECT 1` and a model read against `users`.
- SQL Server catalog checks confirmed all 14 application tables, all 19 foreign keys using
  `NO ACTION`, all 18 explicit indexes, all five CHECK constraints, and the applied migration row.
- Rollback-only tests confirmed rejection of unsupported feature kinds, units on boolean features,
  mismatched typed answers, cross-feature options, invalid coordinates, whitespace-only reviews,
  a second primary mobility type, and referenced-parent deletion.
- Rollback-only valid cases confirmed false, numeric zero, and conflicting community observations.
  Verification rows were removed by transaction rollback.
- Frontend/backend TypeScript checks, repository ESLint, production builds, Markdown formatting,
  and Git whitespace checks passed after migration integration.
- The existing health endpoint returned HTTP 200 with `status: ok` and `database: connected` through
  the same Prisma Client singleton.

References: [Prisma SQL Server support](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/sql-server),
[Prisma Migrate CLI](https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference).
