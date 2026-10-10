# 6 – Status and plan to win

> Written on 2026-10-10 after the foundation and the first feature round. Read `0-overview.md` for the product, this file for *what is left and in which order*. Milestone numbers refer to `5-milestones.md`.

## 1. Where we stand

Everything in the seven-step pipeline works end to end on a phone, against real ETH menus, with three seeded demo users:

| Area | State |
|---|---|
| Auth, onboarding (weekday areas, mensas, diet, allergens) | done |
| Today overview with area filter, load traffic light (dummy model), inline like/dislike | done |
| Swipe deck with drag, double votes, undo, early exit | done |
| Doodle-style availability grid with group overlap | done |
| Group page: where/when summary, consensus, **commit**, agreed banner | done |
| Feedback prompt + form (queue, wait, rating, would-again) | done |
| ETH menu import (API, tested, cron-ready) | done |
| Demo date switch, seed, one-command bootstrap, browser test (`pnpm e2e`) | done |
| **Deployment to a public URL** | packaged (Dockerfile + docker-compose.prod.yml, tested locally); **still needs a VM and a URL** |
| UZH menus (food2050) | stub + seeded fakes |
| Load indicator fed by real data | partly: predicted demand (embeddings + Qdrant) + commits; queue feedback still unused |
| Popularity prediction ("likely popular" badges, `pnpm popularity`) | done, bootstrapped with synthetic votes |
| Multiple availability windows per day | done |
| Stats / "the dataset" page for the pitch | not done |
| Live refresh of the group page | not done (reload only) |
| PWA icon / install prompt | not done |

## 2. What wins a hackathon (and what does not)

Judges reward: a live demo that works on *their* phone, a crisp problem statement, a visible "why only we can do this" (data), and a believable next step. They do not reward feature count. So the plan below is: **deploy first, make the demo bullet-proof, then add exactly the things that make the story land.**

The story in one line: *"greyGiraffe turns the daily 'where and when do we eat' chat into one minute of swiping, and every lunch teaches it how busy each mensa will be."*

## 3. Priorities

### P0 – without these we cannot demo (do today)

1. **Deploy** (Track A, 30 min). The stack is packaged: on any VM with Docker, `cp .env.docker.example .env.docker`, set `AUTH_URL` + secrets, `docker compose -f docker-compose.prod.yml --env-file .env.docker up -d --build` (README → Deploy on a VM). First boot imports menus, seeds the demo and builds predictions by itself. Open the URL on two phones; put it in a QR code slide. Vercel + Neon remains the fallback (README).
2. **Demo rehearsal** (everyone, 30 min, twice). Script in `4-ui-flows.md` §9. Three phones (alice, bob, carol), each person knows their steps. Time it: under 3 minutes.
3. **Seed polish** (Track B, 30 min). Make sure the demo date's data tells the story: 3 users, overlap at 12:15, Polyterrasse leading, one group *not yet* committed so we can press Commit live. Reset script: `pnpm db:seed` is idempotent; add `pnpm demo:reset` that deletes the Hackathon group's decision and feedback.

### P1 – makes the story land (tomorrow morning)

4. **Stats page `/stats`** (Track D, 2 h). The "dataset" slide, live from the DB: swipes per dish (top liked today), feedback count, average queue by mensa and slot, load heatmap (mensa × slot). Simple tables and a small bar chart; no auth needed beyond login. This is the single most persuasive screen for judges: it shows we *collect* something nobody else has.
5. **Load from feedback** (Track B, 1 h). `lib/load.ts` already combines predicted demand + commits; add the average queue bucket from past `Feedback` per mensa and weekday. Pitch line: "it learns from every lunch". Show `pnpm popularity explain <id>` output on a slide: the neighbours behind a prediction are a great 20-second story.
6. **Group page live refresh** (Track C, 30 min). `router.refresh()` every 15 s on the group page and the plan grid so two phones on stage update without manual reload. Stretch: a small "Bob just set 12:15" toast.
7. **UZH import** (Track B, time-box 90 min). Follow `3-menu-import.md` §4: capture the food2050 GraphQL request in DevTools, replay from Node. If it works, both universities are real; if not, the seeded UZH dishes stay and we say "UZH integration in progress" honestly.

### P2 – polish that judges notice (afternoon)

8. **Install to home screen**: proper icon set (`public/icons/*.png`, 192/512), `apple-touch-icon`, splash color. Open the app from the home screen during the demo, not from Safari's address bar.
9. **Empty and loading states** on every screen (skeletons on Today and Group), a friendly 404.
10. **Onboarding defaults**: preselect the two most popular mensas of the chosen area so the first run takes 10 seconds.
11. **Invite flow**: show pending invites as a badge (done) and a toast on the group page when someone accepts.
12. **Copy pass**: every screen has one sentence that explains the next action; no developer wording.

### P3 – only if everything above is done

- Push notification (web push) "everyone is in, commit?" to the group owner.
- Weekly view of menus.
- Computed suggestion that *proposes* the commit automatically when the overlap is unique.
- Dish images for UZH via food2050 image URLs.

## 4. Pitch outline (5 minutes)

1. **Problem** (30 s): show a real group chat screenshot: "where / when?" 14 messages, no decision.
2. **Demo** (2.5 min, live on phones, QR for the jury): Alice opens Today → load lights → quick-likes two dishes → sets 11:45–13:00 → Bob sets his window on a second phone → group page shows overlap → Commit → both phones show "Agreed: Polyterrasse 12:15" → feedback prompt → stats page shows the data growing.
3. **Why it matters** (1 min): the dataset. Every lunch produces structured demand (likes), timing (windows), and ground truth (queue, rating). ETH gastronomy has none of this today. Show `/stats`.
4. **What's next** (30 s): mensa load prediction, UZH, opening to ETH gastronomy as a partner.
5. **Ask** (30 s): pilot with one department after the hackathon.

## 5. Team allocation for the next 24 hours

| Track | Person | Today | Tomorrow |
|---|---|---|---|
| A – Platform | | Deploy, QR, phone install, rehearsal lead | PWA icons, 404/loading states |
| B – Data | | Seed polish, `demo:reset`, real load model | UZH import time-box, stats queries |
| C – Core UI | | Live refresh, copy pass on Today/Swipe/Plan | Onboarding defaults, skeletons |
| D – Social + pitch | | `/stats` page, pitch deck draft | Rehearsals, slides, backup video of the demo |

Rule for the last 12 hours: no schema changes, no new dependencies, every change goes through `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` before push, and the deployed URL is re-tested on a phone after each deploy.

## 6. Risks and backups

| Risk | Backup |
|---|---|
| Venue Wi-Fi blocks the API or is slow | Phones on mobile data; menus are already in the DB; record a 60 s screen video as a fallback. |
| ETH API down on demo day | Menus imported the day before stay in the DB; `DEMO_DATE` keeps the demo on a date with data. |
| A phone's session breaks | Seeded accounts; log in takes 10 s; keep passwords on a card. |
| Commit pressed too early in rehearsal | `pnpm demo:reset` clears the decision and feedback. |
| Jury asks "what about UZH?" | Either real (P1-7) or an honest "in progress, seeded for the demo". |
