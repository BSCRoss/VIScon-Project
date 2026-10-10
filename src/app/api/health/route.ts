import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dishesToday = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "Dish" WHERE date = (now() AT TIME ZONE 'Europe/Zurich')::date`;
    return NextResponse.json({ ok: true, dishesToday: Number(dishesToday[0]?.n ?? 0) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
