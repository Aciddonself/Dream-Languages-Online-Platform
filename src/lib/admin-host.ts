import "server-only";

const isProd = process.env.NODE_ENV === "production";

/** Hostname dedicated to administrator sign-in, e.g. admin.dreamlanguagesug.online. */
export function adminHost() {
  return (process.env.ADMIN_HOST ?? "").trim().toLowerCase();
}

export function requestHost(req: Request) {
  return (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
}

/**
 * Administrator sign-in is only honoured on the admin host. When ADMIN_HOST is not configured
 * (local development) it is allowed anywhere, but never from the public /login form.
 */
export function adminHostAllowed(req: Request) {
  const configured = adminHost();
  if (!configured) return !isProd || process.env.ALLOW_ADMIN_WITHOUT_HOST === "true";
  return requestHost(req) === configured;
}

export function isAdminRole(role: string) {
  return role === "super_admin" || role === "admin";
}

/** Only the two explicitly designated DLA administrator identities may use admin privileges. */
export function isDesignatedAdministrator(role: string, email: string) {
  const address = email.trim().toLowerCase();
  if (role === "super_admin") return address === "dreamlanguagesuganda@gmail.com";
  if (role === "admin") return address === "mabadilikojoseph300@gmail.com";
  return true;
}

export function adminOrigin(fallback: string) {
  const configured = adminHost();
  if (!configured) return fallback;
  return `${/^localhost(:\d+)?$/.test(configured) ? "http" : "https"}://${configured}`;
}
