import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { StudentAiTutorChat } from "./student-chat";

const nav = [
  { href: "/student", label: "Dashboard", icon: "🏠" },
  { href: "/student/ai-tutor", label: "AI Tutor", icon: "🎓" },
  { href: "/student/timetable", label: "Timetable", icon: "🗓️" },
  { href: "/student/fees", label: "Fees", icon: "💰" },
  { href: "/student/attendance", label: "Attendance", icon: "✅" },
  { href: "/student/exams", label: "Exams", icon: "📝" },
  { href: "/student/results", label: "Results", icon: "📊" },
  { href: "/student/materials", label: "Materials", icon: "📄" },
  { href: "/student/community", label: "Community", icon: "💬" },
];

export const dynamic = "force-dynamic";

export default async function StudentAiTutorPage() {
  const user = await requireRole(["student", "super_admin"]);

  return (
    <PortalShell title="Father-DLA AI Tutor" nav={nav}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white font-bold text-lg shadow">
              🎓
            </span>
            <h1 className="display-font text-3xl font-bold">Father-DLA AI Language Tutor</h1>
          </div>
          <p className="text-sm opacity-70 mt-1">
            Your 24/7 personal language companion for French, German, Kiswahili, Luganda, Spanish, Arabic, and more.
          </p>
        </div>
      </div>

      <StudentAiTutorChat studentName={user.firstName ?? "Student"} />
    </PortalShell>
  );
}
