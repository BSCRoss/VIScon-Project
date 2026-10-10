import { NextResponse, type NextRequest } from "next/server";
import { runImport, type ImportSource } from "@/lib/importers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/import?source=eth|food2050|all&week=YYYY-MM-DD  (Authorization: Bearer $CRON_SECRET) */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const source = (req.nextUrl.searchParams.get("source") ?? "all") as ImportSource;
  if (!["eth", "food2050", "all"].includes(source)) return NextResponse.json({ error: "bad source" }, { status: 400 });
  const week = req.nextUrl.searchParams.get("week") ?? undefined;
  if (week && !/^\d{4}-\d{2}-\d{2}$/.test(week)) return NextResponse.json({ error: "bad week" }, { status: 400 });

  const result = await runImport(source, week);
  console.log(`[import] ${JSON.stringify(result)}`);
  return NextResponse.json(result);
}
