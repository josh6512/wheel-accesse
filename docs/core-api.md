# Core API

The first Wheel Accesses application API exposes database-driven category and accessibility-feature
metadata plus place search, reads, and creation. Review and structured-report reads are documented
in [Community content API](community-content-api.md). The search contract and consensus rules are
documented in [Place search API](place-search-api.md). Authentication, catalog mutations, and
frontend UI are not implemented.

All routes are under `/api/v1`. Successful resource responses use a `data` envelope. Validation is
strict: unknown body/query properties and malformed UUIDs are rejected with HTTP 400.

## Categories

### `GET /categories`

Returns active categories ordered by `displayOrder`, display name, and ID.

```json
{
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "example-category",
      "displayName": "Example category",
      "description": "Synthetic documentation example.",
      "isActive": true,
      "displayOrder": 10
    }
  ]
}
```

### `GET /categories/:id`

Returns one active category. A missing or inactive category returns `CATEGORY_NOT_FOUND` with HTTP 404.

## Accessibility features

### `GET /accessibility-features`

### `GET /accessibility-features/:id`

Returns active feature definitions. Active select options are nested under `options` and ordered by
their display order, display name, and ID. Non-select features normally have an empty options array.

```json
{
  "data": {
    "id": "22222222-2222-4222-8222-222222222222",
    "code": "example-select-feature",
    "displayName": "Example select feature",
    "description": null,
    "valueType": "select",
    "unit": null,
    "isActive": true,
    "options": [
      {
        "id": "33333333-3333-4333-8333-333333333333",
        "code": "example-option",
        "displayName": "Example option",
        "displayOrder": 1,
        "isActive": true
      }
    ]
  }
}
```

## Category features

### `GET /categories/:categoryId/features`

Returns active mappings whose category and feature are both active. The mapping's `displayOrder`
and `isPrimary` fields are included, followed by the feature metadata and ordered active options.
This endpoint is suitable for building data-driven forms without hard-coded category behavior.

```json
{
  "data": [
    {
      "displayOrder": 1,
      "isPrimary": true,
      "id": "22222222-2222-4222-8222-222222222222",
      "code": "example-select-feature",
      "displayName": "Example select feature",
      "description": null,
      "valueType": "select",
      "unit": null,
      "isActive": true,
      "options": []
    }
  ]
}
```

## Places

Deleted places and places assigned to inactive categories are not returned by public reads. Search
and place details return only aggregate counts and statuses; they never return reporter identities.

### `GET /places/:id`

Returns general place fields and a compact category object. Creator information is not exposed.
The existing fields are supplemented with ordered `media`, `reviewCount`,
`accessibilityReportCount`, and an ordered `accessibility` summary for every active Boolean feature
mapped to the place category.

Each media item contains `id`, `storageReference`, nullable `altText`, `mimeType`, and
`displayOrder`. The storage reference is an opaque public/external reference, never a credential or
upload token. Each accessibility item contains compact feature metadata, the shared consensus
`status`, `positiveReports`, and `negativeReports`. See
[Place Details](place-details.md) for the complete frontend and evidence behavior.

### `GET /places`

Supported query parameters:

| Parameter  | Validation                          | Default |
| ---------- | ----------------------------------- | ------- |
| `category` | Category UUID                       | none    |
| `city`     | Non-empty text, at most 120 chars   | none    |
| `country`  | Two ASCII letters; normalized upper | none    |
| `q`        | Name substring, at most 200 chars   | none    |
| `features` | Boolean feature filters; see below  | none    |
| `page`     | Integer from 1 through 100,000      | 1       |
| `pageSize` | Integer from 1 through 100          | 20      |

Filtering, counting, ordering, and pagination execute in SQL through Prisma. Results are ordered by
creation time and ID, both descending. Accessibility filters require a category and use the format
`features=<feature-uuid>:true,<feature-uuid>:false`. Every requested filter must match, and each
feature must be an active Boolean feature configured for that active category. See
[Place search API](place-search-api.md) for the complete contract and consensus behavior.

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

### `POST /places`

Creates a basic place and returns HTTP 201. Accepted JSON properties are:

- `name` — required, trimmed, 1–200 characters.
- `categoryId` — required UUID for an existing active category.
- `address` — optional non-empty text, at most 500 characters.
- `city` and `region` — optional non-empty text, at most 120 characters each.
- `countryCode` — optional two-letter code, normalized to uppercase.
- `latitude` and `longitude` — optional finite numbers that must be supplied together; latitude is
  limited to −90…90 and longitude to −180…180.

No creator property is accepted. Until authentication exists, `createdById` is stored as null.

```json
{
  "name": "Synthetic test place",
  "categoryId": "11111111-1111-4111-8111-111111111111",
  "city": "Test City",
  "countryCode": "IL",
  "latitude": 32.0853,
  "longitude": 34.7818
}
```

## Errors

Expected errors use the centralized safe format:

```json
{
  "error": {
    "code": "PLACE_NOT_FOUND",
    "message": "The requested place was not found.",
    "requestId": "request-correlation-id"
  }
}
```

- HTTP 400: malformed parameters/query/body or an inactive/missing category during place creation.
- HTTP 404: a requested active resource does not exist.
- HTTP 500: an unexpected server error; Prisma internals are not returned to the client.
