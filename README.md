# SaaS Project Management Platform

Foundation for a multi-tenant project management platform built with React, Express, PostgreSQL, and Prisma.

## Workspace layout

- `apps/web` — React, TypeScript, Vite, and Tailwind CSS
- `apps/api` — Express, TypeScript, Prisma, Zod, and Vitest
- `packages/shared` — framework-neutral shared TypeScript types

## Local development

1. Copy `.env.example` to `.env` and `apps/api/.env.example` to `apps/api/.env`, then choose matching local-only database credentials in both files.
2. Start PostgreSQL with `docker compose up -d db`.
3. Apply migrations with `npm run prisma:migrate -- --name init`.
4. Start the API with `npm run dev:api`.
5. Start the web app with `npm run dev:web`.

The web app runs on port `5174`, the API on `3001`, and PostgreSQL is published on host port `5433`.
