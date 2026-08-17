# Platform layer (modular monolith)

Next.js App Router monolith that hosts many small internal apps. The platform
owns auth, RBAC, audit, PII gating, nav and data access; app modules only
declare what they need.

## Run it

```bash
npm install
npm run setup        # docker compose postgres + migrate + generate + seed
npm run dev          # http://localhost:3000
npm test             # requires the database from `npm run db:up`
```

Seeded users (local dev credentials provider, password `password`):
`admin@example.com`, `reviewer@example.com`, `staff@example.com`.

## Guarantees

**Every write is audited.** `src/platform/data` exports `db` (reads) and
`mutate()` (writes). The Prisma client is module private and extended so that
any write operation outside a `mutate()` scope throws `AuditBypassError`; raw
SQL helpers throw `RawQueryBlockedError`. `mutate()` writes the mutation and its
audit record (actor, action, resource, before, after, timestamp) in a single
transaction, so a write cannot exist without its audit record — if the audit
insert fails, the write rolls back. Audit rows cannot be forged by app code, and
`audit_log` is append only at the database level via triggers, so even a direct
`psql` connection cannot rewrite history. `tests/no-prisma-import.test.ts` fails
the build if any module other than the data layer imports `@prisma/client`.

**Before/after snapshots are automatic, never opt-in.** `mutate()` hands the
callback a snapshotting transaction client: every write reads its target rows
with full (unredacted) visibility inside the same transaction, before and after
the mutation, and those states become the audit record's `before`/`after`
(deletes record `after: null`). A write the layer cannot snapshot — an
`updateMany`/`deleteMany` with no `where`, a `createMany` (its result is only a
count, so the created rows are unidentifiable; use `createManyAndReturn`), or a
write issued on some other client — throws (`SnapshotUnavailableError`,
`UnsnapshottedWriteError`) instead
of logging a partial record, and a `mutate()` that writes nothing throws
`EmptyMutationError`.

**RBAC has one enforcement point.** Roles live in `src/platform/rbac/roles.ts`.
`can()` / `authorize()` are the only deciders; pages and server actions call
`requirePermission()`. Apps declare permissions in their manifest and never
decide.

**PII gating is server side.** Manifests declare `piiFields: { field:
permission }`. The data layer drops those columns from the query itself
(`omit` / pruned `select`) for actors without the permission and strips them
defensively from relation payloads, so the bytes never leave the server. UI
hiding (`<Can>`) is convenience only.

## Layout

```
src/platform/data      audited data access layer (db, mutate, PII gating)
src/platform/rbac      roles config + single enforcement point
src/platform/auth      Auth.js: generic OIDC + local dev credentials
src/platform/manifest  app manifest zod schema + registry (nav, PII policy)
src/platform/ui        NavShell, DataTable, SchemaForm, DetailPanel, Can
src/apps/<key>         app modules (manifest, view, actions)
src/app/apps/<key>     thin route files
scripts/new-app.ts     scaffolding CLI
```

## New app

```bash
npm run new:app -- inspections --label "Inspections"
```

Creates the manifest, view, actions and route, regenerates the app registry, and
the app appears in the nav for any role holding `inspections.read` (grant it in
`src/platform/rbac/roles.ts`).

## Auth

`ENABLE_DEV_CREDENTIALS=true` enables the local dev provider. Setting
`OIDC_ISSUER`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` enables a standards
only OIDC provider against any IdP; disable dev credentials in production. Users
arriving from the IdP are provisioned through `mutate()`, so provisioning is
audited too.
