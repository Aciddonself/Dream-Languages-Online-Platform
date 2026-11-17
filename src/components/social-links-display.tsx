import { SOCIAL_SLOTS, type SocialLink, type SocialSlot } from "@/lib/social-link-types";

const BRAND_MARKS: Record<SocialSlot, string> = {
  facebook: "f",
  instagram: "◎",
  tiktok1: "♪",
  tiktok2: "♪",
  linkedin: "in",
  x: "𝕏",
  youtube: "▶",
};

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
            <span aria-hidden="true" className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 font-black leading-none ${link.slot === "youtube" ? "bg-red-600 text-white" : link.slot === "facebook" ? "bg-[#1877F2] text-white" : link.slot === "linkedin" ? "bg-[#0A66C2] text-white" : "bg-[var(--brand-primary)] text-white"}`}>{BRAND_MARKS[link.slot]}</span>
            <span>{compact ? label : `${label} ↗`}</span>
          </a>
        );
      })}
    </div>
  );
}
