import { db } from "@/lib/db";
import { apiUser, handle, HttpError } from "@/lib/auth";
import { chatItems } from "@/lib/chat";

async function ownChat(userId: string, id: string) {
  const chat = await db.conversation.findUnique({ where: { id } });
  if (!chat || chat.userId !== userId) throw new HttpError(404, "Gesprek niet gevonden");
  return chat;
}

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const chat = await ownChat(user.id, id);
  return Response.json({ id: chat.id, title: chat.title, items: await chatItems(chat.id) });
});

export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  await ownChat(user.id, id);
  await db.conversation.delete({ where: { id } });
  return Response.json({ ok: true });
});
