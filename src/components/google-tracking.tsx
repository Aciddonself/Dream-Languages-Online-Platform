"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { readCookiePreferences, type CookiePreferences } from "@/components/cookie-consent";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID?.trim() ?? "";
const CONSENT_CHANGE_EVENT = "dla:cookie-preferences-changed";
const DENIED = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;
let loadedContainer = "";
let consentInitialized = false;
let lastTrackedPath = "";

function isValidPreferences(value: unknown): value is CookiePreferences {
  return typeof value === "object" && value !== null
    && typeof (value as CookiePreferences).analytics === "boolean"
    && typeof (value as CookiePreferences).advertising === "boolean";
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function setConsent(preferences: CookiePreferences) {
  window.dataLayer ??= [];
  window.gtag ??= (...args: unknown[]) => window.dataLayer?.push(args);

  // Queue defaults before GTM so tags cannot read or write optional storage
  // until the visitor has chosen the matching category.
  if (!consentInitialized) {
    window.gtag("consent", "default", DENIED);
    consentInitialized = true;
  }
  window.gtag("consent", "update", {
    analytics_storage: preferences.analytics ? "granted" : "denied",
    ad_storage: preferences.advertising ? "granted" : "denied",
    ad_user_data: preferences.advertising ? "granted" : "denied",
    ad_personalization: preferences.advertising ? "granted" : "denied",
  });
}

function loadContainer() {
  if (!/^GTM-[A-Z0-9]+$/.test(GTM_ID) || loadedContainer === GTM_ID) return;

  window.dataLayer ??= [];
  window.gtag ??= (...args: unknown[]) => window.dataLayer?.push(args);
  window.gtag("js", new Date());
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.async = true;
  script.dataset.dlaGoogleTagManager = GTM_ID;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`;
  document.head.appendChild(script);
  loadedContainer = GTM_ID;
}

function clearGoogleCookies(prefixes: string[]) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const names = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=", 1)[0])
    .filter((name) => prefixes.some((prefix) => name === prefix || name.startsWith(`${prefix}_`)));
  const rootDomain = window.location.hostname.split(".").slice(-2).join(".");

  for (const name of names) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    if (rootDomain.includes(".")) {
      document.cookie = `${name}=; Path=/; Domain=.${rootDomain}; Max-Age=0; SameSite=Lax${secure}`;
    }
  }
}

function isPrivatePath(pathname: string) {
  return ["/admin", "/hoc", "/teacher", "/finance", "/student", "/applicant", "/login"]
    .some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function GoogleTracking() {
  const pathname = usePathname();
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    const saved = readCookiePreferences();
    if (saved) setPreferences(saved);

    const onPreferenceChange = (event: Event) => {
      const next = (event as CustomEvent<CookiePreferences>).detail;
      if (isValidPreferences(next)) setPreferences(next);
    };
    window.addEventListener(CONSENT_CHANGE_EVENT, onPreferenceChange);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onPreferenceChange);
  }, []);

  useEffect(() => {
    if (!preferences) return;

    const hasOptionalConsent = preferences.analytics || preferences.advertising;
    if (!hasOptionalConsent) {
      setConsent({ analytics: false, advertising: false });
      clearGoogleCookies(["_ga", "_gid", "_gcl", "_gac"]);
      lastTrackedPath = "";
      return;
    }

    setConsent(preferences);
    loadContainer();

    if (!isPrivatePath(pathname) && lastTrackedPath !== pathname) {
      window.dataLayer?.push({
        event: "page_view",
        page_title: document.title,
        page_location: `${window.location.origin}${pathname}`,
        page_path: pathname,
      });
      lastTrackedPath = pathname;
    }
  }, [pathname, preferences]);

  return null;
}
