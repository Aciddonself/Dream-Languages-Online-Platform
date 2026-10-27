import { NextResponse } from "next/server";
import { asc, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, schoolHolidays } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
};

const dateSchema = z.string().refine(isValidDate, "Enter a valid calendar date.");
const createSchema = z.object({
  title: z.string().trim().min(1).max(180),
  category: z.enum(["public_holiday", "other_holiday"]),
  startsOn: dateSchema,
  endsOn: dateSchema.nullable().optional(),
  details: z.string().trim().max(2000).optional().default(""),
}).refine((value) => !value.endsOn || value.endsOn >= value.startsOn, {
  message: "The end date must be on or after the start date.",
  path: ["endsOn"],
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["super_admin", "head_academics"].includes(user.role)) {
    return NextResponse.json({ error: "Administrator or Head of Academics access required" }, { status: 403 });
  }
  const holidays = await db.select({
    id: schoolHolidays.id,
    title: schoolHolidays.title,
    category: schoolHolidays.category,
    startsOn: schoolHolidays.startsOn,
    endsOn: schoolHolidays.endsOn,
    details: schoolHolidays.details,
    status: schoolHolidays.status,
    approvedAt: schoolHolidays.approvedAt,
    reminderSentAt: schoolHolidays.reminderSentAt,
    createdAt: schoolHolidays.createdAt,
  }).from(schoolHolidays)
    .orderBy(asc(schoolHolidays.startsOn), desc(schoolHolidays.createdAt))
    .limit(200);
  return NextResponse.json({ holidays });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["super_admin", "head_academics"].includes(user.role)) {
    return NextResponse.json({ error: "Administrator or Head of Academics access required" }, { status: 403 });
  }
  const limited = await rateLimit("school-holiday-create", user.id, 20, "10 m");
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [holiday] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(schoolHolidays).values({
      title: parsed.data.title,
      category: parsed.data.category,
      startsOn: parsed.data.startsOn,
      endsOn: parsed.data.endsOn || null,
      details: parsed.data.details || null,
      createdBy: user.id,
    }).returning();
    await tx.insert(auditLogs).values({
      actorId: user.id,
      action: "create_holiday_draft",
      entityType: "school_holiday",
      entityId: created.id,
      after: { title: created.title, category: created.category, startsOn: created.startsOn, endsOn: created.endsOn },
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    return [created];
  });
  return NextResponse.json({ ok: true, holiday }, { status: 201 });
}
