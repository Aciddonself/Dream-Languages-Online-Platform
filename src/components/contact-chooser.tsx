"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import { whatsappContacts } from "@/lib/contacts";

export function ContactChooser() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <aside className="contact-chooser no-print" aria-label="Contact DLA">
      <div className="contact-chooser-panel" id="contact-chooser-options" hidden={!open}>
        <div className="contact-chooser-heading">
          <div>
            <strong>Chat with DLA on WhatsApp</strong>
            <span>Choose either DLA contact number.</span>
          </div>
          <button type="button" className="contact-chooser-close" aria-label="Close contact options" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        {whatsappContacts.map((contact) => (
          <div className="contact-chooser-number" key={contact.label}>
            <strong>{contact.number}</strong>
            <div className="contact-chooser-actions">
              <a href={contact.href} target="_blank" rel="noreferrer">
                <MessageCircle size={16} aria-hidden="true" /> {contact.label}
              </a>
            </div>
          </div>
        ))}
        <div className="contact-chooser-number">
          <Link href="/contact" onClick={() => setOpen(false)}>More ways to contact us</Link>
        </div>
      </div>
      <button
        type="button"
        className="contact-chooser-trigger"
        aria-expanded={open}
        aria-controls="contact-chooser-options"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={19} /> : <MessageCircle size={20} />}
        <span>{open ? "Close" : "WhatsApp DLA"}</span>
      </button>
    </aside>
  );
}
