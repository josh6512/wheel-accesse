# Authentication, sessions, authorization and privacy

## Architecture and endpoints

The API provides first-party email/password authentication. Product write routes are still
unexposed, including the older `POST /places` binding, which was removed during this work.

| Endpoint                     | Result                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/v1/auth/register` | Strict `{displayName,email,password}`; creates user, credential and initial refresh session atomically; 201 plus access token and private account projection |
| `POST /api/v1/auth/login`    | Strict `{email,password}`; 200 plus access token and private account projection                                                                              |
| `POST /api/v1/auth/refresh`  | Cookie only; rotates refresh credentials and returns a new access token                                                                                      |
| `POST /api/v1/auth/logout`   | Revokes the cookie's session family and clears the cookie; idempotent 204                                                                                    |
| `GET /api/v1/auth/me`        | Bearer authentication; returns only `{id,displayName,email}` for the current account                                                                         |

Authentication responses are `Cache-Control: no-store`. Authentication cookies are never returned
in JSON. Public place/review/report projections do not gain account emails or credential fields.
Login uses the same 401 response for unknown email, incorrect password, and deleted account.
Registration conflicts return a restrained 409; registration still reveals limited account
availability, an explicit MVP UX tradeoff. Validation is 400, missing/invalid authentication 401,
rejected web origins 403, and throttling 429 with `Retry-After`.

## Persistence and email identity

`UserCredential` is a one-to-one extension of `User`, containing the unique normalized login email,
Argon2id hash, and timestamps. Existing nullable `User.email` remains legacy private contact data;
it is neither copied into credentials nor used for login, account linking, or account recovery.
There were no destructive backfills. Existing contact records need an explicit verified linking
workflow before they can become accounts.

The MVP accepts ASCII email addresses up to 254 characters, trims surrounding whitespace, and
lowercases the entire address as a deliberate case-insensitive account policy. It does not strip
provider-specific dots or plus tags. Internationalized addresses need a future explicit policy.
The credential column uses SQL Server `Latin1_General_100_BIN2` collation and a unique constraint,
so database locale/accent folding cannot merge distinct normalized identities. Concurrent duplicate
registrations are prevented by this database constraint and mapped to the same safe conflict.

`RefreshSession` contains an ID, user ID, family ID, SHA-256 token representation, creation/absolute
expiry, revocation time and replacement ID. Replacement ID is audit metadata, not an extra
self-referencing FK. User FKs use `NO ACTION`; deleting an account cannot cascade into community
contributions. The migration is `20260920153159_authentication_sessions/migration.sql`, reviewed
before application, with `XACT_ABORT ON`, transaction, rollback and rethrow. The initial migration
and its custom constraints are unchanged.

## Password and access-token security

The centralized `argon2` implementation uses Argon2id, 64 MiB memory, three iterations, one lane,
and library-generated random salts. Passwords are 15–128 characters and are not trimmed or
silently truncated. Spaces and Unicode are permitted; there are no arbitrary symbol/case rules.
Unknown users still take an Argon2 verification path using a randomly generated dummy hash.
These costs exceed the [OWASP Argon2id minimum](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

`jose` signs HS256 JWT access tokens with a secret supplied only through server environment.
Default lifetime is 600 seconds; allowed configuration is 60–900 seconds. Claims are only `sub`
(user UUID), `sid` (session family UUID), `iat`, `exp`, `iss`, and `aud`. Signature algorithm,
signature, issuer, audience, expiry, required claims, type and UUID shapes are checked.
No email, password, display name, mobility or accessibility information is put into tokens.

`requireAuth` then checks the current database account and active, unexpired family before
attaching `{userId,familyId}` to `request.auth`. Logout and soft deletion therefore invalidate
access immediately, even before JWT expiry. Database outages fail closed. The existing schema
has `deletedAt`, not a separate disabled flag; that status is enforced on login, refresh and access.
Future disabling must use an explicit status design or the existing exclusion mechanism.

Future write controllers must use `request.auth.userId`; request body identity is never trusted.
Authentication does not establish ownership or roles: each future resource service must enforce
its authorization policy and return 403 where appropriate. `logoutAll(userId)` service support
exists without a public route and must receive a trusted ID.

## Refresh rotation and revocation

The cookie contains a UUID selector and 32 cryptographically random secret bytes. Only the SHA-256
representation is stored. Fast hashing is suitable here because the secret has 256 bits of random
entropy; user passwords use Argon2id instead.

Each login starts a family with an absolute 14-day expiry (configurable 1–30 days). Every successful
refresh revokes its predecessor, records the replacement, and creates a new secret with the same
family and absolute expiry. Serializable SQL transactions and bounded deadlock retries prevent
two refreshes from both succeeding. Logout and logout-all use the same serializable transaction
and bounded deadlock retries as rotation, so logout racing a refresh still revokes the resulting
family. Presenting a known revoked secret revokes the whole family,
including its current access tokens. A forged secret does not revoke someone else's session.
This follows the replay-detection approach described in [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14).

There is no replay grace period. Network loss after rotation or concurrent rotation from clients
without shared locking can require signing in again. Retain revoked predecessors until family
expiry for replay detection. Production needs a scheduled retention job to remove expired auth
records; no broad deletion job is installed by this task.

## Browser transport, CSRF, and CORS

Cookie: host-only (no Domain), HttpOnly, SameSite=Strict, Path=/api/v1/auth, and absolute expiry.
Production uses Secure and the `__Secure-wa_refresh` name. Local HTTP development uses
`wa_refresh` without Secure; never use development mode for an externally deployed service.
Production requires an HTTPS frontend origin. Frontend and API must be on the same site for Strict
cookies; unrelated sites are intentionally unsupported by this transport.

All four POST auth actions validate exact `Origin === CLIENT_ORIGIN`, reject missing/`null`/
foreign Origin and cross-site Fetch Metadata, before processing credentials. This also protects
login/registration from session-swapping CSRF. CORS grants credentials only to that configured
origin, never `*`. Public reads without Origin still work; cross-origin JS receives no grant.
Bearer tokens on `/me` are not automatically attached by browsers, so it does not rely on the
refresh cookie for authentication. No extra CSRF-token package is required by this transport.

Focused in-process IP limits per 15 minutes: registration 10, login 20, refresh/logout 60 each.
IPv6 keys use the rate-limit library's subnet handling. There is no global limiter. Proxy trust
remains disabled; configure exact trusted proxy hops and a shared limiter store before running
multiple API processes or a reverse proxy. Distributed credential stuffing still needs deployment
level detection/controls before public launch.

## React client

Routes are `/login`, `/register`, and a small private `/account` read page. `AuthProvider`/`useAuth`
centralize account state. The access token is a private module variable; neither token is written
to localStorage or sessionStorage. Refresh secrets are accessible only through the HttpOnly cookie.
On load, a shared refresh promise restores account state. Web Locks serialize cookie actions
across supported browser tabs; a local promise queue always serializes within a tab.

Protected `apiRequest` calls attach the memory token, attempt at most one shared refresh on 401,
and retry the original request once. Failure clears local auth state, including a second 401.
Public reads do not carry tokens. Logout clears memory only after server revocation succeeds,
so a network failure stays visible and retryable. Private account text disappears on logout.
Other open tabs can retain stale header text until their next protected request or reload;
server-side access is already revoked. Forms have proper labels, autocomplete hints, error
announcements, keyboard focus and disabled in-flight actions.

## Configuration and operations

`server/.env.example` contains placeholders only. Required signing configuration is
`AUTH_ACCESS_SECRET` (at least 43 characters, generated from at least 32 random bytes).
`AUTH_ISSUER=wheel-accesses`, `AUTH_AUDIENCE=wheel-accesses-client`, `AUTH_ACCESS_SECONDS=600`,
and `AUTH_REFRESH_DAYS=14` have safe defaults. `CLIENT_ORIGIN` is one exact frontend origin.
Cookie security is derived from NODE_ENV and cannot be disabled in production with a separate flag.
A missing or example signing key prevents API startup. Rotating that key invalidates existing
access tokens; clients can refresh using valid sessions. Signing-key rollover with overlapping
keys is not implemented. Production secrets must come from deployment secret management.

Request logging serializes only request ID, method, path without query, and response status.
Success events can include a trusted user UUID. No request bodies, Authorization/Cookie headers,
Set-Cookie values or raw database/library errors are logged. Redaction is also retained as defense
in depth. Restrict log access and define retention; user UUIDs can still be personal data.

## Future native clients and remaining work

Password/token/session services are independent of Express cookies. A future native controller
can reuse them with refresh credentials stored in OS secure storage. It needs an explicit native
transport contract; do not weaken the web Origin checks or expose cookie secrets in web JSON to
make native requests work. No native transport or client is enabled now.

Email ownership verification, password reset/change, breached-password checks, MFA, OAuth,
roles/moderation, account deletion/export/retention policy and legal notices remain future work.
Unverified email must not be treated as proven identity or used to auto-link legacy users.
Before public writes, complete ownership authorization, verified identity/recovery decisions,
abuse controls, moderation/reporting, privacy notices and applicable legal review. This foundation
does not claim that schema separation alone establishes legal compliance. Account erasure must
revoke sessions and handle credentials separately from the reviewed community-data policy.

## Verification

`npm test` covers validation, password hashing, JWT verification, HTTP boundaries and frontend
storage/restore/retry behavior alongside regressions. `npm run test:auth:database -w server`
explicitly runs the real SQL Server suite. It creates uniquely named synthetic accounts, tests
registration/login, duplicate identity, deleted users, rotation/replay/concurrency, expiry,
logout and logout-all, including five logout-versus-refresh races, then deletes only its own
sessions/credentials/users and verifies cleanup.
Run it with the developer's Windows identity and local database configuration.

The browser smoke test verified registration, authenticated header state, reload restoration,
private `/me`, logout and rejection afterward. A temporary 60-second access lifetime verified
expiry followed by exactly one refresh and successful request retry; the saved default remains
600 seconds. The registration form fits a 390×844 viewport with no horizontal overflow and
45-pixel inputs. Synthetic browser and integration accounts/sessions were removed and verified.
