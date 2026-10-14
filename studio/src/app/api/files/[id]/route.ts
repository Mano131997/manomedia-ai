import { db } from "@/lib/db";
import { apiUser, handle, HttpError } from "@/lib/auth";
import { readAsset } from "@/lib/storage";

// Files are shared within the team: any signed-in colleague can view and download them.
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await apiUser();
  const { id } = await ctx.params;
  const asset = await db.asset.findUnique({ where: { id } });
  if (!asset) throw new HttpError(404, "Bestand niet gevonden");
  const data = await readAsset(asset.storageKey);
  const download = new URL(req.url).searchParams.has("download");
  const headers: Record<string, string> = {
    "Content-Type": asset.mime,
    "Content-Length": String(data.length),
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    // SVG demo images must not run scripts when opened directly.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  };
  if (download) headers["Content-Disposition"] = `attachment; filename="${asset.fileName.replace(/[^\w.\-]/g, "_")}"`;
  return new Response(new Uint8Array(data), { headers });
});
