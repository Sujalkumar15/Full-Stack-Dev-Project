# Real-Time Collaborative Workspace (FS-02)

A full-stack, multi-tenant workspace for organizing hierarchical pages and editing rich-text documents with other users in real time. The application combines a Notion-style React interface with an Express API, PostgreSQL persistence, Prisma tenant-safe relations, TipTap editing, and Yjs CRDT synchronization over WebSockets.

## Highlights

- Email/password registration, login, logout, and current-user sessions
- Workspaces with `OWNER`, `ADMIN`, `MEMBER`, and `GUEST` roles
- Member directory and administrator controls for adding registered users, changing roles, and removing members
- Nested, orderable pages with archive, restore, delete, and workspace/restricted visibility
- Centralized page authorization with `READ`, `COMMENT`, `EDIT`, and `MANAGE` access levels
- TipTap rich-text editing with headings, paragraphs, bold, italic, underline, links, lists, blockquotes, code blocks, and Yjs-aware undo/redo
- Genuine Yjs collaboration through `y-websocket`, including reconnect behavior, presence, participant avatars, selections, and colored remote cursors
- Durable PostgreSQL storage for Yjs snapshots and incremental updates, with periodic compaction and document versions
- Responsive React workspace shell with loading, empty, error, and read-only states

## Architecture

This repository is an npm-workspaces monorepo:

```text
collaborative-workspace/
├── apps/
│   ├── api/                 # Express REST API, WebSocket server, Prisma
│   └── web/                 # React workspace and collaborative editor
├── packages/
│   └── shared/              # Shared Zod schemas and TypeScript contracts
├── compose.yaml             # Independent PostgreSQL 16 service
├── package.json
└── README.md
```

The API and WebSocket upgrade handler share one Node HTTP server on port `4001`. REST is responsible for authentication, workspace/page management, and issuing short-lived page-scoped collaboration tokens. The WebSocket layer authorizes the token and current database state before admitting a connection to a page room.

## Technology stack

| Layer           | Technologies                                                             |
| --------------- | ------------------------------------------------------------------------ |
| Web             | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query |
| Editor          | TipTap 3, Starter Kit, Collaboration, Collaboration Caret                |
| Real time       | Yjs, `y-websocket`, `y-protocols`, `ws`                                  |
| API             | Node.js, Express 5, TypeScript, Zod, Helmet, CORS, Pino                  |
| Authentication  | Argon2id, opaque session cookies, SHA-256 token hashes                   |
| Data            | PostgreSQL 16, Prisma ORM                                                |
| Testing/tooling | Vitest, Testing Library, Supertest, ESLint, Prettier                     |

## Local ports

| Service           | Address                                               |
| ----------------- | ----------------------------------------------------- |
| Web               | `http://localhost:5175`                               |
| API and WebSocket | `http://localhost:4001`                               |
| PostgreSQL        | `127.0.0.1:5434` on the host, `5432` in the container |

The Compose project, container, volume, and network have project-specific names and do not reuse another application's PostgreSQL resources.

## Prerequisites

- Node.js `22.12` or newer
- npm `10` or newer
- Docker with Docker Compose

## Environment configuration

The API's local environment file is **`apps/api/.env`**. It is ignored by Git. Create it from the committed placeholder template:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

On macOS or Linux:

```bash
cp apps/api/.env.example apps/api/.env
```

Required settings:

| Variable            | Purpose                                    | Local example                   |
| ------------------- | ------------------------------------------ | ------------------------------- |
| `NODE_ENV`          | Runtime mode                               | `development`                   |
| `PORT`              | API and WebSocket port                     | `4001`                          |
| `FRONTEND_ORIGIN`   | Exact allowed browser origin               | `http://localhost:5175`         |
| `COOKIE_SECRET`     | HMAC/cookie secret; at least 32 characters | Generate a private random value |
| `DATABASE_URL`      | Prisma PostgreSQL connection string        | Points to `localhost:5434`      |
| `POSTGRES_USER`     | Compose database user                      | `collaborative_workspace`       |
| `POSTGRES_PASSWORD` | Compose database password                  | Choose a private local value    |
| `POSTGRES_DB`       | Compose database name                      | `collaborative_workspace`       |

Do not commit `apps/api/.env`, reuse the placeholder secrets, or expose the database outside a trusted local environment. `compose.yaml` reads this exact file for PostgreSQL settings.

## Installation and local development

From this repository's root:

```bash
npm install
docker compose up -d postgres
npm run prisma:generate
npm exec --workspace @collaborative-workspace/api -- prisma migrate deploy
npm run dev
```

`npm run dev` first builds the shared package, then runs the shared package watcher, API, and web application together. Open `http://localhost:5175`.

Check the database container with:

```bash
docker compose ps
```

## Database migrations

The repository already contains these migrations:

- `20261118175541_initial_foundation`
- `20261119154500_add_yjs_update_hash`

On a fresh database, apply the existing migration history with:

```bash
npm exec --workspace @collaborative-workspace/api -- prisma migrate deploy
```

Do not create another “initial” migration. `deploy` applies committed, pending migrations without modifying migration history. The available root Prisma scripts are:

```bash
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run prisma migrate dev for intentional schema development
```

The core schema contains `User`, `Session`, `Workspace`, `WorkspaceMember`, `Page`, `PagePermission`, `YjsDocument`, `YjsUpdate`, `Comment`, and `DocumentVersion`. UUID identifiers, composite workspace relations, indexes, and unique constraints keep page, permission, collaboration, and membership records tied to the correct tenant. Comment storage exists in the schema, but a user-facing comment workflow is not currently implemented.

## Authentication and session security

- Passwords are hashed with Argon2id before database writes.
- Successful registration and login create a cryptographically random 32-byte opaque token.
- Only the token's SHA-256 hash is stored in PostgreSQL; the raw token is returned only as the session cookie.
- The `collaborative_workspace_session` cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/`, expires after 30 days, and is `Secure` in production.
- Logout deletes the matching session and closes its active collaboration connections.
- Expired or revoked sessions fail both REST and WebSocket authorization.
- Login attempts are rate limited, and authentication failures do not expose password hashes or session tokens.

## Workspace, member, and page authorization

All tenant-scoped operations derive the current user from the authenticated session. Client-supplied user IDs or roles are never used as authentication.

- Workspace creators become `OWNER` automatically.
- `OWNER` and `ADMIN` can rename a workspace and manage members.
- Only an owner can add or manage administrators; the owner cannot be demoted or removed through the member API.
- Administrators cannot manage other administrators.
- Members are added by the email of an existing registered account.
- Every page lookup includes its workspace ID, preventing cross-workspace parent links and record access.
- `WORKSPACE` pages are visible according to workspace role and inherited access; `RESTRICTED` pages require applicable access.
- Explicit page access levels are `READ`, `COMMENT`, `EDIT`, and `MANAGE`; access resolution is centralized and defaults to deny.
- Moving a page, changing visibility/order, archiving, restoring, deleting, or changing permissions requires `MANAGE`; ordinary title edits require `EDIT`.
- Permission or membership changes revalidate affected live WebSocket connections.

## REST API

All request bodies and route parameters are validated with shared Zod schemas. JSON errors use a structured error envelope and include a request ID.

### Health and authentication

| Method | Endpoint             | Purpose                                         |
| ------ | -------------------- | ----------------------------------------------- |
| `GET`  | `/api/health`        | Service health and request ID                   |
| `POST` | `/api/auth/register` | Create a user and session                       |
| `POST` | `/api/auth/login`    | Authenticate and create a session               |
| `POST` | `/api/auth/logout`   | Revoke the current session and clear the cookie |
| `GET`  | `/api/auth/me`       | Return the authenticated public user            |

### Workspaces and members

| Method   | Endpoint                                       | Purpose                                        |
| -------- | ---------------------------------------------- | ---------------------------------------------- |
| `POST`   | `/api/workspaces`                              | Create a workspace; current user becomes owner |
| `GET`    | `/api/workspaces`                              | List the current user's workspaces             |
| `GET`    | `/api/workspaces/:workspaceId`                 | Get an accessible workspace                    |
| `PATCH`  | `/api/workspaces/:workspaceId`                 | Rename a workspace                             |
| `GET`    | `/api/workspaces/:workspaceId/members`         | List members                                   |
| `POST`   | `/api/workspaces/:workspaceId/members`         | Add an existing user by email                  |
| `PATCH`  | `/api/workspaces/:workspaceId/members/:userId` | Change a member's role                         |
| `DELETE` | `/api/workspaces/:workspaceId/members/:userId` | Remove a member                                |

### Pages

All page routes are below `/api/workspaces/:workspaceId/pages`.

| Method   | Endpoint suffix                | Purpose                                               |
| -------- | ------------------------------ | ----------------------------------------------------- |
| `POST`   | `/`                            | Create a page                                         |
| `GET`    | `/`                            | List accessible pages; accepts `includeArchived=true` |
| `GET`    | `/:pageId`                     | Get an accessible page                                |
| `PATCH`  | `/:pageId`                     | Update title, parent, visibility, or sort order       |
| `POST`   | `/:pageId/archive`             | Archive the page subtree                              |
| `POST`   | `/:pageId/restore`             | Restore the page subtree                              |
| `DELETE` | `/:pageId`                     | Delete the page subtree                               |
| `PUT`    | `/:pageId/permissions/:userId` | Add or replace a page permission                      |
| `DELETE` | `/:pageId/permissions/:userId` | Remove a page permission                              |
| `POST`   | `/:pageId/collaboration-token` | Issue a short-lived token for the page room           |

The API uses cookie authentication, so browser requests must include credentials. In local development, Vite proxies `/api` to port `4001`.

## Real-time collaboration and persistence

Each page maps to one Yjs document and one authorized room. TipTap's Collaboration extension binds directly to that `Y.Doc`; there is no competing HTML state that can overwrite CRDT content. Starter Kit's built-in history is disabled so undo and redo use Yjs collaboration history.

The editor first requests a collaboration token from the page endpoint. The API verifies the session and current page access, then issues a signed, page-scoped token valid for five minutes. The client connects to:

```text
ws://localhost:4001/api/collaboration/:pageId?token=<short-lived-token>
```

The token is not the long-lived session credential. During the WebSocket upgrade the server verifies its signature, page, session, workspace membership, archive state, origin, and effective access. Identity and awareness data are server-derived. `READ` and `COMMENT` connections can receive document updates but cannot submit document changes; `EDIT` and `MANAGE` connections can edit. Connections are periodically revalidated and closed when access or the session is revoked.

Accepted binary Yjs updates are persisted before broadcast. A room loads its latest `YjsDocument` snapshot and then applies ordered `YjsUpdate` rows. Update hashes suppress duplicate pending updates. Per-room serialization plus a PostgreSQL advisory lock and serializable compaction transaction protect concurrent persistence. Compaction creates a new snapshot and `DocumentVersion`, advances the snapshot watermark, and only then removes covered incremental rows. Compaction runs after 100 updates, periodically, and when rooms shut down; application shutdown waits for room persistence to finish.

Yjs awareness drives online participants, avatars, selections, cursor labels, and join/leave updates. The server sanitizes awareness payloads so clients cannot impersonate another user.

## Commands

Run these from the repository root:

| Command                   | Purpose                                        |
| ------------------------- | ---------------------------------------------- |
| `npm run dev`             | Run shared, API, and web development processes |
| `npm run build`           | Build shared, API, then web                    |
| `npm run typecheck`       | Type-check all three workspaces                |
| `npm run test`            | Run all Vitest suites                          |
| `npm run lint`            | Lint the monorepo                              |
| `npm run format`          | Format supported files with Prettier           |
| `npm run format:check`    | Check formatting without writing               |
| `npm run prisma:generate` | Generate Prisma Client                         |
| `npm run prisma:migrate`  | Run Prisma Migrate in development mode         |

The test suites cover shared contracts, authentication and session revocation, workspace/member authorization, tenant isolation, page operations and permissions, collaboration authorization/persistence, primary web flows, and the member-management interface.

## Production notes

- Set `NODE_ENV=production`, use a high-entropy `COOKIE_SECRET`, and supply production-only database credentials through a secret manager.
- Serve the web app and API over HTTPS so production cookies and WebSockets are protected in transit.
- Set `FRONTEND_ORIGIN` to the exact deployed web origin and keep PostgreSQL on a private network.
- Run `prisma migrate deploy` as a controlled deployment step before starting the new API version.
- The current real-time hub is process-local. Multiple API instances would require a shared fan-out/room coordination layer; Redis is not part of the current implementation.
