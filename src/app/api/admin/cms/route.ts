import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, cmsPages, newsPosts, testimonials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { detectPhoneOrHandle } from "@/lib/phone-filter";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";

const createNewsSchema = z.object({
  kind: z.literal("news"),
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().max(128).optional(),
  excerpt: z.string().trim().max(500).optional(),
  body: z.string().trim().min(1).max(20_000),
  status: z.enum(["draft", "published"]).default("draft"),
}).strict();
const createPageSchema = z.object({
  kind: z.literal("page"),
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().max(128).optional(),
  body: z.string().trim().min(1).max(30_000),
  seoTitle: z.string().trim().max(180).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
}).strict();
const reviewSchema = z.object({
  action: z.enum(["approve_review", "reject_review"]),
  reviewId: z.string().uuid(),
}).strict();
const updatePageSchema = z.object({
  action: z.literal("save_page"),
  pageId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().min(1).max(128),
  body: z.string().trim().min(1).max(30_000),
  seoTitle: z.string().trim().max(180).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  status: z.enum(["draft", "published", "unpublished", "archived"]),
}).strict();
const patchSchema = z.discriminatedUnion("action", [reviewSchema, updatePageSchema]);

function makeSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 128);
}

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
  const parsed = z.discriminatedUnion("kind", [createNewsSchema, createPageSchema]).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { data } = parsed;
  if (detectPhoneOrHandle(`${data.title} ${data.body}`).blocked) {
    return NextResponse.json({ error: "Public content cannot contain personal phone numbers or external contact handles." }, { status: 400 });
  }
  const slug = makeSlug(data.slug || data.title);
  if (!slug) return NextResponse.json({ error: "Use a title that can form a valid website address" }, { status: 400 });

  if (data.kind === "page") {
    const [page] = await db.insert(cmsPages).values({
      title: data.title,
      slug,
      body: data.body,
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null,
      status: data.status,
      publishedAt: data.status === "published" ? new Date() : null,
    }).onConflictDoNothing().returning({ id: cmsPages.id, title: cmsPages.title, slug: cmsPages.slug, status: cmsPages.status, version: cmsPages.version });
    if (!page) return NextResponse.json({ error: "That website address is already in use. Choose another slug." }, { status: 409 });
    await db.insert(auditLogs).values({
      actorId: actor.id,
      action: "create_cms_page",
      entityType: "cms_page",
      entityId: page.id,
      after: { title: page.title, slug: page.slug, status: page.status, version: page.version },
    });
    revalidatePath(`/pages/${page.slug}`);
    revalidateTag("public-content", "max");
    return NextResponse.json({ ok: true, page }, { status: 201 });
  }

  const [post] = await db.insert(newsPosts).values({
    title: data.title,
    slug,
    excerpt: data.excerpt || null,
    body: data.body,
    status: data.status,
    publishedAt: data.status === "published" ? new Date() : null,
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
  const limit = await rateLimit("admin-cms", actor.id, 30, "1 m");
  if (!limit.ok) return tooManyRequests(limit.retryAfter);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.action === "save_page") {
    if (detectPhoneOrHandle(`${parsed.data.title} ${parsed.data.body}`).blocked) {
      return NextResponse.json({ error: "Public content cannot contain personal phone numbers or external contact handles." }, { status: 400 });
    }
    const slug = makeSlug(parsed.data.slug);
    if (!slug) return NextResponse.json({ error: "Use a valid website address." }, { status: 400 });
    const [existing] = await db.select().from(cmsPages).where(eq(cmsPages.id, parsed.data.pageId)).limit(1);
    if (!existing) return NextResponse.json({ error: "Website page not found." }, { status: 404 });
    const publishedAt = parsed.data.status === "published"
      ? existing.status === "published" ? existing.publishedAt ?? new Date() : new Date()
      : null;
    const [updated] = await db.update(cmsPages).set({
      title: parsed.data.title,
      slug,
      body: parsed.data.body,
      seoTitle: parsed.data.seoTitle || null,
      seoDescription: parsed.data.seoDescription || null,
      status: parsed.data.status,
      publishedAt,
      version: existing.version + 1,
      updatedAt: new Date(),
    }).where(and(eq(cmsPages.id, existing.id), eq(cmsPages.version, parsed.data.expectedVersion)))
      .returning({ id: cmsPages.id, slug: cmsPages.slug, status: cmsPages.status, version: cmsPages.version });
    if (!updated) return NextResponse.json({ error: "This page changed in another session. Refresh and review the latest version before saving." }, { status: 409 });
    await db.insert(auditLogs).values({
      actorId: actor.id,
      action: "update_cms_page",
      entityType: "cms_page",
      entityId: updated.id,
      before: { title: existing.title, slug: existing.slug, body: existing.body, seoTitle: existing.seoTitle, seoDescription: existing.seoDescription, status: existing.status, version: existing.version },
      after: { title: parsed.data.title, slug, body: parsed.data.body, seoTitle: parsed.data.seoTitle || null, seoDescription: parsed.data.seoDescription || null, status: updated.status, version: updated.version },
    });
    revalidatePath(`/pages/${existing.slug}`);
    revalidatePath(`/pages/${updated.slug}`);
    revalidateTag("public-content", "max");
    return NextResponse.json({ ok: true, page: updated });
  }

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
