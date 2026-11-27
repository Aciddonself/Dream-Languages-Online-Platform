import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { incidents, testimonials } from "@/db/schema";
import { detectPhoneOrHandle } from "@/lib/phone-filter";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const reviewSchema = z.object({
  authorName: z.string().trim().min(2).max(80),
  role: z.enum(["Learner", "Parent or guardian", "Community member", "Other"]),
  quote: z.string().trim().min(10).max(1000),
  rating: z.number().int().min(1).max(5),
  website: z.string().max(200).optional(),
}).strict();

export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("public-reviews", ip, 3, "1 h");
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your review and try again." }, { status: 400 });
  }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check your name, rating, and review, then try again." }, { status: 400 });
  if (parsed.data.website) {
    return NextResponse.json({ ok: true, message: "Thank you. Your review is waiting for approval." }, { status: 201 });
  }

  const detection = detectPhoneOrHandle(`${parsed.data.authorName} ${parsed.data.quote}`);
  if (detection.blocked) {
    await db.insert(incidents).values({
      type: detection.reason === "handle" ? "external_contact" : "phone_share",
      location: "public_review",
      maskedContent: detection.masked ?? "[blocked]",
    });
    return NextResponse.json({ error: "Please remove phone numbers and private contact details from your review." }, { status: 400 });
  }

  await db.insert(testimonials).values({
    authorName: parsed.data.authorName,
    role: parsed.data.role,
    quote: parsed.data.quote,
    rating: parsed.data.rating,
    published: false,
  });
  return NextResponse.json({ ok: true, message: "Thank you. Your review is waiting for approval." }, { status: 201 });
}
