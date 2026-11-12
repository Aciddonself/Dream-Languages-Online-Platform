import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

function csvCell(value: unknown) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? "");
  const safe = /^[\t\r ]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET() {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "Administrator access required" }, { status: 403 });

  const records = await db.select({
    registrationNumber: users.registrationNumber,
    name: users.displayName,
    email: users.email,
    role: users.role,
    status: users.status,
    createdAt: users.createdAt,
  }).from(users).orderBy(asc(users.createdAt));

  const rows = [
    ["Registration number", "Name", "Email", "Role", "Status", "Created at"],
    ...records.map((record) => [
      record.registrationNumber,
      record.name,
      record.email,
      record.role,
      record.status,
      record.createdAt,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="dla-users.csv"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
