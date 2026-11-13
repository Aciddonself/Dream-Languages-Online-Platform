import { GlassCard } from "@/components/ui/glass";

function getWebmailUrl() {
  const value = process.env.CPANEL_WEBMAIL_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function MailAccessCard() {
  const webmailUrl = getWebmailUrl();
  return (
    <GlassCard className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5" strong>
      <div>
        <h2 className="font-semibold">School email</h2>
        <p className="mt-1 text-sm opacity-70">
          {webmailUrl
            ? "Open the school mailbox in cPanel Webmail. Inbox access can be integrated here after the mailbox is configured."
            : "Configure a secure cPanel Webmail URL to add the school inbox shortcut here."}
        </p>
      </div>
      {webmailUrl ? (
        <a className="btn-glass btn-glass-primary inline-flex items-center rounded-xl px-4 py-2 font-semibold" href={webmailUrl} target="_blank" rel="noopener noreferrer">
          Open school inbox ↗
        </a>
      ) : (
        <span className="rounded-xl border border-white/15 px-4 py-2 text-sm opacity-60" aria-disabled="true">
          Inbox not configured
        </span>
      )}
    </GlassCard>
  );
}
