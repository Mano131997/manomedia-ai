import { db } from "@/lib/db";
import { apiUser, handle } from "@/lib/auth";

export const GET = handle(async () => {
  const user = await apiUser();
  const chats = await db.conversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
    take: 100,
  });
  return Response.json(chats);
});

export const POST = handle(async () => {
  const user = await apiUser();
  const chat = await db.conversation.create({ data: { userId: user.id } });
  return Response.json({ id: chat.id, title: chat.title });
});
