import Link from "next/link";
import { getPendingFeedback } from "@/lib/queries/feedback";

export async function FeedbackPrompt({ userId }: { userId: string }) {
  const pending = await getPendingFeedback(userId);
  if (!pending?.due) return null;
  const where = pending.plan.mensa?.name ?? "lunch";
  return (
    <Link href="/feedback" className="block bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
      How was {where} today? Tap to give 30 seconds of feedback →
    </Link>
  );
}
