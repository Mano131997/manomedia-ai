import { db } from "@/lib/db";
import { apiUser, handle, HttpError } from "@/lib/auth";
import { chatItems, sendChatMessage } from "@/lib/chat";

export const maxDuration = 300;

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await apiUser();
  const { id } = await ctx.params;
  const chat = await db.conversation.findUnique({ where: { id } });
  if (!chat || chat.userId !== user.id) throw new HttpError(404, "Gesprek niet gevonden");
  const body = (await req.json()) as { text?: string; assetIds?: string[] };
  const assetIds = Array.isArray(body.assetIds) ? body.assetIds.filter((a) => typeof a === "string").slice(0, 4) : [];
  await sendChatMessage({ userId: user.id, conversationId: id, text: String(body.text ?? ""), assetIds });
  const fresh = await db.conversation.findUniqueOrThrow({ where: { id } });
  return Response.json({ id, title: fresh.title, items: await chatItems(id) });
});
