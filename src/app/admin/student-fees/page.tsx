import { redirect } from "next/navigation";
import { requireRole } from "@/lib/rbac";

export default async function AdminStudentFeesPage() {
  await requireRole(["admin", "super_admin"]);
  redirect("/finance/students");
}
