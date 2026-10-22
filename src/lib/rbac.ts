import { getCurrentUser } from "@/lib/auth";
import type { users } from "@/db/schema";
import { redirect } from "next/navigation";

type User = typeof users.$inferSelect;

const ROLE_PERMS: Record<string, string[]> = {
  super_admin: ["*"],
  head_academics: [
    "academic.read", "academic.update", "exam.approve", "exam.reopen", "grade.read",
    "teacher.supervise", "content.read",
  ],
  teacher: [
    "class.read", "class.update", "attendance.mark", "material.upload", "exam.create",
    "exam.mark", "result.publish", "community.moderate",
  ],
  finance: [
    "fee.read", "fee.update", "payment.verify", "hold.manage", "receipt.issue", "report.finance",
  ],
  student: ["self.read", "self.update", "community.post", "exam.take", "result.read"],
  applicant: ["self.read", "self.update", "document.upload"],
  guest: ["public.read"],
};

export function hasPermission(role: string, perm: string) {
  const perms = ROLE_PERMS[role] ?? [];
  if (perms.includes("*")) return true;
  return perms.includes(perm);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireRole(roles: string[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(roleHome(user.role));
  return user;
}

export function canDelete(role: string) {
  return role === "super_admin";
}

export function roleHome(role: string) {
  switch (role) {
    case "super_admin": return "/admin";
    case "head_academics": return "/hoc";
    case "teacher": return "/teacher";
    case "finance": return "/finance";
    case "student": return "/student";
    case "applicant": return "/applicant";
    default: return "/";
  }
}