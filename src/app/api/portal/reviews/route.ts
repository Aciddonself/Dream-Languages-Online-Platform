import { NextResponse } from "next/server";
import { db } from "@/db";
import { incidents, testimonials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { detectPhoneOrHandle } from "@/lib/phone-filter";
import { z } from "zod";

const schema = z.object({
  quote: z.string().trim().min(10).max(1000),
  rating: z.number().int().min(1).max(5),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "Only enrolled students can submit reviews" }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const detection = detectPhoneOrHandle(parsed.data.quote);
  if (detection.blocked) {
    await db.insert(incidents).values({
      type: detection.reason === "handle" ? "external_contact" : "phone_share",
      actorId: user.id,
      location: "student_review",
      maskedContent: detection.masked ?? "[blocked]",
    });
    return NextResponse.json({ error: "Reviews cannot contain phone numbers or external contact details." }, { status: 400 });
  }
  const authorName = user.displayName ?? [user.firstName, user.lastName].filter(Boolean).join(" ") ?? "Student";
  const [review] = await db.insert(testimonials).values({
    studentId: user.id,
    authorName,
    role: "Student",
    quote: parsed.data.quote,
    rating: parsed.data.rating,
    published: false,
  }).returning({ id: testimonials.id });
  return NextResponse.json({ ok: true, reviewId: review.id, message: "Your review has been submitted for administrator approval." }, { status: 201 });
}
