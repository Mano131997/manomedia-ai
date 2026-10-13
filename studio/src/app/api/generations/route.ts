import { db } from "@/lib/db";
import { apiUser, handle, HttpError } from "@/lib/auth";
import {
  createImageGeneration,
  createVideoGeneration,
  refreshGeneration,
  serializeGeneration,
} from "@/lib/generations";

// GET /api/generations?type=image&mine=1&take=60
export const GET = handle(async (req: Request) => {
  const user = await apiUser();
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const mine = url.searchParams.get("mine") === "1";
  const take = Math.min(200, Number(url.searchParams.get("take") ?? 60));
  const rows = await db.generation.findMany({
    where: {
      ...(type === "image" || type === "video" ? { type } : {}),
      ...(mine ? { userId: user.id } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { name: true } } },
  });
  // Check pending jobs with the provider while we're here.
  const fresh = await Promise.all(
    rows.map(async (g) =>
      g.status === "queued" || g.status === "running" ? { ...(await refreshGeneration(g)), user: g.user } : g,
    ),
  );
  return Response.json(fresh.map(serializeGeneration));
});

export const POST = handle(async (req: Request) => {
  const user = await apiUser();
  const body = await req.json();
  let gens;
  if (body.type === "image") gens = await createImageGeneration(user.id, body);
  else if (body.type === "video") gens = [await createVideoGeneration(user.id, body)];
  else throw new HttpError(400, "type moet image of video zijn");
  return Response.json(gens.map((g) => serializeGeneration({ ...g, user: { name: user.name } })));
});
