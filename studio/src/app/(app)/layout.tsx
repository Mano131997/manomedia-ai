import { requireUser } from "@/lib/auth";
import { falEnabled } from "@/lib/fal";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="shell">
      <Sidebar name={user.name} isAdmin={user.role === "admin"} demo={!falEnabled()} />
      <main className="main">{children}</main>
    </div>
  );
}
