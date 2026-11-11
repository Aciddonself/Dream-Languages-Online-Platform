import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { randomBytes } from "node:crypto";

const schema = z.object({ userId: z.string().uuid() }).strict();

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });

  const [user] = await db.select().from(users).where(eq(users.id, parsed.data.userId)).limit(1);
  if (!user || !user.authId) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const newPassword = randomBytes(12).toString("base64url").slice(0, 16);
  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.authId, { password: newPassword, email_confirm: true });
  if (error) return NextResponse.json({ error: "Could not reset password" }, { status: 500 });

  return NextResponse.json({ ok: true, newPassword, email: user.email });
}
