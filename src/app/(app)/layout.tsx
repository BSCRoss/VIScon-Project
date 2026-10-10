import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getPendingFeedback, getYesterdayPrompt } from "@/lib/queries/feedback";
import { YesterdayFeedbackModal } from "@/components/YesterdayFeedbackModal";
import { isDemoDate, appDateString, formatDateLong } from "@/lib/time";
import { BottomNav } from "@/components/BottomNav";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [invites, pending, yesterday] = await Promise.all([
    prisma.groupInvite.count({ where: { toUserId: user.id, status: "PENDING" } }),
    getPendingFeedback(user.id),
    getYesterdayPrompt(user.id),
  ]);
  return (
    <>
      {isDemoDate() ? <p className="bg-ink px-4 py-1 text-center text-[11px] font-medium text-white/80">Demo mode · showing {formatDateLong(appDateString())}</p> : null}
      <FeedbackPrompt userId={user.id} />
      <main className="mx-auto max-w-xl px-4 pb-28 pt-5">{children}</main>
      <BottomNav badges={{ "/groups": invites, "/today": pending?.due ? 1 : 0 }} />
      {yesterday ? <YesterdayFeedbackModal prompt={yesterday} /> : null}
    </>
  );
}
