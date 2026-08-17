---
name: testing-platform-apps
description: How to run and browser-test the internal platform app modules (directory, feature flags, KYC review) in the cognition-take-home Next.js + Prisma repo.
---

# Testing platform app modules locally

## The app modules
- `/apps/directory` — user directory with PII gating and access requests (`directory.read`).
- `/apps/feature-flags` — flag list, `/apps/feature-flags/<id>` detail, toggle (`feature_flags.toggle`).
- `/apps/kyc-review` — case queue with an open case selected by `?caseId=`, approve/reject (`kyc_review.decide`).

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
- `compliance@example.com` — role `compliance_reviewer` (the only role that sees KYC PII and can approve/reject)
- `reviewer@example.com` — role `reviewer`
- `staff@example.com` — role `staff` (read-only for most apps)

The login form's hint text does not list every seeded user; check `prisma/seed.ts` and `prisma/seeds/` for the full list.
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

## Styling pitfall: buttons that look missing
`tailwind.config.ts` `content` must glob `./src/apps` and `./src/platform`; a class used only there is otherwise
never generated, which once made the `DetailPanel` approval button (`bg-emerald-600 text-white`) render as white
text on a transparent background. Before concluding a button is permission-gated:
- select all text (`ctrl+a`) — an invisible label highlights and becomes readable;
- or check `getComputedStyle(btn).backgroundColor` in the console and click its `getBoundingClientRect()` position.

## Coordinate math for computer-use clicks
The browser viewport is 1600px wide while screenshots are scaled to 1024px: multiply page coordinates from
`getBoundingClientRect()` by 0.64 and add the ~55px browser chrome offset for the y axis.
