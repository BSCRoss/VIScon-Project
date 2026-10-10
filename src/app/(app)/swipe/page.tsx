import { requireOnboardedUser } from "@/lib/session";
import { getTodayDishes, getUserPlan } from "@/lib/queries/today";
import { SwipeDeck } from "@/components/SwipeDeck";

export default async function SwipePage() {
  const user = await requireOnboardedUser();
  const [{ dishes, flaggedAllergenIds }, plan] = await Promise.all([getTodayDishes(user.id), getUserPlan(user.id)]);
  const unswiped = dishes.filter((d) => d.mySwipe === null);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Swipe</h1>
      <SwipeDeck dishes={unswiped} flaggedAllergenIds={flaggedAllergenIds} lastGroupId={plan?.groupId} />
    </div>
  );
}
