# Collaborative Workspace

Project 2 is an independent npm-workspaces monorepo for a real-time collaborative workspace.

## Applications

- `apps/web`: React, TypeScript, Vite, Tailwind CSS
- `apps/api`: Express, TypeScript, Prisma, PostgreSQL
- `packages/shared`: shared Zod contracts and TypeScript types

## Local ports

- Web: `http://localhost:5175`
- API: `http://localhost:4001`
- PostgreSQL: `localhost:5434`

Copy each `.env.example` to `.env`, start PostgreSQL with `docker compose up -d postgres`,
generate Prisma Client, and run the migration before starting the applications.
