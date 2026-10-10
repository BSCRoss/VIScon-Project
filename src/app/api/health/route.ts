import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { appDate, appDateString } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dishesToday = await prisma.dish.count({ where: { date: appDate() } });
    return NextResponse.json({ ok: true, date: appDateString(), dishesToday });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
