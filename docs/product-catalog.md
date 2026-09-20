# Initial product catalog

Wheel Accesses stores product categories and accessibility definitions as editable database
configuration. The frontend and APIs load these records dynamically; adding a category or feature
is a data/configuration change, not a reason to add conditional product logic throughout the
codebase.

## Seed command and safety policy

From the repository root, run:

```powershell
npm run prisma:seed
```

`server/prisma/catalog.ts` is the reviewed catalog manifest and `server/prisma/seed.ts` reconciles it
inside one database transaction. Codes are the stable natural keys. Fixed UUIDs make new records
consistent across environments; when a matching code already exists, its existing UUID is retained
and relationships use that UUID.

The seed creates missing records and updates only seed-managed presentation metadata: display names,
descriptions, display order, and primary mapping flags. It deliberately preserves existing active
flags so an operator's deactivation is not undone. Feature value types and units are semantic
contracts; a conflict makes the seed stop rather than rewrite existing answers. The seed never
deletes or truncates records, never removes unlisted catalog data, and does not create or mutate
users, mobility profiles, places, reviews, accessibility reports, answers, or media. Already-matching
rows are not written again, so repeated runs do not change `updatedAt` timestamps.

## Mobility types

| Code                          | Display name                  |
| ----------------------------- | ----------------------------- |
| `MANUAL_WHEELCHAIR`           | Manual Wheelchair             |
| `POWERED_WHEELCHAIR`          | Powered Wheelchair            |
| `CRUTCHES`                    | Crutches                      |
| `WALKER_ROLLATOR`             | Walker / Rollator             |
| `WALKING_AID_LIMITED_WALKING` | Walking Aid / Limited Walking |

These are rows, not a TypeScript enum. More mobility types can be added without a schema change.

## Categories and feature mappings

The initial ordered categories are `HOTEL`, `RESTAURANT`, `PARK`, and `ATTRACTION`. Mappings have
their own display order and identify the most useful values as primary.

| Category   | Ordered feature codes                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hotel      | `STEP_FREE_ENTRANCE`, `ACCESSIBLE_TOILET`, `ACCESSIBLE_PARKING`, `RAMP_AVAILABLE`, `ELEVATOR`, `GENERAL_MANEUVERING_SPACE`, `ROOM_MANEUVERING_SPACE`, `ROLL_IN_SHOWER`, `SHOWER_SEAT`, `SHOWER_GRAB_BARS`, `BED_HEIGHT`, `BEDSIDE_TRANSFER_SPACE` |
| Restaurant | `STEP_FREE_ENTRANCE`, `ACCESSIBLE_TOILET`, `ACCESSIBLE_PARKING`, `RAMP_AVAILABLE`, `GENERAL_MANEUVERING_SPACE`, `ADEQUATE_TABLE_SPACING`, `WHEELCHAIR_COMPATIBLE_SEATING`, `ACCESSIBLE_DINING_ROUTE`                                              |
| Park       | `STEP_FREE_ENTRANCE`, `ACCESSIBLE_TOILET`, `ACCESSIBLE_PARKING`, `RAMP_AVAILABLE`, `ACCESSIBLE_PATH`, `REST_SEATING_AREAS`, `ACCESSIBLE_PRIMARY_ROUTE`, `PATH_SURFACE`                                                                            |
| Attraction | `STEP_FREE_ENTRANCE`, `ACCESSIBLE_TOILET`, `ACCESSIBLE_PARKING`, `RAMP_AVAILABLE`, `ELEVATOR`, `GENERAL_MANEUVERING_SPACE`, `ACCESSIBLE_PRIMARY_ROUTE`, `REST_SEATING_AREAS`                                                                      |

Shared concepts reuse one feature row across categories. For example, parks and attractions share
the primary-area route and rest/seating definitions instead of creating category-prefixed copies.

## Feature types and options

Most initial features are `boolean`. `BED_HEIGHT` is `numeric` with unit `cm`; `PATH_SURFACE` is
`select` with `PAVED`, `ASPHALT`, `GRAVEL`, `GRASS`, and `DIRT_NATURAL_SURFACE` options. The current
search UI intentionally renders only Boolean features as checkboxes. Numeric and select definitions
remain available from the metadata APIs for future reporting and filtering work.

When extending the catalog:

1. Add a stable, never-repurposed code and a clear user-facing display name to the catalog manifest.
2. Reuse an existing feature when it has the same meaning.
3. Add ordered category mappings instead of branching on a category in application code.
4. Retire incompatible semantics with a new code rather than changing a feature type already used
   by reports.
5. Run the seed twice and confirm the second run reports only unchanged managed rows.
