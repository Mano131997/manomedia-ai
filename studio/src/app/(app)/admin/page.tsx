import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Admin } from "@/components/Admin";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/image");
  return <Admin selfId={user.id} />;
}
