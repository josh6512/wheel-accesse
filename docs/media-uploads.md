# Secure place and review images

## Scope and storage

This MVP supports still place/review images only. Authentication, Prisma 6.19.3,
Windows Integrated Authentication, schema and migration history are unchanged.
Existing `MediaAsset`, `PlaceMedia` and `ReviewMedia` models hold metadata, never
image bytes. No migration is needed.

The media service depends on the `MediaStorageService` interface (`put`, `read`,
`remove`). `LocalDevelopmentStorage` writes into a private directory, not an
`express.static` tree. `MEDIA_LOCAL_ROOT` defaults to `.data/media`, relative to
the server working directory; `.data/`, `.media-test/` and real `.env` files are
Git-ignored. Keep that directory and its parents writable only by the service
account; Windows deployments require appropriate NTFS ACLs, not just POSIX mode
bits. The provider rejects a symlink root and symlink/non-file reads.

Keys are server-generated UUID-v4 names ending in `.webp`. Original names are
never used as paths. Strict key validation prevents traversal; exclusive `wx`
writes refuse collisions rather than overwriting an existing object. Errors do
not return filesystem paths. Image contents, multipart bodies and credentials
are not logged.

The URL resolver returns controlled HTTP(S) references through
`MEDIA_PUBLIC_BASE_URL` (default `http://localhost:3000/api/v1/media`), never raw
local paths or storage keys. Existing valid external HTTP(S) references remain
supported. The base URL is explicit configuration, not derived from the Host
header. Credentials, query strings and fragments are prohibited in that base.

Production media writes, deletes and local binary reads deliberately return 503
until a production provider is integrated. There is no silent production local
disk fallback. A future provider can retain the controlled read route, or adapt
the resolver to short-lived signed read/CDN URLs with an explicit deletion and
cache-invalidation policy. No cloud service is deployed by this task.

## Endpoints and authorization

All paths are relative to `/api/v1`.

| Method | Path                 | Behavior                                                               |
| ------ | -------------------- | ---------------------------------------------------------------------- |
| POST   | `/places/:id/media`  | One image, place creator only                                          |
| POST   | `/reviews/:id/media` | One image, review author only                                          |
| GET    | `/places/:id/media`  | Authenticated creator's management list                                |
| GET    | `/reviews/:id/media` | Authenticated author's management list                                 |
| DELETE | `/media/:id`         | Uploader must also own every attached parent                           |
| GET    | `/media/:id`         | Public normalized binary, only while attachment and parent are visible |

Mutations use existing bearer `requireAuth`, with identity from the verified
session only. No uploader/user ID is accepted in multipart fields. Uploads
require an undeleted parent and active place category; anonymous/legacy parents
without an owner are not claimable. The server rechecks ownership and counts in
a serializable SQL transaction. Existing bounded deadlock retries rerun the
whole transaction, not individual writes. Filesystem operations are outside
retryable transactions.

Uploads return 201 and `{ data: { id, storageReference, mimeType, altText,
displayOrder } }`. Public place/review galleries use the same safe projection.
No uploader identity, credential or filesystem path is added to public media.
Public images are intentionally readable without authentication, including by
non-owners. Guessing an ID does not authorize mutation.

## Validation and resource limits

- Input allowlist: JPEG (`.jpg`/`.jpeg`, `image/jpeg`), PNG (`.png`, `image/png`),
  WebP (`.webp`, `image/webp`). Signature, extension, MIME and decoded format must
  agree. SVG, HTML, scripts, documents, archives and executables are rejected.
- Maximum input and normalized output: **5 MiB per image**.
- Maximum active attachments: **6 per place**, **3 per review**. Counts include
  existing images and are checked transactionally under concurrent uploads.
- One `image` file and one optional `altText` field per multipart request.
  Alt text is trimmed and limited to 500 characters. Unknown fields are rejected.
- Multipart parser limits: one file, one field, two parts, 2,000 field bytes,
  20-byte field names and configured 20 header pairs. A separate total-body
  budget is 5 MiB + 16 KiB, including chunked bodies. Known oversized content
  lengths are rejected before parsing. Body receipt has a 30-second deadline.
- Two active upload requests per application process; no unbounded processing
  queue. Uploads share a 15-minute budget of **10/account and 30/IP** across
  place/review routes. Deletes use **30/account and 90/IP**. Reads do not consume
  those write budgets. Limits are process-local, not cluster-wide.
- Maximum decoded input: **16 million pixels**, **8192 pixels per side**, four
  channels and one frame/page. Sharp's warning-level decoder rejection is used.
- Sharp applies orientation, resizes within **2048×2048** without enlarging,
  and re-encodes WebP at quality 82 with a five-second processing timeout.

Only the normalized output is permanently stored. Sharp's default metadata
stripping is retained: no `withMetadata`/`keepMetadata` on the output pipeline.
Tests inspect output metadata and confirm EXIF/GPS/device metadata is absent.
This does not remove sensitive information visible in pixels or supplied in alt
text. The UI warns that saved images are public and asks users to avoid faces
and private information. No image recognition or generated accessibility claims
are performed. See [Sharp output documentation](https://sharp.pixelplumbing.com/api-output/)
and [Multer limits](https://expressjs.com/en/resources/middleware/multer/).

## Consistency and deletion

Normalized bytes are stored before the metadata/attachment transaction. A
known rollback removes the newly stored object. After a transaction error, the
service checks for a committed metadata row before deleting bytes, protecting
against a lost commit acknowledgement. An uncertain database outcome deliberately
retains the object rather than risking deletion of committed content.

Deleting media first soft-deletes its metadata transactionally. Attachments stay
linked for ownership/history, but all public projections exclude the deleted
asset. The stored object is then removed. Successful deletion returns 204;
repeated owner deletion is safe. If storage removal fails, the image stays hidden
and a safe 503 explains that removal is pending and may be retried. Public reads
return 404 for deleted, missing or invisible-parent assets, with `no-store`,
`nosniff`, fixed WebP MIME and inline disposition on successful reads.

Deleting a whole review/place hides its images through the parent visibility
check; it does not immediately purge all retained image objects. An upload racing
review deletion either fails or becomes publicly inaccessible. Future retention
and reconciliation work must address whole-parent deletion, orphaned objects
after process crashes/uncertain commits and failed storage deletions. This is not
a distributed transaction and does not claim guaranteed physical purge during
an infrastructure outage. Already downloaded public copies cannot be recalled.

## Frontend behavior

Selection creates only local previews; object URLs are revoked on removal or
unmount. Client format/size/count checks are UX safeguards, not security checks.
Optional descriptions are submitted as alt text, with sensible gallery fallbacks.
Broken images show an accessible unavailable placeholder.

Add Place runs: create place → individual sequential media uploads → optional
accessibility report → optional initial review. A successfully created place is
never rolled back because a follow-up fails. Each result is explicit, including
`1 of 2 images confirmed uploaded` and safe error details. There is no false
all-success state or automatic retry of a potentially completed write.

The review composer saves text first, then uploads optional images to the new
review. The owner can add more images from the place/review management controls
and remove images with confirmation. Non-owners have no management controls;
the API independently rejects their requests. Access tokens remain in memory
through the existing API client; uploads introduce no new token storage.

## Verification commands and launch limits

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
`npm run format:check`, `git diff --check` and `npm audit` from the repository root.
Run `npx prisma validate`, `npx prisma generate`, `npx prisma migrate status`
from `server`, using the ignored local environment. Stop processes holding the
Windows Prisma engine DLL before generation if necessary.

Real-database suites are explicit opt-ins:
`npm run test:auth:database -w server`,
`npm run test:community:database -w server`, and
`npm run test:media:database -w server`.
The media suite uses a unique temporary directory and synthetic accounts/content,
then verifies zero remaining rows and files. Permanent catalog rows are not
modified. Run as the developer identity for SQL Server Integrated Authentication.

Before public launch: integrate production storage, TLS, shared rate limits and
byte/storage quotas, reverse-proxy request limits, resource-isolated image
processing, retention/reconciliation, monitoring, backup/deletion policy,
abuse reporting/moderation and an appropriate legal/privacy review. Evaluate
malware scanning for the deployment risk model and keep native decoders patched.
Signature checks and re-encoding are defense in depth, not a malware-free or
legally compliant certification. No moderation, avatars, videos, maps or admin
features are implemented here.
