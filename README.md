# 🦒 greyGiraffe

Coordinate lunch with your group at ETH and UZH mensas. ETH Zurich hackathon project.

**Start with the plans:** [`plans/0-overview.md`](plans/0-overview.md) (what and why), [`plans/2-architecture.md`](plans/2-architecture.md) (stack, schema, actions), [`plans/3-menu-import.md`](plans/3-menu-import.md) (where menus come from), [`plans/4-ui-flows.md`](plans/4-ui-flows.md) (every screen), [`plans/5-milestones.md`](plans/5-milestones.md) (who builds what, in which order).

## Stack

Next.js 15 (App Router, TypeScript, Server Actions) · Tailwind CSS v4 · Prisma 6 + PostgreSQL · Auth.js v5 (username + password) · Vercel (hosting + cron) · Vitest.

## Local setup

Requirements: Node 20+, Docker Desktop (for a local Postgres) **or** a Postgres/Neon URL.

```bash
git clone git@github.com:thestud1/greyGiraffe.git ~/dev/greyGiraffe   # clone outside iCloud/Dropbox folders
cd ~/dev/greyGiraffe
corepack enable            # gives you pnpm if you don't have it
pnpm bootstrap             # installs, .env, Postgres + Qdrant (docker compose), migrations, demo seed, this week's ETH menus, predictions
pnpm dev                   # http://localhost:3001 → log in as alice / password123 (also bob, carol)
```

`pnpm bootstrap` is safe to re-run. It uses `DATABASE_URL` from `.env` if that database answers; otherwise it starts a Docker container `greygiraffe-pg` on port 54329 and writes its URL into `.env`. To share one database across the team, paste a Neon URL into `DATABASE_URL` and `DIRECT_URL` before running it.

Load this week's real ETH menus (no server needed):

```bash
pnpm import:menus          # or: pnpm import:menus eth 2026-10-12
```
The same import runs on a schedule in production via `/api/import` (see `vercel.json`), and from the **Me** screen in development.

Demo date: `.env` contains `DEMO_DATE=2026-10-09` so the app shows Friday's real menus regardless of the real date. Remove the line for live use. Restart `pnpm dev` after changing it.

Checks before pushing: `pnpm typecheck && pnpm lint && pnpm test`.

Phone on the same Wi-Fi: add `AUTH_URL=http://<your-LAN-IP>:3001` to `.env`, restart `pnpm dev`, open that URL on the phone.

## Popularity prediction (demand estimate)

Every dish is embedded with a local sentence model (all-MiniLM-L6-v2 via transformers.js, no API key) and stored in **Qdrant**. For each dish of the day we fetch the 10 most similar dishes that people have actually voted on and average their scores → "Likely popular" / "Low demand" badges on Today and a demand term in the mensa load light.

```bash
docker compose up -d qdrant    # vector DB on :6333 (without it an in-memory fallback is used automatically)
pnpm popularity                # index voted dishes + predict the current week (≈10 s; first run downloads the ~25 MB model)
pnpm popularity explain <dishId>   # show the neighbours behind one prediction
```
The seed adds a synthetic vote history on the other days of the week so predictions work before real users exist. `pnpm import:menus` re-runs the prediction after importing (disable with `POPULARITY_ON_IMPORT=false` on serverless hosts; the app only reads predictions from Postgres).

## Dish photos

ETH serves 300–650 KB originals. `pnpm import:menus` (and `pnpm images:cache`) downloads each photo once, resizes it with sharp to a 192 px thumbnail and a 720 px card image (WebP, ~5–40 KB) and stores both in Postgres. `/api/img/<dishId>?s=thumb|medium` serves them with immutable cache headers; uncached dishes redirect to the original.

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
src/lib/popularity/*          embeddings (embed.ts), Qdrant store + fallback (store.ts), vote signal, predict/index
src/components/AvailabilityGrid.tsx   press-and-slide availability (multiple windows, erase by dragging over a selection)
src/app/(auth)/*              login, register
src/app/(app)/*               onboarding, today (drag-to-vote cards), plan (group + availability), groups, feedback, settings
src/app/api/import            cron/manual import endpoint (Bearer CRON_SECRET)
scripts/setup.sh, scripts/import.ts   one-command setup; import menus from the CLI
src/components/*              BottomNav, DishCard, SwipeDeck, FeedbackPrompt, forms/*
```

## Conventions

- Pages are server components; only forms, the swipe deck and nav are client components.
- A screen = `page.tsx` (loads data via `lib/queries`) + a form component in `components/forms` that calls a server action with `useActionState`.
- Slots are minutes after midnight (660–840, step 15) in the DB; format with `formatSlot()` only in the UI.
- Prices are `Decimal` in Prisma; convert to `number` (see `toDishDTO`) before passing to client components.
- Add a migration for every schema change: `pnpm db:migrate --name <what-changed>` and commit `prisma/migrations`.

## Run the whole app in Docker on your laptop (no Node needed)

```bash
git clone git@github.com:thestud1/greyGiraffe.git && cd greyGiraffe
./scripts/docker-up.sh
```
That is all: the script starts Docker Desktop if needed, writes `.env.docker` with laptop defaults (port 8080, demo mode, random secrets), builds the image, starts Postgres + Qdrant + the app + the scheduler, waits until the app answers and prints the URL. Open http://localhost:8080 and log in as `alice / password123`. `./scripts/docker-up.sh logs|down|reset` for logs, stop, or a fresh start.

## Deploy on a VM with Docker

One app image + Postgres + Qdrant + a scheduler, all in `docker-compose.prod.yml`. Needs Docker with the compose plugin on the VM (Ubuntu: `sudo apt install docker.io docker-compose-v2`, then add your user to the `docker` group).

```bash
git clone git@github.com:thestud1/greyGiraffe.git && cd greyGiraffe
cp .env.docker.example .env.docker
nano .env.docker            # AUTH_URL = the URL users will open (http://<vm-ip> or https://yourdomain), new secrets, POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.docker logs -f app   # first boot: migrations → menu import → demo seed → predictions (~1 min)
```

Then open `AUTH_URL` on a phone and log in as `alice / password123`. **`AUTH_URL` must be exactly the address people type** (scheme, host, port): the login cookie is bound to that host, so `http://192.168.1.20` in the browser with `AUTH_URL=http://localhost` silently fails to log in. The build takes a few minutes the first time (it also bakes the embedding model into the image, so the VM never downloads it at runtime).

What the containers do:

| Service | Role |
|---|---|
| `app` | Next.js on port 3000 (mapped to `APP_PORT`, default 80). On start: `prisma migrate deploy`, then if `IMPORT_ON_START` the ETH menu import + photo cache, if `SEED_DEMO` the demo data, then predictions. Health check on `/api/health`. |
| `postgres` | data, in the `pgdata` volume |
| `qdrant` | vectors for the popularity prediction, in the `qdrant` volume (the app falls back to in-memory search if it is down) |
| `scheduler` | calls `/api/import` at `IMPORT_TIMES` (UTC, Mon–Fri) so menus stay fresh |

Day-to-day on the VM:

```bash
C=(docker compose -f docker-compose.prod.yml --env-file .env.docker)
"${C[@]}" ps                                   # status
"${C[@]}" logs -f app                          # logs
"${C[@]}" exec app pnpm demo:reset            # reset the demo (decisions + feedback) and re-seed
"${C[@]}" exec app pnpm import:menus          # import menus now (photos + predictions included)
git pull && "${C[@]}" up -d --build            # deploy a new version (migrations run automatically)
"${C[@]}" down                                 # stop (data stays in the volumes); add -v to wipe
```

After the demo, set `SEED_DEMO=false`, `IMPORT_ON_START=false` and clear `DEMO_DATE` in `.env.docker`, then `up -d` again. For HTTPS put Caddy or nginx in front of `APP_PORT` and set `AUTH_URL` to the https URL; phones can install the app to the home screen only over HTTPS.

## Deploy (Vercel + Neon) – alternative

1. Create a Neon project; set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) in Vercel.
2. Set `AUTH_SECRET`, `AUTH_TRUST_HOST=true`, `CRON_SECRET`, optionally `ADMIN_USERNAMES=alice,bob`.
3. From your machine: `pnpm db:deploy && pnpm db:seed` against the Neon URL.
4. Deploy. `vercel.json` schedules `/api/import` on weekday mornings.

## Note on this checkout

If your clone lives in iCloud Drive (as the original one does), `node_modules` will sync to iCloud and slow things down. Clone to a normal folder such as `~/dev/greyGiraffe` for development.
