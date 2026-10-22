import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { cmsPages, newsPosts, testimonials } from "@/db/schema";
import { desc } from "drizzle-orm";
import { AdminCmsPageCreate, AdminCmsPageEditor, AdminNewsCreate, AdminReviewDecision } from "@/components/admin-cms-controls";
import { AnnouncementCreate } from "@/components/announcement-create";
import { classes } from "@/db/schema";
import { isNull } from "drizzle-orm";

const nav = [{ href: "/admin", label: "Dashboard", icon: "🏠" }, { href: "/admin/cms", label: "CMS", icon: "📝" }, { href: "/admin/sms", label: "Bulk SMS", icon: "✉️" }];

export default async function AdminCms() {
  await requireRole(["super_admin"]);
  const [pages, posts, reviews] = await Promise.all([
    db.select().from(cmsPages).orderBy(desc(cmsPages.updatedAt)).limit(50),
    db.select().from(newsPosts).orderBy(desc(newsPosts.createdAt)).limit(50),
    db.select().from(testimonials).orderBy(desc(testimonials.createdAt)).limit(100),
  ]);
  const schoolClasses = await db.select({ id: classes.id, name: classes.name }).from(classes).where(isNull(classes.deletedAt)).orderBy(classes.name);
  return (
    <PortalShell title="Website CMS" nav={nav}>
      <h1 className="display-font text-2xl font-bold mb-4">Website CMS</h1>
      <p className="mb-5 text-sm opacity-70">Review published and draft website content. Updates appear on the public site when content is published.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-5" strong>
          <h2 className="font-semibold mb-3">Create a website update</h2>
          <AdminNewsCreate />
        </GlassCard>
        <GlassCard className="p-5" strong>
          <h2 className="font-semibold mb-3">Publish a school announcement</h2>
          <AnnouncementCreate classes={schoolClasses} allowAll />
        </GlassCard>
        <GlassCard className="p-5" strong>
          <h2 className="font-semibold mb-3">Create a website page</h2>
          <AdminCmsPageCreate />
        </GlassCard>
        <GlassCard className="p-5 lg:col-span-2" strong>
          <h2 className="font-semibold mb-3">Website pages ({pages.length})</h2>
          <p className="mb-4 text-xs opacity-65">Page content is plain text, safely escaped on display. Each save creates an audited version; archived and unpublished pages are not public.</p>
          {pages.length ? <div className="space-y-4">{pages.map((page) => (
            <AdminCmsPageEditor key={page.id} page={page} />
          ))}</div> : <p className="text-sm opacity-65">No CMS pages have been created yet.</p>}
        </GlassCard>
        <GlassCard className="p-5" strong>
          <h2 className="font-semibold mb-3">News and stories ({posts.length})</h2>
          {posts.length ? <ul className="space-y-2 text-sm">{posts.map((post) => (
            <li className="glass flex items-center justify-between gap-3 px-3 py-2" key={post.id}>
              <span>{post.title}</span><span className="text-xs opacity-65">{post.status}</span>
            </li>
          ))}</ul> : <p className="text-sm opacity-65">No news posts have been added yet.</p>}
        </GlassCard>
        <GlassCard className="p-5 lg:col-span-2" strong>
          <h2 className="font-semibold mb-3">Student reviews/comments awaiting approval ({reviews.filter((review) => !review.published).length})</h2>
          {reviews.filter((review) => !review.published).length ? (
            <ul className="space-y-3">{reviews.filter((review) => !review.published).map((review) => (
              <li className="rounded-xl border border-white/10 p-3" key={review.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="font-semibold">{review.authorName} · {review.rating ?? 5}/5</div><p className="mt-1 text-sm opacity-75">{review.quote}</p></div>
                  <AdminReviewDecision reviewId={review.id} />
                </div>
              </li>
            ))}</ul>
          ) : <p className="text-sm opacity-65">No student reviews are awaiting approval.</p>}
          <div className="mt-4 text-xs opacity-65">Approved reviews are shown on the public website; rejected reviews remain unpublished.</div>
        </GlassCard>
        <GlassCard className="p-5 lg:col-span-2">
          <h2 className="font-semibold mb-2">Content workflow</h2>
          <p className="text-sm opacity-70">Create and publish news updates, and approve student reviews before publication. Page layout and course, FAQ, partner, and gallery records are still managed through code/database setup.</p>
        </GlassCard>
      </div>
    </PortalShell>
  );
}