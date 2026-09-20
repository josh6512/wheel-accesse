# Wheel Accesses

Wheel Accesses is planned as a community-driven accessibility platform. This repository contains a
React web search experience and an independent Express REST API that can later also serve a React
Native app and an administration interface.

The initial database schema, core catalog/place APIs, category-driven place search, and community
review/accessibility-report read APIs are implemented. The web client provides the first Home →
Search → Results → Accessibility Filters flow. See
[Database schema](docs/database-schema.md) for the data model, [Core API](docs/core-api.md) for
catalog/place endpoints, [Place search API](docs/place-search-api.md) for filtering and consensus,
and [Community content API](docs/community-content-api.md) for reviews and structured reports. The
read-only [Place Details experience](docs/place-details.md) combines these contracts for one place.

## Architecture

```text
React web client ─┐
React Native app ─┼─> Express REST API ─> Prisma ─> Microsoft SQL Server
Admin interface ──┘
```

The repository is an npm workspace with two independently buildable packages:

- `client/` — React, TypeScript, Vite, and React Router. It contains responsive home and search
  pages, a typed API layer, dynamic category-driven filters, place cards, pagination, and focused
  Vitest/Testing Library coverage. It never connects to SQL Server directly.
- `server/` — Express and TypeScript, organized by domain module. It owns environment validation,
  HTTP security, CORS, structured logging, request validation, errors, Prisma, and the category,
  accessibility-feature, category-feature, place, review, accessibility-report, and health routes.
- `server/prisma/` — Initial Prisma models, migration history, and supplemental SQL Server
  constraints. The generated client is ignored and recreated locally; see the schema guide.

Future backend features should be added as cohesive folders under `server/src/modules/`. Each
module can own only the routes, controller, service, validation, and data access that it needs.
Categories, mobility types, accessibility attributes, and select options are modeled as configurable
database data. The initial product configuration is maintained through an idempotent Prisma seed;
see [Initial product catalog](docs/product-catalog.md).

## Technology and prerequisites

- Node.js 20.19 or newer and npm
- React, TypeScript, Vite, and React Router
- Node.js, Express, and TypeScript
- Prisma ORM with the Microsoft SQL Server provider
- Zod, Pino, Helmet, CORS, ESLint, and Prettier
- A locally reachable Microsoft SQL Server instance with TCP/IP connectivity enabled
- A development database accessible through Windows integrated security or a least-privilege SQL
  login

Do not commit credentials. All `.env` files are ignored; only placeholder `.env.example` files are
tracked.

## Install and configure

From the repository root:

```powershell
npm install
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

The server requires:

| Variable        | Purpose                              | Example only            |
| --------------- | ------------------------------------ | ----------------------- |
| `NODE_ENV`      | Runtime mode                         | `development`           |
| `PORT`          | Express port                         | `3000`                  |
| `CLIENT_ORIGIN` | Exact browser origin allowed by CORS | `http://localhost:5173` |
| `DATABASE_URL`  | Prisma SQL Server connection string  | See below               |

The client accepts:

| Variable            | Purpose                  | Example only                   |
| ------------------- | ------------------------ | ------------------------------ |
| `VITE_API_BASE_URL` | Public REST API base URL | `http://localhost:3000/api/v1` |

Every variable prefixed with `VITE_` is visible to browser users. Never place credentials, tokens,
or other secrets in the client environment.

### SQL Server connection

For a local Windows-only SQL Server instance, use integrated security without storing a password:

```dotenv
DATABASE_URL="sqlserver://127.0.0.1:1433;database=wheel_accesses_dev;integratedSecurity=true;encrypt=true;trustServerCertificate=true;schema=dbo"
```

If SQL authentication is intentionally enabled and locally configured, use:

```dotenv
DATABASE_URL="sqlserver://HOST:PORT;database=DATABASE_NAME;user=USERNAME;password=PASSWORD;encrypt=true;trustServerCertificate=true"
```

Replace `HOST`, `PORT`, `DATABASE_NAME`, `USERNAME`, and `PASSWORD`. SQL Server connection-string
values containing reserved characters can be wrapped in `{braces}`. `trustServerCertificate=true`
is useful only for local development with a self-signed certificate; production should use a
trusted certificate and reviewed encryption settings. The instance name and port remain entirely
local configuration.

The API fails at startup with a short configuration error when a required variable is missing. The
health endpoint handles an unreachable database without leaking its connection details.

## Commands

Run both packages together:

```powershell
npm run dev
```

Or run them separately in two terminals:

```powershell
npm run dev:server
npm run dev:client
```

Quality, build, and Prisma commands:

```powershell
npm run build
npm run test
npm run lint
npm run typecheck
npm run format:check
npm run prisma:generate
npm run prisma:seed
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
```

The initial migration `20260916122623_initial_schema` is applied to the local development database.
Its migration SQL contains the supplemental integrity rules. Do not use `db push` as a substitute
for migration history.

With the API running, request `GET http://localhost:3000/api/v1/health`. It returns `200` when the
API and database are available, or `503` with a safe `degraded` response when SQL Server cannot be
reached.

The core API provides read-only category and accessibility-feature catalogs, category-specific
feature definitions, and place search/detail. See [Core API](docs/core-api.md) and
[Place search API](docs/place-search-api.md).
Community read APIs return independent plain-text reviews and typed accessibility reports. Their
write routes remain deferred pending ownership and abuse-control design. See
[Community content API](docs/community-content-api.md).

The web app provides `/`, `/search`, and `/places/:placeId`. Search state is stored in the URL so it
can be refreshed, shared, and preserved during pagination. The category and Boolean accessibility
filter labels are loaded from the API rather than hard-coded in the client. Place Details provides
ordered media/fallback presentation, shared Boolean consensus, typed report evidence, and paginated
reviews without enabling unauthenticated writes.

Email/password authentication is available at `/login` and `/register`, with a private `/account`
read page and header logout. Set a randomly generated `AUTH_ACCESS_SECRET` in ignored `server/.env`
before starting the API; see the placeholder and defaults in `server/.env.example`.
The additive `20260920153159_authentication_sessions` migration is applied locally.
See [Authentication and security](docs/authentication.md) for token/session behavior, configuration,
CSRF/CORS protections, tests, and deployment limitations. Content writes remain unexposed.

## Security and privacy baseline

- External request data can be parsed through shared Zod validation middleware.
- Helmet supplies baseline HTTP security headers; CORS allows only the configured frontend origin.
- Request bodies are size-limited.
- Errors have stable public shapes and hide stack traces and internal details in production.
- Request IDs support operational tracing without identifying users.
- Structured logs redact authorization headers, cookies, passwords, tokens, and database URLs.
- Database access remains server-side and centralized through Prisma.
- Reusable authentication middleware supplies trusted identity; future resource ownership checks remain separate.
- Future private accessibility-profile information should use persistence and access rules separate
  from public profile data.

## Intentionally not implemented

Resource-specific authorization, mobility-profile APIs, catalog mutations, place/review/report
write endpoints, non-Boolean accessibility filters, relevance ranking, duplicate detection,
uploads, moderation, administration, personalization, matching, maps, caching, and the final
interface are intentionally absent. Their initial data structures and migration are defined where
applicable; only the documented initial product catalog configuration is seeded.
