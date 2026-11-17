import Link from "next/link";
import { GlassCard } from "@/components/ui/glass";
import { whatsappContacts } from "@/lib/contacts";

export default async function ContactPage({ searchParams }: { searchParams?: Promise<{ shopItem?: string }> }) {
  const item = (await searchParams)?.shopItem?.slice(0, 120);
  const orderLinks = item ? whatsappContacts.map((contact) => {
    const url = new URL(contact.href);
    url.searchParams.set("text", `Hello DLA, I am interested in ordering ${item} from My DLA Shop. Please share availability and payment details.`);
    return { ...contact, href: url.toString() };
  }) : null;
  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-4">Contact Us</h1>
      <GlassCard className="p-6 space-y-3">
        <div className="text-sm opacity-80">P.O. Box 123526, Kampala GPO; Bbunga, Ggaba Road, at St. Karoli Lwanga Catholic Church.</div>
        <p className="text-sm opacity-75">Prospective learners can apply online and the DLA team will reply inside the system. Enrolled students and staff can use the in-system help desk and inbox.</p>
        <p className="text-sm opacity-75">Chat with the DLA team on WhatsApp:</p>
        {item && <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-4"><p className="font-bold">My DLA Shop enquiry: {item}</p><p className="mt-1 text-sm opacity-75">Choose a DLA WhatsApp contact and the item name will be included in your message.</p></div>}
        <div className="flex flex-wrap gap-3">
          {(orderLinks ?? whatsappContacts).map((contact) => (
            <a
              className="inline-flex rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold hover:bg-white/40"
              href={contact.href}
              key={contact.label}
              rel="noreferrer"
              target="_blank"
            >
              {contact.label} · {contact.number}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="inline-flex rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold hover:bg-white/40" href="/register">Apply online</Link>
        </div>
      </GlassCard>
    </main>
  );
}
