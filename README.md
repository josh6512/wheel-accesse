# Wheel Accesses

Wheel Accesses is planned as a community-driven accessibility platform. This repository currently
contains only the technical foundation: a React web client and an independent Express REST API that
will later serve the web app, a React Native app, and an administration interface.

The initial database schema and the first core catalog/place APIs are implemented. Product UI is not
implemented yet. See [Database schema](docs/database-schema.md) for the data model and integrity
rules, and [Core API](docs/core-api.md) for the available endpoints and request/response shapes.

## Architecture

```text
React web client ─┐
React Native app ─┼─> Express REST API ─> Prisma ─> Microsoft SQL Server
Admin interface ──┘
```

The repository is an npm workspace with two independently buildable packages:

- `client/` — React, TypeScript, Vite, and React Router. It contains a minimal placeholder page and
  a small API client layer. It never connects to SQL Server directly.
- `server/` — Express and TypeScript, organized by domain module. It owns environment validation,
  HTTP security, CORS, structured logging, request validation, errors, Prisma, and the category,
  accessibility-feature, category-feature, place, and health API routes.
- `server/prisma/` — Initial Prisma models, migration history, and supplemental SQL Server
  constraints. The generated client is ignored and recreated locally; see the schema guide.

Future backend features should be added as cohesive folders under `server/src/modules/`. Each
module can own only the routes, controller, service, validation, and data access that it needs.
Categories, mobility types, accessibility attributes, and select options are modeled as configurable
database data. No product catalog data has been seeded.

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
feature definitions, and basic place listing/detail/creation. See [Core API](docs/core-api.md).

## Security and privacy baseline

- External request data can be parsed through shared Zod validation middleware.
- Helmet supplies baseline HTTP security headers; CORS allows only the configured frontend origin.
- Request bodies are size-limited.
- Errors have stable public shapes and hide stack traces and internal details in production.
- Request IDs support operational tracing without identifying users.
- Structured logs redact authorization headers, cookies, passwords, tokens, and database URLs.
- Database access remains server-side and centralized through Prisma.
- The modular backend leaves room for authentication and authorization at module boundaries.
- Future private accessibility-profile information should use persistence and access rules separate
  from public profile data.

## Intentionally not implemented

Authentication, authorization, user and mobility-profile APIs, catalog mutations, reviews,
accessibility reports/answers, advanced search and accessibility filters, duplicate detection,
uploads, moderation, administration, personalization, matching, maps, caching, and the final
interface are intentionally absent. Their initial data structures and migration are defined where
applicable, but no product data has been seeded.
