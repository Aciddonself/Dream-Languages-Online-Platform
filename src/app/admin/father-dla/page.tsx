import { revalidatePath } from "next/cache";
import { desc, eq, gte, sql } from "drizzle-orm";
import { requireRole } from "@/lib/rbac";
import { PortalShell } from "@/components/portal-shell";
import { Badge, GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { fatherDlaFeedback, fatherDlaMessages, fatherDlaUsage } from "@/db/schema";
import { getConfig, monthlySpendUsd, saveConfigOverride } from "@/lib/father-dla/service";

export const dynamic = "force-dynamic";

async function savePrompts(formData: FormData) {
  "use server";
  await requireRole(["super_admin"]);
  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim();
  const staffPrompt = String(formData.get("staffPrompt") ?? "").trim();
  const num = (name: string, min: number, max: number) => {
    const value = Number(formData.get(name));
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined;
  };
  await saveConfigOverride({
    ...(systemPrompt.length > 50 ? { systemPrompt } : {}),
    ...(staffPrompt.length > 50 ? { staffPrompt } : {}),
    limits: {
      messagesPerHour: num("messagesPerHour", 1, 500),
      monthlyBudgetUsd: num("monthlyBudgetUsd", 1, 100000),
      maxReplyTokens: num("maxReplyTokens", 100, 4000),
    } as never,
  });
  revalidatePath("/admin/father-dla");
}

export default async function AdminFatherDla() {
  await requireRole(["super_admin"]);
  const config = await getConfig();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [daily, top, flagged, spend, feedback] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${fatherDlaUsage.createdAt}, 'YYYY-MM-DD')`,
        calls: sql<number>`count(*)`,
        searches: sql<number>`coalesce(sum(${fatherDlaUsage.searches}), 0)`,
        cost: sql<number>`coalesce(sum(${fatherDlaUsage.costMicroUsd}), 0)`,
      })
      .from(fatherDlaUsage)
      .where(gte(fatherDlaUsage.createdAt, since))
      .groupBy(sql`1`)
      .orderBy(desc(sql`1`))
      .limit(30),
    db
      .select({ question: fatherDlaUsage.question, n: sql<number>`count(*)` })
      .from(fatherDlaUsage)
      .where(gte(fatherDlaUsage.createdAt, since))
      .groupBy(fatherDlaUsage.question)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
    db
      .select({ id: fatherDlaMessages.id, content: fatherDlaMessages.content, reason: fatherDlaMessages.flagReason, at: fatherDlaMessages.createdAt })
      .from(fatherDlaMessages)
      .where(eq(fatherDlaMessages.flagged, true))
      .orderBy(desc(fatherDlaMessages.createdAt))
      .limit(25),
    monthlySpendUsd(),
    db
      .select({ up: sql<number>`count(*) filter (where ${fatherDlaFeedback.rating} = 1)`, down: sql<number>`count(*) filter (where ${fatherDlaFeedback.rating} = -1)` })
      .from(fatherDlaFeedback),
  ]);

  const cap = config.limits.monthlyBudgetUsd;
  return (
    <PortalShell title="Father-DLA monitoring" nav={[]}>
      <div className="mb-6">
        <h1 className="display-font text-3xl font-bold">Father-DLA monitoring</h1>
        <p className="text-sm opacity-65">Usage, cost, flagged answers and the editable system prompt. Student conversations are private and are not shown here.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <GlassCard className="p-5" strong><div className="text-xs opacity-60">Spend this month</div><div className="text-2xl font-bold">${spend.toFixed(2)} <span className="text-sm font-normal opacity-60">of ${cap}</span></div>{spend >= cap * config.limits.budgetAlertRatio && <Badge tone="warning">Budget alert</Badge>}</GlassCard>
        <GlassCard className="p-5" strong><div className="text-xs opacity-60">Feedback</div><div className="text-2xl font-bold">👍 {Number(feedback[0]?.up ?? 0)} · 👎 {Number(feedback[0]?.down ?? 0)}</div></GlassCard>
        <GlassCard className="p-5" strong><div className="text-xs opacity-60">Limits</div><div className="text-sm">{config.limits.messagesPerHour} msgs/hour · {config.limits.maxReplyTokens} tokens/reply · {config.limits.maxSearchesPerAnswer} searches/answer</div></GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <GlassCard className="p-5" strong>
          <h2 className="font-semibold mb-3">Cost per day (last 30 days)</h2>
          {daily.length ? (
            <table className="w-full text-sm"><thead><tr className="text-left opacity-60"><th>Day</th><th>Replies</th><th>Searches</th><th className="text-right">Cost</th></tr></thead>
              <tbody>{daily.map((d) => <tr key={d.day}><td>{d.day}</td><td>{Number(d.calls)}</td><td>{Number(d.searches)}</td><td className="text-right">${(Number(d.cost) / 1_000_000).toFixed(4)}</td></tr>)}</tbody></table>
          ) : <p className="text-sm opacity-65">No usage yet.</p>}
        </GlassCard>
        <GlassCard className="p-5" strong>
          <h2 className="font-semibold mb-3">Top questions</h2>
          {top.length ? <ol className="list-decimal pl-5 space-y-1 text-sm">{top.map((t, i) => <li key={i}>{t.question ?? "(filtered)"} <span className="opacity-60">×{Number(t.n)}</span></li>)}</ol> : <p className="text-sm opacity-65">No questions yet.</p>}
        </GlassCard>
      </div>

      <GlassCard className="p-5 mb-6" strong>
        <h2 className="font-semibold mb-3">Flagged answers</h2>
        {flagged.length ? (
          <ul className="divide-y divide-[var(--border-strong)]">
            {flagged.map((f) => (
              <li key={f.id} className="py-3 text-sm"><Badge tone="warning">{f.reason ?? "flagged"}</Badge> <span className="opacity-60 text-xs">{new Date(f.at).toLocaleString()}</span><p className="mt-1 whitespace-pre-wrap">{f.content.slice(0, 400)}</p></li>
            ))}
          </ul>
        ) : <p className="text-sm opacity-65">Nothing flagged.</p>}
      </GlassCard>

      <GlassCard className="p-5" strong>
        <h2 className="font-semibold mb-3">System prompts and limits</h2>
        <form action={savePrompts} className="space-y-4">
          <label className="block text-sm font-medium">Student prompt<textarea name="systemPrompt" defaultValue={config.systemPrompt} rows={10} className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm" /></label>
          <label className="block text-sm font-medium">Teacher and staff prompt<textarea name="staffPrompt" defaultValue={config.staffPrompt} rows={6} className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm" /></label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">Messages per hour<input name="messagesPerHour" type="number" defaultValue={config.limits.messagesPerHour} className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 p-2" /></label>
            <label className="text-sm">Monthly budget (USD)<input name="monthlyBudgetUsd" type="number" defaultValue={config.limits.monthlyBudgetUsd} className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 p-2" /></label>
            <label className="text-sm">Max tokens per reply<input name="maxReplyTokens" type="number" defaultValue={config.limits.maxReplyTokens} className="mt-1 w-full rounded-xl border border-white/15 bg-black/20 p-2" /></label>
          </div>
          <button type="submit" className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white">Save</button>
        </form>
      </GlassCard>
    </PortalShell>
  );
}
