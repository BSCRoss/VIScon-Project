"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signIn, signOut } from "@/auth";
import { fail, ok, type ActionResult } from "./types";

const registerSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Username: 3–24 characters, letters, numbers or underscore"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().trim().max(40, "Display name too long").optional(),
});

export async function register(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    displayName: formData.get("displayName") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const { username, password, displayName } = parsed.data;

  if (await prisma.user.findUnique({ where: { username } })) return fail("That username is taken");
  await prisma.user.create({ data: { username, displayName: displayName || null, passwordHash: await bcrypt.hash(password, 10) } });

  await signIn("credentials", { username, password, redirectTo: "/onboarding" }); // throws a redirect on success
  return ok();
}

export async function login(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return fail("Enter your username and password");
  try {
    await signIn("credentials", { username, password, redirectTo: "/today" });
  } catch (e) {
    if (e instanceof AuthError) return fail("Wrong username or password");
    throw e; // NEXT_REDIRECT must propagate
  }
  return ok();
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
