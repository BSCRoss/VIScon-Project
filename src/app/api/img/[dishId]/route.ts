import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/img/<dishId>?s=thumb|medium → cached WebP; falls back to a redirect to the original. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ dishId: string }> }) {
  const { dishId } = await params;
  const size = req.nextUrl.searchParams.get("s") === "thumb" ? "thumb" : "medium";
  const row = await prisma.dishImage.findUnique({ where: { dishId }, select: { [size]: true } as { thumb?: true; medium?: true } });
  const bytes = row ? (row as { thumb?: Uint8Array; medium?: Uint8Array })[size] : null;
  if (bytes) {
    return new NextResponse(Buffer.from(bytes), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "Content-Length": String(bytes.byteLength) },
    });
  }
  const dish = await prisma.dish.findUnique({ where: { id: dishId }, select: { imageUrl: true } });
  if (dish?.imageUrl) return NextResponse.redirect(dish.imageUrl, { status: 302 });
  return new NextResponse(null, { status: 404 });
}
