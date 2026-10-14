import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiUser, handle, HttpError } from "@/lib/auth";
import { monthStart } from "@/lib/usage";

export const GET = handle(async () => {
  await apiUser({ admin: true });
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  const spend = await db.usageEvent.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: monthStart() } },
    _sum: { cents: true },
  });
  const byUser = new Map(spend.map((s) => [s.userId, s._sum.cents ?? 0]));
  return Response.json(
    users.map((u) => ({
      id: u.id, email: u.email, name: u.name, role: u.role, active: u.active,
      budgetCents: u.budgetCents, monthCents: byUser.get(u.id) ?? 0,
    })),
  );
});

// Invite a colleague: the admin sets a starting password and passes it on.
export const POST = handle(async (req: Request) => {
  await apiUser({ admin: true });
  const body = (await req.json()) as { email?: string; name?: string; password?: string; role?: string; budgetCents?: number };
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "Ongeldig e-mailadres");
  if (!name) throw new HttpError(400, "Naam is verplicht");
  if (!body.password || body.password.length < 10) throw new HttpError(400, "Startwachtwoord: minstens 10 tekens");
  if (await db.user.findUnique({ where: { email } })) throw new HttpError(409, "Dit e-mailadres heeft al toegang");
  const user = await db.user.create({
    data: {
      email, name,
      role: body.role === "admin" ? "admin" : "member",
      budgetCents: Math.max(0, Math.round(body.budgetCents ?? 0)),
      passwordHash: await bcrypt.hash(body.password, 12),
    },
  });
  return Response.json({ id: user.id });
});
