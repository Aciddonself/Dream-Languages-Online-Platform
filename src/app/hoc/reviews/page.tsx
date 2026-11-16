import { desc, eq } from "drizzle-orm";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { AdminReviewDecision } from "@/components/admin-cms-controls";
import { db } from "@/db";
import { testimonials } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/hoc", label: "Dashboard", icon: "🏠" },
  { href: "/hoc/reviews", label: "Public reviews", icon: "⭐" },
  { href: "/hoc/live-classes", label: "Live Classes", icon: "🎥" },
  { href: "/hoc/attendance", label: "Attendance", icon: "✅" },
  { href: "/hoc/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/hoc/community", label: "Class discussions", icon: "💬" },
];

export default async function HocReviewsPage() {
  await requireRole(["head_academics", "super_admin"]);
  const reviews = await db.select().from(testimonials)
    .where(eq(testimonials.published, false))
    .orderBy(desc(testimonials.createdAt))
    .limit(100);

  return (
    <PortalShell title="Public review approvals" nav={nav}>
      <h1 className="mb-2 text-3xl font-bold">Review submissions</h1>
      <p className="mb-5 text-sm">Approve appropriate reviews before they appear on the public website. Rejected reviews remain private.</p>
      {reviews.length ? (
        <ul className="grid gap-3">
          {reviews.map((review) => (
            <li key={review.id}>
              <GlassCard className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold">{review.authorName} · {review.rating ?? 5}/5</h2>
                  <p className="mt-1 text-sm">{review.role ?? "DLA community"}</p>
                  <p className="mt-3 whitespace-pre-wrap">{review.quote}</p>
                </div>
                <AdminReviewDecision reviewId={review.id} />
              </GlassCard>
            </li>
          ))}
        </ul>
      ) : (
        <GlassCard className="p-5">There are no reviews waiting for approval.</GlassCard>
      )}
    </PortalShell>
  );
}
