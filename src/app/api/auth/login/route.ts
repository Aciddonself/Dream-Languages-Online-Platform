import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyPassword, createSession } from "@/lib/auth";
import { roleHome } from "@/lib/rbac";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().trim().min(1).max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(256),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  if (!user || user.deletedAt || !["active", "registered", "applicant"].includes(user.status)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  await createSession(user.id);
  return NextResponse.json({
    ok: true,
    redirectTo: roleHome(user.role),
    user: { id: user.id, email: user.email, role: user.role },
  });
}