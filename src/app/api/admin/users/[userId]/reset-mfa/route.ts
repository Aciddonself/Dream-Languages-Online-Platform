import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { clientIp } from "@/lib/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!["super_admin", "admin"].includes(actor.role)) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });

  const { userId } = await params;
  if (userId === actor.id) return NextResponse.json({ error: "You cannot reset your own authenticator from user management" }, { status: 400 });
  const [target] = await db.select({ id: users.id, authId: users.authId, role: users.role, deletedAt: users.deletedAt })
    .from(users).where(eq(users.id, userId)).limit(1);
  if (!target || target.deletedAt || !target.authId) return NextResponse.json({ error: "Active account not found" }, { status: 404 });
  if (actor.role === "admin" && ["admin", "super_admin"].includes(target.role)) {
    return NextResponse.json({ error: "Only the super admin can reset another administrator's authenticator" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: target.authId });
  if (error) return NextResponse.json({ error: "Could not read this account's authenticator setup" }, { status: 502 });
  let removed = 0;
  for (const factor of data.factors) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({ userId: target.authId, id: factor.id });
    if (deleteError) return NextResponse.json({ error: "Could not fully reset this authenticator. Contact the super admin." }, { status: 502 });
    removed += 1;
  }
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "reset_user_authenticator",
    entityType: "user",
    entityId: target.id,
    after: { removedFactorCount: removed },
    ip: clientIp(request),
  });
  return NextResponse.json({ ok: true, removedFactorCount: removed, message: "Authenticator reset. The user must scan a new QR code at their next sign in." });
}
