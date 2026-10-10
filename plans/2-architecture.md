# 2 – Architecture

> Read `0-overview.md` first. This file fixes the technical shape of greyGiraffe so that several people (or agents) can build parts in parallel without re-deciding anything. Where this file says "decide and document", pick the simplest option and note it in a short comment at the top of the relevant file.

## 1. Stack (pinned choices)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15+, App Router, TypeScript, React Server Components | Single repo for UI, API and importer. Use `npx create-next-app@latest --ts --tailwind --app --src-dir`. |
| Styling | Tailwind CSS | Mobile-first. No component library required; if one is wanted, use shadcn/ui. |
| Database | PostgreSQL (hosted: Neon free tier, or Supabase Postgres) | One shared database for local dev, preview and production, to keep the hackathon simple. Create a second branch/database for local only if someone needs destructive testing. |
| ORM | Prisma | Schema in section 4. Use `prisma migrate dev` locally, `prisma migrate deploy` in CI/deploy. |
| Auth | Auth.js (next-auth v5) Credentials provider, JWT session strategy | Username + password, bcrypt (cost 10). No email, no OAuth. |
| Gestures | `react-swipeable` (simplest) or `framer-motion` drag | Only the swipe deck uses it. |
| Hosting | Vercel | Public HTTPS URL for phones. Preview deploy per PR. |
| Scheduling | Vercel Cron → `GET /api/import` | Protected by `CRON_SECRET` header. Also callable manually. |
| Time zone | `Europe/Zurich` everywhere a calendar date or slot is computed | Use `date-fns-tz` or `Intl` with explicit zone. Never use the server's local time. |
| Validation | `zod` for all server action / route inputs | |
| Package manager | pnpm | |

## 2. Repository layout (as built)

```
greyGiraffe/
  plans/                          # these documents
  prisma/schema.prisma            # data model (section 4)
  prisma/migrations/              # commit every migration
  prisma/seed.ts                  # allergens, 4 mensas, fake UZH dishes for today, demo users alice/bob/carol
  src/
    auth.ts                       # Auth.js (Credentials + Prisma)   src/auth.config.ts = edge-safe part used by middleware
    middleware.ts                 # protects everything except /login, /register, /api/import, /api/health
    app/
      (auth)/login, (auth)/register
      (app)/layout.tsx            # authenticated shell: FeedbackPrompt + BottomNav
      (app)/onboarding, today, swipe, plan, groups, groups/new, groups/[groupId], feedback, settings
      api/import/route.ts         # GET, Bearer CRON_SECRET, ?source=eth|food2050|all&week=YYYY-MM-DD
      api/health/route.ts
      api/auth/[...nextauth]/route.ts
    lib/
      db.ts                       # Prisma singleton
      time.ts                     # Europe/Zurich dates + 15-min slots (tested)
      session.ts                  # requireUser(), requireOnboardedUser()
      labels.ts                   # campus / queue / swipe labels
      actions/                    # server actions: auth, onboarding, swipes, plans, groups, feedback, admin, types
      queries/                    # today.ts (DishDTO), group.ts (getGroupToday summary), feedback.ts
      importers/                  # types, upsert, eth (done, tested), food2050 (stub), index (runImport)
    components/                   # BottomNav, DishCard, SwipeDeck, FeedbackPrompt, RunImportButton, ui, forms/*
    types/next-auth.d.ts
  vercel.json                     # cron
  vitest.config.mts
  .env.example
```

## 3. Environment variables

```
DATABASE_URL=postgresql://...           # Neon/Supabase pooled URL
DIRECT_URL=postgresql://...             # unpooled, for migrations (Prisma `directUrl`)
AUTH_SECRET=...                         # `npx auth secret`
AUTH_TRUST_HOST=true                    # needed on Vercel for Auth.js v5
CRON_SECRET=...                         # random string; Vercel sends it as `Authorization: Bearer <CRON_SECRET>`
IMPORT_USER_AGENT="greyGiraffe/0.1 (hackathon; contact: <email>)"
```

## 4. Data model (Prisma)

Copy this into `prisma/schema.prisma`. Field comments are part of the spec.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DIRECT_URL") }

enum Campus { ETH_ZENTRUM ETH_HOENGGERBERG ETH_OERLIKON ETH_BASEL UZH_ZENTRUM UZH_IRCHEL UZH_OERLIKON OTHER }
enum MenuSource { ETH_COOKPIT FOOD2050 SEED }
enum MealTime { LUNCH DINNER }
enum GroupRole { OWNER MEMBER }
enum InviteStatus { PENDING ACCEPTED DECLINED }
enum QueueBucket { NONE LT10 B10_30 GT30 }   // none / <10 / 10–30 / >30 people

model User {
  id            String   @id @default(cuid())
  username      String   @unique            // lowercase, 3–24 chars, [a-z0-9_]
  passwordHash  String
  displayName   String?
  vegetarian    Boolean  @default(false)    // filter preference, not a hard rule
  vegan         Boolean  @default(false)
  createdAt     DateTime @default(now())

  mensas        UserMensa[]
  allergens     UserAllergen[]
  memberships   GroupMember[]
  groupsOwned   Group[]        @relation("GroupOwner")
  invitesSent   GroupInvite[]  @relation("InviteFrom")
  invitesGot    GroupInvite[]  @relation("InviteTo")
  swipes        Swipe[]
  plans         Plan[]
  feedback      Feedback[]
}

model Mensa {
  id            String     @id @default(cuid())
  name          String
  campus        Campus
  source        MenuSource
  sourceId      String                      // ETH: facility-id as string, e.g. "9". food2050: "uzh-zentrum/untere-mensa/mittag"
  offersLunch   Boolean    @default(true)
  offersDinner  Boolean    @default(false)
  infoUrl       String?
  isActive      Boolean    @default(true)   // hide closed/unused mensas from pickers

  dishes        Dish[]
  users         UserMensa[]
  plans         Plan[]
  feedback      Feedback[]

  @@unique([source, sourceId])
}

model Dish {
  id            String    @id @default(cuid())
  mensaId       String
  mensa         Mensa     @relation(fields: [mensaId], references: [id], onDelete: Cascade)
  date          DateTime  @db.Date           // calendar date in Europe/Zurich
  mealTime      MealTime
  sourceKey     String                       // stable per source, see 3-menu-import.md; used for upsert
  lineName      String?                      // ETH "line" (counter) name, e.g. "Rice Up! Bowl"
  name          String
  description   String?
  mealClass     String?                      // "Meat" | "Vegetarian" | "Vegan" | "Fish" | null
  isVegetarian  Boolean?
  isVegan       Boolean?
  priceStudent  Decimal?  @db.Decimal(6,2)
  priceInternal Decimal?  @db.Decimal(6,2)
  priceExternal Decimal?  @db.Decimal(6,2)
  imageUrl      String?
  calories      Int?
  protein       Float?
  fat           Float?
  carbs         Float?
  sugar         Float?
  salt          Float?
  importedAt    DateTime  @default(now())

  allergens     DishAllergen[]
  swipes        Swipe[]
  feedback      Feedback[]

  @@unique([mensaId, sourceKey])
  @@index([date, mensaId])
}

model Allergen {                             // fixed 14 rows, EU codes; seeded
  id      Int    @id
  nameEn  String
  nameDe  String
  dishes  DishAllergen[]
  users   UserAllergen[]
}
model DishAllergen { dishId String; dish Dish @relation(fields:[dishId], references:[id], onDelete: Cascade); allergenId Int; allergen Allergen @relation(fields:[allergenId], references:[id]); @@id([dishId, allergenId]) }
model UserAllergen { userId String; user User @relation(fields:[userId], references:[id], onDelete: Cascade); allergenId Int; allergen Allergen @relation(fields:[allergenId], references:[id]); @@id([userId, allergenId]) }
model UserMensa    { userId String; user User @relation(fields:[userId], references:[id], onDelete: Cascade); mensaId String; mensa Mensa @relation(fields:[mensaId], references:[id], onDelete: Cascade); @@id([userId, mensaId]) }

model Group {
  id         String   @id @default(cuid())
  name       String
  ownerId    String
  owner      User     @relation("GroupOwner", fields: [ownerId], references: [id])
  createdAt  DateTime @default(now())
  members    GroupMember[]
  invites    GroupInvite[]
  plans      Plan[]
}
model GroupMember {
  groupId  String; group Group @relation(fields:[groupId], references:[id], onDelete: Cascade)
  userId   String; user  User  @relation(fields:[userId],  references:[id], onDelete: Cascade)
  role     GroupRole @default(MEMBER)
  joinedAt DateTime  @default(now())
  @@id([groupId, userId])
}
model GroupInvite {
  id         String       @id @default(cuid())
  groupId    String; group Group @relation(fields:[groupId], references:[id], onDelete: Cascade)
  fromUserId String; from  User  @relation("InviteFrom", fields:[fromUserId], references:[id])
  toUserId   String; to    User  @relation("InviteTo",   fields:[toUserId],   references:[id])
  status     InviteStatus @default(PENDING)
  createdAt  DateTime     @default(now())
  @@unique([groupId, toUserId])
}

model Swipe {                                // one reaction per user per dish; dish already carries the date
  id        String   @id @default(cuid())
  userId    String; user User @relation(fields:[userId], references:[id], onDelete: Cascade)
  dishId    String; dish Dish @relation(fields:[dishId], references:[id], onDelete: Cascade)
  value     Int                              // -2 | -1 | 1 | 2  (right = "I want to eat this today")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, dishId])
}

model Plan {                                 // the user's intention for one day: one lunch per day
  id          String   @id @default(cuid())
  userId      String; user  User  @relation(fields:[userId],  references:[id], onDelete: Cascade)
  date        DateTime @db.Date
  groupId     String?; group Group? @relation(fields:[groupId], references:[id], onDelete: SetNull)
  slotMinutes Int?                           // minutes after midnight, 660..840 in steps of 15 (11:00–14:00)
  mensaId     String?; mensa Mensa? @relation(fields:[mensaId], references:[id], onDelete: SetNull)  // optional explicit choice
  updatedAt   DateTime @updatedAt
  @@unique([userId, date])
}

model Feedback {                             // post-meal data; one per user per day
  id          String      @id @default(cuid())
  userId      String; user  User  @relation(fields:[userId],  references:[id], onDelete: Cascade)
  date        DateTime    @db.Date
  mensaId     String; mensa Mensa @relation(fields:[mensaId], references:[id])
  dishId      String?; dish  Dish? @relation(fields:[dishId], references:[id], onDelete: SetNull)
  queueBucket QueueBucket
  waitMinutes Int?                           // optional finer estimate
  rating      Int                            // 1..5
  wouldAgain  Boolean?
  comment     String?
  arrivedAt   Int?                           // minutes after midnight, when they actually got there
  createdAt   DateTime    @default(now())
  @@unique([userId, date])
}
```

## 5. Auth

- Auth.js v5 with the Credentials provider. `authorize()` looks up `User` by lowercase username and checks bcrypt.
- JWT session; put `userId` and `username` in the token. Export `auth`, `signIn`, `signOut` from `lib/auth.ts` plus `requireUser()` that redirects to `/login` when unauthenticated.
- Registration is a server action: validate with zod (username regex, password ≥ 8), hash, create user, then `signIn("credentials")`.
- `middleware.ts` protects everything under `(app)`; `/login`, `/register`, `/api/import`, `/api/health` stay public.
- New users with no `UserMensa` rows are redirected to `/onboarding`.

## 6. Server actions (write side)

All actions live in `lib/actions/*`, take zod-validated input, call `requireUser()`, return `{ ok: true } | { ok: false, error }`, and `revalidatePath` the affected pages.

| Action | Input | Behaviour |
|---|---|---|
| `register` | username, password, displayName? | create user, sign in |
| `saveOnboarding` | mensaIds[], vegetarian, vegan, allergenIds[] | replace `UserMensa` and `UserAllergen`, update flags |
| `swipe` | dishId, value ∈ {-2,-1,1,2} | upsert `Swipe`; reject if dish.date ≠ today |
| `undoSwipe` | dishId | delete |
| `setPlan` | groupId?, slotMinutes?, mensaId? | upsert `Plan` for today; validate slot range/step and group membership |
| `createGroup` | name | create group, add owner as member |
| `inviteByUsername` | groupId, username | must be member; create `GroupInvite` PENDING (ignore duplicates) |
| `respondInvite` | inviteId, accept: boolean | set status; on accept add `GroupMember` |
| `leaveGroup` | groupId | remove membership |
| `submitFeedback` | mensaId, dishId?, queueBucket, rating, waitMinutes?, wouldAgain?, comment? | upsert `Feedback` for today |

## 7. Read queries (page data)

- `getTodayDishes(userId)`: dishes for `zurichToday()` with `mealTime = LUNCH` at the user's mensas, including allergens and the user's existing swipe. Order: mensa name, then line name. Apply vegetarian/vegan preference as a *soft* filter toggle in the UI, not in the query.
- `getGroupToday(groupId, viewerId)`: members; for each member their `Plan` (slot, mensa) and right swipes (value > 0) with dish → mensa. Also compute `summary = { byMensa: {mensaId, name, memberCount, dishCount}[], bySlot: {slotMinutes, memberCount}[] }` sorted desc. This is the only aggregation in the MVP.
- `getPendingFeedback(userId)`: today's plan if `slotMinutes + 45 ≤ nowMinutesZurich` and no `Feedback` for today → return plan to drive the prompt.
- `getInvites(userId)`: PENDING invites with group name and inviter.

## 8. Importer entry point

`GET /api/import?source=eth|food2050|all&date=YYYY-MM-DD` (default `all`, today's week). Rejects without `Authorization: Bearer $CRON_SECRET`. Runs the importers from `lib/importers`, returns `{ source, mensas, dishesUpserted, errors[] }`. Keep it idempotent: re-running for the same week only updates. `vercel.json`:

```json
{ "crons": [ { "path": "/api/import?source=all", "schedule": "0 5 * * 1-5" } ] }
```
(05:00 UTC = 07:00 Zurich in summer, 06:00 in winter; fine either way. Add a second run at `30 9 * * 1-5` to catch late changes.)

## 9. Conventions

- "Today" is always `zurichToday()`; slots are integers (minutes) in the DB and formatted as `HH:MM` only in the UI.
- Decimal prices are CHF; render with one or two decimals (`8.90`).
- Dish names stay in source language. ETH is fetched with `lang=en`; UZH is German.
- Server components for pages, client components only for the swipe deck, pickers and the feedback form.
- No external calls from the browser to ETH/food2050; everything goes through the importer.
- Lint/format: ESLint (Next default) + Prettier. No tests required for the hackathon except a unit test for each importer's mapping function using a saved JSON fixture (`lib/importers/__fixtures__/eth-weeklyrotas.json`).

## 10. Deployment checklist

1. Create Neon project → copy pooled and direct URLs to Vercel env vars and `.env.local`.
2. `pnpm prisma migrate deploy && pnpm prisma db seed` from a dev machine once.
3. Deploy to Vercel; set `AUTH_SECRET`, `AUTH_TRUST_HOST`, `CRON_SECRET`.
4. Hit `/api/import?source=eth` manually with the bearer token; verify `/today` shows dishes on a phone.
