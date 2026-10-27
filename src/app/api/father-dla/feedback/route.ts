import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { fatherDlaFeedback, fatherDlaMessages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeUntrusted } from "@/lib/father-dla/safety";

const schema = z.object({
  messageId: z.string().uuid(),
  rating: z.union([z.literal(1), z.literal(-1)]),
  report: z.string().trim().max(500).optional(),
}).strict();

export async function POST(request: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  const { messageId, rating, report } = parsed.data;

  const [message] = await db
    .select({ id: fatherDlaMessages.id })
    .from(fatherDlaMessages)
    .where(and(eq(fatherDlaMessages.id, messageId), eq(fatherDlaMessages.userId, user.id), eq(fatherDlaMessages.role, "assistant")))
    .limit(1);
  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

  const cleanReport = report ? sanitizeUntrusted(report) : null;
  await db
    .insert(fatherDlaFeedback)
    .values({ messageId, userId: user.id, rating, report: cleanReport })
    .onConflictDoUpdate({ target: [fatherDlaFeedback.messageId, fatherDlaFeedback.userId], set: { rating, report: cleanReport } });
  if (cleanReport || rating === -1) {
    await db.update(fatherDlaMessages).set({ flagged: true, flagReason: cleanReport ? "user_report" : "thumbs_down" }).where(eq(fatherDlaMessages.id, messageId));
  }
  return NextResponse.json({ ok: true });
}
