import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getFeedbackFormData } from "@/lib/queries/feedback";
import { AppHeader } from "@/components/AppHeader";
import { FeedbackForm } from "@/components/forms/FeedbackForm";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const user = await requireUser();
  const { done } = await searchParams;
  const { planSlot, existing, mensas, likedDishes, defaultMensaId } = await getFeedbackFormData(user.id);

  if (done && existing) {
    return (
      <div className="card space-y-4 py-10 text-center">
        <h1 className="text-[22px] font-semibold tracking-tight">Thanks!</h1>
        <p className="text-[14px] text-muted">Your feedback helps everyone pick better lunches.</p>
        <div className="flex flex-col gap-2 px-6">
          <Link href="/today" className="btn-primary">Back to Today</Link>
          <Link href="/feedback" className="btn-ghost text-[13px]">Edit my answers</Link>
        </div>
      </div>
    );
  }
  if (mensas.length === 0) {
    return <div className="card text-[14px] text-muted">Pick your mensas first under <Link href="/onboarding" className="font-medium text-brand-700">settings</Link>.</div>;
  }
  return (
    <div>
      <AppHeader eyebrow="After lunch" title="How was it?" subtitle="Queue, rating, 30 seconds." />
      <div className="card"><FeedbackForm mensas={mensas} likedDishes={likedDishes} defaultMensaId={defaultMensaId} planSlot={planSlot} existing={existing} /></div>
    </div>
  );
}
