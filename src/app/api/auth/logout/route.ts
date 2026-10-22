import { NextResponse } from "next/server";
import { destroyAllSessions, destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  const everywhere = new URL(request.url).searchParams.get("all") === "1";
  if (everywhere) await destroyAllSessions();
  else await destroySession();
  return NextResponse.json({ ok: true });
}