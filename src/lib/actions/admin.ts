"use server";

import { requireUser } from "@/lib/session";
import { runImport } from "@/lib/importers";
import { revalidatePath } from "next/cache";

/** Dev panel: who may trigger an import from the UI. */
export async function canRunImport(username: string): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  const admins = (process.env.ADMIN_USERNAMES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return admins.includes(username.toLowerCase());
}

export async function runImportAction(): Promise<string> {
  const user = await requireUser();
  if (!(await canRunImport(user.username))) return "Not allowed";
  const result = await runImport("all");
  revalidatePath("/", "layout");
  return JSON.stringify(result, null, 2);
}
