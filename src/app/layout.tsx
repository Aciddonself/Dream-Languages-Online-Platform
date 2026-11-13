import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppToaster } from "@/components/app-toaster";
import { CookieConsent } from "@/components/cookie-consent";
import { SiteChrome } from "@/components/site-chrome";

// The proxy creates a per-request CSP nonce and Next.js copies it onto its
// inline hydration scripts. Static/ISR HTML would cache an older nonce, causing
// browsers to block hydration and remain on the route loading skeleton. Keep
// the route tree request-rendered so the HTML nonce matches the response CSP.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.dreamlanguagesug.com"),
  title: {
    default: "Dream Languages And Adult Literacy",
    template: "%s | DLA",
  },
  description:
    "Dream Languages and Adult Literacy offers modern language learning, adult literacy, placement assessments, and student support in Uganda.",
  openGraph: {
    title: "Dream Languages And Adult Literacy",
    description:
      "Dream Languages and Adult Literacy offers modern language learning, adult literacy, placement assessments, and student support in Uganda.",
    url: "https://www.dreamlanguagesug.com",
    siteName: "Dream Languages And Adult Literacy",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Dream Languages And Adult Literacy",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <SiteChrome>{children}</SiteChrome>
          <AppToaster />
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
