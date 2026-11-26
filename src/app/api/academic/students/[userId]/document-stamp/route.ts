import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { z } from "zod";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["super_admin", "head_academics", "admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Administrator or Head of Academics access required" }, { status: 403 });
  }
  const limited = await rateLimit("student-document-stamp", actor.id, 30, "10 m");
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Enter the authorized signatory name for the stamp" }, { status: 400 }); }
  const parsed = z.object({ stamperName: z.string().trim().min(2).max(120) }).strict().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter an authorized signatory name of at least two characters" }, { status: 400 });

  const { userId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: "Invalid student ID" }, { status: 400 });
  }
  const [student] = await db.select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.id, userId),
      eq(users.role, "student"),
      isNull(users.deletedAt),
    ))
    .limit(1);
  if (!student) return NextResponse.json({ error: "Student account not found" }, { status: 404 });

  const stampedAt = new Date();
  const stamperName = parsed.data.stamperName;
  const stamperTitle = actor.role === "super_admin" || actor.role === "admin" ? "School Administrator" : "Head of Academics";
  await db.transaction(async (tx) => {
    await tx.update(users).set({
      documentStampedAt: stampedAt,
      documentStampedBy: actor.id,
      documentStamperName: stamperName,
      documentStamperTitle: stamperTitle,
      updatedAt: stampedAt,
    }).where(eq(users.id, student.id));
    await tx.insert(auditLogs).values({
      actorId: actor.id,
      action: "stamp_student_documents",
      entityType: "user",
      entityId: student.id,
      after: { stampedAt: stampedAt.toISOString(), stamperName, stamperTitle },
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
  });

  return NextResponse.json({ ok: true, stampedAt: stampedAt.toISOString(), stamperName, stamperTitle });
}
