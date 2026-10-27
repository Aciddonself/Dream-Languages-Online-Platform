import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { incidents, teacherRatings, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { detectPhoneOrHandle } from "@/lib/phone-filter";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  teacherId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(600).optional(),
}).strict();

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const teachers = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName })
    .from(users)
    .where(and(eq(users.role, "teacher"), isNull(users.deletedAt)));
  return NextResponse.json({
    teachers: teachers.map((t) => ({ id: t.id, name: t.displayName ?? ([t.firstName, t.lastName].filter(Boolean).join(" ") || "Teacher") })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "Only students can rate teachers" }, { status: 403 });
  const limit = await rateLimit("teacher-rating", user.id, 10, "1 m");
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a teacher and a rating from 1 to 5." }, { status: 400 });
  const { teacherId, rating, comment } = parsed.data;
  const [teacher] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, teacherId), eq(users.role, "teacher"), isNull(users.deletedAt))).limit(1);
  if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  if (comment) {
    const detection = detectPhoneOrHandle(comment);
    if (detection.blocked) {
      await db.insert(incidents).values({
        type: detection.reason === "handle" ? "external_contact" : "phone_share",
        actorId: user.id,
        location: "teacher_rating",
        maskedContent: detection.masked ?? "[blocked]",
      });
      return NextResponse.json({ error: "Comments cannot contain phone numbers or external contact details." }, { status: 400 });
    }
  }
  // A re-rating replaces the earlier one and goes back to the admin for approval.
  await db.insert(teacherRatings).values({ teacherId, studentId: user.id, rating, comment: comment || null, published: false })
    .onConflictDoUpdate({
      target: [teacherRatings.teacherId, teacherRatings.studentId],
      set: { rating, comment: comment || null, published: false, createdAt: new Date() },
    });
  return NextResponse.json({ ok: true, message: "Thank you. Your rating was sent to the administrator for approval." }, { status: 201 });
}
