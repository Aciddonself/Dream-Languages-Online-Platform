import { SOCIAL_SLOTS, type SocialLink, type SocialSlot } from "@/lib/social-link-types";

function SocialMark({ slot }: { slot: SocialSlot }) {
  if (slot === "facebook") return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><path d="M13.6 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.5 1.6-1.5H17V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.5v3.2h2.8V21h3.3Z" /></svg>;
  if (slot === "instagram") return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.6" cy="6.5" r=".8" className="fill-current stroke-none" /></svg>;
  if (slot === "tiktok1" || slot === "tiktok2") return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><path d="M16.6 3c.3 2.2 1.5 3.5 3.4 3.7v3.2a8 8 0 0 1-3.4-1v6.4a5.7 5.7 0 1 1-5.7-5.7c.4 0 .8 0 1.2.1V13a2.6 2.6 0 1 0 1.2 2.2V3h3.3Z" /></svg>;
  if (slot === "linkedin") return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><path d="M5.2 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8ZM3.6 9h3.2v11.4H3.6V9Zm5.2 0h3v1.6h.1a3.3 3.3 0 0 1 3-1.9c3.2 0 3.8 2.1 3.8 4.8v6.9h-3.2v-6.1c0-1.5 0-3.3-2-3.3s-2.3 1.6-2.3 3.2v6.2H8.8V9Z" /></svg>;
  if (slot === "youtube") return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.7V8.3l6.3 3.7-6.3 3.7Z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.8 5.7 22H2.5l7.3-8.4L1.8 2h6.5l4.5 6.7L18.9 2Zm-1.1 17.8h1.7L7.3 4H5.5l12.3 15.8Z" /></svg>;
}

export function SocialLinksDisplay({ links, compact = false }: { links: SocialLink[]; compact?: boolean }) {
  const active = links.filter((link) => link.url);
  if (!active.length) return <p className="text-sm text-[var(--text-muted)]">Our social pages will be listed here soon.</p>;
  return (
    <div className={`grid grid-cols-2 gap-2 sm:flex sm:flex-wrap ${compact ? "sm:gap-2" : "sm:gap-3"}`}>
      {active.map((link) => {
        const platform = SOCIAL_SLOTS.find((item) => item.id === link.slot);
        const label = link.slot === "tiktok1" || link.slot === "tiktok2" ? `TikTok ${link.slot.endsWith("1") ? "1" : "2"}` : platform?.name ?? link.slot;
        return (
          <a key={link.slot} href={link.url} target="_blank" rel="noopener noreferrer"
            aria-label={`Open DLA on ${label}`} title={label}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-strong)] px-3 py-2 text-sm font-bold text-[var(--brand-secondary)] shadow-[0_3px_12px_rgba(8,38,74,0.06)] transition-colors hover:border-[var(--brand-primary)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-secondary)]">
            <span aria-hidden="true" className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${link.slot === "youtube" ? "bg-red-600 text-white" : link.slot === "facebook" ? "bg-[#1877F2] text-white" : link.slot === "linkedin" ? "bg-[#0A66C2] text-white" : link.slot === "tiktok1" || link.slot === "tiktok2" ? "bg-black text-white" : link.slot === "instagram" ? "bg-gradient-to-br from-fuchsia-600 via-rose-500 to-amber-400 text-white" : "bg-[var(--text)] text-white"}`}><SocialMark slot={link.slot} /></span>
            <span>{compact ? label : `${label} ↗`}</span>
          </a>
        );
      })}
    </div>
  );
}
