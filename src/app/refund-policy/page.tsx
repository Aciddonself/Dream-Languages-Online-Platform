import { GlassCard } from "@/components/ui/glass";

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-4">Refund Policy</h1>
      <GlassCard className="p-6 space-y-4 text-sm leading-relaxed">
        <p>DLA is committed to fair and transparent refund practices.</p>
        <h2 className="font-bold text-base">Eligibility</h2>
        <p>Refund requests must be submitted within 14 days of payment. Refunds are processed for unused course sessions only.</p>
        <h2 className="font-bold text-base">Non-Refundable Items</h2>
        <p>Registration fees, placement test fees, and materials already distributed are non-refundable.</p>
        <h2 className="font-bold text-base">Process</h2>
        <p>To request a refund, contact the Finance office with your registration number and payment receipt. Refunds are processed within 14 business days.</p>
        <h2 className="font-bold text-base">Contact</h2>
        <p>Finance office: finance@dreamlanguagesug.com</p>
      </GlassCard>
    </main>
  );
}
