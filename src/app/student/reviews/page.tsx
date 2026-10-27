import { StudentReviewForm } from "@/components/student-review-form";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { requireRole } from "@/lib/rbac";
import { TeacherRatingForm } from "@/components/content-controls";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/student", label: "Dashboard", icon: "🏠" },
  { href: "/student/fees", label: "Fees", icon: "💰" },
  { href: "/student/attendance", label: "Attendance", icon: "✅" },
  { href: "/student/exams", label: "Exams", icon: "📝" },
  { href: "/student/results", label: "Results", icon: "📊" },
  { href: "/student/materials", label: "Materials", icon: "📄" },
  { href: "/student/community", label: "Class discussion", icon: "💬" },
  { href: "/student/reviews", label: "Share a Review", icon: "⭐" },
];

export default async function StudentReviewPage() {
  await requireRole(["student"]);
  const teachers = (await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName })
    .from(users)
    .where(and(eq(users.role, "teacher"), isNull(users.deletedAt)))
  ).map((t) => ({ id: t.id, name: t.displayName ?? ([t.firstName, t.lastName].filter(Boolean).join(" ") || "Teacher") }));
  return (
    <PortalShell title="Student Portal" nav={nav}>
      <h1 className="display-font text-3xl font-bold mb-2">Share a Review</h1>
      <p className="text-sm opacity-65 mb-5">Your review is private until an administrator approves it for the public website.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-5"><h2 className="font-semibold mb-3">Review DLA</h2><StudentReviewForm /></GlassCard>
        <GlassCard className="p-5"><h2 className="font-semibold mb-3">Rate a teacher</h2><TeacherRatingForm teachers={teachers} /></GlassCard>
      </div>
    </PortalShell>
  );
}
