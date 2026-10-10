# greyGiraffe – Project Overview (ETH Zurich Hackathon)

> This document is the single source of truth for what we are building. It is written so that a coding agent can read it once and understand the goal, the domain, the user flow, the data involved, where the data comes from, and what is still undecided. Items marked **OPEN** are decisions not yet made; do not silently pick one, surface them.

## 1. One-paragraph summary

greyGiraffe is a web app that helps university students in Zurich coordinate lunch breaks. ETH and UZH have many canteens ("mensas"), each publishing a daily menu. Today students check menus individually and coordinate over chat. greyGiraffe shows each user the menus of the mensas they care about, lets them react to dishes with a swipe interface, lets them pick a group and a time slot, shows what their friends chose, and collects feedback after the meal (queue length, dish rating). The long-term value is the dataset: which dishes people like, how busy each mensa is at which time, and how groups actually decide.

## 2. Domain vocabulary

| Term | Meaning |
|---|---|
| **Mensa** | A university canteen (e.g. "Mensa Polyterrasse", "UZH Zentrum Lower Mensa"). Each mensa may serve lunch and/or dinner. ETH mensas are identified by a numeric `facility-id` in the ETH API; UZH mensas by a `location/kitchen` slug pair on food2050. |
| **Menu / dish** | One item offered by a mensa on one day for one meal time (name, description, price, image, vegetarian/vegan flags, allergens, nutrition values). |
| **Meal time** | Breakfast, lunch or dinner. We focus on **lunch**. |
| **Time slot** | A concrete time a group plans to eat, e.g. 12:15. Granularity is **OPEN** (suggest 15 min). |
| **Group** | A set of users who want to eat together (friends, study group, lab). A user can be in several groups. |
| **Swipe / vote** | A user's reaction to a dish for today. See section 4, step 5 for the semantics. |
| **Post-meal feedback** | Data a user submits after eating: queue length observed and a personal rating of the dish. |

## 3. Users and the problem

- **Primary user:** a student at ETH or UZH who eats lunch on campus most days and usually eats with the same few people.
- **Pain:** menus live on different websites per mensa; deciding "where and when" happens in group chats every day; nobody knows how long the queue will be.
- **Goal of the app:** make the daily decision take under a minute and collect structured data while doing so.

## 4. Core user flow (the "essential pipeline")

The flow below is the MVP. Every step should work end to end before any polish is added.

1. **Account creation and mensa selection.**
   A user signs up (auth method **OPEN**: email/password, magic link, or OAuth) and selects the mensas they are interested in. This selection filters everything the user sees later. The reference bot models the same thing as "favourite restaurants" plus dietary preferences (vegetarian, vegan, show allergies, show full nutrition).

2. **Groups.**
   A user can create a group or join one they were invited to. Invitation mechanism **OPEN** (invite link or code is the simplest). A group has a name and members.

3. **Daily menu view.**
   Every day the user opens the web app and sees today's menus for their selected mensas, presented like an inbox: one entry per dish, easy to scan. Data per dish: mensa, dish name, description, student price, image, vegetarian/vegan flags, allergen icons, optionally nutrition values.

4. **Pick group and time slot.**
   The user chooses which group they want to eat with today and the time slot they intend to go. Both are stored as today's "plan" for that user.

5. **Swipe on dishes.**
   The user swipes through today's dishes. Right = likes it, left = does not. A double swipe is a stronger signal (double right = strongly want this, double left = strongly do not). Exact semantics and whether a swipe implies "I will eat this" vs. "I like this in general" is **OPEN**; for the MVP store the raw signal: `{user, menu, date, value ∈ {-2, -1, +1, +2}}`.

6. **Group overview and sync.**
   The user sees what the other members of the chosen group did today: which dishes they swiped right on, which mensa that implies, and which time slot they picked. From this the group converges on one mensa and one time. Whether convergence is manual (members adjust their own choice) or computed (app proposes the best match) is **OPEN**; MVP = manual with a clear summary.

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

### 5b. UZH mensas – food2050 (Next.js page scraping)

UZH canteens are run by ZFV and publish on <https://app.food2050.ch>. There is no public REST API; the bot does this:

1. Download `https://app.food2050.ch/de/v2/zfv/{location}/{kitchen}/menu/weekly` (e.g. `uzh-zentrum/untere-mensa`; optional `{time}/` segment for lunch/dinner).
2. Extract the `<script id="__NEXT_DATA__">` JSON blob; read `buildId` and `props.pageProps.organisation.outlet.menuCategory.calendar.week.daily[]`, each with `from.dateLocal` and `menuItems[]` (`category.name`, `dish.name`, `dish.allergens[]`, `detailUrl`).
3. For each item, fetch `https://app.food2050.ch/_next/data/{buildId}{detailPath}.json` (bot sleeps 500 ms between calls). The detail has `dish.isVegan`, `dish.isVegetarian`, `dish.imageUrl`, `dish.stats` (servingWeight, energy, fat, carbohydrates, sugar, protein, salt), `dish.allergens[].allergen.externalId`, and `prices[]` with `priceCategory.name` ("Student"/"Studierende") and `amount` as a string.
4. food2050 also exposes a GraphQL endpoint `POST https://api.app.food2050.ch/` (operation `KitchenStatsPerMinute`, variables `locationSlug`, `kitchenSlug`) returning per-minute CO₂ and "temperature change" stats; the bot stores these as `Food2050CO2Entry`. Not needed for the MVP but a possible proxy for how busy a kitchen is.

Fragile: the Next.js build id changes on every deploy and the page structure is unofficial. Expect to fix this scraper during the hackathon.

### 5c. Legacy / not used

- `https://www.mensa.uzh.ch/de/menueplaene/{mensa}/{weekday}.html` HTML scraping (`GetUzhMenus`) – commented out in the bot, superseded by food2050.
- SV-Restaurant website scraping (`HandleSVRestaurantMenu`) – disabled in the bot; ETH moved to the cookpit API.

### 5d. What else to reuse from the bot

- **Schema** (`ETHBot.DataLayer/Data/ETH/Food/*.cs`): `Restaurant` (name, location enum, offers lunch/dinner, internal names = facility id or food2050 slugs, scraper type), `Menu` (name, description, date, is-vegetarian/vegan/gluten-free/lactose-free/balanced/local, price as `Amount`, calories, protein, fat, carbs, salt, sugar, weight, image URLs), `Allergy` (14 rows, EN + DE names: gluten, crustacean, eggs, fish, peanuts, soya, milk, nuts, celery, mustard, sesame, sulphite, lupines, mollusc), `MenuAllergy` (m:n), `MenuUserSetting` (vegetarian/vegan filter, show nutrition, show allergies), `DiscordUserFavouriteRestaurant` (user ↔ mensa), `RestaurantOpeningTime`.
- **Default mensas** when a user has no preferences: Polyterrasse, UZH Zentrum Lower Mensa, UZH Zentrum Upper Mensa for lunch.
- **Not reusable:** the C# runtime, SkiaSharp image rendering, Discord permission checks, and the `SqlModule` (a Discord command that lets server members run read-only SQL against the bot's database; irrelevant to us).

### 5e. Recommendation for the hackathon

Implement a small importer in our own stack: pull the ETH `facilities` + `weeklyrotas` endpoints (clean, reliable, covers all ETH mensas), store into our `Mensa` / `Dish` tables, run it on a schedule. Add the food2050 scraper for UZH only if time allows; otherwise seed UZH dishes for the demo. Hard-code the allergen table from the bot's `RestaurantBaseSetup.sql`.

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
- **Web app first.** Mobile-friendly layout matters because swiping happens on a phone, but no native app.
- **Tech stack: OPEN.** Not decided yet; pick for speed of iteration and document the choice in a separate plan file.
- **Menu data:** ETH via the official API (section 5a) is the baseline; UZH via food2050 is optional.
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

## 9. Open questions (collected)

- Auth method; invite mechanism; time slot granularity.
- Precise meaning of single vs. double swipe.
- Manual vs. computed group convergence.
- Whether to include UZH (food2050 scraper) in the MVP or seed it.
- Tech stack.

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
