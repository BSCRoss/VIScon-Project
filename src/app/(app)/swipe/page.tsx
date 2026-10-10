import { requireOnboardedUser } from "@/lib/session";
import { getTodayContext, getUserPlan } from "@/lib/queries/today";
import { AppHeader } from "@/components/AppHeader";
import { SwipeDeck } from "@/components/SwipeDeck";

export default async function SwipePage() {
  const user = await requireOnboardedUser();
  const [{ dishes, flaggedAllergenIds }, plan] = await Promise.all([getTodayContext(user.id), getUserPlan(user.id)]);
  const unswiped = dishes.filter((d) => d.mySwipe === null);
  return (
    <div>
      <AppHeader eyebrow="Decide" title="What do you feel like?" subtitle="Right = I want this today. Swipe further for a stronger vote." />
      <SwipeDeck dishes={unswiped} flaggedAllergenIds={flaggedAllergenIds} lastGroupId={plan?.groupId} />
    </div>
  );
}
