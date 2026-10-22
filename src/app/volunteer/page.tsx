import { GlassCard } from "@/components/ui/glass";
import { TeacherApplicationForm } from "@/components/teacher-application-form";

export default function VolunteerTeacherPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <GlassCard className="p-6 md:p-9" strong>
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-primary)]">Work with Dream Languages Uganda</p>
        <h1 className="display-font mt-2 text-3xl font-bold">Teach with us</h1>
        <p className="mb-7 mt-3 opacity-75">Share your language expertise with our learners. Apply to volunteer or tell us your paid teaching expectations. The school administrator will review your application and documents.</p>
        <TeacherApplicationForm />
      </GlassCard>
    </main>
  );
}
