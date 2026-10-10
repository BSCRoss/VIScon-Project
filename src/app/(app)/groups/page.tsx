import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getInvites, getUserGroups } from "@/lib/queries/group";
import { respondInvite } from "@/lib/actions/groups";
import { AppHeader } from "@/components/AppHeader";

export default async function GroupsPage() {
  const user = await requireUser();
  const [groups, invites] = await Promise.all([getUserGroups(user.id), getInvites(user.id)]);
  return (
    <div>
      <AppHeader eyebrow="People" title="Groups" right={<Link href="/groups/new" className="btn-secondary py-2"><Plus size={16} /> New</Link>} />

      {invites.length ? (
        <section className="mb-6 space-y-2">
          <h2 className="section-title">Invitations</h2>
          {invites.map((inv) => (
            <div key={inv.id} className="card flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{inv.group.name}</p>
                <p className="text-[13px] text-muted">from {inv.from.displayName ?? inv.from.username}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={respondInvite.bind(null, inv.id, true)}><button className="btn-primary py-2">Accept</button></form>
                <form action={respondInvite.bind(null, inv.id, false)}><button className="btn-secondary py-2">Decline</button></form>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        {groups.length === 0 ? (
          <div className="card text-center text-[14px] text-muted">You are not in a group yet. Create one and invite friends by username.</div>
        ) : (
          groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="card flex items-center justify-between transition hover:bg-stone-50">
              <div>
                <p className="font-medium">{g.name}</p>
                <p className="text-[13px] text-muted">{g._count.members} {g._count.members === 1 ? "member" : "members"}</p>
              </div>
              <ChevronRight size={18} className="text-muted" />
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
