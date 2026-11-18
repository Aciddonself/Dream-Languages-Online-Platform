import { GlassCard } from "@/components/ui/glass";
import { ApplyForm } from "@/components/apply-form";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { asc } from "drizzle-orm";
import { MONTHS, nextIntakeIndex, YEAR } from "@/lib/classes-2027";

export const dynamic = "force-dynamic";

export default async function ApplyPage({
  searchParams,
}: {
  searchParams?: Promise<{ dept?: string; code?: string; intake?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const initialDeptParam = params?.dept ?? "";
  const requestedIntake = `${MONTHS[nextIntakeIndex(new Date())]} ${YEAR}`;

  let departmentOptions: { id: string; name: string }[] = [];
  try {
    departmentOptions = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .orderBy(asc(departments.name));
  } catch (err) {
    console.warn("Apply page DB error, using resilient department list:", err);
  }

  // If code is provided (e.g. ?code=ger), match it to a real department record.
  let initialDepartmentId = initialDeptParam;
  if (!initialDepartmentId && params?.code) {
    const codeUpper = params.code.toUpperCase();
    const matched = departmentOptions.find((department) => department.name.toUpperCase() === codeUpper);
    if (matched) initialDepartmentId = matched.id;
  }

  return (
    <main className="min-h-screen grid place-items-center px-6 py-10">
      <GlassCard className="w-full max-w-2xl p-8" strong>
        <h1 className="display-font text-2xl font-bold mb-1">Apply for Admission</h1>
        <p className="text-sm opacity-70 mb-6">
          Start your application for the {requestedIntake} intake. The admissions team will review your details and confirm your place before enrolment.
        </p>
        {departmentOptions.length === 0 && <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm" role="status">Applications are temporarily unavailable because no language departments are configured. Please contact the school.</p>}
        <ApplyForm
          departments={departmentOptions}
          initialDepartmentId={initialDepartmentId}
          requestedIntake={requestedIntake}
        />
      </GlassCard>
    </main>
  );
}
