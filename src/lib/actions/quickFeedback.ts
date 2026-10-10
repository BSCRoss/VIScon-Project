"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { dateOnly } from "@/lib/time";
import { fail, ok, type ActionResult } from "./types";

const schema = z.object({
  dishId: z.string().min(1),
  dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rating: z.number().int().min(1).max(5),
  wouldAgain: z.boolean().nullable(),
});

/** The "how was yesterday?" popup: rating + would-eat-again for one dish. Upserts the day's feedback row. */
export async function submitQuickFeedback(input: z.infer<typeof schema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("Pick a star rating");
  const { dishId, dateIso, rating, wouldAgain } = parsed.data;
  const dish = await prisma.dish.findUnique({ where: { id: dishId }, select: { mensaId: true } });
  if (!dish) return fail("Dish not found");
  const date = dateOnly(dateIso);
  await prisma.feedback.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { dishId, mensaId: dish.mensaId, rating, wouldAgain },
    create: { userId: user.id, date, dishId, mensaId: dish.mensaId, rating, wouldAgain },
  });
  revalidatePath("/", "layout");
  return ok("Thanks!");
}
