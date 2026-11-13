import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assignments, auditLogs, classes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  classId: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(5000).optional(),
  dueAt: z.coerce.date().optional(),
  maxScore: z.number().int().min(1).max(1000).default(100),
}).strict();

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["teacher", "head_academics", "super_admin"].includes(actor.role)) return NextResponse.json({ error: "Academic staff access required" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.dueAt && parsed.data.dueAt <= new Date()) return NextResponse.json({ error: "Choose a deadline in the future" }, { status: 400 });

  const [schoolClass] = await db.select({ id: classes.id, name: classes.name, teacherId: classes.teacherId })
    .from(classes).where(and(eq(classes.id, parsed.data.classId), isNull(classes.deletedAt))).limit(1);
  if (!schoolClass) return NextResponse.json({ error: "Active class not found" }, { status: 404 });
  if (actor.role === "teacher" && schoolClass.teacherId !== actor.id) return NextResponse.json({ error: "You can only set assignments for your own classes" }, { status: 403 });

  const [assignment] = await db.insert(assignments).values({
    classId: schoolClass.id,
    teacherId: actor.id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    dueAt: parsed.data.dueAt ?? null,
    maxScore: parsed.data.maxScore,
  }).returning({ id: assignments.id, title: assignments.title, dueAt: assignments.dueAt });
  await db.insert(auditLogs).values({ actorId: actor.id, action: "create_assignment", entityType: "assignment", entityId: assignment.id,
    after: { classId: schoolClass.id, title: assignment.title, dueAt: assignment.dueAt, maxScore: parsed.data.maxScore } });
  return NextResponse.json({ ok: true, assignment }, { status: 201 });
}
