import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, partners, teacherRatings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";

const addPartner = z.object({
  action: z.literal("add_partner"),
  name: z.string().trim().min(1).max(160),
  website: z.string().trim().url().max(300).optional().or(z.literal("")),
  logoUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
}).strict();
const removePartner = z.object({ action: z.literal("remove_partner"), id: z.string().uuid() }).strict();
const decideRating = z.object({ action: z.enum(["approve_teacher_rating", "reject_teacher_rating"]), id: z.string().uuid() }).strict();
const schema = z.discriminatedUnion("action", [addPartner, removePartner, decideRating]);

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "School administrator access required" }, { status: 403 });
  const limit = await rateLimit("admin-cms", actor.id, 30, "1 m");
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the details and try again." }, { status: 400 });
  const data = parsed.data;

  if (data.action === "add_partner") {
    const [partner] = await db.insert(partners).values({
      name: data.name,
      website: data.website || null,
      logoUrl: data.logoUrl || null,
      published: true,
    }).returning({ id: partners.id, name: partners.name });
    await db.insert(auditLogs).values({ actorId: actor.id, action: "add_partner", entityType: "partner", entityId: partner.id, after: { name: partner.name } });
    revalidateTag("public-content", "max");
    return NextResponse.json({ ok: true, partner }, { status: 201 });
  }

  if (data.action === "remove_partner") {
    const [removed] = await db.delete(partners).where(eq(partners.id, data.id)).returning({ id: partners.id, name: partners.name });
    if (!removed) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    await db.insert(auditLogs).values({ actorId: actor.id, action: "remove_partner", entityType: "partner", entityId: removed.id, before: { name: removed.name } });
    revalidateTag("public-content", "max");
    return NextResponse.json({ ok: true });
  }

  const published = data.action === "approve_teacher_rating";
  const [updated] = await db.update(teacherRatings).set({ published }).where(eq(teacherRatings.id, data.id)).returning({ id: teacherRatings.id });
  if (!updated) return NextResponse.json({ error: "Rating not found" }, { status: 404 });
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: published ? "approve_teacher_rating" : "reject_teacher_rating",
    entityType: "teacher_rating",
    entityId: updated.id,
    after: { published },
  });
  revalidateTag("public-content", "max");
  return NextResponse.json({ ok: true, published });
}
