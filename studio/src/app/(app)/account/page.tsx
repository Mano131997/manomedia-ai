import { requireUser } from "@/lib/auth";
import { Account } from "@/components/Account";

export default async function AccountPage() {
  const user = await requireUser();
  return <Account name={user.name} email={user.email} />;
}
