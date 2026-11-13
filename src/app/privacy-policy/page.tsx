import { GlassCard } from "@/components/ui/glass";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-4">Privacy Policy</h1>
      <GlassCard className="p-6 space-y-4 text-sm leading-relaxed">
        <p>DLA is committed to protecting your personal data in accordance with the Uganda Data Protection and Privacy Act 2019.</p>
        <h2 className="font-bold text-base">Data We Collect</h2>
        <p>We collect only necessary information: name, contact details, academic records, and payment information for educational purposes.</p>
        <h2 className="font-bold text-base">How We Use Data</h2>
        <p>Data is used for enrolment, academic tracking, fee management, and communication. We do not sell personal data to third parties.</p>
        <h2 className="font-bold text-base">Google Calendar and Meet</h2>
        <p>When an authorized administrator connects the school Google account, DLA uses Google Calendar event access to create class schedule entries and Google Meet links. The integration stores an encrypted refresh token in the school database, and uses it only to create these requested class events. It does not read unrelated calendar events, invite students by email, or use Google Calendar data for advertising. Administrators can disconnect the Google account from the Academic page; they can also revoke access from their Google Account security settings.</p>
        <h2 className="font-bold text-base">Your Rights</h2>
        <p>You have the right to access, correct, or request deletion of your personal data. Use our Data Deletion Request form.</p>
        <h2 className="font-bold text-base">Contact</h2>
        <p>Data Protection Officer: privacy@dreamlanguagesug.com</p>
      </GlassCard>
    </main>
  );
}
