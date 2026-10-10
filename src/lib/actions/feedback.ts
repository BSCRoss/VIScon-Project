"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { appDate } from "@/lib/time";
import { fail, type ActionResult } from "./types";

const schema = z.object({
  mensaId: z.string().min(1, "Pick the mensa you went to"),
  dishId: z.string().optional(),
  queueBucket: z.enum(["NONE", "LT10", "B10_30", "GT30"]).optional(),
  rating: z.coerce.number().int().min(1, "Rate your dish").max(5),
  waitMinutes: z.coerce.number().int().min(0).max(180).optional(),
  wouldAgain: z.enum(["yes", "no"]).optional(),
  arrivedAt: z.coerce.number().int().optional(),
  comment: z.string().trim().max(500).optional(),
});

const opt = (v: FormDataEntryValue | null) => (v === null || v === "" ? undefined : v);

export async function submitFeedback(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    mensaId: formData.get("mensaId"),
    dishId: opt(formData.get("dishId")),
    queueBucket: opt(formData.get("queueBucket")),
    rating: opt(formData.get("rating")),
    waitMinutes: opt(formData.get("waitMinutes")),
    wouldAgain: opt(formData.get("wouldAgain")),
    arrivedAt: opt(formData.get("arrivedAt")),
    comment: opt(formData.get("comment")),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const date = appDate();
  const data = {
    mensaId: d.mensaId,
    dishId: d.dishId ?? null,
    queueBucket: d.queueBucket ?? null,
    rating: d.rating,
    waitMinutes: d.waitMinutes ?? null,
    wouldAgain: d.wouldAgain === undefined ? null : d.wouldAgain === "yes",
    arrivedAt: d.arrivedAt ?? null,
    comment: d.comment ?? null,
  };
  await prisma.feedback.upsert({ where: { userId_date: { userId: user.id, date } }, update: data, create: { ...data, userId: user.id, date } });
  revalidatePath("/", "layout");
  redirect("/feedback?done=1");
}
