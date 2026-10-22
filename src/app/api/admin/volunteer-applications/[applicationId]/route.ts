import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, teacherApplications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({ status: z.enum(["shortlisted", "rejected"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { applicationId } = await params;
  const [existing] = await db.select({ id: teacherApplications.id, status: teacherApplications.status }).from(teacherApplications).where(eq(teacherApplications.id, applicationId)).limit(1);
  if (!existing) return NextResponse.json({ error: "Teacher application not found" }, { status: 404 });
  const now = new Date();
  const [updated] = await db.update(teacherApplications).set({ status: parsed.data.status, reviewedBy: actor.id, reviewedAt: now }).where(eq(teacherApplications.id, applicationId)).returning({ id: teacherApplications.id, status: teacherApplications.status });
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "review_teacher_application",
    entityType: "teacher_application",
    entityId: updated.id,
    before: { status: existing.status },
    after: { status: updated.status },
  });
  return NextResponse.json({ ok: true, application: updated });
}
