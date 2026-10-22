import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { askFatherDla, getAiAgentStatus } from "@/lib/ai-agent";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().trim().min(1).max(3000),
  })).min(1).max(20),
});

export async function GET() {
  const status = getAiAgentStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await askFatherDla(parsed.data.messages);
    return NextResponse.json({
      answer: result.answer,
      provider: result.provider,
      model: result.model,
      userRole: user?.role ?? "guest",
    });
  } catch (error) {
    console.error("Father-DLA AI Agent execution error:", error);
    return NextResponse.json(
      { error: "Father-DLA encountered a temporary error. Please try asking again." },
      { status: 500 }
    );
  }
}
