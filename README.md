# SaaS Project Management (FS-04)

A full-stack, multi-tenant project and issue tracking application. It gives teams an isolated workspace, project catalog, issue workflow, and interactive Kanban board while enforcing authorization and tenant boundaries in the API and database—not only in the user interface.

## Objectives and features

- Register, log in, log out, and restore the authenticated user
- Create an initial workspace during registration and switch between accessible workspaces
- List workspace members and their roles
- Create, view, update, and delete projects
- Create, view, update, assign, prioritize, and delete issues
- Move issues between `TODO`, `IN_PROGRESS`, and `DONE` columns using drag and drop
- Generate stable issue identifiers such as `PROJ-12` with a transactional per-project counter
- Enforce active workspace membership and `OWNER`, `ADMIN`, `MEMBER`, or `VIEWER` role permissions
- Prevent cross-workspace project, issue, assignee, and sprint references
- Present responsive authentication, workspace, project, issue, and Kanban views with loading, empty, and error states

The Prisma schema also provides a migration path for sprints, comments, and activity logs. Those models are not advertised as complete user-facing workflows in the current application.

## Architecture

The repository is an npm-workspaces monorepo:

```text
saas-project-management/
├── apps/
│   ├── api/                 # Express REST API, authentication, Prisma
│   └── web/                 # React application and Kanban interface
├── packages/
│   └── shared/              # Framework-neutral shared TypeScript types
├── docker-compose.yml       # Independent PostgreSQL 16 service
├── package.json
└── README.md
```

The browser calls the JSON API with credentials. Express authenticates the signed cookie, loads the user, and resolves active workspace membership before tenant-scoped handlers run. Service queries retain the workspace ID when addressing projects and issues. Prisma composite keys and relations provide a second tenant-safety boundary in PostgreSQL.

## Technology stack

| Layer          | Technologies                                                               |
| -------------- | -------------------------------------------------------------------------- |
| Web            | React 19, TypeScript, Vite, Tailwind CSS 4, React Router                   |
| Kanban         | `@dnd-kit/core`, `@dnd-kit/utilities`                                      |
| API            | Node.js, Express 5, TypeScript, Zod, CORS, cookie-parser                   |
| Authentication | bcrypt, JSON Web Tokens (`HS256`), HttpOnly cookies, Express rate limiting |
| Data           | PostgreSQL 16, Prisma ORM                                                  |
| Testing        | Vitest, Supertest                                                          |

## Local ports

| Service    | Address                                               |
| ---------- | ----------------------------------------------------- |
| Web        | `http://localhost:5174`                               |
| API        | `http://localhost:3001`                               |
| PostgreSQL | `localhost:5433` on the host, `5432` in the container |

The Compose service uses the project-specific `saas-pm-postgres` container and `saas-pm-postgres-data` volume.

## Prerequisites

- Node.js `22` or newer
- npm `10` or newer
- Docker with Docker Compose

## Environment configuration

Create local files from the committed examples:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

On macOS or Linux, use `cp` instead of `Copy-Item`. Keep all `.env` files private and make the database settings in the root and API files agree.

### Root `.env`

`docker-compose.yml` reads the root file. Its supported variables are:

| Variable               | Purpose                                    | Local default/example           |
| ---------------------- | ------------------------------------------ | ------------------------------- |
| `POSTGRES_DB`          | Database name                              | `saas_project_management`       |
| `POSTGRES_USER`        | Database user                              | `saas_user`                     |
| `POSTGRES_PASSWORD`    | Database password                          | Choose a private local value    |
| `POSTGRES_HOST_PORT`   | Published PostgreSQL port                  | `5433`                          |
| `DATABASE_URL`         | Matching Prisma connection string          | Points to `localhost:5433`      |
| `PORT`                 | API port                                   | `3001`                          |
| `NODE_ENV`             | Runtime mode                               | `development`                   |
| `WEB_ORIGIN`           | Exact allowed web origin                   | `http://localhost:5174`         |
| `JWT_SECRET`           | JWT signing secret, at least 32 characters | Generate a private random value |
| `JWT_EXPIRES_IN_HOURS` | Cookie and token lifetime                  | `168`                           |

The API reads the corresponding application settings from `apps/api/.env`. The web app reads `VITE_API_URL` from `apps/web/.env`; the example points to `http://localhost:3001/api`.

Never commit real passwords or signing keys. The example files contain placeholders only and must be replaced for any non-throwaway environment.

## Installation and local development

From the repository root:

```bash
npm install
docker compose up -d db
npm run prisma:generate
npm exec --workspace @saas/api -- prisma migrate deploy
```

Run the API and web application in separate terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open `http://localhost:5174`. The API health endpoint is available at `http://localhost:3001/api/health`.

Inspect PostgreSQL health without changing its data:

```bash
docker compose ps
```

## Database migrations and Prisma

The repository already contains this migration history:

- `20261118124330_init`
- `20261118153833_auth_multitenancy`
- `20261118161811_add_project_issue_counter`
- `20261118163500_backfill_project_issue_counter`

For a fresh installation, apply those existing migrations with:

```bash
npm exec --workspace @saas/api -- prisma migrate deploy
```

Do not create a new initial migration. `prisma migrate deploy` applies the committed history without generating or editing migrations. Root Prisma commands are:

```bash
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run prisma migrate dev for deliberate schema development
npm run prisma:studio    # Open Prisma Studio
```

The primary models are `User`, `Workspace`, `Membership`, `Project`, `Issue`, `Sprint`, `Comment`, and `ActivityLog`. Workspace-scoped unique and composite relations protect project keys, issue numbers, assignees, and related records from crossing tenant boundaries.

## Authentication

Registration accepts a display name, email, password, and initial workspace name. Passwords are hashed with bcrypt using 12 rounds before the short transaction that atomically creates the user, workspace, and owner membership.

Successful registration or login returns a signed JWT in the `saas_session` cookie. The cookie is `HttpOnly`, `SameSite=Lax`, scoped to `/`, expires with `JWT_EXPIRES_IN_HOURS`, and is `Secure` in production. JWT verification allows only `HS256` and checks the configured issuer and audience. Registration is limited to five attempts per hour per client and login to ten attempts per 15 minutes.

Logout clears the cookie. JWT authentication is stateless, so logout does not maintain a server-side token revocation list; use an appropriately short lifetime and rotate `JWT_SECRET` if all existing tokens must be invalidated.

## API endpoints

Responses use JSON. Protected routes authenticate from the cookie; browser calls must include credentials.

### Health and authentication

| Method | Endpoint             | Access               | Purpose                                                |
| ------ | -------------------- | -------------------- | ------------------------------------------------------ |
| `GET`  | `/api/health`        | Public               | Service health                                         |
| `POST` | `/api/auth/register` | Public, rate limited | Create a user, initial workspace, and owner membership |
| `POST` | `/api/auth/login`    | Public, rate limited | Authenticate and set the cookie                        |
| `POST` | `/api/auth/logout`   | Public               | Clear the authentication cookie                        |
| `GET`  | `/api/auth/me`       | Authenticated        | Return the current public user                         |

### Workspaces

| Method | Endpoint                               | Access           | Purpose                                        |
| ------ | -------------------------------------- | ---------------- | ---------------------------------------------- |
| `GET`  | `/api/workspaces`                      | Authenticated    | List active workspace memberships              |
| `GET`  | `/api/workspaces/:workspaceId`         | Workspace member | Get workspace details                          |
| `GET`  | `/api/workspaces/:workspaceId/members` | Workspace member | List active members for assignment and display |

The current API creates the initial workspace during registration. It does not expose separate create, rename, invite, or member-role mutation routes.

### Projects

All project routes begin with `/api/workspaces/:workspaceId/projects`.

| Method   | Endpoint suffix | Access            | Purpose                          |
| -------- | --------------- | ----------------- | -------------------------------- |
| `POST`   | `/`             | `OWNER`, `ADMIN`  | Create a project                 |
| `GET`    | `/`             | Any active member | List workspace projects          |
| `GET`    | `/:projectId`   | Any active member | Get a tenant-scoped project      |
| `PATCH`  | `/:projectId`   | `OWNER`, `ADMIN`  | Update name, key, or description |
| `DELETE` | `/:projectId`   | `OWNER`, `ADMIN`  | Delete a project                 |

### Issues

Issue routes begin with `/api/workspaces/:workspaceId/projects/:projectId/issues`.

| Method   | Endpoint suffix | Access                     | Purpose                              |
| -------- | --------------- | -------------------------- | ------------------------------------ |
| `POST`   | `/`             | `OWNER`, `ADMIN`, `MEMBER` | Create an issue                      |
| `GET`    | `/`             | Any active member          | List project issues                  |
| `GET`    | `/:issueId`     | Any active member          | Get an issue                         |
| `PATCH`  | `/:issueId`     | `OWNER`, `ADMIN`, `MEMBER` | Update issue fields or Kanban status |
| `DELETE` | `/:issueId`     | `OWNER`, `ADMIN`           | Delete an issue                      |

Issue input supports title, description, `TODO`/`IN_PROGRESS`/`DONE` status, `LOW`/`MEDIUM`/`HIGH`/`URGENT` priority, an optional workspace assignee membership, and an optional sprint belonging to the same project.

## Multi-tenancy and authorization

- Every tenant-scoped route loads the authenticated user's active membership from PostgreSQL.
- Missing membership is reported as not found, limiting cross-tenant resource discovery.
- Roles come from the membership record; query strings and request bodies cannot elevate access.
- `VIEWER` is read-only. `MEMBER` can create and update issues. `ADMIN` and `OWNER` additionally manage projects and delete issues.
- Project and issue reads/writes retain the workspace ID in service queries.
- Assignees must be active members of the same workspace, and sprint references must belong to the same workspace and project.
- Issue numbers are assigned in a transaction by incrementing the parent project's counter.
- Zod rejects malformed parameters and payloads before controller logic.

## Testing and build commands

Run commands from the repository root:

| Command                   | Purpose                               |
| ------------------------- | ------------------------------------- |
| `npm run build`           | Build every workspace                 |
| `npm run build:web`       | Type-check and build the Vite web app |
| `npm run build:api`       | Compile the Express API               |
| `npm test`                | Run each workspace's available tests  |
| `npm run prisma:generate` | Generate Prisma Client                |

The API Vitest suite covers health, registration/login/logout, cookie behavior, role enforcement, workspace isolation, and tenant-safe project/issue CRUD. Supertest drives the HTTP integration tests.

## Security considerations

- Use a unique, high-entropy `JWT_SECRET` in every deployed environment and never expose it through `VITE_*` variables.
- Terminate TLS in production so secure cookies and API traffic are encrypted.
- Set `WEB_ORIGIN` to the exact deployed web origin; CORS is configured for credentials.
- Keep PostgreSQL private, use a dedicated database/user, and back up the named volume before destructive maintenance.
- Apply migrations with `prisma migrate deploy` during deployment rather than generating migrations on the server.
- Return only selected public user fields; password hashes are never serialized by authentication responses.
- Rate limiting is process-local by default. A shared store is required if authentication traffic is distributed across multiple API instances.
