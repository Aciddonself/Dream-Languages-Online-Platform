import { NextResponse } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, classes, departments, feeSchedules, feeStructures, levels, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const schema = z.object({
  studentId: z.string().uuid(),
  scheduleId: z.string().uuid().optional(),
  levelId: z.string().uuid(),
  amount: z.number().int().positive().max(100_000_000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3,8}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).strict();

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["finance", "admin", "super_admin"].includes(actor.role)) return NextResponse.json({ error: "Finance or administrator access required" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const outcome = await db.transaction(async (tx: any) => {
    const [student] = await tx.select({
      id: users.id, name: users.displayName, firstName: users.firstName, lastName: users.lastName,
      registrationNumber: users.registrationNumber, departmentId: users.departmentId, departmentName: departments.name,
      role: users.role, status: users.status,
    }).from(users).leftJoin(departments, eq(users.departmentId, departments.id))
      .where(and(eq(users.id, input.studentId), eq(users.role, "student"), isNull(users.deletedAt))).for("update").limit(1);
    if (!student || !["active", "registered"].includes(student.status)) return { error: "Active or registered student account not found.", status: 404 as const };
    if (!student.departmentId) return { error: "Assign the student to a language department before setting fees.", status: 409 as const };
    const [level] = await tx.select({ id: levels.id, code: levels.code, name: levels.name, departmentId: levels.departmentId }).from(levels).where(eq(levels.id, input.levelId)).limit(1);
    if (!level) return { error: "Choose a valid language level.", status: 400 as const };
    const [classLevel] = await tx.select({ programmeId: classes.programmeId, termId: classes.termId }).from(classes)
      .innerJoin(departments, eq(classes.departmentId, departments.id))
      .where(and(eq(classes.departmentId, student.departmentId), eq(classes.levelId, input.levelId), isNull(classes.deletedAt), isNull(departments.deletedAt), eq(departments.isLanguage, true))).limit(1);
    if (!classLevel && level.departmentId !== student.departmentId) return { error: "This level is not available in the student’s language department.", status: 409 as const };
    const [existing] = input.scheduleId ? await tx.select().from(feeSchedules)
      .where(and(eq(feeSchedules.id, input.scheduleId), eq(feeSchedules.studentId, student.id))).for("update").limit(1) : [];
    if (input.scheduleId && !existing) return { error: "Fee schedule not found for this student.", status: 404 as const };
    const paid = existing?.paid ?? 0;
    if (input.amount < paid) return { error: "Total fees due cannot be less than the amount already paid.", status: 409 as const };
    if (existing && paid > 0 && existing.currency !== input.currency) return { error: "Currency cannot be changed after payments have been applied.", status: 409 as const };
    const studentName = student.name || [student.firstName, student.lastName].filter(Boolean).join(" ") || student.registrationNumber || "Student";
    const structureName = "Manual fee: " + studentName + " · " + level.code;
    let [structure] = existing?.feeStructureId ? await tx.select().from(feeStructures).where(eq(feeStructures.id, existing.feeStructureId)).limit(1) : [];
    if (structure && existing) {
      const [otherSchedule] = await tx.select({ id: feeSchedules.id }).from(feeSchedules)
        .where(and(eq(feeSchedules.feeStructureId, structure.id), ne(feeSchedules.id, existing.id))).limit(1);
      if (otherSchedule) structure = undefined;
    }
    if (structure && existing) {
      await tx.update(feeStructures).set({ name: structureName, amount: input.amount, currency: input.currency, programmeId: classLevel?.programmeId ?? null, levelId: level.id, termId: classLevel?.termId ?? null }).where(eq(feeStructures.id, structure.id));
    } else {
      [structure] = await tx.insert(feeStructures).values({ name: structureName, amount: input.amount, currency: input.currency, programmeId: classLevel?.programmeId ?? null, levelId: level.id, termId: classLevel?.termId ?? null }).returning();
    }
    const scheduleValues = {
      feeStructureId: structure.id, amount: input.amount, currency: input.currency, dueDate: input.dueDate || null,
      status: paid >= input.amount ? "paid" : paid > 0 ? "partial" : "unpaid",
    };
    let scheduleId = existing?.id;
    if (existing) await tx.update(feeSchedules).set(scheduleValues).where(eq(feeSchedules.id, existing.id));
    else {
      const [created] = await tx.insert(feeSchedules).values({ studentId: student.id, ...scheduleValues, paid: 0 }).returning({ id: feeSchedules.id });
      scheduleId = created.id;
    }
    await tx.insert(auditLogs).values({
      actorId: actor.id, action: existing ? "edit_student_fee_schedule" : "create_student_fee_schedule",
      entityType: "fee_schedule", entityId: scheduleId,
      after: { studentId: student.id, departmentId: student.departmentId, levelId: level.id, levelCode: level.code, amount: input.amount, paid, currency: input.currency, dueDate: input.dueDate || null },
    });
    return { ok: true as const, scheduleId };
  });
  if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json(outcome, { status: 201 });
}
