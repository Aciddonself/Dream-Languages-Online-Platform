import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteChrome } from "@/components/site-chrome";
import { AppToaster } from "@/components/app-toaster";

const inter = Inter({ subsets: ["latin", "cyrillic", "greek", "vietnamese"], variable: "--font-inter", display: "swap", preload: false });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });

export const metadata: Metadata = {
  title: "DLA Learning Hub",
  description: "Online learning and school management for Dream Languages Uganda",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${space.variable} antialiased`}>
        <ThemeProvider>
          <SiteChrome>{children}</SiteChrome>
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}