# greyGiraffe – Project Overview (ETH Zurich Hackathon)

> This document is the single source of truth for what we are building. It is written so that a coding agent can read it once and understand the goal, the domain, the user flow, the data involved, where the data comes from, and which decisions have been made. All product decisions are settled (see section 9); minor details an agent may decide itself are listed at the end of section 10.

## 1. One-paragraph summary

greyGiraffe is a web app that helps university students in Zurich coordinate lunch breaks. ETH and UZH have many canteens ("mensas"), each publishing a daily menu. Today students check menus individually and coordinate over chat. greyGiraffe shows each user the menus of the mensas they care about, lets them react to dishes with a swipe interface, lets them pick a group and a time slot, shows what their friends chose, and collects feedback after the meal (queue length, dish rating). The long-term value is the dataset: which dishes people like, how busy each mensa is at which time, and how groups actually decide.

## 2. Domain vocabulary

| Term | Meaning |
|---|---|
| **Mensa** | A university canteen (e.g. "Mensa Polyterrasse", "UZH Zentrum Lower Mensa"). Each mensa may serve lunch and/or dinner. ETH mensas are identified by a numeric `facility-id` in the ETH API; UZH mensas by a `location/kitchen` slug pair on food2050. |
| **Menu / dish** | One item offered by a mensa on one day for one meal time (name, description, price, image, vegetarian/vegan flags, allergens, nutrition values). |
| **Meal time** | Breakfast, lunch or dinner. We focus on **lunch**. |
| **Time slot** | The time a user wants to *start* lunch, in 15-minute steps (11:00, 11:15, …, 14:00). |
| **Group** | A set of users who want to eat together (friends, study group, lab). A user can be in several groups. |
| **Swipe / vote** | A user's reaction to a dish for today. Right = "I want to eat this today". See section 4, step 5. |
| **Post-meal feedback** | Data a user submits after eating: queue length observed and a personal rating of the dish. |

## 3. Users and the problem

- **Primary user:** a student at ETH or UZH who eats lunch on campus most days and usually eats with the same few people.
- **Pain:** menus live on different websites per mensa; deciding "where and when" happens in group chats every day; nobody knows how long the queue will be.
- **Goal of the app:** make the daily decision take under a minute and collect structured data while doing so.

## 4. Core user flow (the "essential pipeline")

The flow below is the MVP. Every step should work end to end before any polish is added.

1. **Account creation and mensa selection.**
   A user signs up with **username and password** (no email verification, no OAuth) and selects the mensas they are interested in. This selection filters everything the user sees later. The reference bot models the same thing as "favourite restaurants" plus dietary preferences (vegetarian, vegan, show allergies, show full nutrition).

2. **Groups.**
   A user can create a group and **invite other users by username**. The invited user sees a pending invite and accepts or declines. A group has a name and members.

3. **Daily menu view.**
   Every day the user opens the web app and sees today's menus for their selected mensas, presented like an inbox: one entry per dish, easy to scan. Data per dish: mensa, dish name, description, student price, image, vegetarian/vegan flags, allergen icons, optionally nutrition values.

4. **Pick group and time slot.**
   The user chooses which group they want to eat with today and the 15-minute slot at which they want to start lunch (11:00–14:00). Both are stored as today's "plan" for that user.

5. **Swipe on dishes.**
   The user swipes through today's dishes. **Right = "I want to eat this today"**, left = "not today". A double swipe is a stronger signal (double right = "definitely this one", double left = "definitely not"). Store the raw signal: `{user, dish, date, value ∈ {-2, -1, +1, +2}}`. A right swipe on a dish implicitly expresses interest in that dish's mensa; the group view (step 6) aggregates swipes per mensa.

6. **Group overview and sync.**
   The user sees what the other members of the chosen group did today: which dishes they swiped right on, which mensa that implies, and which time slot they picked. Convergence is **manual**: the app shows a clear summary (per member: right-swiped dishes grouped by mensa, chosen slot) and members adjust their own plan until they agree. No automatic proposal in the MVP; a computed suggestion is a stretch goal.

7. **Post-meal feedback.**
   After the planned time slot, the user is prompted: how many people were queueing (bucketed estimate, e.g. none / <10 / 10–30 / >30) and how they rate the dish they ate (e.g. 1–5). We want to collect as much structured data as reasonably possible here, since this is the dataset that makes the project interesting beyond the hackathon.

## 5. Where menu data comes from (verified 2026-10-10)

We do not need to invent a scraper. The open-source ETH D-INFK Discord bot (<https://github.com/BattleRush/ETH-DINFK-Bot>, C#/.NET, MariaDB) already solves menu ingestion for ETH and UZH. `plans/1-Food_Discord_Bot.md` is a copy of its `ETHDINFKBot/Modules/FoodModule.cs` (the Discord-facing rendering code). The ingestion logic lives in `ETHDINFKBot/Helpers/FoodHelper.cs` and runs from a cron job (`FoodFetchJob`, every 30 min during 05–11 and 15–16 UTC) that calls `FoodHelper.LoadMenus()`. For every restaurant row in its DB it dispatches on `ScraperTypeId`:

### 5a. ETH mensas – official JSON API (preferred, no scraping)

ETH runs a public, unauthenticated JSON API ("cookpit"). Both endpoints returned HTTP 200 with real data on 2026-10-10.

- **Facility list:** `GET https://idapps.ethz.ch/cookpit-pub-services/v1/facilities?client-id=ethz-wcms&lang=en&rs-first=0&rs-size=50`
  Returns `facility-array[]` with `facility-id`, `facility-name`, `facility-url`, `caterer-name`, `publication-type-code` (1 = publishes menus, 2 = no menus, e.g. kiosks/cafés), opening and payment info.
- **Weekly menus:** `GET https://idapps.ethz.ch/cookpit-pub-services/v1/weeklyrotas?client-id=ethz-wcms&lang=en&rs-first=0&rs-size=50&valid-after=YYYY-MM-DD`
  Returns `weekly-rota-array[]`; each entry has `facility-id`, `valid-from`, `valid-to`, and `day-of-week-array[]` → `opening-hour-array[]` → `meal-time-array[]` (`name` = Lunch/Dinner, `time-from`, `time-to`) → `line-array[]` → `meal`. Several rotas can exist per facility (overlapping validity ranges); pick the one covering the requested date. Use `lang=de` for German.
- **One `meal` object contains:** `name`, `description` (ingredients separated by `|`), `image-url` (append `?client-id=ethz-wcms`), `meal-price-array[]` with `customer-group-desc` ∈ {students, internal, external} and `price` (CHF), `meal-class-array[]` (`desc-short` ∈ Meat / Vegetarian / Vegan / …), `allergen-array[]` (`desc-short` is the 1–14 allergen code, `desc` the English name), `meat-type-array[]`, and optional `energy`, `proteins`, `fat`, `carbohydrates`, `sugar`, `salt` (often null).
- **Important:** JSON keys are kebab-case (`facility-id`), not the camelCase shown in the bot's C# classes.
- **Facilities that publish menus today** (`publication-type-code` = 1):
  Zentrum: 3 Clausiusbar, 5 Dozentenfoyer, 7 food&lab, 8 Archimedes, 9 Mensa Polyterrasse, 10 Polysnack, 11 Tannenbar.
  Hönggerberg: 14 Alumni quattro Lounge, 16 Mendokoro, 19 food market, 20 FUSION meal, 22 Rice Up!.
  Oerlikon: 23 Octavo. Basel: 27 Science Lounge, 28 Flavour Kitchen.
  (The bot's seed SQL uses older ids; trust the live facility endpoint.)

### 5b. UZH mensas – food2050 (scraper in the bot is broken; see 3-menu-import.md §4)

UZH canteens are run by ZFV and publish only on <https://app.food2050.ch>. The bot scraped a `__NEXT_DATA__` JSON blob from `/de/v2/zfv/{location}/{kitchen}/menu/weekly` and then per-dish `_next/data/{buildId}/….json` files. Checked on 2026-10-10: those URLs now redirect to `/de/zfv/...`, the site uses the Next.js App Router, the HTML contains no menu data, and menus are loaded client-side through a same-origin GraphQL endpoint `POST https://app.food2050.ch/api/v2/graphql` (Apollo, introspection disabled). The old GraphQL host `api.app.food2050.ch` used by the bot's CO₂ ticker returns 404.

What still applies from the bot: the slugs (`uzh-zentrum` / `untere-mensa`, menu slugs `mittag` / `abend`), the per-dish fields (name, category, isVegan, isVegetarian, imageUrl, allergens with `externalId`, prices by category "Studierende", nutrition stats), and the allergen mapping. `3-menu-import.md` §4 gives a time-boxed procedure (capture the GraphQL request in browser DevTools, replay from Node) and the seed fallback.

### 5c. Legacy / not used

- `https://www.mensa.uzh.ch/de/menueplaene/{mensa}/{weekday}.html` HTML scraping (`GetUzhMenus`) – commented out in the bot, superseded by food2050.
- SV-Restaurant website scraping (`HandleSVRestaurantMenu`) – disabled in the bot; ETH moved to the cookpit API.

### 5d. What else to reuse from the bot

- **Schema** (`ETHBot.DataLayer/Data/ETH/Food/*.cs`): `Restaurant` (name, location enum, offers lunch/dinner, internal names = facility id or food2050 slugs, scraper type), `Menu` (name, description, date, is-vegetarian/vegan/gluten-free/lactose-free/balanced/local, price as `Amount`, calories, protein, fat, carbs, salt, sugar, weight, image URLs), `Allergy` (14 rows, EN + DE names: gluten, crustacean, eggs, fish, peanuts, soya, milk, nuts, celery, mustard, sesame, sulphite, lupines, mollusc), `MenuAllergy` (m:n), `MenuUserSetting` (vegetarian/vegan filter, show nutrition, show allergies), `DiscordUserFavouriteRestaurant` (user ↔ mensa), `RestaurantOpeningTime`.
- **Default mensas** when a user has no preferences: Polyterrasse, UZH Zentrum Lower Mensa, UZH Zentrum Upper Mensa for lunch.
- **Not reusable:** the C# runtime, SkiaSharp image rendering, Discord permission checks, and the `SqlModule` (a Discord command that lets server members run read-only SQL against the bot's database; irrelevant to us).

### 5e. Recommendation for the hackathon

Implement a small importer in our own stack: pull the ETH `facilities` + `weeklyrotas` endpoints first (clean, reliable, covers all ETH mensas), store into our `Mensa` / `Dish` tables, run it on a schedule. **Goal is both ETH and UZH**: after ETH works, spend at most 60 minutes capturing the food2050 GraphQL query (3-menu-import.md §4); if that fails, seed UZH dishes for the demo. Hard-code the allergen table from the bot's `RestaurantBaseSetup.sql`.

## 6. Data we want to end up with

Minimum entities (names are suggestions):

- `User` – id, display name, auth identity, dietary preferences (vegetarian, vegan, allergens to avoid).
- `Mensa` – id, name, campus/location, offers lunch/dinner, source (`eth:<facility-id>` or `food2050:<location>/<kitchen>`).
- `UserMensa` – which mensas a user follows.
- `Group`, `GroupMember` – groups and membership, plus pending invites.
- `Dish` – one menu item on one date at one mensa, meal time, with the fields from section 5a; `Allergen` and `DishAllergen` (codes 1–14).
- `Swipe` – user, dish, date, value (-2..+2), timestamp.
- `Plan` – user, date, group, time slot, optionally chosen mensa.
- `Feedback` – user, date, dish or mensa, queue bucket, rating, free text, timestamp.

## 7. Constraints and assumptions

- **Hackathon scope:** a working demo of the full seven-step flow beats a polished subset. Prefer boring, well-known tools.
- **Web app, phone first.** Swiping happens on a phone, so every screen must work at ~400px width. Deploy to a public URL early so the team can open it on their phones. No native app.
- **Tech stack:** decided, see section 10.
- **Menu data:** ETH via the official API (section 5a) first, UZH via food2050 (5b) second. Both are wanted.
- **Be polite to upstream services:** cache API responses (menus change at most daily), rate-limit food2050 requests, identify ourselves with a User-Agent.
- **Language:** UI in English. Dish names from ETH/UZH are available in English (`lang=en`) for ETH, German-only for UZH; keep them as-is.
- **Privacy:** store only what the flow needs; feedback should be attributable to a user for the dataset but not shown to other users with names attached unless they are in the same group.

## 8. Definition of done for the MVP

1. Today's ETH dishes are imported from the cookpit API into our database by a scheduled or on-demand job.
2. A new user can sign up, pick mensas, and create or join a group.
3. Today's dishes for the selected mensas are displayed.
4. The user can pick a group and a time slot, and swipe on each dish; swipes persist.
5. The group view shows every member's swipes and time slot for today.
6. After the time slot a feedback prompt appears and its answers persist.
7. All of the above works on a phone-sized screen.

## 9. Decisions log

| # | Question | Decision (2026-10-10) |
|---|---|---|
| 1 | Auth | Username + password. Passwords hashed (bcrypt/argon2). No email, no OAuth. |
| 2 | Group invites | Invite by username; invitee accepts a pending invite. |
| 3 | Time slot | Start-of-lunch time in 15-minute steps, 11:00–14:00. |
| 4 | Swipe meaning | Right = "I want to eat this today". Double swipe = stronger version of the same. |
| 5 | Group convergence | Manual. App only summarises; members adjust their own plan. |
| 6 | UZH in MVP | Yes, best case both ETH and UZH. ETH importer first, UZH second, seed as fallback. |
| 7 | Tech stack | Next.js full-stack, see section 10. |
| 8 | Weekday areas (2026-10-10) | Onboarding asks per weekday whether the user is at Zentrum (HG + UZH Zentrum) or Hönggerberg. Today/Swipe only propose mensas in that day's area. Editable under Me. |
| 9 | Time selection (2026-10-10) | Replaces single slots: a Doodle-style grid where the user presses and slides to mark an availability window (11:00–14:00, 15-min rows) and sees how many group members are free per row. |
| 10 | Commit (2026-10-10) | When every member has a window and at least one row is free for all, any member can commit "mensa + time". The decision shows as a banner on Today and on the group page; it can be changed. |
| 11 | Mensa load (2026-10-10) | Traffic light per mensa on Today. Dummy model (stable pseudo-random baseline + committed groups) until queue feedback is used. |
| 13 | Multiple windows (2026-10-10) | Availability is a set of 15-min start slots, not one window: 11:00–12:00 and 13:00–14:00 is valid. Painting adds, dragging over a selection erases. |
| 14 | Popularity prediction (2026-10-10) | Local sentence embeddings (all-MiniLM-L6-v2) + Qdrant (in-memory fallback). A dish's demand = similarity-weighted mean vote score of its 10 nearest voted dishes. Shown as badges and fed into the load light. Bootstrapped with synthetic history until real votes exist. |
| 15 | No separate swipe screen (2026-10-10) | Voting happens on the Today overview: drag a card right = want it, left = skip (further = double), plus thumb buttons. Tabs: Today · Plan (time + group) · Group · Me. |
| 16 | Vote instead of commit (2026-10-10) | Members tap one of a few generated options (mensa + start time). The vote closes by itself at a majority or 45 min before the earliest proposed time (live clock), or when a member ends it; the winner becomes the decision exactly like a commit. Reopening clears the votes. |
| 12 | Demo date (2026-10-10) | `DEMO_DATE` env pins the app's calendar date (set to Friday 2026-10-09 for the demo) so real ETH menus show. |

## 10. Tech stack

Chosen for a small team, a short timeline, and phone-first use.

- **Framework:** Next.js (App Router, TypeScript). One repo for UI, API routes and the importer. Server Actions or Route Handlers for mutations.
- **Styling:** Tailwind CSS. Mobile-first layout; the swipe deck uses touch gestures (e.g. `framer-motion` drag or `react-swipeable`).
- **Database:** PostgreSQL via Prisma. Use a hosted free tier (Neon or Supabase) so local dev, Vercel and phones all hit the same database. Avoid SQLite: it does not work on serverless hosting.
- **Auth:** Auth.js (NextAuth) Credentials provider with bcrypt-hashed passwords, or a minimal custom session cookie. Keep it to a single login form.
- **Menu import:** a Route Handler `/api/import` that fetches the ETH cookpit API (and later food2050) and upserts `Mensa` / `Dish` rows. Triggered by Vercel Cron each morning and callable manually for the demo.
- **Hosting:** Vercel. Gives a public HTTPS URL for phones from day one; add a web app manifest so it can be installed to the home screen.
- **Repo layout (suggestion):** `app/` routes (`/login`, `/onboarding`, `/today`, `/swipe`, `/group/[id]`, `/feedback`), `lib/importers/eth.ts`, `lib/importers/food2050.ts`, `prisma/schema.prisma`, `prisma/seed.ts` (allergens, fallback UZH dishes).

Minor details an agent may decide and document: exact UI library, session implementation, cron time, how feedback prompts are triggered (poll on page load vs. push).

---

<details>
<summary>Original note (kept verbatim)</summary>

Hackathon ETHZ

Idea: We want to create an app that lets students coordinate their lunch breaks, we have multiple mensas that students can chose from.

The essential pipeline looks like this:
1)User has to create an account, select the mensas they are interested in.
2)The users then can create groups or join groups they are invited to.
3)Every day a user goes on the web app and like E-mails they see the menus.
4)They chose the group they want to eat with and the time slot they want to go eat.
5)They can swipe left and right, right if they enjoy it, left if they don't and double left double right. (we can use 1-Food_Discord_Bot)
6)They get an overview of what the others in their team did and can sync on when and where they want to go eat.
7)After collecting the food, users should be prompted on how many people were queueing how they personally rank the food, we want to gather as much information as possible

</details>
