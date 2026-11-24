import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { messages, notifications, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const [records, directory] = await Promise.all([
    db.select({ id: messages.id, senderId: messages.senderId, recipientId: messages.recipientId, body: messages.body, createdAt: messages.createdAt })
      .from(messages)
      .where(and(isNull(messages.roomId), or(eq(messages.senderId, user.id), eq(messages.recipientId, user.id))))
      .orderBy(desc(messages.createdAt)).limit(100),
    db.select({ id: users.id, displayName: users.displayName, firstName: users.firstName, lastName: users.lastName, role: users.role })
      .from(users)
      .where(and(ne(users.id, user.id), inArray(users.status, ["active", "registered"]), isNull(users.deletedAt)))
      .orderBy(users.firstName, users.lastName).limit(500),
  ]);
  const counterpartIdSet = new Set<string>();
  for (const message of records) {
    if (message.senderId && message.senderId !== user.id) counterpartIdSet.add(message.senderId);
    if (message.recipientId && message.recipientId !== user.id) counterpartIdSet.add(message.recipientId);
  }
  const counterpartIds: string[] = Array.from(counterpartIdSet);
  const counterpartRows = counterpartIds.length
    ? await db.select({ id: users.id, displayName: users.displayName, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(inArray(users.id, counterpartIds))
    : [];
  const nameById = new Map(counterpartRows.map((row) => [row.id, row.displayName ?? ([row.firstName, row.lastName].filter(Boolean).join(" ") || "DLA user")]));
  return NextResponse.json({
    messages: records.reverse().map((message) => ({
      ...message,
      senderName: message.senderId === user.id ? "You" : nameById.get(message.senderId ?? "") ?? "Former DLA user",
      recipientName: message.recipientId === user.id ? "You" : nameById.get(message.recipientId ?? "") ?? "Former DLA user",
    })),
    contacts: directory.map((contact) => ({
      id: contact.id,
      name: contact.displayName ?? ([contact.firstName, contact.lastName].filter(Boolean).join(" ") || "DLA user"),
      role: contact.role.replaceAll("_", " "),
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

const sendSchema = z.object({ recipientId: z.string().uuid(), body: z.string().trim().min(1).max(4000) });

export async function POST(request: Request) {
  const sender = await getCurrentUser();
  if (!sender) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 }); }
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Select a recipient and enter a message of up to 4,000 characters." }, { status: 400 });
  if (parsed.data.recipientId === sender.id) return NextResponse.json({ error: "Choose another account as the recipient." }, { status: 400 });
  const [recipient] = await db.select({ id: users.id }).from(users).where(and(
    eq(users.id, parsed.data.recipientId), inArray(users.status, ["active", "registered"]), isNull(users.deletedAt),
  )).limit(1);
  if (!recipient) return NextResponse.json({ error: "That recipient is not an active DLA account." }, { status: 404 });
  const [message] = await db.insert(messages).values({ senderId: sender.id, recipientId: recipient.id, body: parsed.data.body })
    .returning({ id: messages.id, createdAt: messages.createdAt });
  try {
    await db.insert(notifications).values({
      userId: recipient.id,
      title: `New message from ${sender.displayName ?? sender.email}`,
      body: parsed.data.body.slice(0, 240),
    });
  } catch (error) {
    console.error("Direct message notification could not be delivered", error instanceof Error ? error.message : "unknown error");
  }
  return NextResponse.json({ ok: true, message }, { status: 201 });
}
