import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiUser, handle, HttpError } from "@/lib/auth";

// Update a colleague: active (revoke/restore access), role, budget, or reset password.
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await apiUser({ admin: true });
  const { id } = await ctx.params;
  const body = (await req.json()) as { active?: boolean; role?: string; budgetCents?: number; password?: string };
  if (id === admin.id && (body.active === false || body.role === "member")) {
    throw new HttpError(400, "Je kan jezelf niet blokkeren of je admin-rol afnemen");
  }
  const data: { active?: boolean; role?: string; budgetCents?: number; passwordHash?: string } = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.role === "admin" || body.role === "member") data.role = body.role;
  if (typeof body.budgetCents === "number") data.budgetCents = Math.max(0, Math.round(body.budgetCents));
  if (body.password !== undefined) {
    if (body.password.length < 10) throw new HttpError(400, "Wachtwoord: minstens 10 tekens");
    data.passwordHash = await bcrypt.hash(body.password, 12);
  }
  await db.user.update({ where: { id }, data });
  return Response.json({ ok: true });
});
