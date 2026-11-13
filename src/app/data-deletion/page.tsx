import { GlassCard, GlassButton, GlassInput } from "@/components/ui/glass";

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-4">Data Deletion Request</h1>
      <GlassCard className="p-6">
        <p className="text-sm opacity-70 mb-4">Request deletion of your personal data from DLA systems.</p>
        <form className="space-y-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Full Name</label>
            <GlassInput placeholder="Your full name" />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Email</label>
            <GlassInput type="email" placeholder="your@email.com" />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Registration Number (if applicable)</label>
            <GlassInput placeholder="DLA/2026/GER/0042" />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Reason</label>
            <GlassInput placeholder="Why you want your data deleted" />
          </div>
          <GlassButton type="submit" variant="primary">Submit Request</GlassButton>
        </form>
      </GlassCard>
    </main>
  );
}
