import { NextResponse } from "next/server";
import { and, asc, count, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, classes, enrolments, exams, levels, results, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  examId: z.string().uuid(),
  studentId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  grade: z.string().trim().max(8).optional(),
  comments: z.string().trim().max(2000).optional(),
  specialCase: z.boolean().default(false),
  specialCaseReason: z.string().trim().max(1000).optional(),
});

const correctionSchema = z.object({
  examId: z.string().uuid(),
  studentId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  grade: z.string().trim().max(8).optional(),
  comments: z.string().trim().max(2000).optional(),
  reason: z.string().trim().min(3).max(1000),
});

export async function PATCH(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["head_academics", "super_admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Only the Head of Academics or school administrator can correct published marks" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = correctionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { examId, studentId, score, grade, comments, reason } = parsed.data;
  const outcome = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(results).where(and(eq(results.examId, examId), eq(results.studentId, studentId))).limit(1);
    if (!existing?.published) return { error: "Published result not found" as const, status: 404 as const };
    if (existing.promotionStatus === "promoted") {
      return { error: "This student has already been promoted. Contact administration to review the class placement before changing this mark." as const, status: 409 as const };
    }
    const [exam] = await tx.select({ assessmentType: exams.assessmentType }).from(exams).where(eq(exams.id, examId)).limit(1);
    if (!exam) return { error: "Assessment not found" as const, status: 404 as const };

    const promotionStatus = exam.assessmentType === "final_exam"
      ? score < 65 ? "not_eligible" : "pending"
      : existing.promotionStatus;
    const promotionReason = exam.assessmentType === "final_exam"
      ? score < 65
        ? "Corrected final examination score is below the 65% pass mark."
        : "Mark corrected; review class progression before promotion."
      : existing.promotionReason;
    const [updated] = await tx.update(results).set({
      score,
      grade: grade || null,
      comments: comments || null,
      promotionStatus,
      promotionReason,
      promotionReviewedBy: actor.id,
    }).where(eq(results.id, existing.id)).returning({ id: results.id });
    await tx.insert(auditLogs).values({
      actorId: actor.id,
      action: "correct_published_result",
      entityType: "result",
      entityId: updated.id,
      before: { score: existing.score, grade: existing.grade, comments: existing.comments, promotionStatus: existing.promotionStatus },
      after: { score, grade: grade || null, comments: comments || null, promotionStatus, promotionReason, reason },
    });
    return { resultId: updated.id, promotionStatus, promotionReason };
  });

  if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ ok: true, ...outcome });
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["teacher", "head_academics", "super_admin"].includes(actor.role)) {
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

  const { examId, studentId, score, grade, comments, specialCase, specialCaseReason } = parsed.data;
  if (specialCase && !["head_academics", "super_admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Only the Head of Academics or school administrator can record a promotion exception" }, { status: 403 });
  }
  if (specialCase && !specialCaseReason) {
    return NextResponse.json({ error: "Document the reason for this special-case decision" }, { status: 400 });
  }

  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  if (actor.role === "teacher" && exam.teacherId !== actor.id) {
    return NextResponse.json({ error: "You can only publish marks for your own assessments" }, { status: 403 });
  }
  const examClassId = exam.classId;
  if (!examClassId) return NextResponse.json({ error: "Assign this assessment to a class before publishing results" }, { status: 409 });
  const [student] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, studentId), eq(users.role, "student"))).limit(1);
  if (!student) return NextResponse.json({ error: "Student account not found" }, { status: 404 });
  const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments).where(and(
    eq(enrolments.studentId, student.id),
    eq(enrolments.classId, examClassId),
    eq(enrolments.status, "active"),
  )).limit(1);
  if (!enrollment) return NextResponse.json({ error: "Student is not actively enrolled in this assessment class" }, { status: 409 });

  const outcome = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(results).where(and(eq(results.studentId, student.id), eq(results.examId, exam.id))).limit(1);
    if (existing?.published) return { error: "This result has already been published. Contact the Head of Academics for a correction.", status: 409 as const };

    let promotionStatus: string | null = null;
    let promotionReason: string | null = null;
    let promotionReviewedBy: string | null = null;
    let promotedAt: Date | null = null;
    let nextClassId: string | null = null;
    let previousClassId: string | null = null;

    if (exam.assessmentType === "final_exam") {
      promotionReviewedBy = specialCase ? actor.id : null;
      if (specialCase) {
        promotionStatus = "held";
        promotionReason = specialCaseReason!;
      } else if (score < 65) {
        promotionStatus = "not_eligible";
        promotionReason = "Final examination score is below the 65% pass mark.";
      } else {
        const [currentEnrollment] = await tx.select({
          id: enrolments.id,
          classId: classes.id,
          departmentId: classes.departmentId,
          programmeId: classes.programmeId,
          levelId: classes.levelId,
          currentLevelOrder: levels.order,
        }).from(enrolments)
          .innerJoin(classes, eq(enrolments.classId, classes.id))
          .leftJoin(levels, eq(classes.levelId, levels.id))
          .where(and(eq(enrolments.studentId, student.id), eq(enrolments.classId, examClassId), eq(enrolments.status, "active")))
          .limit(1);
        previousClassId = currentEnrollment?.classId ?? null;
        if (!currentEnrollment?.levelId || currentEnrollment.currentLevelOrder === null) {
          promotionStatus = "pending";
          promotionReason = "No current academic level is assigned; academic staff must complete the placement.";
        } else {
          const departmentFilter = currentEnrollment.departmentId
            ? eq(levels.departmentId, currentEnrollment.departmentId)
            : isNull(levels.departmentId);
          const [nextLevel] = await tx.select({ id: levels.id }).from(levels)
            .where(and(departmentFilter, gt(levels.order, currentEnrollment.currentLevelOrder)))
            .orderBy(asc(levels.order)).limit(1);
          const nextClasses = nextLevel
            ? await tx.select({
                id: classes.id,
                name: classes.name,
                capacity: classes.capacity,
                studentCount: count(enrolments.id),
              }).from(classes)
                .leftJoin(enrolments, and(eq(enrolments.classId, classes.id), eq(enrolments.status, "active")))
                .where(and(
                  eq(classes.levelId, nextLevel.id),
                  currentEnrollment.programmeId ? eq(classes.programmeId, currentEnrollment.programmeId) : isNull(classes.programmeId),
                  currentEnrollment.departmentId ? eq(classes.departmentId, currentEnrollment.departmentId) : isNull(classes.departmentId),
                  isNull(classes.deletedAt),
                ))
                .groupBy(classes.id)
                .orderBy(asc(classes.name))
            : [];
          const targetClass = nextClasses.find((candidate) => candidate.capacity === null || candidate.studentCount < candidate.capacity);
          if (targetClass) {
            nextClassId = targetClass.id;
            promotionStatus = "promoted";
            promotionReason = `Passed the final examination with ${score}%; advanced to ${targetClass.name}.`;
            promotedAt = new Date();
          } else {
            promotionStatus = "pending";
            promotionReason = nextLevel ? "No available class is configured at the next level." : "No higher level is configured for this programme.";
          }
        }
      }
    }

    const resultValues = {
      studentId: student.id,
      examId: exam.id,
      classId: examClassId,
      score,
      grade: grade || null,
      comments: comments || null,
      published: true,
      publishedAt: new Date(),
      promotionStatus,
      promotionReason,
      promotionReviewedBy,
      promotedAt,
    };
    const [publishedResult] = existing
      ? await tx.update(results).set(resultValues).where(eq(results.id, existing.id)).returning({ id: results.id })
      : await tx.insert(results).values(resultValues).returning({ id: results.id });

    if (nextClassId && previousClassId) {
      await tx.update(enrolments).set({ status: "completed" }).where(eq(enrolments.id, enrollment.id));
      await tx.insert(enrolments).values({ studentId: student.id, classId: nextClassId, status: "active" }).onConflictDoNothing();
      await tx.insert(auditLogs).values({
        actorId: actor.id,
        action: "auto_promote_student",
        entityType: "user",
        entityId: student.id,
        before: { classId: previousClassId },
        after: { classId: nextClassId, examId: exam.id, score },
      });
    }
    await tx.insert(auditLogs).values({
      actorId: actor.id,
      action: "publish_result",
      entityType: "result",
      entityId: publishedResult.id,
      after: { studentId: student.id, examId: exam.id, score, assessmentType: exam.assessmentType, promotionStatus },
    });
    return { resultId: publishedResult.id, promotionStatus, promotionReason, nextClassId };
  });

  if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ ok: true, ...outcome }, { status: 201 });
}
