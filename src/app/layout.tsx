import type { Metadata } from "next";
import { Crimson_Text, Playball, Romanesco } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteChrome } from "@/components/site-chrome";
import { AppToaster } from "@/components/app-toaster";

const romanesco = Romanesco({ subsets: ["latin"], weight: "400", variable: "--font-romanesco", display: "swap" });
const playball = Playball({ subsets: ["latin"], weight: "400", variable: "--font-playball", display: "swap" });
const crimson = Crimson_Text({ subsets: ["latin"], weight: ["400", "600", "700"], style: ["normal", "italic"], variable: "--font-crimson", display: "swap" });

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
      <body className={`${romanesco.variable} ${playball.variable} ${crimson.variable} antialiased`}>
        <ThemeProvider>
          <SiteChrome>{children}</SiteChrome>
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}