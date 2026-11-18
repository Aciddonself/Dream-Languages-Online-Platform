import { GlassCard } from "@/components/ui/glass";

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-4">Cookie Policy</h1>
      <GlassCard className="p-6 space-y-4 text-sm leading-relaxed">
        <p>DLA uses essential cookies to keep accounts signed in, protect the website, and remember cookie preferences. Optional analytics and advertising cookies are currently disabled.</p>
        <h2 className="font-bold text-base">Types of Cookies</h2>
        <p><strong>Authentication and security:</strong> Supabase session cookies support account sign in. An administrative security cookie helps enforce the admin inactivity timeout.</p>
        <p><strong>Cookie preference:</strong> A first party preference cookie and browser storage record whether you accepted or rejected optional cookies. This preference lasts for one year.</p>
        <p><strong>Optional analytics and advertising:</strong> These are not currently enabled on the website.</p>
        <h2 className="font-bold text-base">Managing Cookies</h2>
        <p>Use Cookie settings in the footer to change your choice at any time. Essential authentication and security cookies are required for the service and cannot be disabled through the preference control. You can also clear cookies and browser storage in your browser settings.</p>
      </GlassCard>
    </main>
  );
}
