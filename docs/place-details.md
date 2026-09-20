# Place Details

The web route `/places/:placeId` provides the first complete read-only place experience. Search
result cards use the place UUID as the route parameter and remain ordinary keyboard-accessible
links. No category name or place name is encoded into routing logic.

## Place details response

`GET /api/v1/places/:id` remains the canonical place endpoint. Its existing identity, location,
timestamp, and compact category fields are preserved. The detail response additionally includes:

- `media`: ordered safe media metadata.
- `reviewCount`: the number of visible reviews.
- `accessibilityReportCount`: the number of visible structured reports.
- `accessibility`: every active Boolean feature mapped to the place category, in mapping order,
  with `SUPPORTED`, `NOT_SUPPORTED`, `CONFLICTING`, or `UNKNOWN` status plus positive and negative
  report counts.

The response never includes creator/reporter identities, user email, mobility associations,
deletion fields, or storage credentials.

## Media read contract

Place media and review media use this public shape:

```json
{
  "id": "media-asset-uuid",
  "storageReference": "https://public-media.example/place.jpg",
  "altText": "Step-free entrance beside the lobby",
  "mimeType": "image/jpeg",
  "displayOrder": 10
}
```

`storageReference` is the existing opaque external object reference. It is not a credential or
signed upload token. The web client renders only HTTP(S) image references with an image MIME type;
other references remain available to a future reviewed media resolver. Places without renderable
media receive a branded placeholder—no external stock imagery is invented.

Uploads, deletion, media signing, and object-storage mutation remain unimplemented.

## Accessibility summary and evidence

The detail repository counts non-deleted Boolean answers for all active category mappings. The
service passes those counts through the same `deriveAccessibilityStatus` function used by Search,
so Place Details cannot introduce a second consensus rule:

- more positive than negative observations: `SUPPORTED`
- more negative than positive observations: `NOT_SUPPORTED`
- equal non-zero counts: `CONFLICTING`
- no observations: `UNKNOWN`

The page always uses textual status labels and counts in addition to visual indicators. It also
states that community information is not an accessibility guarantee.

Numeric, select, and text values are not converted to Boolean status. Existing paginated
accessibility reports provide a progressive-disclosure evidence section. Each observation displays
its typed value, preserving numeric units and select-option display names. Reporter attribution is
not rendered in this view. No numeric/select aggregation or search behavior is introduced.

## Reviews

The page uses `GET /api/v1/places/:placeId/reviews` with a five-item page size. Reviews remain
plain-text community comments, show only the existing public display name when available, and can
include ordered safe review-media metadata. Review failures are isolated from place and
accessibility content.

There is no review composer. A restrained callout explains that publishing is coming in a future
release. Authentication now exists, but no browser-supplied user ID and no content write route is
accepted.

## Resilience and accessibility

The page has distinct loading, invalid-ID, missing-place, network-error, no-media, no-report, and
no-review states. Report and review failures do not replace successfully loaded place details.
Semantic headings, ordinary links, labeled pagination controls, live loading text, text-based
status descriptions, visible focus, meaningful image alternatives, reduced-motion styles, and
mobile horizontal gallery scrolling support accessible navigation.
