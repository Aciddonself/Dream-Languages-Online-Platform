import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { classes, exams } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

const schema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  classId: z.string().uuid(),
  assessmentType: z.enum(["test", "exam", "final_exam"]),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  durationMinutes: z.coerce.number().int().min(5).max(480).default(60),
}).refine((value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt, {
  message: "Assessment end must be after its start",
  path: ["endsAt"],
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["teacher", "head_academics", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Academic staff access required" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [schoolClass] = await db.select().from(classes).where(eq(classes.id, parsed.data.classId)).limit(1);
  if (!schoolClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  if (user.role === "teacher" && schoolClass.teacherId !== user.id) {
    return NextResponse.json({ error: "You can only create assessments for your assigned classes" }, { status: 403 });
  }
  const [exam] = await db.insert(exams).values({
    title: parsed.data.title,
    description: parsed.data.description || null,
    classId: schoolClass.id,
    teacherId: user.role === "teacher" ? user.id : schoolClass.teacherId,
    assessmentType: parsed.data.assessmentType,
    startsAt: parsed.data.startsAt ?? null,
    endsAt: parsed.data.endsAt ?? null,
    durationMinutes: parsed.data.durationMinutes,
    published: true,
    approvedBy: user.role === "head_academics" || user.role === "super_admin" ? user.id : null,
  }).returning({ id: exams.id, title: exams.title, assessmentType: exams.assessmentType });
  return NextResponse.json({ ok: true, exam }, { status: 201 });
}
