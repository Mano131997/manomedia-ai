import { db } from "@/lib/db";
import { apiUser, handle, HttpError } from "@/lib/auth";
import { refreshGeneration, serializeGeneration } from "@/lib/generations";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await apiUser();
  const { id } = await ctx.params;
  const gen = await db.generation.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
  if (!gen) throw new HttpError(404, "Niet gevonden");
  const fresh = await refreshGeneration(gen);
  return Response.json(serializeGeneration({ ...fresh, user: gen.user }));
});

// Owners and admins can delete a generation from the library.
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const gen = await db.generation.findUnique({ where: { id } });
  if (!gen) throw new HttpError(404, "Niet gevonden");
  if (gen.userId !== user.id && user.role !== "admin") throw new HttpError(403, "Niet jouw beeld");
  await db.generation.delete({ where: { id } });
  return Response.json({ ok: true });
});
