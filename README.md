# InvoiceReconciliationPlatform

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/getting-started/tutorials/angular-monorepo-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve web
```

To create a production bundle:

```sh
npx nx build web
```

To see all available targets to run for a project, run:

```sh
npx nx show project web
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Shared contracts

The API and web app can import shared DTOs, types, and constants from `libs/shared`:

```ts
import type { CreateInvoiceDto, Money } from '@invoice-reconciliation-platform/shared';
```

Money fields use integer cents, and invoice lines carry their own configurable VAT rate in basis points. These exports are compile-time contracts; validate untrusted input at the API boundary. Tenant identity should come from the authenticated request context, not create DTOs.

## Prisma and PostgreSQL

The API uses Prisma ORM 7 with the PostgreSQL driver adapter. Copy `.env.example` to `.env`, set `DATABASE_URL`, and replace `AUTH_ACCESS_TOKEN_SECRET` with a fresh random secret before starting the API. Generate one with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Users are global identities; tenant-specific roles and access live in `Membership`. Self-service registration creates a tenant and its initial owner membership. Passwords use Argon2id, a memory-hard algorithm that raises the cost of large-scale offline guessing. `AuditLog` records tenant-scoped events and rejects updates, deletes, and truncation at the database level. Refresh tokens are opaque, rotated, and stored only as SHA-256 hashes; the raw refresh token is sent in an HttpOnly, SameSite=Lax cookie. Access tokens are short-lived JWTs. The tenancy migration preserves existing user roles by moving them into memberships and enables forced RLS on `Membership` and `AuditLog`. Tenant-scoped operations on those tables use `PrismaService.withTenant(tenantId, callback)`; membership discovery before tenant selection uses a transaction-local user context. Production must use a database role that cannot bypass RLS. If a database already has duplicate email addresses across tenants, resolve them before applying the tenancy migration; it fails explicitly rather than merging accounts. Existing accounts created before authentication have no password hash and need an explicit password-reset/onboarding flow before they can log in.

```powershell
Copy-Item .env.example .env
# Set DATABASE_URL and AUTH_ACCESS_TOKEN_SECRET in .env.
npm run db:validate
npm run db:generate
npm run db:migrate
npx nx test api
npx nx lint api
npx nx build api
npx nx serve api
```

`db:migrate` creates/applies migrations against the configured database. The generated Prisma Client is checked in under `apps/api/src/generated/prisma` so clean Nx builds do not depend on running generation first; regenerate it after changing `prisma/schema.prisma`.

Authentication endpoints are under `/api/auth`: `POST register`, `POST login`, `POST refresh`, `POST logout`, `POST tenant`, and `GET me`. Login can accept a `tenantId`; otherwise, it selects the user's first membership. Registration requires `email`, a 12-character-minimum `password`, `displayName`, and `organizationName`. Logout revokes the current refresh session. Login and tenant selection return an access token and membership summaries; the refresh token is never included in the JSON body.

Protect routes with `JwtAuthGuard`; it verifies the JWT and rechecks the active membership and role against PostgreSQL. Add `RolesGuard` and `@Roles(...)` for role restrictions, and use `@CurrentUser()` for the authenticated principal. Never trust a client-supplied tenant ID without checking membership, never store plaintext refresh tokens, and do not rely on frontend route guards for authorization. Rate limiting, email verification, password reset, and account recovery remain production follow-ups.

The Angular shell uses `AuthService` for in-memory session state, `AuthApiService` for typed auth endpoints, and `ApiClient` as the reusable typed HTTP wrapper for feature services. On protected browser routes it attempts cookie-based session restoration; access tokens are not stored in local storage. The HTTP interceptor adds bearer tokens to same-origin `/api/` requests and retries a protected API request once after refreshing a 401. The tenant selector asks the API to switch the active tenant before updating local state. During development, the Angular server proxies `/api` to the Nest API at `http://localhost:3000`; production must route `/api` to the API on the same origin (or explicitly configure CORS and credentials).

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/angular:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/angular:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Set up CI!

### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/getting-started/tutorials/angular-monorepo-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
