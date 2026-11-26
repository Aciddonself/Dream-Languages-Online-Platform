import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements, attendance, certificates, classes, communityGroups, departments, discussionRooms, emailLogs, exams, faqs, feeStructures,
  feeSchedules, holds, incidents, invoices, levels, materials, newsPosts, notifications, partners, pauseRequests, payments, programmes, receipts, settings,
  resitRequests, results, smsCampaigns, teacherApplications, teacherRatings, terms, testimonials, timetableSessions, users,
} from "@/db/schema";

export type SectionRow = { title: string; detail: string; status?: string; href?: string };
export type SectionData = { rows: SectionRow[]; description: string; links?: { href: string; label: string }[] };

const day = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB") : "not set");
const when = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleString("en-GB") : "not set");
const name = (u: { displayName?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  u.displayName ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Unnamed");

async function people(role: "student" | "teacher" | "head_academics" | "finance" | "super_admin" | "applicant" | "admin", description: string): Promise<SectionData> {
  const list = await db.select({ user: users, departmentName: departments.name }).from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.role, role), isNull(users.deletedAt))).orderBy(users.registrationNumber, desc(users.createdAt)).limit(200);
  return {
    description,
    links: [{ href: `/admin/users?role=${role}`, label: "Search, filter and create accounts" }],
    rows: list.map(({ user: u, departmentName }) => ({ title: name(u), detail: `${departmentName ? `${departmentName} · ` : "Unassigned department · "}${u.registrationNumber ? `${u.registrationNumber} · ` : ""}${u.email}`, status: u.status })),
  };
}

const loaders: Record<string, () => Promise<SectionData>> = {
  students: () => people("student", "Every enrolled student with their registration number."),
  teachers: () => people("teacher", "Teaching staff accounts."),
  "head-of-academics": () => people("head_academics", "Heads of Academics."),
  "finance-staff": () => people("finance", "Finance team accounts."),
  admins: async () => {
    const list = await db.select().from(users).where(and(inArray(users.role, ["super_admin", "admin"]), isNull(users.deletedAt))).orderBy(desc(users.createdAt)).limit(200);
    return { description: "Super admin and admin accounts.", links: [{ href: "/admin/users?role=admin", label: "Search, filter and create accounts" }], rows: list.map((u) => ({ title: name(u), detail: u.email, status: u.status })) };
  },
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
    const list = await db.select({
      id: feeStructures.id,
      name: feeStructures.name,
      amount: feeStructures.amount,
      currency: feeStructures.currency,
      createdAt: feeStructures.createdAt,
      programme: programmes.name,
      levelCode: levels.code,
      termName: terms.name,
    }).from(feeStructures)
      .leftJoin(programmes, eq(feeStructures.programmeId, programmes.id))
      .leftJoin(levels, eq(feeStructures.levelId, levels.id))
      .leftJoin(terms, eq(feeStructures.termId, terms.id))
      .orderBy(desc(feeStructures.createdAt));
    return {
      description: "Published fee structure records from the finance database, including programme, level, and term when linked.",
      links: [{ href: "/finance", label: "Open Finance dashboard" }],
      rows: list.map((f) => ({ title: f.name, detail: `${f.currency} ${f.amount.toLocaleString()} · ${f.programme ?? "Programme not linked"} · ${f.levelCode ? `Level ${f.levelCode}` : "All levels"} · ${f.termName ?? "Term not linked"} · added ${day(f.createdAt)}` })),
    };
  },
  payments: async () => {
    const list = await db.select({
      id: payments.id, amount: payments.amount, currency: payments.currency, method: payments.method,
      reference: payments.reference, status: payments.status, createdAt: payments.createdAt,
      verifiedAt: payments.verifiedAt, studentName: users.displayName, firstName: users.firstName,
      lastName: users.lastName, email: users.email, registrationNumber: users.registrationNumber,
      departmentName: departments.name,
    }).from(payments).leftJoin(users, eq(payments.studentId, users.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .orderBy(desc(payments.createdAt)).limit(250);
    return {
      description: "Student payment submissions, current verification state, transaction reference, and language department.",
      links: [{ href: "/finance/payments", label: "Review and verify payments" }],
      rows: list.map((p) => ({
        title: `${p.currency} ${p.amount.toLocaleString()} · ${p.studentName ?? ([p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || "Student not linked")}`,
        detail: `${p.registrationNumber ?? "No registration number"} · ${p.departmentName ?? "Department not assigned"} · ${p.method.replaceAll("_", " ")} · Reference ${p.reference ?? "not supplied"} · submitted ${when(p.createdAt)}${p.verifiedAt ? ` · reviewed ${when(p.verifiedAt)}` : ""}`,
        status: p.status,
      })),
    };
  },
  refunds: async () => {
    const reversed = await db.select({ amount: payments.amount, currency: payments.currency, method: payments.method,
      reference: payments.reference, createdAt: payments.createdAt, studentName: users.displayName,
      firstName: users.firstName, lastName: users.lastName, email: users.email, registrationNumber: users.registrationNumber,
    }).from(payments).leftJoin(users, eq(payments.studentId, users.id))
      .where(eq(payments.status, "reversed")).orderBy(desc(payments.createdAt)).limit(200);
    const rejectedCount = await db.select({ total: sql<number>`count(*)::int` }).from(payments).where(eq(payments.status, "rejected"));
    return {
      description: `Reversed payment records only. Rejected payments are not refunds. The current database does not store refund requests, approval decisions, or payout transactions. ${rejectedCount[0]?.total ?? 0} rejected payment(s) are recorded separately.`,
      links: [{ href: "/admin/payments", label: "Review payment records" }],
      rows: reversed.map((payment) => ({
        title: `${payment.currency} ${payment.amount.toLocaleString()} · ${payment.studentName ?? ([payment.firstName, payment.lastName].filter(Boolean).join(" ") || payment.email || "Student not linked")}`,
        detail: `${payment.registrationNumber ?? "No registration number"} · ${payment.method.replaceAll("_", " ")} · reference ${payment.reference ?? "not supplied"} · recorded ${when(payment.createdAt)}`,
        status: "Reversed",
      })),
    };
  },
  receipts: async () => {
    const [issued, eligible] = await Promise.all([
      db.select({ number: receipts.number, issuedAt: receipts.issuedAt, paymentId: payments.id,
        amount: payments.amount, currency: payments.currency, method: payments.method,
        registrationNumber: users.registrationNumber, displayName: users.displayName,
        firstName: users.firstName, lastName: users.lastName, email: users.email,
      }).from(receipts).leftJoin(payments, eq(receipts.paymentId, payments.id))
        .leftJoin(users, eq(payments.studentId, users.id)).orderBy(desc(receipts.issuedAt)).limit(200),
      db.select({ id: payments.id, amount: payments.amount, currency: payments.currency, createdAt: payments.createdAt,
        registrationNumber: users.registrationNumber, displayName: users.displayName, firstName: users.firstName,
        lastName: users.lastName, email: users.email,
      }).from(payments).leftJoin(users, eq(payments.studentId, users.id))
        .where(eq(payments.status, "verified")).orderBy(desc(payments.verifiedAt)).limit(200),
    ]);
    const issuedPaymentIds = new Set(issued.map((receipt) => receipt.paymentId).filter(Boolean));
    return {
      description: "Issued receipts plus verified payments for which a downloadable receipt can be generated.",
      rows: [
        ...issued.map((r) => ({
          title: `${r.number} · ${r.currency ?? "UGX"} ${Number(r.amount ?? 0).toLocaleString()}`,
          detail: `${r.displayName ?? ([r.firstName, r.lastName].filter(Boolean).join(" ") || r.email || "Student not linked")} · ${r.registrationNumber ?? "No registration number"} · ${r.method ?? "Payment"} · issued ${when(r.issuedAt)}`,
          href: r.paymentId ? `/api/portal/documents/receipt/${r.paymentId}` : undefined,
          status: "Issued",
        })),
        ...eligible.filter((p) => !issuedPaymentIds.has(p.id)).map((p) => ({
          title: `${p.currency} ${p.amount.toLocaleString()} · ${p.displayName ?? ([p.firstName, p.lastName].filter(Boolean).join(" ") || p.email || "Student not linked")}`,
          detail: `${p.registrationNumber ?? "No registration number"} · verified ${when(p.createdAt)} · receipt not generated yet`,
          href: `/api/portal/documents/receipt/${p.id}`,
          status: "Ready to issue",
        })),
      ],
    };
  },
  debtors: async () => {
    const scheduleRows = await db.select({
      id: feeSchedules.id, amount: feeSchedules.amount, paid: feeSchedules.paid,
      currency: feeSchedules.currency, dueDate: feeSchedules.dueDate, status: feeSchedules.status,
      displayName: users.displayName, firstName: users.firstName, lastName: users.lastName,
      email: users.email, registrationNumber: users.registrationNumber, departmentName: departments.name,
    }).from(feeSchedules).leftJoin(users, eq(feeSchedules.studentId, users.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(sql`${feeSchedules.paid} < ${feeSchedules.amount}`)
      .orderBy(feeSchedules.dueDate, users.registrationNumber).limit(250);
    const invoiceRows = await db.select({ id: invoices.id, number: invoices.number, amount: invoices.amount,
      dueAt: invoices.dueAt, status: invoices.status, displayName: users.displayName,
      firstName: users.firstName, lastName: users.lastName, email: users.email, registrationNumber: users.registrationNumber,
    }).from(invoices).leftJoin(users, eq(invoices.studentId, users.id))
      .where(sql`${invoices.status} <> 'paid'`).orderBy(invoices.dueAt).limit(250);
    return {
      description: "Outstanding student fee schedules and unpaid invoices. Schedules show paid versus billed amounts; invoices are shown separately because they are a separate ledger record.",
      links: [{ href: "/finance/students", label: "Browse balances by language" }, { href: "/finance/reports", label: "Open finance reports" }],
      rows: [
        ...scheduleRows.map((row) => {
          const overdue = Boolean(row.dueDate && new Date(row.dueDate) < new Date());
          return { title: `${row.displayName ?? ([row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || "Student not linked")} · ${row.registrationNumber ?? "No registration number"}`,
            detail: `${row.departmentName ?? "Department not assigned"} · balance ${row.currency} ${Math.max(row.amount - row.paid, 0).toLocaleString()} (${row.paid.toLocaleString()} paid of ${row.amount.toLocaleString()}) · due ${day(row.dueDate)}`,
            status: overdue ? "Overdue" : row.status };
        }),
        ...invoiceRows.map((row) => ({ title: `Invoice ${row.number} · ${row.displayName ?? ([row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || "Student not linked")}`,
          detail: `${row.registrationNumber ?? "No registration number"} · UGX ${row.amount.toLocaleString()} · due ${day(row.dueAt)}`,
          status: row.status })),
      ],
    };
  },
  holds: async () => {
    const list = await db.select({ reason: holds.reason, status: holds.status, placedAt: holds.placedAt,
      liftedAt: holds.liftedAt, studentName: users.displayName, firstName: users.firstName,
      lastName: users.lastName, email: users.email, registrationNumber: users.registrationNumber,
      departmentName: departments.name,
    }).from(holds).leftJoin(users, eq(holds.studentId, users.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(holds.status, "active")).orderBy(desc(holds.placedAt)).limit(250);
    return { description: "Active finance holds with the student's identity, language department, reason, and placement date.", rows: list.map((h) => ({ title: `${h.studentName ?? ([h.firstName, h.lastName].filter(Boolean).join(" ") || h.email || "Student not linked")} · ${h.registrationNumber ?? "No registration number"}`,
      detail: `${h.departmentName ?? "Department not assigned"} · ${h.reason} · placed ${when(h.placedAt)}`, status: h.status })) };
  },
  "payment-settings": async () => {
    const [row] = await db.select({ value: settings.value, updatedAt: settings.updatedAt }).from(settings)
      .where(eq(settings.key, "payment_details")).limit(1);
    const value = row?.value && typeof row.value === "object" ? row.value as Record<string, unknown> : {};
    const accounts = Array.isArray(value.bankAccounts) ? value.bankAccounts.filter((account): account is string => typeof account === "string") : [];
    const methods = [
      ...(accounts.length ? [{ title: "Bank transfer", detail: `${typeof value.accountName === "string" ? value.accountName : "Account name not configured"} · ${accounts.join(", ")}${typeof value.bankName === "string" && value.bankName ? ` · ${value.bankName}` : ""}${typeof value.branch === "string" && value.branch ? ` · ${value.branch}` : ""}`, status: "Configured" }] : [{ title: "Bank transfer", detail: "No bank accounts configured in payment_details.", status: "Not configured" }]),
      ...(["mtnMerchant", "airtelMerchant"] as const).map((key) => ({
        title: key === "mtnMerchant" ? "MTN Mobile Money" : "Airtel Money",
        detail: typeof value[key] === "string" && value[key] ? `Merchant code ${value[key]}` : "Merchant code not configured",
        status: typeof value[key] === "string" && value[key] ? "Configured" : "Not configured",
      })),
      { title: "Pesapal online checkout", detail: process.env.PESAPAL_CONSUMER_KEY && process.env.PESAPAL_CONSUMER_SECRET && process.env.PESAPAL_IPN_ID ? `Pesapal ${process.env.PESAPAL_ENVIRONMENT?.toLowerCase() === "live" ? "live" : "sandbox"} credentials and IPN are configured.` : "Awaiting Pesapal merchant credentials and a registered IPN ID. Manual bank and mobile money payments remain available.", status: process.env.PESAPAL_CONSUMER_KEY && process.env.PESAPAL_CONSUMER_SECRET && process.env.PESAPAL_IPN_ID ? "Configured" : "Not configured" },
    ];
    return { description: `Official payment instructions read from the same payment_details setting used by the public Pay Now page.${row ? ` Last updated ${when(row.updatedAt)}.` : " No payment_details setting exists yet."}`,
      links: [{ href: "/pay-now", label: "View public payment instructions" }, { href: "/admin/settings", label: "Open system settings" }, { href: "/finance/weekly-cashbook", label: "Weekly cashbook" }], rows: methods };
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
