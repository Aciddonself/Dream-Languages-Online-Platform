import { GlassCard } from "@/components/ui/glass";

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-4">Cookie Policy</h1>
      <GlassCard className="p-6 space-y-4 text-sm leading-relaxed">
        <p>DLA uses cookies to improve your experience. Essential cookies are required for the site to function. Analytics cookies help us understand usage.</p>
        <h2 className="font-bold text-base">Types of Cookies</h2>
        <p><strong>Essential:</strong> Required for login, navigation, and security.</p>
        <p><strong>Analytics:</strong> Help us improve the website (optional, requires consent).</p>
        <h2 className="font-bold text-base">Managing Cookies</h2>
        <p>You can accept or reject non-essential cookies using the consent banner. You can also manage cookies through your browser settings.</p>
      </GlassCard>
    </main>
  );
}
