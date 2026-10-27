import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements, attendance, certificates, classes, communityGroups, departments, discussionRooms, emailLogs, exams, faqs, feeStructures,
  holds, incidents, invoices, levels, materials, newsPosts, notifications, partners, pauseRequests, payments, programmes, receipts,
  resitRequests, results, smsCampaigns, teacherApplications, teacherRatings, terms, testimonials, timetableSessions, users,
} from "@/db/schema";

export type SectionRow = { title: string; detail: string; status?: string };
export type SectionData = { rows: SectionRow[]; description: string; links?: { href: string; label: string }[] };

const day = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB") : "not set");
const when = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleString("en-GB") : "not set");
const name = (u: { displayName?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  u.displayName ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Unnamed");

async function people(role: "student" | "teacher" | "head_academics" | "finance" | "super_admin" | "applicant", description: string): Promise<SectionData> {
  const list = await db.select().from(users).where(and(eq(users.role, role), isNull(users.deletedAt))).orderBy(users.registrationNumber, desc(users.createdAt)).limit(200);
  return {
    description,
    links: [{ href: `/admin/users?role=${role}`, label: "Search, filter and create accounts" }],
    rows: list.map((u) => ({ title: name(u), detail: `${u.registrationNumber ? `${u.registrationNumber} · ` : ""}${u.email}`, status: u.status })),
  };
}

const loaders: Record<string, () => Promise<SectionData>> = {
  students: () => people("student", "Every enrolled student with their registration number."),
  teachers: () => people("teacher", "Teaching staff accounts."),
  "head-of-academics": () => people("head_academics", "Heads of Academics."),
  "finance-staff": () => people("finance", "Finance team accounts."),
  admins: () => people("super_admin", "School administrator accounts."),
  applications: () => people("applicant", "Applicants waiting to be reviewed and promoted to students."),

  volunteers: async () => {
    const list = await db.select().from(teacherApplications).orderBy(desc(teacherApplications.createdAt)).limit(100);
    return { description: "People who applied to teach with DLA.", links: [{ href: "/admin/volunteers", label: "Review applications" }], rows: list.map((a) => ({ title: `${a.firstName} ${a.lastName}`, detail: `${a.languageTaught ?? "Language not given"} · ${a.email}`, status: a.status })) };
  },
  programmes: async () => {
    const list = await db.select().from(programmes).orderBy(programmes.name);
    const lv = await db.select().from(levels).orderBy(levels.order);
    return { description: "Programmes and the levels taught.", rows: [...list.map((p) => ({ title: p.name, detail: p.description ?? "Programme" })), ...lv.map((l) => ({ title: `Level ${l.code}`, detail: l.name }))] };
  },
  terms: async () => {
    const list = await db.select().from(terms).orderBy(desc(terms.startDate));
    return { description: "Terms and monthly intakes.", links: [{ href: "/classes-2027", label: "View the 2027 intake calendar" }], rows: list.map((t) => ({ title: t.name, detail: `${day(t.startDate)} to ${day(t.endDate)}` })) };
  },
  timetable: async () => {
    const list = await db.select().from(timetableSessions).where(gte(timetableSessions.endsAt, new Date())).orderBy(timetableSessions.startsAt).limit(100);
    return { description: "Upcoming sessions on the timetable.", links: [{ href: "/admin/academic", label: "Schedule a session" }, { href: "/timetable", label: "Public timetable" }], rows: list.map((s) => ({ title: s.title, detail: `${when(s.startsAt)}${s.room ? ` · ${s.room}` : ""}`, status: s.meetUrl ? "Meet ready" : "Scheduled" })) };
  },
  "live-classes": async () => {
    const list = await db.select().from(timetableSessions).where(gte(timetableSessions.endsAt, new Date())).orderBy(timetableSessions.startsAt).limit(100);
    return { description: "Upcoming live classes and their Google Meet links.", links: [{ href: "https://meet.google.com/new", label: "Create a Google Meet" }, { href: "/admin/academic", label: "Schedule a session" }], rows: list.map((s) => ({ title: s.title, detail: `${when(s.startsAt)} · ${s.meetUrl ? "Meet link attached" : "No Meet link yet"}`, status: s.meetUrl ? "Meet ready" : "Scheduled" })) };
  },
  attendance: async () => {
    const list = await db.select().from(attendance).orderBy(desc(attendance.markedAt)).limit(100);
    return { description: "Latest attendance marks across all classes.", rows: list.map((a) => ({ title: a.status, detail: `${when(a.markedAt)}${a.note ? ` · ${a.note}` : ""}` })) };
  },
  exams: async () => {
    const list = await db.select().from(exams).orderBy(desc(exams.createdAt)).limit(100);
    return { description: "All exams and tests with their publication state.", rows: list.map((e) => ({ title: e.title, detail: `${e.durationMinutes ?? 60} minutes`, status: e.published ? "Published" : "Needs review" })) };
  },
  results: async () => {
    const list = await db.select({ score: results.score, grade: results.grade, published: results.published, title: exams.title }).from(results).leftJoin(exams, eq(results.examId, exams.id)).orderBy(desc(results.createdAt)).limit(100);
    return { description: "Latest results recorded.", rows: list.map((r) => ({ title: r.title ?? "Assessment", detail: `Score ${r.score ?? "pending"} · Grade ${r.grade ?? "not graded"}`, status: r.published ? "Released" : "Pending release" })) };
  },
  resits: async () => {
    const list = await db.select().from(resitRequests).orderBy(desc(resitRequests.createdAt)).limit(100);
    return { description: "Resit and re-mark requests from students.", rows: list.map((r) => ({ title: r.reason ?? "Resit request", detail: `Requested ${day(r.createdAt)}`, status: r.status })) };
  },
  certificates: async () => {
    const list = await db.select().from(certificates).orderBy(desc(certificates.issuedAt)).limit(100);
    return { description: "Certificates issued to students.", rows: list.map((c) => ({ title: `Level ${c.level ?? "-"}`, detail: `Issued ${day(c.issuedAt)} · Verify code ${c.verifyCode}` })) };
  },
  materials: async () => {
    const list = await db.select().from(materials).orderBy(desc(materials.createdAt)).limit(100);
    return { description: "Learning materials shared by teachers.", rows: list.map((m) => ({ title: m.title, detail: m.description ?? m.type ?? "Material" })) };
  },
  "fee-structures": async () => {
    const list = await db.select().from(feeStructures).orderBy(desc(feeStructures.createdAt));
    return { description: "Fee structures per programme and term.", rows: list.map((f) => ({ title: f.name, detail: `${f.currency} ${f.amount.toLocaleString()}` })) };
  },
  payments: async () => {
    const list = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(100);
    return { description: "Latest payments and their verification status.", links: [{ href: "/admin/finance", label: "Open finance console" }], rows: list.map((p) => ({ title: `${p.currency} ${p.amount.toLocaleString()} · ${p.method}`, detail: day(p.createdAt), status: p.status })) };
  },
  receipts: async () => {
    const list = await db.select().from(receipts).orderBy(desc(receipts.issuedAt)).limit(100);
    return { description: "Receipts issued.", rows: list.map((r) => ({ title: String(r.number ?? r.id), detail: `Issued ${day(r.issuedAt)}` })) };
  },
  debtors: async () => {
    const list = await db.select().from(invoices).where(sql`${invoices.status} <> 'paid'`).orderBy(invoices.dueAt).limit(100);
    return { description: "Unpaid invoices.", rows: list.map((i) => ({ title: `Invoice ${i.number}`, detail: `UGX ${i.amount.toLocaleString()} · due ${day(i.dueAt)}`, status: i.status })) };
  },
  holds: async () => {
    const list = await db.select().from(holds).where(eq(holds.status, "active")).orderBy(desc(holds.placedAt));
    return { description: "Students with an active account hold.", rows: list.map((h) => ({ title: h.reason, detail: `Since ${day(h.placedAt)}`, status: h.status })) };
  },
  "dead-semester": async () => {
    const list = await db.select().from(pauseRequests).orderBy(desc(pauseRequests.createdAt)).limit(100);
    return { description: "Requests to pause studies.", rows: list.map((r) => ({ title: r.reason ?? "Pause request", detail: `Requested ${day(r.createdAt)}`, status: r.status })) };
  },
  news: async () => {
    const list = await db.select().from(announcements).orderBy(desc(announcements.publishedAt)).limit(100);
    return { description: "Announcements sent to students and staff.", links: [{ href: "/admin/cms", label: "Publish an announcement" }], rows: list.map((a) => ({ title: a.title, detail: `${a.audience} · ${day(a.publishedAt)}` })) };
  },
  blog: async () => {
    const list = await db.select().from(newsPosts).orderBy(desc(newsPosts.createdAt)).limit(100);
    return { description: "Blog and news posts shown on the website.", links: [{ href: "/admin/cms", label: "Write a new post" }, { href: "/blog", label: "View the blog" }], rows: list.map((p) => ({ title: p.title, detail: `/${p.slug}`, status: p.status === "published" ? "Published" : "Draft" })) };
  },
  testimonials: async () => {
    const list = await db.select().from(testimonials).orderBy(desc(testimonials.createdAt)).limit(100);
    const ratings = await db.select().from(teacherRatings).orderBy(desc(teacherRatings.createdAt)).limit(50);
    return {
      description: "Student reviews and teacher ratings. Approve them on the CMS page so they appear on the website.",
      links: [{ href: "/admin/cms", label: "Approve reviews and ratings" }, { href: "/testimonials", label: "Public reviews page" }],
      rows: [
        ...list.map((t) => ({ title: `${t.authorName} · ${t.rating ?? 5}/5`, detail: t.quote, status: t.published ? "Published" : "Pending approval" })),
        ...ratings.map((r) => ({ title: `Teacher rating · ${r.rating}/5`, detail: r.comment ?? "No comment", status: r.published ? "Published" : "Pending approval" })),
      ],
    };
  },
  faqs: async () => {
    const list = await db.select().from(faqs).orderBy(faqs.order);
    return { description: "Frequently asked questions on the website.", rows: list.map((f) => ({ title: f.question, detail: f.answer, status: f.published ? "Published" : "Hidden" })) };
  },
  partners: async () => {
    const list = await db.select().from(partners).orderBy(partners.name);
    return { description: "Partners shown on the website. Add or remove them from the CMS page.", links: [{ href: "/admin/cms", label: "Add or remove partners" }], rows: list.map((p) => ({ title: p.name, detail: p.website ?? "No website" })) };
  },
  email: async () => {
    const list = await db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt)).limit(100);
    return { description: "Recent emails sent by the system.", rows: list.map((e) => ({ title: e.subject, detail: `${e.toEmail} · ${when(e.createdAt)}`, status: e.status })) };
  },
  sms: async () => {
    const list = await db.select().from(smsCampaigns).orderBy(desc(smsCampaigns.createdAt)).limit(100);
    return { description: "Bulk SMS campaigns.", links: [{ href: "/admin/sms", label: "Send a bulk SMS" }], rows: list.map((s) => ({ title: s.message, detail: `${s.recipientCount} recipients · ${day(s.createdAt)}`, status: s.status })) };
  },
  notifications: async () => {
    const list = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100);
    return { description: "Notifications sent to users.", rows: list.map((n) => ({ title: n.title, detail: n.body, status: n.read ? "Read" : "Unread" })) };
  },
  "discussion-rooms": async () => {
    const list = await db.select().from(discussionRooms).orderBy(desc(discussionRooms.createdAt)).limit(100);
    return { description: "Discussion rooms across the school.", rows: list.map((r) => ({ title: r.title, detail: `${r.language ?? "Any language"} · ${r.level ?? "All levels"}`, status: r.status })) };
  },
  "community-groups": async () => {
    const list = await db.select().from(communityGroups).orderBy(communityGroups.name);
    return { description: "Class and programme groups.", rows: list.map((g) => ({ title: g.name, detail: g.description ?? g.type })) };
  },
  academic: async () => {
    const list = await db.select().from(departments).where(isNull(departments.deletedAt)).orderBy(departments.name);
    return { description: "Languages and departments.", links: [{ href: "/admin/academic", label: "Open academic scheduler" }], rows: list.map((d) => ({ title: `${d.flagEmoji ?? ""} ${d.name}`.trim(), detail: d.description ?? d.code })) };
  },
  classes: async () => {
    const list = await db.select().from(classes).where(isNull(classes.deletedAt)).orderBy(classes.name);
    return { description: "All classes.", rows: list.map((c) => ({ title: c.name, detail: `Capacity: ${c.capacity ?? "not set"}` })) };
  },
  incidents: async () => {
    const list = await db.select().from(incidents).orderBy(desc(incidents.createdAt)).limit(100);
    return { description: "Safety incidents flagged by the system.", links: [{ href: "/admin/incidents", label: "Open incident centre" }], rows: list.map((i) => ({ title: i.type, detail: `${i.location ?? "unknown"} · ${day(i.createdAt)}`, status: i.status })) };
  },
};

export async function adminSection(slug: string): Promise<SectionData | null> {
  const loader = loaders[slug];
  if (!loader) return null;
  try {
    return await loader();
  } catch (error) {
    console.warn(`Admin section "${slug}" could not load:`, error);
    return { description: "This section could not load right now. Try again shortly.", rows: [] };
  }
}
