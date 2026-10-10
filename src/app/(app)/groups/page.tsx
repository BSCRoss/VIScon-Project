import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getInvites, getUserGroups } from "@/lib/queries/group";
import { respondInvite } from "@/lib/actions/groups";

export default async function GroupsPage() {
  const user = await requireUser();
  const [groups, invites] = await Promise.all([getUserGroups(user.id), getInvites(user.id)]);
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Groups</h1>
        <Link href="/groups/new" className="btn-secondary py-1.5">New group</Link>
      </header>

      {invites.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Invitations</h2>
          {invites.map((inv) => (
            <div key={inv.id} className="card flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">{inv.group.name}</p>
                <p className="text-sm text-stone-500">from {inv.from.displayName ?? inv.from.username}</p>
              </div>
              <div className="flex gap-2">
                <form action={respondInvite.bind(null, inv.id, true)}><button className="btn-primary py-1.5">Accept</button></form>
                <form action={respondInvite.bind(null, inv.id, false)}><button className="btn-secondary py-1.5">Decline</button></form>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        {groups.length === 0 ? (
          <div className="card text-center text-stone-600">You are not in a group yet. Create one and invite friends by username.</div>
        ) : (
          groups.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="card flex items-center justify-between">
              <span className="font-medium">{g.name}</span>
              <span className="text-sm text-stone-500">{g._count.members} {g._count.members === 1 ? "member" : "members"} →</span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
