---
name: testing-platform-apps
description: How to run and browser-test the internal platform app modules (directory, access requests, feature flags) in the cognition-take-home Next.js + Prisma repo.
---

# Testing platform app modules locally

## Bring the stack up
```bash
npm install
npm run setup     # docker compose postgres + prisma migrate deploy + generate + seed
npm run dev       # http://localhost:3000
```
`npm run setup` is idempotent-ish; if `psql` says a table does not exist, re-run `npm run db:migrate && npm run seed`.
The container is named `cognition-take-home-db-1`.

## Logging in
`ENABLE_DEV_CREDENTIALS=true` in `.env` renders the dev credentials form at `/login`.
Seeded users (password `password` for all):
- `admin@example.com` — role `admin` (permission wildcard)
- `platform-admin@example.com` — role `platform_admin`
- `reviewer@example.com` — role `reviewer`
- `staff@example.com` — role `staff` (read-only for most apps)

The login form's hint text does not list every seeded user; check `prisma/seed.ts` for the full list.
After sign-in everyone lands on `/apps/directory`. Sign out is a link in the left sidebar that goes to
`/api/auth/signout` and needs a second confirm click.

## Inspecting data directly
Prisma models are `@@map`ped to snake_case tables but keep camelCase columns, so quote them:
```bash
docker exec cognition-take-home-db-1 psql -U platform -d platform -x \
  -c 'select at, "actorEmail", action, before, after from audit_log order by at desc limit 5;'
docker exec cognition-take-home-db-1 psql -U platform -d platform \
  -c 'select id, key, environment, enabled from feature_flag;'
```
Running `npm test` seeds extra "Test flag" / `probe-*@example.com` rows into the same dev database, so the
UI lists may contain test noise — filter by `environment=production` for a clean, stable set.

## RBAC gating in the UI
`src/platform/ui/DetailPanel.tsx` hides its `approval` action button when `can(actor, permission)` is false, and
app views additionally hide sections (e.g. the feature-flags change history is gated on `feature_flags.toggle`).
To prove gating, open the *same* detail URL as two different users and compare.

## Known styling pitfall: invisible action buttons
`tailwind.config.ts` `content` globs only cover `./src/app`, `./src/pages`, `./src/components` — **not**
`./src/apps` or `./src/platform`. Any utility class used only in those directories is never generated. Today this
makes the `DetailPanel` approval button (`bg-emerald-600 text-white`) render as white text on a transparent
background, i.e. effectively invisible, and `grid-cols-[10rem_1fr]` field layouts collapse to a single column.
If a button seems missing from a screenshot, verify before concluding it is permission-gated:
- select all text (`ctrl+a`) — the invisible label highlights and becomes readable;
- or check `getComputedStyle(btn).backgroundColor` in the console and click its `getBoundingClientRect()` position.
Adding `"./src/apps/**/*.{ts,tsx}"` and `"./src/platform/**/*.{ts,tsx}"` to the Tailwind `content` array is the
likely fix.

## Coordinate math for computer-use clicks
The browser viewport is 1600px wide while screenshots are scaled to 1024px: multiply page coordinates from
`getBoundingClientRect()` by 0.64 and add the ~55px browser chrome offset for the y axis.
