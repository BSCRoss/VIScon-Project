import Link from "next/link";
import { MessageSquareHeart } from "lucide-react";
import { getPendingFeedback } from "@/lib/queries/feedback";

export async function FeedbackPrompt({ userId }: { userId: string }) {
  const pending = await getPendingFeedback(userId);
  if (!pending?.due) return null;
  const where = pending.mensaName ?? "lunch";
  return (
    <Link href="/feedback" className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-[13px] font-medium text-amber-900">
      <MessageSquareHeart size={16} aria-hidden /> How was {where}? Give 30 seconds of feedback →
    </Link>
  );
}
