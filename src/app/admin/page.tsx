import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";

export default async function AdminIndex() {
  const s = await getAdminSession();
  if (s.isLoggedIn) redirect("/admin/dashboard");
  redirect("/admin/login");
}
