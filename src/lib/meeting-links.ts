/** Accept Google Meet links for new sessions and existing configured Jitsi rooms. */
export function isSupportedMeetingUrl(value: string) {
  try {
    const url = new URL(value);
    const isGoogleMeet = url.protocol === "https:"
      && url.hostname === "meet.google.com"
      && url.username === ""
      && url.password === ""
      && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/i.test(url.pathname);
    const isLegacyJitsi = url.protocol === "https:"
      && url.hostname === "meet.jit.si"
      && url.username === ""
      && url.password === ""
      && url.pathname.split("/").filter(Boolean).length === 1;
    return isGoogleMeet || isLegacyJitsi;
  } catch {
    return false;
  }
}
