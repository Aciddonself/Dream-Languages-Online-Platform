import { GlassCard } from "@/components/ui/glass";

function getWebmailUrl() {
  const value = process.env.CPANEL_WEBMAIL_URL?.trim() || "https://mail.hostinger.com/";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function MailAccessCard() {
  const webmailUrl = getWebmailUrl();
  // Use the stable webmail entry point. A /cpsess... token is temporary and must not be committed.
  const infoComWebmailUrl = "https://dreamlanguagesug.com:2096/3rdparty/roundcube/?_task=mail&_mbox=INBOX";
  return (
    <GlassCard className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5" strong>
      <div>
        <h2 className="font-semibold">School email</h2>
        <p className="mt-1 text-sm opacity-70">
          Open the info@dreamlanguagesug.online mailbox in this browser. Sign in with the mailbox password if prompted.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {webmailUrl ? (
          <a className="btn-glass btn-glass-primary inline-flex items-center rounded-xl px-4 py-2 font-semibold" href={webmailUrl}>
            Open info@dreamlanguagesug.online inbox
          </a>
        ) : null}
        <a className="btn-glass inline-flex items-center rounded-xl px-4 py-2 font-semibold" href={infoComWebmailUrl}>
          Open info@dreamlanguagesug.com inbox
        </a>
      </div>
    </GlassCard>
  );
}
