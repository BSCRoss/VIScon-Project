import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type CurrentUser = { id: string; username: string; name: string | null };

/** Use in pages/actions: returns the logged-in user or redirects to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return { id: session.user.id, username: session.user.username, name: session.user.name ?? null };
}

/** Like requireUser, but also sends users without any selected mensa to /onboarding. */
export async function requireOnboardedUser(): Promise<CurrentUser> {
  const user = await requireUser();
  const count = await prisma.userMensa.count({ where: { userId: user.id } });
  if (count === 0) redirect("/onboarding");
  return user;
}
