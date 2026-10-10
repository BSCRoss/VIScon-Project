# 3 – Menu import

> Read `0-overview.md` section 5 and `2-architecture.md` section 4 first. This file specifies the importers in `lib/importers/`. Everything about ETH was verified against the live API on 2026-10-10; the UZH part documents what is known and how to finish it.

## 1. Common shape

```ts
// lib/importers/types.ts
export type NormalizedMensa = {
  source: "ETH_COOKPIT" | "FOOD2050" | "SEED";
  sourceId: string;            // see per-source rules
  name: string;
  campus: Campus;
  offersLunch: boolean;
  offersDinner: boolean;
  infoUrl?: string;
};
export type NormalizedDish = {
  mensa: { source: NormalizedMensa["source"]; sourceId: string };
  date: string;                // "YYYY-MM-DD" in Europe/Zurich
  mealTime: "LUNCH" | "DINNER";
  sourceKey: string;           // stable within the mensa; drives upsert
  lineName?: string;
  name: string;
  description?: string;
  mealClass?: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
  priceStudent?: number; priceInternal?: number; priceExternal?: number;
  imageUrl?: string;
  calories?: number; protein?: number; fat?: number; carbs?: number; sugar?: number; salt?: number;
  allergenIds: number[];       // EU codes 1..14
};
```

`lib/importers/upsert.ts` takes `NormalizedMensa[]` and `NormalizedDish[]`, upserts mensas on `(source, sourceId)`, dishes on `(mensaId, sourceKey)`, and replaces each dish's `DishAllergen` rows. Return counts. Wrap each mensa in its own try/catch so one bad facility does not abort the run.

Importers are pure functions `fetchX(weekOf: Date): Promise<{ mensas, dishes }>` plus a `mapX(rawJson)` function that is unit-tested against a fixture. Always send `User-Agent: ${IMPORT_USER_AGENT}`.

## 2. Allergens (seed)

EU codes used by both ETH and food2050. Seed exactly these ids:

| id | en | de |
|---|---|---|
| 1 | Cereals containing gluten | Glutenhaltiges Getreide |
| 2 | Crustaceans | Krebstiere |
| 3 | Eggs | Eier |
| 4 | Fish | Fisch |
| 5 | Peanuts | Erdnüsse |
| 6 | Soya | Soja |
| 7 | Milk | Milch |
| 8 | Nuts | Hartschalenobst (Nüsse) |
| 9 | Celery | Sellerie |
| 10 | Mustard | Senf |
| 11 | Sesame | Sesam |
| 12 | Sulphur dioxide and sulphites | Schwefeldioxid und Sulfite |
| 13 | Lupines | Lupine |
| 14 | Molluscs | Weichtiere |

## 3. ETH – cookpit API (`lib/importers/eth.ts`)

Public, unauthenticated JSON. Base: `https://idapps.ethz.ch/cookpit-pub-services/v1/`. Always add `client-id=ethz-wcms`. **All JSON keys are kebab-case.**

### 3a. Facilities → mensas

`GET facilities?client-id=ethz-wcms&lang=en&rs-first=0&rs-size=50`

Response: `{ "facility-array": Facility[] }` with
`facility-id` (int), `facility-name`, `facility-url`, `caterer-name`, `publication-type-code` (1 = publishes menus, 2 = no menus), `publication-type-desc`, address fields, `customer-group-array`, `payment-option-array`, `facility-feature-array`.

Mapping:
- Keep only `publication-type-code === 1`.
- `sourceId = String(facility-id)`; `name = facility-name`; `infoUrl = facility-url`.
- `campus` from the path segment of `facility-url`: `/zentrum/` → ETH_ZENTRUM, `/hoenggerberg/` → ETH_HOENGGERBERG, `/oerlikon/` → ETH_OERLIKON, `/basel/` → ETH_BASEL, else OTHER.
- `offersLunch` / `offersDinner`: set true when the rota (3b) contains a meal-time named "Lunch" / "Dinner" for that facility; default lunch=true.

Live list on 2026-10-10 (id – name – campus): 3 Clausiusbar Z · 5 Dozentenfoyer Z · 7 food&lab Z · 8 Archimedes Z · 9 Mensa Polyterrasse Z · 10 Polysnack Z · 11 Tannenbar Z · 14 Alumni quattro Lounge H · 16 Mendokoro H · 19 food market H · 20 FUSION meal H · 22 Rice Up! H · 23 Octavo Oerlikon · 27 Science Lounge Basel · 28 Flavour Kitchen Basel. Do not hard-code; this is for sanity checks.

### 3b. Weekly rotas → dishes

`GET weeklyrotas?client-id=ethz-wcms&lang=en&rs-first=0&rs-size=50&valid-after=YYYY-MM-DD`

- `valid-after` = Monday of the target week. Page with `rs-first += 50` until a page returns fewer than 50 entries (the first page already returned exactly 50 on 2026-10-10).
- Response: `{ "weekly-rota-array": Rota[] }`. `Rota = { "weekly-rota-id", "facility-id", "valid-from", "valid-to", "day-of-week-array": Day[] }`.
- A facility can have **several rotas** (e.g. one per meal time, or a standing rota valid for a year next to weekly ones). For a target date keep rotas where `valid-from ≤ date ≤ valid-to`.
- `Day = { "day-of-week-code" (1 = Monday … 7), "day-of-week-desc", "opening-hour-array": OpeningHour[] | null }`
- `OpeningHour = { "time-from", "time-to", "meal-time-array": MealTimeEntry[] }`
- `MealTimeEntry = { "name" ("Lunch" | "Dinner" | …), "time-from", "time-to", "line-array": Line[] | null, "menu": { "menu-url" } }`
- `Line = { "name", "meal": Meal | null }`
- `Meal = { "line-id", "name", "description", "image-url", "price-unit-code", "price-unit-desc", "meal-price-array": [{ "price", "customer-group-desc": "students"|"internal"|"external", … }], "meal-class-array": [{ "code", "desc-short": "Meat"|"Vegetarian"|"Vegan"|…, "desc" }], "allergen-array": [{ "code", "desc-short": "1".."14" (EU code as string), "desc" }], "meat-type-array", "fishing-method-array", "addon-array", "energy", "proteins", "fat", "saturatedfattyacids", "carbohydrates", "sugar", "salt" }` (nutrition values are usually null).

Mapping per `(rota, day, mealTimeEntry, line)` where `line.meal` is not null:

| NormalizedDish field | From |
|---|---|
| `mensa.sourceId` | `String(rota["facility-id"])` |
| `date` | Monday of the target week + (`day-of-week-code` − 1) days, formatted in Europe/Zurich. Skip days outside `[valid-from, valid-to]`. |
| `mealTime` | `"Lunch"` → LUNCH, `"Dinner"` → DINNER, anything else → skip |
| `sourceKey` | `${date}:${mealTime}:${meal["line-id"] ?? line.name}` |
| `lineName` | `line.name` |
| `name` | `meal.name` (fallback `line.name`) |
| `description` | `meal.description` (ingredients separated by ` \| `) |
| `mealClass` | first `meal-class-array[].desc-short` |
| `isVegan` | any class `desc-short === "Vegan"` |
| `isVegetarian` | `isVegan` or any class `"Vegetarian"` |
| prices | `meal-price-array` by `customer-group-desc` students/internal/external |
| `imageUrl` | `image-url ? image-url + "?client-id=ethz-wcms" : undefined` |
| nutrition | `energy`→calories (round), `proteins`, `fat`, `carbohydrates`, `sugar`, `salt` |
| `allergenIds` | `allergen-array[].desc-short` parsed as int, kept if 1..14 (ignore `code`, it is ETH-internal) |

Edge cases seen in the data: facilities with 7 days but zero lines (closed or no publication), the same facility repeated with different rotas, `line-array` null, `meal` null. The mapper must skip silently and count them in `errors[]` only when a meal exists but cannot be mapped.

Fetch today + the rest of the current week in one run (one rotas call). Use `lang=en`; optionally a second pass with `lang=de` if German names are wanted later.

### 3c. Fixture test

Save one real `weeklyrotas` page as `lib/importers/__fixtures__/eth-weeklyrotas.json` and one `facilities` response. Test: mapping yields > 0 dishes for facility 9 on a weekday, prices are numbers, every allergen id is within 1..14, no duplicate `sourceKey` per mensa.

## 4. UZH – food2050 (`lib/importers/food2050.ts`) – status: needs a 60-minute investigation

UZH mensas (run by ZFV) publish only on <https://app.food2050.ch>. What is known as of 2026-10-10:

- The Discord bot's scraper is **broken**: it read a `__NEXT_DATA__` JSON blob from `/de/v2/zfv/{location}/{kitchen}/menu/weekly`. Those URLs now 308-redirect to `/de/zfv/...`, and the pages are rendered with the Next.js App Router. The HTML contains no menu data; it is loaded client-side.
- The site is an Apollo client calling **`POST https://app.food2050.ch/api/v2/graphql`** (same origin). Introspection is disabled (`INTROSPECTION_DISABLED`). The old host `api.app.food2050.ch` returns 404.
- The menu queries live in lazily loaded route chunks, not in the initial bundles.
- Known slugs: location `uzh-zentrum`, kitchens `untere-mensa` (Lower Mensa) and `obere-mensa` (Upper Mensa, verify), menu slugs `mittag` / `abend`. Other UZH locations (Irchel, Oerlikon, Rämi 59, etc.) are listed on <https://app.food2050.ch/de/zfv>.

Procedure to finish it (time-box 60 min, then fall back to seed):
1. Open `https://app.food2050.ch/de/zfv/uzh-zentrum/untere-mensa/menu/weekly` in a browser with DevTools → Network → filter `graphql`.
2. Copy the request body of the query that returns the week (fields will resemble the old shape: `calendar.week.daily[].from.dateLocal`, `menuItems[].dish.name`, `category.name`, `dish.isVegan`, `dish.isVegetarian`, `dish.imageUrl`, `dish.allergens[].allergen.externalId`, `prices[].amount` with `priceCategory.name` "Studierende", `dish.stats.{energy,fat,carbohydrates,sugar,protein,salt,servingWeight}.amount`). Also copy any headers beyond `content-type` (e.g. `x-organisation`, cookies, or an anonymous auth token).
3. Replay it with `fetch` from Node with the same body and headers. If it works without a browser session, save body + headers as `lib/importers/food2050.query.ts` and the response as a fixture.
4. Map to `NormalizedDish`: `mensa.sourceId = "{location}/{kitchen}/{menuSlug}"`, `sourceKey = ${date}:${mealTime}:${menuItem id or category.name}`, `name = dish.name`, `lineName = category.name`, prices from the "Studierende" category, allergens via the table below, `campus` UZH_ZENTRUM / UZH_IRCHEL / UZH_OERLIKON by location slug.
5. Sleep ≥ 500 ms between requests; cache per day.

food2050 allergen `externalId` → EU code: `cerealsContainingGluten`, `wheat`, `barley`, `rye` → 1 · `crustaceans` → 2 · `eggs` → 3 · `fish` → 4 · `peanuts` → 5 · `soybeans` → 6 · `milk` → 7 · `nuts`, `walnut`, `almond`, `cashew`, `pistachio`, `hazel`, `pecan`, `brazilNut`, `macadamia`, `queenslandNut` → 8 · `celery` → 9 · `mustard` → 10 · `sesame` → 11 · `sulphites` → 12 · `lupin` → 13 · `molluscs` → 14 · anything else → ignore.

Fallback: `prisma/seed.ts` inserts mensas `FOOD2050:uzh-zentrum/untere-mensa/mittag` ("UZH Zentrum Lower Mensa", UZH_ZENTRUM) and `FOOD2050:uzh-zentrum/obere-mensa/mittag` ("UZH Zentrum Upper Mensa") with 4–6 realistic dishes for *today* (seed computes the date at run time) so the demo shows both universities.

## 5. `/api/import` behaviour

- Auth: `Authorization: Bearer ${CRON_SECRET}`; otherwise 401.
- Query: `source=eth|food2050|all` (default all), `week=YYYY-MM-DD` (any day of the target week; default today).
- Runs importers sequentially, each in try/catch; always upserts what succeeded.
- Response: `{ ranAt, week, results: { eth: { mensas, dishes, errors[] }, food2050: {...} | "skipped" } }`.
- Log a one-line summary; keep raw errors in the response for the dev panel.

## 6. Manual verification checklist

1. `curl -H "Authorization: Bearer $CRON_SECRET" "$URL/api/import?source=eth"` → dishes > 100 on a weekday.
2. In the DB: `select m.name, count(*) from "Dish" d join "Mensa" m on m.id=d."mensaId" where d.date = current_date group by 1;` shows Polyterrasse with ~10 rows.
3. `/today` on a phone shows images and prices; allergen chips show numbers 1–14 only.
4. Re-run the import: counts unchanged, no duplicates.
