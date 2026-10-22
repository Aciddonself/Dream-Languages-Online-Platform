import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard, Badge } from "@/components/ui/glass";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { GlassButton } from "@/components/ui/glass";

const nav = [
  { href: "/applicant", label: "Dashboard", icon: "🏠" },
  { href: "/applicant/documents", label: "Documents", icon: "📄" },
  { href: "/applicant/status", label: "Application Tracker", icon: "📍" },
];

export default async function ApplicantDashboard() {
  await requireRole(["applicant", "student", "super_admin"]);
  const user = await getCurrentUser();
  const steps = ["Submitted", "Documents Review", "Interview/Placement Test", "Approved", "Fees", "Enrolled"];
  return (
    <PortalShell title="Applicant Portal" nav={nav}>
      <div className="mb-6">
        <h1 className="display-font text-3xl font-bold">Application Tracker</h1>
        <p className="text-sm opacity-60">Track your admission progress.</p>
      </div>
      <GlassCard className="p-5 mb-4 flex flex-wrap items-center justify-between gap-4" strong>
        <div>
          <div className="text-sm opacity-70">Application registration number</div>
          <div className="font-mono text-lg font-semibold">{user?.registrationNumber ?? "Pending assignment"}</div>
        </div>
        <Link href="/api/portal/documents/admission">
          <GlassButton>Download admission form (PDF)</GlassButton>
        </Link>
      </GlassCard>
      <GlassCard className="p-6 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <Badge tone={i < 2 ? "success" : "info"}>{s}</Badge>
              {i < steps.length - 1 && <span className="opacity-40">→</span>}
            </div>
          ))}
        </div>
      </GlassCard>
      <div className="grid md:grid-cols-2 gap-4">
        <GlassCard className="p-6">
          <div className="font-semibold mb-2">Placement Test</div>
          <p className="text-sm opacity-70 mb-3">Take your CEFR placement test (A1–C2) to be placed at the right level.</p>
          <button className="btn-glass btn-glass-primary px-4 py-2 rounded-xl font-semibold">Start Test</button>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="font-semibold mb-2">Documents</div>
          <p className="text-sm opacity-70 mb-3">Upload required documents for review.</p>
          <button className="btn-glass px-4 py-2 rounded-xl font-semibold">Upload Documents</button>
        </GlassCard>
      </div>
    </PortalShell>
  );
}