import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getPendingFeedback } from "@/lib/queries/feedback";
import { BottomNav } from "@/components/BottomNav";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [invites, pending] = await Promise.all([
    prisma.groupInvite.count({ where: { toUserId: user.id, status: "PENDING" } }),
    getPendingFeedback(user.id),
  ]);
  return (
    <>
      <FeedbackPrompt userId={user.id} />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-4">{children}</main>
      <BottomNav badges={{ "/groups": invites, "/today": pending?.due ? 1 : 0 }} />
    </>
  );
}
