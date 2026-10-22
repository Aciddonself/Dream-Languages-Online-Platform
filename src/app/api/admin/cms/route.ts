import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, newsPosts, testimonials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { detectPhoneOrHandle } from "@/lib/phone-filter";

const createNewsSchema = z.object({
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().max(128).optional(),
  excerpt: z.string().trim().max(500).optional(),
  body: z.string().trim().min(1).max(20_000),
  status: z.enum(["draft", "published"]).default("draft"),
});
const reviewSchema = z.object({
  action: z.enum(["approve_review", "reject_review"]),
  reviewId: z.string().uuid(),
});

function makeSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 128);
}

export async function POST(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "School administrator access required" }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = createNewsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (detectPhoneOrHandle(`${parsed.data.title} ${parsed.data.body}`).blocked) {
    return NextResponse.json({ error: "Public content cannot contain personal phone numbers or external contact handles." }, { status: 400 });
  }
  const slug = makeSlug(parsed.data.slug || parsed.data.title);
  if (!slug) return NextResponse.json({ error: "Use a title that can form a valid website address" }, { status: 400 });
  const [post] = await db.insert(newsPosts).values({
    title: parsed.data.title,
    slug,
    excerpt: parsed.data.excerpt || null,
    body: parsed.data.body,
    status: parsed.data.status,
    publishedAt: parsed.data.status === "published" ? new Date() : null,
    authorId: actor.id,
  }).onConflictDoNothing().returning({ id: newsPosts.id, title: newsPosts.title, slug: newsPosts.slug, status: newsPosts.status });
  if (!post) return NextResponse.json({ error: "That website address is already in use. Choose another slug." }, { status: 409 });
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "create_news_post",
    entityType: "news_post",
    entityId: post.id,
    after: { title: post.title, slug: post.slug, status: post.status },
  });
  revalidateTag("public-content", "max");
  return NextResponse.json({ ok: true, post }, { status: 201 });
}

export async function PATCH(request: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "School administrator access required" }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const [review] = await db.select().from(testimonials).where(eq(testimonials.id, parsed.data.reviewId)).limit(1);
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  const published = parsed.data.action === "approve_review";
  await db.update(testimonials).set({ published }).where(eq(testimonials.id, review.id));
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: published ? "approve_student_review" : "reject_student_review",
    entityType: "testimonial",
    entityId: review.id,
    before: { published: review.published },
    after: { published },
  });
  revalidateTag("public-content", "max");
  return NextResponse.json({ ok: true, published });
}
