import { GlassCard } from "@/components/ui/glass";

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-4">Cookie Policy</h1>
      <GlassCard className="p-6 space-y-4 text-sm leading-relaxed">
        <p>DLA uses essential cookies to keep accounts signed in, protect the website, and remember cookie preferences. Optional Google Analytics 4 and Google Ads tags run only when a visitor opts in and DLA has configured the matching measurement ID.</p>
        <h2 className="font-bold text-base">Types of Cookies</h2>
        <p><strong>Authentication and security:</strong> Supabase session cookies support account sign in. An administrative security cookie helps enforce the admin inactivity timeout.</p>
        <p><strong>Cookie preference:</strong> A first party preference cookie and browser storage record whether you accepted or rejected optional cookies. This preference lasts for one year.</p>
        <p><strong>Optional analytics and advertising:</strong> Google Analytics 4 and Google Ads load only after you opt in to the relevant category and the corresponding tag ID has been configured. Google may receive usage, device, and advertising measurement data according to the selected service and its policies.</p>
        <h2 className="font-bold text-base">Managing Cookies</h2>
        <p>Use Cookie settings in the footer to change your analytics or advertising choice at any time. Rejecting or withdrawing optional consent prevents future optional tracking and clears site visible Google measurement cookies. Essential authentication and security cookies are required for the service and cannot be disabled through the preference control. You can also clear cookies and browser storage in your browser settings.</p>
        <p>Learn more in <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google’s Privacy Policy</a>.</p>
      </GlassCard>
    </main>
  );
}