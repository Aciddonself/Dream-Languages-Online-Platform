import Link from "next/link";
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
  { href: "/volunteer", label: "Teach with us" },
  { href: "/testimonials", label: "Student reviews" },
  { href: "/blog", label: "News & stories" },
  { href: "/faqs", label: "FAQs" },
  { href: "/login", label: "Sign in" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <div className="site-footer-brand-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/dla-logo.png" alt="" />
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
        <div className="site-footer-bottom">
          <span>© Dream Languages And Adult Literacy Uganda Limited. All rights reserved.</span>
          <span>Kampala, Uganda</span>
        </div>
      </div>
    </footer>
  );
}
