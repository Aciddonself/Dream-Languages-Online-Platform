import { GlassCard } from "@/components/ui/glass";

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-4">Terms of Service</h1>
      <GlassCard className="p-6 space-y-4 text-sm leading-relaxed">
        <p>By using the Dream Languages And Adult Literacy Uganda Limited (DLA) website and services, you agree to these terms.</p>
        <h2 className="font-bold text-base">Use of Services</h2>
        <p>DLA provides language education, practical skills training, and related services. Users must provide accurate information during registration and comply with school policies.</p>
        <h2 className="font-bold text-base">Account Responsibility</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials. Notify DLA immediately of any unauthorised use.</p>
        <h2 className="font-bold text-base">Intellectual Property</h2>
        <p>All course materials, content, and resources provided by DLA are protected by copyright. Reproduction or distribution without permission is prohibited.</p>
        <h2 className="font-bold text-base">Termination</h2>
        <p>DLA reserves the right to suspend or terminate accounts that violate these terms or school policies.</p>
        <h2 className="font-bold text-base">Contact</h2>
        <p>For questions, contact DLA at info@dreamlanguagesug.com or visit our Contact page.</p>
      </GlassCard>
    </main>
  );
}
