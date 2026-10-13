import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { apiUser, handle, HttpError } from "@/lib/auth";

// Change your own password.
export const PATCH = handle(async (req: Request) => {
  const user = await apiUser();
  const { currentPassword, newPassword } = (await req.json()) as { currentPassword?: string; newPassword?: string };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(String(currentPassword ?? ""), row.passwordHash))) {
    throw new HttpError(400, "Huidig wachtwoord klopt niet");
  }
  if (!newPassword || newPassword.length < 10) throw new HttpError(400, "Nieuw wachtwoord: minstens 10 tekens");
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
  return Response.json({ ok: true });
});
