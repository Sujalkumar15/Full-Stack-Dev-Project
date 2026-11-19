# Full-Stack Development Projects

This submission contains two independent full-stack applications. Each project has its own source tree, npm workspace configuration, environment files, PostgreSQL database, Docker resources, migration history, ports, and Git repository. Run commands from the selected project's directory; this index is navigation and comparison documentation, not a shared monorepo.

## Project navigation

| ID    | Project                 | Objective                                                                                                  | Documentation                                                 |
| ----- | ----------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| FS-04 | SaaS Project Management | Provide tenant-isolated project planning, issue tracking, and an interactive Kanban workflow               | [Open the FS-04 README](../saas-project-management/README.md) |
| FS-02 | Collaborative Workspace | Provide hierarchical workspaces and genuine multi-user rich-text editing with durable CRDT synchronization | [Open the FS-02 README](../collaborative-workspace/README.md) |

The projects remain in their existing sibling directories and have not been moved or copied:

```text
Projects/
├── Full-Stack-Development-Projects/
│   └── README.md                         # This submission index
├── saas-project-management/
│   └── README.md                         # FS-04 documentation
└── collaborative-workspace/
    └── README.md                         # FS-02 documentation
```

## FS-04 — SaaS Project Management

FS-04 is a multi-tenant project and issue tracking application. Registration provisions a user, initial workspace, and owner membership atomically. Active database memberships control access to tenant-scoped project and issue APIs.

### Key features

- Email/password authentication with bcrypt and a signed JWT in an HttpOnly cookie
- Workspace selection, member visibility, role-based authorization, and tenant isolation
- Project creation, editing, listing, and deletion
- Issue creation, assignment, priority, status updates, and deletion
- Drag-and-drop Kanban board for `TODO`, `IN_PROGRESS`, and `DONE`
- Transactional, per-project issue identifiers
- Zod request validation and integration tests for authentication, roles, and cross-workspace access

### Architecture summary

- `apps/web`: React, TypeScript, Vite, Tailwind CSS, React Router, dnd-kit
- `apps/api`: Express, TypeScript, Zod, Prisma, JWT authentication
- `packages/shared`: shared TypeScript definitions
- PostgreSQL 16 through an independent Docker Compose service

| Service    | Local port |
| ---------- | ---------- |
| Web        | `5174`     |
| API        | `3001`     |
| PostgreSQL | `5433`     |

## FS-02 — Collaborative Workspace

FS-02 is a collaborative knowledge workspace with hierarchical pages and genuine multi-user editing. TipTap binds directly to a Yjs document, WebSockets synchronize authorized page rooms, and PostgreSQL persists binary snapshots plus incremental updates so content survives server restarts.

### Key features

- Argon2id authentication with opaque sessions; only session-token hashes are stored
- Workspace creation, renaming, selection, and member administration
- `OWNER`, `ADMIN`, `MEMBER`, and `GUEST` roles
- Hierarchical pages, ordering, archive/restore/delete, and restricted visibility
- `READ`, `COMMENT`, `EDIT`, and `MANAGE` page access with inherited permission resolution
- TipTap rich-text editing with collaboration-aware undo/redo
- Yjs and `y-websocket` synchronization over the existing API HTTP server
- Presence, participant avatars, live selections, and colored remote cursors
- PostgreSQL snapshots, ordered incremental updates, duplicate suppression, and safe compaction

### Architecture summary

- `apps/web`: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, TipTap, Yjs
- `apps/api`: Express, TypeScript, Zod, Prisma, `ws`, Yjs protocols, Pino, Helmet
- `packages/shared`: shared Zod contracts and TypeScript types
- PostgreSQL 16 through a separate Docker Compose service

| Service           | Local port |
| ----------------- | ---------- |
| Web               | `5175`     |
| API and WebSocket | `4001`     |
| PostgreSQL        | `5434`     |

## Shared prerequisites

- Node.js 22 (FS-02 requires `22.12` or newer)
- npm 10 or newer
- Docker with Docker Compose
- Available local ports listed above

Both projects use npm workspaces and PostgreSQL 16, but they intentionally use different ports, database credentials, Compose resources, named volumes, and migration histories.

## Getting started

Choose one application, change into its directory, and follow its README. The relative links below work from this index:

- [FS-04 setup and reference](../saas-project-management/README.md)
- [FS-02 setup and reference](../collaborative-workspace/README.md)

Do not run application commands from `Full-Stack-Development-Projects`. It contains only this combined submission guide.

For either project, the general sequence is:

1. Install dependencies with `npm install` in that project's root.
2. Copy only that project's committed `.env.example` files to their documented local `.env` locations.
3. Replace placeholders with private, project-specific local values.
4. Start that project's PostgreSQL Compose service.
5. Generate Prisma Client.
6. Apply the project's **existing** migrations with `prisma migrate deploy` as documented in its README.
7. Start the project's development processes.

Do not create a new initial migration on a fresh installation. Each application already includes its own committed migration history.

## Independence and data isolation

These are separate applications, not packages in one runtime:

- Do not share `.env` files, database URLs, secrets, containers, volumes, or Prisma migrations.
- Run scripts only from the corresponding project directory.
- Starting, stopping, migrating, or testing one project should target only that project's resources.
- Each project can be run independently; neither is a dependency of the other.
