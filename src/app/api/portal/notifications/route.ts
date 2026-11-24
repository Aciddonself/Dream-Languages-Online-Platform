import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const rows = await db.select({
    id: notifications.id,
    title: notifications.title,
    body: notifications.body,
    read: notifications.read,
    createdAt: notifications.createdAt,
  }).from(notifications).where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt)).limit(30);
  return NextResponse.json({ notifications: rows, unreadCount: rows.filter((row) => !row.read).length }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

const updateSchema = z.object({ notificationId: z.string().uuid().optional(), markAllRead: z.boolean().optional() })
  .refine((value) => value.markAllRead === true || Boolean(value.notificationId));

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Choose a notification to mark as read." }, { status: 400 });
  const where = parsed.data.markAllRead
    ? eq(notifications.userId, user.id)
    : and(eq(notifications.userId, user.id), eq(notifications.id, parsed.data.notificationId!));
  await db.update(notifications).set({ read: true }).where(where);
  return NextResponse.json({ ok: true });
}
