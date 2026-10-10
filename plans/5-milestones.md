# 5 – Build plan and milestones

> Read `0-overview.md` first, then `2-architecture.md`, `3-menu-import.md`, `4-ui-flows.md`. This file orders the work so that a demo exists early and improves every few hours. Each milestone ends in something you can open on a phone.

## Team split (3–4 people or agents in parallel)

| Track | Owns | Files |
|---|---|---|
| **A – Platform** | repo setup, Prisma schema + migrations, Auth.js, layout + bottom nav, Vercel + Neon, env | `prisma/`, `lib/auth.ts`, `lib/db.ts`, `app/(auth)`, `app/(app)/layout.tsx`, `vercel.json` |
| **B – Data** | ETH importer, seed (allergens, demo data), `/api/import`, cron, later UZH importer | `lib/importers/*`, `prisma/seed.ts`, `app/api/import` |
| **C – Core UI** | onboarding, today, swipe deck, plan | `app/(app)/onboarding`, `today`, `swipe`, `plan`, `components/SwipeDeck`, `DishCard`, `SlotPicker` |
| **D – Social** | groups, invites, group summary, feedback prompt + form, settings | `app/(app)/groups/*`, `feedback`, `settings`, `lib/queries/group.ts`, `components/GroupSummary`, `FeedbackPrompt` |

Tracks C and D can start against the Prisma schema immediately; until B lands, run `prisma db seed` which inserts a fake day of dishes.

## Milestone 0 – Skeleton deployed (target: hour 2)

- [ ] `create-next-app`, Tailwind, Prisma, Auth.js installed; `.env.example` filled.
- [ ] `schema.prisma` from `2-architecture.md` migrated to Neon.
- [ ] Register + login work; `/today` shows "no menus yet"; bottom nav renders.
- [ ] Deployed to Vercel; everyone can open it on their phone.
- [ ] Seed inserts the 14 allergens, 2 ETH + 2 UZH mensas, and ~15 fake dishes for today.

## Milestone 1 – Real menus (target: hour 5)

- [ ] ETH importer passes a fixture test and runs via `/api/import?source=eth`.
- [ ] Mensas appear in onboarding grouped by campus; `/today` lists real dishes with prices, images, allergens.
- [ ] Vercel Cron configured.
- [ ] UZH: decision point. If the GraphQL request for the weekly menu has been captured and replays from Node, implement `food2050.ts`; otherwise keep seeded UZH dishes and move on.

## Milestone 2 – Swipe + plan (target: hour 8)

- [ ] Swipe deck with gestures and buttons; swipes persist; undo works.
- [ ] End-of-deck summary.
- [ ] Plan screen: group + 15-minute slot saved.
- [ ] Today shows the plan chip and swipe indicators.

## Milestone 3 – Groups (target: hour 12)

- [ ] Create group, invite by username, accept/decline.
- [ ] Group screen with "Where / When" summary and per-member rows.
- [ ] Two phones, two users, one group: the demo path steps 1–4 work end to end.

## Milestone 4 – Feedback + dataset (target: hour 16)

- [ ] Feedback prompt appears 45 min after the slot (plus dev override).
- [ ] Feedback form saves; reopening shows the saved values.
- [ ] A minimal `/stats` page or SQL snippet showing counts of swipes and feedback per mensa, for the pitch.

## Milestone 5 – Polish (remaining time)

- Loading and empty states, optimistic swipes, allergen warnings in red, web app manifest + icon so the app can be added to the home screen.
- Second cron run mid-morning; import error reporting on the settings dev panel.
- Stretch: computed suggestion on the group screen ("Best match: Polyterrasse at 12:15"), weekly view, UZH importer if skipped.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| food2050 (UZH) has no stable API; the Discord bot's scraper is already broken (checked 2026-10-10). | Treat UZH as stretch. Seed UZH dishes for the demo. Time-box the investigation to 60 min. |
| ETH API shape differs between facilities (some have no lines or nutrition). | Mapping function tolerates missing arrays; fixture includes a facility with empty days. |
| Time zone bugs ("today" off by one in the evening). | All date logic through `lib/time.ts` with `Europe/Zurich`; test around 23:30. |
| Auth.js v5 config friction on Vercel. | Set `AUTH_TRUST_HOST=true`; use JWT sessions; keep a single Credentials provider. |
| Serverless DB connection limits. | Use the pooled Neon URL at runtime; Prisma singleton. |
| Too few users for a convincing group demo. | Seed 3 demo users already in a group with swipes and plans for today. |

## Definition of "demo ready"

The six steps of the demo path in `4-ui-flows.md` section 9 run on two real phones against the Vercel deployment with today's real ETH menus, without touching a terminal.
