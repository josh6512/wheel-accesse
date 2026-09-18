# Place search API

`GET /api/v1/places` provides the first database-backed place search implementation. It combines
basic place fields with category-driven Boolean accessibility filters and compact community
consensus summaries. Search does not expose reports, answers, users, or reporter identities.

## Query contract

All query validation is strict. Unknown query parameters return HTTP 400.

| Parameter  | Meaning                                                  | Default |
| ---------- | -------------------------------------------------------- | ------- |
| `category` | Active category UUID                                     | none    |
| `city`     | Exact city match, case-insensitive, 1–120 characters     | none    |
| `country`  | Exact two-letter country code, normalized to uppercase   | none    |
| `q`        | Place-name substring, case-insensitive, 1–200 characters | none    |
| `features` | Comma-separated Boolean feature filters, at most 20      | none    |
| `page`     | One-based page number, at most 100,000                   | 1       |
| `pageSize` | Results per page, from 1 through 100                     | 20      |

Accessibility filters use a stable feature UUID and Boolean value:

```text
features=<feature-uuid>:true,<feature-uuid>:false
```

When `features` is present, `category` is required. Each feature UUID may occur only once and must
identify an active Boolean feature with an active mapping to the selected active category. An
inactive, unrelated, missing, or non-Boolean feature returns `INVALID_ACCESSIBILITY_FILTER` with
HTTP 400. A missing or inactive category returns `INVALID_CATEGORY_FILTER` with HTTP 400.

All supplied place and feature filters have AND semantics. For example, a search with two `true`
feature filters returns only places whose consensus is `SUPPORTED` for both features. Unknown and
conflicting values do not match either `true` or `false` filters.

Example requests (UUIDs are illustrative):

```text
GET /api/v1/places?city=Tel%20Aviv&country=IL&category=11111111-1111-4111-8111-111111111111
GET /api/v1/places?q=Hilton&page=1&pageSize=20
GET /api/v1/places?category=11111111-1111-4111-8111-111111111111&features=22222222-2222-4222-8222-222222222222:true
GET /api/v1/places?category=11111111-1111-4111-8111-111111111111&features=22222222-2222-4222-8222-222222222222:true,33333333-3333-4333-8333-333333333333:true
```

## Consensus calculation

Only non-deleted accessibility reports and Boolean answers for the relevant feature are counted.
The status for each configured active Boolean feature is calculated independently for each place:

| Condition                         | Status          |
| --------------------------------- | --------------- |
| positive reports > negative       | `SUPPORTED`     |
| negative reports > positive       | `NOT_SUPPORTED` |
| positive = negative, at least one | `CONFLICTING`   |
| no positive or negative reports   | `UNKNOWN`       |

A filter ending in `:true` matches `SUPPORTED`; a filter ending in `:false` matches
`NOT_SUPPORTED`. A missing answer is unknown, not a negative report.

Consensus is a snapshot of community observations, not a guarantee that a place will meet a
person's needs. The response deliberately includes both counts so clients can communicate the
strength and disagreement in the available evidence.

## Response

Counting and pagination run in SQL. Accessibility summaries are loaded for only the current page,
so the implementation does not issue one database query per place. Results are ordered by
`createdAt` and then ID, both descending.

```json
{
  "data": [
    {
      "id": "66666666-6666-4666-8666-666666666666",
      "name": "Synthetic library",
      "address": "1 Test Street",
      "city": "Test City",
      "region": null,
      "countryCode": "IL",
      "latitude": 32.0853,
      "longitude": 34.7818,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z",
      "category": {
        "id": "11111111-1111-4111-8111-111111111111",
        "code": "library",
        "displayName": "Library"
      },
      "accessibility": [
        {
          "feature": {
            "id": "22222222-2222-4222-8222-222222222222",
            "code": "step-free-entry",
            "displayName": "Step-free entry"
          },
          "status": "SUPPORTED",
          "positiveReports": 3,
          "negativeReports": 1
        }
      ],
      "reviewCount": 0
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

An out-of-range page returns an empty `data` array while retaining the correct total count and page
metadata. Soft-deleted places, places in inactive categories, soft-deleted reports, inactive
feature mappings, and inactive features are excluded as applicable.

## Implementation decision

Search extends the existing `GET /api/v1/places` list endpoint so existing category, city, country,
page, and page-size clients remain compatible. The implementation lives in a dedicated search
module with separate route, validation, controller, service, repository, aggregation, and response
types.

SQL Server performs filtering, counting, consensus comparisons, ordering, and pagination. Safe
parameterized raw SQL is isolated in the repository because correlated per-feature aggregation and
SQL Server pagination are considerably clearer there than as a large generated Prisma object
graph. Inputs are bound with Prisma SQL parameters rather than interpolated into SQL text. A search
uses one category-feature eligibility lookup when accessibility filters are present, one
transaction containing count and page queries, and one summary query for the returned page. It
does not issue a query for every result.

## Current limitations

- Accessibility filtering supports Boolean feature definitions only.
- Text, numeric, and select feature summaries and filters are not implemented.
- Name search is a literal substring search, not full-text search or relevance ranking.
- City and country are exact matches; coordinate/radius search is not implemented.
- Consensus is unweighted. It does not yet account for observation age, trust, moderation, or
  duplicate submissions.
