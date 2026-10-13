import { Chat } from "@/components/Chat";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <Chat initialId={id} />;
}
