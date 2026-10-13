import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, handle, HttpError } from "@/lib/auth";

export const POST = handle(async (req: Request) => {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  const user = await db.user.findUnique({ where: { email: String(email ?? "").trim().toLowerCase() } });
  const ok = user && user.active && (await bcrypt.compare(String(password ?? ""), user.passwordHash));
  if (!ok) throw new HttpError(401, "E-mail of wachtwoord klopt niet");
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  await createSession(user.id, proto === "https");
  return Response.json({ ok: true });
});
