import type { TikTokLinks } from "@/lib/social-links";

export function TikTokLinks({ links }: { links: TikTokLinks }) {
  return <div className="flex flex-wrap gap-3">{links.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="btn-glass rounded-xl px-4 py-2 font-semibold">TikTok · {link.label}<span aria-hidden="true"> ↗</span></a>)}</div>;
}
