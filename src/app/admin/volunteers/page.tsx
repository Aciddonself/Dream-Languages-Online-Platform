import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireRole } from "@/lib/rbac";
import { db } from "@/db";
import { teacherApplications } from "@/db/schema";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { TeacherApplicationReview } from "@/components/teacher-application-review";

const nav = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/volunteers", label: "Teacher applications", icon: "🧑‍🏫" },
  { href: "/admin/cms", label: "CMS", icon: "📝" },
];

export const dynamic = "force-dynamic";

export default async function VolunteerApplicationsPage() {
  await requireRole(["super_admin"]);
  const applications = await db.select().from(teacherApplications).orderBy(desc(teacherApplications.createdAt));
  return (
    <PortalShell title="Teacher Applications" nav={nav}>
      <h1 className="display-font mb-2 text-3xl font-bold">Teacher applications</h1>
      <p className="mb-5 text-sm opacity-70">Review private contact details and application documents. Only school administrators can access this queue.</p>
      <div className="grid gap-4">
        {applications.length ? applications.map((application: { id: string; firstName: string; lastName: string; languageTaught: string; isVolunteer: boolean; payPerSession?: number | null; availability?: string | null; email: string; phone: string; address: string; nextOfKinName: string; nextOfKinRelationship: string; nextOfKinPhone: string; nextOfKinAddress: string; recommendationPath?: string | null; referenceName?: string | null; referencePhone?: string | null; createdAt: Date; status: string }) => (
          <GlassCard key={application.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{application.firstName} {application.lastName}</h2>
                <p className="text-sm">{application.languageTaught} · {application.isVolunteer ? "Volunteer" : `Paid · UGX ${application.payPerSession?.toLocaleString()} per session · ${application.availability?.replace("_", "-")}`}</p>
                <p className="mt-2 text-sm opacity-75">{application.email} · {application.phone} · {application.address}</p>
                <p className="mt-2 text-sm opacity-75">Next of kin: {application.nextOfKinName} ({application.nextOfKinRelationship}), {application.nextOfKinPhone}, {application.nextOfKinAddress}</p>
                {application.referenceName && <p className="mt-2 text-sm opacity-75">Reference: {application.referenceName} · {application.referencePhone}</p>}
                <p className="mt-2 text-xs opacity-60">Submitted {application.createdAt.toLocaleString()}</p>
              </div>
              <TeacherApplicationReview id={application.id} status={application.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
              <Link className="underline" href={`/api/admin/volunteer-applications/${application.id}/cv`}>CV</Link>
              <Link className="underline" href={`/api/admin/volunteer-applications/${application.id}/cover-letter`}>Cover letter</Link>
              {application.recommendationPath ? <Link className="underline" href={`/api/admin/volunteer-applications/${application.id}/recommendation`}>Recommendation letter</Link> : null}
            </div>
          </GlassCard>
        )) : <GlassCard className="p-5 text-sm opacity-70">No teacher applications have been submitted.</GlassCard>}
      </div>
    </PortalShell>
  );
}
