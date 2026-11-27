"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { SocialLinksDisplay } from "@/components/social-links-display";
import { CookieSettingsButton } from "@/components/cookie-consent";
import { DEFAULT_SOCIAL_LINKS, type SocialLinks } from "@/lib/social-link-types";
import { whatsappContacts } from "@/lib/contacts";

const explore = [
  { href: "/about", label: "About DLA" },
  { href: "/departments", label: "Departments" },
  { href: "/courses", label: "Courses & fees" },
  { href: "/classes-2027", label: "Classes 2027" },
  { href: "/timetable", label: "Timetable" },
];

const community = [
  { href: "/apply", label: "Apply for admission" },
  { href: "/my-dla-shop", label: "MY_DLA_SHOP" },
  { href: "/volunteer", label: "Teach with us" },
  { href: "/testimonials", label: "Student reviews" },
  { href: "/blog", label: "News & stories" },
  { href: "/faqs", label: "FAQs" },
];

const legal = [
  { href: "/terms-of-service", label: "Terms of Service" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/cookie-policy", label: "Cookie Policy" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/data-deletion", label: "Data Deletion Request" },
];

export function SiteFooter() {
  const [socialLinks, setSocialLinks] = useState<SocialLinks>([...DEFAULT_SOCIAL_LINKS]);
  useEffect(() => {
    let active = true;
    void fetch("/api/public/social-links", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ links?: SocialLinks }> : null)
      .then((data) => { if (active && data?.links) setSocialLinks(data.links); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <div className="site-footer-brand-head">
            <Image src="/dla-logo.png" alt="" width={88} height={88} quality={90} />
            <strong>Dream Languages Uganda</strong>
          </div>
          <p>Language learning, adult literacy, and practical skills for every learner.</p>
          <p className="site-footer-tagline">Learn · Grow · Belong</p>
        </div>
        <div className="site-footer-col">
          <h3>Explore</h3>
          <nav aria-label="Footer explore">
            {explore.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}</Link>
            ))}
          </nav>
        </div>
        <div className="site-footer-col">
          <h3>Community</h3>
          <nav aria-label="Footer community">
            {community.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}</Link>
            ))}
          </nav>
        </div>
        <div className="site-footer-col">
          <h3>Get in touch</h3>
          <nav aria-label="Footer contact">
            <Link href="/contact">Contact us</Link>
            {whatsappContacts.map((contact) => (
              <a key={contact.label} href={contact.href} target="_blank" rel="noreferrer">
                {contact.label} · {contact.number}
              </a>
            ))}
          </nav>
        </div>
        <div className="site-footer-col">
          <h3>Legal</h3>
          <nav aria-label="Footer legal">
            {legal.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}</Link>
            ))}
            <CookieSettingsButton />
          </nav>
        </div>
        <div className="site-footer-col">
          <h3>Social media</h3>
          <SocialLinksDisplay links={socialLinks} compact />
        </div>
        <div className="site-footer-bottom">
          <span>© Dream Languages And Adult Literacy Uganda Limited. All rights reserved.</span>
          <span>Kampala, Uganda · info@dreamlanguagesug.online · Reg. No. DLA-UG-001</span>
          <span>Built by <a href="https://www.zilenix.online" target="_blank" rel="noopener noreferrer">Zilenix</a></span>
        </div>
      </div>
    </footer>
  );
}
