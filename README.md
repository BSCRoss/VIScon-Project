# 🦒 greyGiraffe

Coordinate lunch with your group at ETH and UZH mensas. ETH Zurich hackathon project.

**Start with the plans:** [`plans/0-overview.md`](plans/0-overview.md) (what and why), [`plans/2-architecture.md`](plans/2-architecture.md) (stack, schema, actions), [`plans/3-menu-import.md`](plans/3-menu-import.md) (where menus come from), [`plans/4-ui-flows.md`](plans/4-ui-flows.md) (every screen), [`plans/5-milestones.md`](plans/5-milestones.md) (who builds what, in which order).

## Stack

Next.js 15 (App Router, TypeScript, Server Actions) · Tailwind CSS v4 · Prisma 6 + PostgreSQL · Auth.js v5 (username + password) · Vercel (hosting + cron) · Vitest.

## Local setup (10 minutes)

```bash
pnpm install                       # also runs prisma generate
cp .env.example .env               # Prisma reads .env; Next reads .env too
# edit .env: DATABASE_URL / DIRECT_URL (local Postgres or a Neon branch), AUTH_SECRET (npx auth secret), CRON_SECRET
pnpm db:migrate                    # creates tables (prisma migrate dev)
pnpm db:seed                       # allergens, 4 mensas, fake UZH dishes for today, users alice/bob/carol (password123), group "Hackathon"
pnpm dev                           # http://localhost:3001 (port 3001 to avoid clashing with other dev servers) → log in as alice
```

Load real ETH menus for the current week:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3001/api/import?source=eth"
```
or press **Run menu import now** under *Me* (shown in development, or for `ADMIN_USERNAMES` in production).

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test` (time helpers + ETH importer mapping against a saved API fixture).

## Where things live

```
prisma/schema.prisma          data model (spec: plans/2-architecture.md §4)
prisma/seed.ts                idempotent seed
src/auth.ts, src/auth.config.ts, src/middleware.ts   Auth.js; everything except /login, /register, /api/import|health is protected
src/lib/db.ts                 Prisma client singleton
src/lib/time.ts               Europe/Zurich dates, 15-minute slots – never use `new Date()` for calendar logic elsewhere
src/lib/session.ts            requireUser() / requireOnboardedUser()
src/lib/actions/*             server actions (write side), one file per domain, all return ActionResult
src/lib/queries/*             read helpers used by pages
src/lib/importers/*           ETH importer (done), food2050/UZH (stub – see plans/3-menu-import.md §4), upsert
src/app/(auth)/*              login, register
src/app/(app)/*               onboarding, today, swipe, plan, groups, feedback, settings
src/app/api/import            cron/manual import endpoint (Bearer CRON_SECRET)
src/components/*              BottomNav, DishCard, SwipeDeck, FeedbackPrompt, forms/*
```

## Conventions

- Pages are server components; only forms, the swipe deck and nav are client components.
- A screen = `page.tsx` (loads data via `lib/queries`) + a form component in `components/forms` that calls a server action with `useActionState`.
- Slots are minutes after midnight (660–840, step 15) in the DB; format with `formatSlot()` only in the UI.
- Prices are `Decimal` in Prisma; convert to `number` (see `toDishDTO`) before passing to client components.
- Add a migration for every schema change: `pnpm db:migrate --name <what-changed>` and commit `prisma/migrations`.

## Deploy (Vercel + Neon)

1. Create a Neon project; set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) in Vercel.
2. Set `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `CRON_SECRET`, optionally `ADMIN_USERNAMES=alice,bob`.
3. From your machine: `pnpm db:deploy && pnpm db:seed` against the Neon URL.
4. Deploy. `vercel.json` schedules `/api/import` on weekday mornings.

## Note on this checkout

If your clone lives in iCloud Drive (as the original one does), `node_modules` will sync to iCloud and slow things down. Clone to a normal folder such as `~/dev/greyGiraffe` for development.
