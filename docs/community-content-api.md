# Community content API

Wheel Accesses treats reviews and accessibility reports as separate concepts:

- A **review** is a plain-text community comment about a place.
- An **accessibility report** is an independent structured observation containing typed answers to
  the accessibility features configured for that place's category.

Reports are not aggregated, scored, or merged. Conflicting observations remain separate records.
All routes are under `/api/v1` and use the existing `{ "data": ... }` success convention.

## Reviews

### `GET /places/:placeId/reviews`

Returns non-deleted reviews for a visible place. Supported query parameters are `page` (default 1)
and `pageSize` (default 20, maximum 100).

```json
{
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "body": "Synthetic plain-text example.",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "place": {
        "id": "22222222-2222-4222-8222-222222222222",
        "name": "Synthetic place"
      },
      "author": {
        "id": "33333333-3333-4333-8333-333333333333",
        "displayName": "Example author"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

### `GET /reviews/:id`

Returns one public review or `REVIEW_NOT_FOUND` with HTTP 404.

Review bodies are stored and returned as plain text. Clients must render them as text, never as
trusted HTML. Future authenticated review submission accepts a strict body containing only `body`,
trims whitespace, rejects blank text, and permits at most 4,000 characters.

Reviews also include an ordered `media` array with safe media asset ID, external storage reference,
alt text, MIME type, and display order. Upload and delete operations remain unavailable. The Place
Details client renders only HTTP(S) image references and otherwise omits the unresolved media item.

## Structured accessibility reports

### `GET /places/:placeId/accessibility-reports`

Returns independent, non-deleted reports for a visible place. It uses the same page defaults and
limits as review lists.

### `GET /accessibility-reports/:id`

Returns one report with place/author metadata and all typed answers. Each answer contains feature
metadata and a discriminated `value`:

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "observedAt": "2026-01-01T00:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "place": {
      "id": "22222222-2222-4222-8222-222222222222",
      "name": "Synthetic place"
    },
    "author": null,
    "answers": [
      {
        "feature": {
          "id": "55555555-5555-4555-8555-555555555555",
          "code": "synthetic-width",
          "displayName": "Synthetic width",
          "description": null,
          "valueType": "numeric",
          "unit": "cm"
        },
        "value": {
          "type": "numeric",
          "value": "84.5",
          "unit": "cm"
        }
      }
    ]
  }
}
```

Typed values have these shapes:

- Boolean: `{ "type": "boolean", "value": false }`
- Numeric: `{ "type": "numeric", "value": "84.5", "unit": "cm" }`; the decimal is a string to
  preserve database precision and the unit is the report-time snapshot.
- Text: `{ "type": "text", "value": "Plain observation" }`
- Select: `{ "type": "select", "option": { "id": "...", "code": "...", "displayName": "..." } }`

Place Details presents numeric, select, and text answers only as individual report evidence. It
does not invent an aggregate status for non-Boolean values and does not render reporter attribution.

## Privacy

Public authors contain only `id` and nullable `displayName`. Email, mobility associations, deletion
metadata, and other private profile information are never selected for API responses. If the user
record is deleted or attribution is absent, `author` is null. Public mobility disclosure is deferred
until authentication, authorization, and withdrawal rules are implemented.

## Why write routes are deferred

There is intentionally no public `POST /reviews` or `POST /accessibility-reports` route. Accepting a
user ID from an unauthenticated request would allow ownership spoofing. The service/repository and
strict validation contracts exist. Authentication now supplies a trusted `request.auth.userId`, but
write routes remain deferred until ownership authorization and abuse rules are implemented.

The future authenticated report flow will:

1. Take the author ID only from authenticated request context.
2. Require a visible active place.
3. Load only active category-feature mappings, active features, and active select options for the
   place's category.
4. Reject unrelated/inactive features, mismatched answer types, invalid select options, and duplicate
   feature answers.
5. Copy the configured numeric unit into the stored answer rather than trusting a client-supplied
   unit.
6. Create a new report and answers transactionally through Prisma, preserving each observation as an
   independent report.

Submission validation accepts only boolean, finite numeric, trimmed text of at most 2,000 characters,
or single-select option answers. Unknown properties are rejected. No aggregation or consensus value
is computed.
