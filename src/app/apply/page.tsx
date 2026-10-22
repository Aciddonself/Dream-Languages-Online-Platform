import { GlassCard } from "@/components/ui/glass";
import { ApplyForm } from "@/components/apply-form";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { asc } from "drizzle-orm";
import { DEFAULT_DEPARTMENTS } from "@/lib/public-content";

export const revalidate = 60;

export default async function ApplyPage({
  searchParams,
}: {
  searchParams?: Promise<{ dept?: string; code?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const initialDeptParam = params?.dept ?? "";

  let departmentOptions: { id: string; name: string }[] = [];
  try {
    departmentOptions = await db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .orderBy(asc(departments.name));
  } catch (err) {
    console.warn("Apply page DB error, using resilient department list:", err);
  }

  if (departmentOptions.length === 0) {
    departmentOptions = DEFAULT_DEPARTMENTS.map((d) => ({ id: d.id, name: d.name }));
  }

  // If code is provided (e.g. ?code=ger), match to ID
  let initialDepartmentId = initialDeptParam;
  if (!initialDepartmentId && params?.code) {
    const codeUpper = params.code.toUpperCase();
    const matched = DEFAULT_DEPARTMENTS.find((d) => d.code === codeUpper);
    if (matched) initialDepartmentId = matched.id;
  }

  return (
    <main className="min-h-screen grid place-items-center px-6 py-10">
      <GlassCard className="w-full max-w-2xl p-8" strong>
        <h1 className="display-font text-2xl font-bold mb-1">Apply for Admission</h1>
        <p className="text-sm opacity-70 mb-6">
          Dream Languages Uganda offers language and adult literacy education, practical skills training, and flexible learning for students of all ages. Submit your details to open an applicant account and receive your registration number.
        </p>
        <ApplyForm
          departments={departmentOptions}
          initialDepartmentId={initialDepartmentId}
        />
      </GlassCard>
    </main>
  );
}
