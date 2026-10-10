# 4 – Screens and user flows

> Read `0-overview.md` and `2-architecture.md` first. Every screen below lists its route, what it shows, what the user can do, and acceptance criteria. Build phone-first (≈390 px wide); desktop just gets a centered column (max ~640 px). All authenticated screens share a bottom navigation bar: **Today · Swipe · Group · Me**.

## 0. Shared elements

- **Bottom nav** (`components/BottomNav.tsx`): Today (`/today`), Plan (`/plan`), Group (`/groups`), Me (`/settings`). Highlight the active tab. Show a small badge on Group when there are pending invites, and on Today when feedback is pending.
- **Dish card** (`components/DishCard.tsx`): image (fallback: neutral placeholder with mensa initial), mensa name, line name, dish name, description (truncate to 2 lines, expandable), student price, badges for Vegan / Vegetarian, allergen icons as small chips with numbers 1–14 and a tooltip name. If the dish contains an allergen the user flagged, show a red "contains X" chip.
- **Feedback prompt** (`components/FeedbackPrompt.tsx`): a sticky banner at the top of any screen when `getPendingFeedback` returns a plan: "How was lunch at {mensa}?" → opens `/feedback`.
- **Empty states** must say what to do next (e.g. "No menus yet for today. Menus are imported each morning.").

## 1. Register / Login

Routes: `/register`, `/login`.

- Register form: username, password, optional display name. Inline validation messages. On success → `/onboarding`.
- Login form: username, password. On success → `/today` (or `/onboarding` if the user has no mensas).
- Accept: wrong password shows an error without clearing the username; both pages work without JavaScript enhancements beyond the form.

## 2. Onboarding

Route: `/onboarding` (also reachable later from Settings).

- Step 1 **Pick your mensas**: list grouped by campus (ETH Zentrum, ETH Hönggerberg, UZH Zentrum, UZH Irchel, Other). Multi-select tiles. Pre-select Mensa Polyterrasse and UZH Zentrum Lower Mensa to shorten the demo.
- Step 0 **Where are you each day?** Mon–Fri segmented control: HG / Höngg / Off (decision 8). The mensa list below only shows mensas in the chosen areas.
- Step 2 **Preferences**: toggles Vegetarian, Vegan; multi-select of the 14 allergens to flag.
- Save → `/today`.
- Accept: at least one mensa required; selection persists on reload.

## 3. Today (menu inbox)

Route: `/today`.

- Header: date ("Friday, 10 Oct"), the user's current plan summary chip ("Group: Lab · 12:15" or "Set your plan"), tapping it opens `/plan`.
- Filter row: "All / Vegetarian / Vegan" soft filter, default from user preferences.
- Agreed-decision banner(s) when a group has committed.
- List of today's lunch dishes grouped by mensa (only mensas in today's area), each mensa heading with a load traffic light (decision 11), each dish a compact `DishCard`. Dishes the user already swiped show a small indicator (👍/👍👍/👎/👎👎).
- Primary button at the bottom: "Swipe through today's menu" → `/swipe` (hidden when every dish is already swiped).
- Accept: loads in < 1 s with ~40 dishes; works for a user with 3 mensas; shows the empty state if the import has not run.

## 4. Swipe deck – REMOVED (decision 15): voting lives on the Today cards (drag right/left, thumb buttons). The section below is historical.

Route: `/swipe`. Client component `SwipeDeck`.

- Shows only *unswiped* dishes for today at the user's mensas, as a card stack. Order: by mensa, then line.
- Gestures: drag right → +1, drag left → −1. Double-tap-then-swipe or a swipe past a farther threshold → ±2 (show "Definitely!" / "No way"). Also four buttons under the card for accessibility: 👎👎 👎 👍 👍👍, plus an Undo link.
- Semantics shown once as a hint: "Swipe right = I want to eat this today".
- After the last card: summary screen "You liked N dishes at: Polyterrasse (3), Untere Mensa (1)" with buttons "Set time & group" (`/plan`) and "See what your group chose" (`/groups/<last used>`).
- Accept: each swipe persists via the `swipe` action without blocking the animation (optimistic); refreshing the page does not show already swiped dishes; `undo` works for the last card.

## 5. Plan (availability grid) – replaces the slot picker (decision 9)

Route: `/plan`.

- Group picker: the user's groups as radio tiles (plus "Create a group" link). If the user has none → prompt to create one.
- Availability grid (`AvailabilityGrid`): rows of 15 minutes from 11:00 to 14:00. Press a row and slide to mark your window; it saves on release. The right column shows how many members of the selected group are free in that row, with "all free" markers and the agreed slot once committed.
- Optional: "Mensa I'm going to" dropdown limited to mensas where the user has a right swipe today; leave empty by default.
- Save → `/groups/[groupId]`.
- Accept: `Plan` row upserted for today; slot stored as minutes; can be changed any number of times.

## 6. Groups

Routes: `/groups`, `/groups/new`, `/groups/[groupId]`.

**/groups**: list of the user's groups (name, member count), pending invites with Accept/Decline, button "New group".

**/groups/new**: name → create → `/groups/[id]`.

**/groups/[groupId]** – the sync screen, the heart of the app:
- Header: group name, member avatars (initials), "Invite" button → inline input "username" → `inviteByUsername` with success/error toast.
- **Summary block** (from `getGroupToday`):
  - "Where": mensas ranked by number of members with a right swipe there, e.g. "Polyterrasse · 4 of 5", with the top dishes under each.
  - "When": slots ranked by number of members, e.g. "12:15 · 3", "12:30 · 1".
  - Members who have done nothing yet are listed as "no plan yet".
- **Per-member list**: name, slot chip, chosen mensa (if set), their right-swiped dishes as small chips (👍👍 first).
- Your own row has an "Edit my plan" link → `/plan`.
- **Consensus + Commit** (decision 10): once every member has a window and some row is free for all, a Commit form appears (mensa + time preselected from the ranking). After committing, the group page shows the agreed card with a "Change decision" link, and Today shows the banner.
- Accept: updates when the page is reloaded (no realtime needed; add a 30 s `router.refresh()` interval if cheap); a member of another group cannot open this page (404).

## 7. Feedback

Route: `/feedback` (also opened by the prompt banner).

- Pre-filled from today's plan: mensa (editable dropdown), dish (dropdown of right-swiped dishes at that mensa, optional).
- Questions, each a single tap row:
  1. "How many people were queueing?" — None / <10 / 10–30 / >30
  2. "How long did you wait?" — optional number of minutes
  3. "Rate your dish" — 5 stars
  4. "Would you eat it again?" — Yes / No (optional)
  5. "When did you actually get there?" — slot chips (optional, default = plan slot)
  6. Free text (optional)
- Submit → thank-you state with "Back to Today". Only one feedback per day; reopening shows the submitted values.
- Accept: `Feedback` upserted; the prompt banner disappears after submission.

## 8. Settings ("Me")

Route: `/settings`.

- Display name, mensas (reopens onboarding step 1), preferences (step 2), allergens.
- Sign out.
- Developer section (only shown when `NODE_ENV !== "production"` or for a hard-coded admin username): "Run import now" button calling `/api/import` with the secret via a server action; shows the import result.

## 9. Demo path (what we show on stage)

1. Register two users on two phones, pick Polyterrasse + Untere Mensa.
2. User A creates group "Hackathon", invites user B by username, B accepts.
3. Both swipe today's menu; both set 12:15 / 12:30.
4. Open the group screen: summary shows "Polyterrasse · 2 of 2", slots 12:15 and 12:30; B changes to 12:15.
5. Fast-forward: trigger the feedback prompt (a dev toggle that ignores the 45-minute rule) and submit feedback with queue length and rating.
6. Show the `Feedback` and `Swipe` tables (or a tiny stats page) as the dataset we collect.
