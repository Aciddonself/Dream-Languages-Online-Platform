import Link from "next/link";
import { whatsappContacts } from "@/lib/contacts";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <strong>Dream Languages Uganda</strong>
          <p>Language learning, adult literacy, and practical skills for every learner.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/about">About DLA</Link>
          <Link href="/courses">Courses</Link>
          <Link href="/volunteer">Teach with us</Link>
          <Link href="/contact">Contact</Link>
          {whatsappContacts.map((contact) => (
            <a key={contact.label} href={contact.href} target="_blank" rel="noreferrer">
              {contact.label} · {contact.number}
            </a>
          ))}
        </nav>
        <span className="site-footer-copy">© Dream Languages And Adult Literacy Uganda Limited. All rights reserved.</span>
      </div>
    </footer>
  );
}
