import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getFeedbackFormData } from "@/lib/queries/feedback";
import { FeedbackForm } from "@/components/forms/FeedbackForm";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const user = await requireUser();
  const { done } = await searchParams;
  const { plan, existing, mensas, likedDishes, defaultMensaId } = await getFeedbackFormData(user.id);

  if (done && existing) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold">Thanks! 🦒</h1>
        <p className="text-stone-600">Your feedback helps everyone pick better lunches.</p>
        <Link href="/today" className="btn-primary">Back to Today</Link>
        <p><Link href="/feedback" className="text-sm underline">Edit my answers</Link></p>
      </div>
    );
  }
  if (mensas.length === 0) {
    return <div className="card text-stone-600">Pick your mensas first under <Link href="/onboarding" className="underline">settings</Link>.</div>;
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">How was lunch?</h1>
      <FeedbackForm mensas={mensas} likedDishes={likedDishes} defaultMensaId={defaultMensaId} planSlot={plan?.slotMinutes ?? null} existing={existing} />
    </div>
  );
}
