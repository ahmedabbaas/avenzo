import { requireAdmin } from "../../lib/admin/auth";
import AdminPanel from "./panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();
  return <AdminPanel email={user.email ?? "Admin"} />;
}
