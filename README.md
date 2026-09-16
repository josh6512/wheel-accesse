# Wheel Accesses

Wheel Accesses is planned as a community-driven accessibility platform. This repository currently
contains only the technical foundation: a React web client and an independent Express REST API that
will later serve the web app, a React Native app, and an administration interface.

No product features or final database models are included at this stage.

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
  HTTP security, CORS, structured logging, request validation, errors, Prisma, and API routes.
- `server/prisma/` — Prisma schema and CLI configuration for SQL Server. It intentionally contains
  no domain models or migrations yet. The generated client is ignored and recreated locally.

Future backend features should be added as cohesive folders under `server/src/modules/`. Each
module can own only the routes, controller, service, validation, and data access that it needs.
Categories and accessibility attributes will eventually be configurable database data rather than
hard-coded into application logic.

## Technology and prerequisites

- Node.js 20.19 or newer and npm
- React, TypeScript, Vite, and React Router
- Node.js, Express, and TypeScript
- Prisma ORM with the Microsoft SQL Server provider
- Zod, Pino, Helmet, CORS, ESLint, and Prettier
- A locally reachable Microsoft SQL Server instance with TCP/IP connectivity enabled
- A development database and least-privilege SQL login that can access it

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

Set `DATABASE_URL` in `server/.env` using values for your machine:

```dotenv
DATABASE_URL="sqlserver://HOST:PORT;database=DATABASE_NAME;user=USERNAME;password=PASSWORD;encrypt=true;trustServerCertificate=true"
```

Replace `HOST`, `PORT`, `DATABASE_NAME`, `USERNAME`, and `PASSWORD`. SQL Server connection-string
values containing reserved characters can be wrapped in `{braces}`. `trustServerCertificate=true` is commonly useful for local development
with a self-signed certificate; production should use a trusted certificate and reviewed encryption
settings. Prisma's SQL Server connector uses SQL authentication in this URL format. The instance
name and port remain entirely local configuration.

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
npm run lint
npm run typecheck
npm run format:check
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
```

`npm run prisma:migrate:dev` is prepared for the next stage. Do not run it until reviewed Prisma
models have been added and the target development database is configured.

With the API running, request `GET http://localhost:3000/api/v1/health`. It returns `200` when the
API and database are available, or `503` with a safe `degraded` response when SQL Server cannot be
reached.

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

Authentication, user or mobility profiles, places, search, categories, accessibility attributes,
forms, reviews, comments, uploads, moderation, administration, personalization, matching, maps,
caching, and the final interface are intentionally absent. The Prisma schema contains no product
models and no database migration has been created.
