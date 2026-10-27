import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  assignments, attendance, auditLogs, certificates, classes, discussionRooms, documents, enrolments, exams, feeSchedules, feeStructures,
  discounts, incidents, messages, notifications, pauseRequests, payments, resitRequests, results, roles, supportTickets, teacherRatings,
  timetableSessions, users, submissions, invoices, receipts,
} from "@/db/schema";
import { adminSection, type SectionData, type SectionRow } from "@/lib/admin-sections";

type Viewer = { id: string; role: string };

const day = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-GB") : "not set");
const when = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleString("en-GB") : "not set");
const nm = (u: { displayName?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null }) =>
  u.displayName ?? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Unnamed");
const money = (n: number, c = "UGX") => `${c} ${n.toLocaleString()}`;
const today = () => new Date().toISOString().slice(0, 10);

async function count(table: Parameters<typeof db.select>[0] extends never ? never : any, where?: any) {
  const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(table).where(where);
  return Number(row?.c ?? 0);
}

async function myClassIds(user: Viewer) {
  if (user.role === "teacher" || user.role === "head_academics") {
    const rows = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.teacherId, user.id), isNull(classes.deletedAt)));
    return rows.map((r) => r.id);
  }
  const rows = await db.select({ id: enrolments.classId }).from(enrolments).where(eq(enrolments.studentId, user.id));
  return rows.map((r) => r.id);
}

async function inbox(user: Viewer): Promise<SectionData> {
  const list = await db.select({ body: messages.body, createdAt: messages.createdAt, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName })
    .from(messages).leftJoin(users, eq(users.id, messages.senderId))
    .where(eq(messages.recipientId, user.id)).orderBy(desc(messages.createdAt)).limit(50);
  return { description: "Direct messages sent to you. Class conversations are in Community.", rows: list.map((m) => ({ title: nm(m), detail: `${m.body.slice(0, 160)} · ${when(m.createdAt)}` })) };
}

async function myNotifications(user: Viewer): Promise<SectionData> {
  const list = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(50);
  return { description: "Updates sent to you by the school.", rows: list.map((n) => ({ title: n.title, detail: `${n.body} · ${when(n.createdAt)}`, status: n.read ? "Read" : "Unread" })) };
}

async function calendar(user: Viewer): Promise<SectionData> {
  const ids = user.role === "super_admin" || user.role === "finance" ? null : await myClassIds(user);
  const filter = ids === null ? undefined : ids.length ? inArray(timetableSessions.classId, ids) : sql`false`;
  const list = await db.select().from(timetableSessions).where(and(gte(timetableSessions.endsAt, new Date()), filter)).orderBy(timetableSessions.startsAt).limit(60);
  const rows: SectionRow[] = list.map((s) => ({ title: s.title, detail: `${when(s.startsAt)}${s.room ? ` · ${s.room}` : ""}`, status: s.meetUrl ? "Live link ready" : "Scheduled" }));
  if (user.role === "finance") {
    const due = await db.select().from(feeSchedules).where(gte(feeSchedules.dueDate, today())).orderBy(feeSchedules.dueDate).limit(40);
    rows.unshift(...due.map((f) => ({ title: `Fee due: ${money(Math.max(f.amount - f.paid, 0), f.currency)}`, detail: `Due ${day(f.dueDate)}`, status: f.status })));
  }
  return { description: "Your upcoming dates.", links: [{ href: "/classes-2027", label: "Intake calendar 2027" }], rows };
}

async function helpDesk(user: Viewer): Promise<SectionData> {
  const admin = user.role === "super_admin";
  const list = await db.select().from(supportTickets).where(admin ? undefined : eq(supportTickets.userId, user.id)).orderBy(desc(supportTickets.createdAt)).limit(100);
  return { description: admin ? "Every support ticket from students, staff and applicants." : "Requests you sent to the school and their status.", rows: list.map((t) => ({ title: t.subject, detail: `${t.body.slice(0, 160)} · ${day(t.createdAt)}`, status: t.status })) };
}

async function myDocuments(user: Viewer): Promise<SectionData> {
  const list = await db.select().from(documents).where(eq(documents.ownerId, user.id)).orderBy(desc(documents.createdAt));
  return { description: "Documents you have uploaded and how they were reviewed.", rows: list.map((d) => ({ title: d.name, detail: `${d.comment ?? "Awaiting review"} · ${day(d.createdAt)}`, status: d.status })) };
}

async function profile(user: Viewer): Promise<SectionData> {
  const [u] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!u) return { description: "Account not found.", rows: [] };
  return {
    description: "Your account details. Ask the school office to change your name or email.",
    rows: [
      { title: "Name", detail: nm(u) },
      { title: "Email", detail: u.email },
      { title: "Role", detail: u.role.replace("_", " ") },
      ...(u.registrationNumber ? [{ title: "Registration number", detail: u.registrationNumber }] : []),
      { title: "Account status", detail: String(u.status) },
    ],
  };
}

async function classesOf(user: Viewer): Promise<SectionData> {
  const ids = await myClassIds(user);
  const list = ids.length ? await db.select().from(classes).where(and(inArray(classes.id, ids), isNull(classes.deletedAt))).orderBy(classes.name) : [];
  return { description: user.role === "student" ? "Classes you are enrolled in." : "Classes assigned to you.", links: [{ href: `/${user.role === "student" ? "student" : "teacher"}/timetable`, label: "Open timetable" }], rows: list.map((c) => ({ title: c.name, detail: `Capacity: ${c.capacity ?? "not set"}` })) };
}

async function studentAssignments(user: Viewer): Promise<SectionData> {
  const ids = await myClassIds(user);
  if (!ids.length) return { description: "Assignments for your classes appear here once you are enrolled.", rows: [] };
  const list = await db.select().from(assignments).where(inArray(assignments.classId, ids)).orderBy(desc(assignments.dueAt));
  const mine = await db.select().from(submissions).where(eq(submissions.studentId, user.id));
  const done = new Map<string, (typeof mine)[number]>(mine.map((s) => [s.assignmentId as string, s]));
  return {
    description: "Work set by your teachers and whether you have handed it in.",
    rows: list.map((a) => {
      const s = done.get(a.id);
      return { title: a.title, detail: `Due ${day(a.dueAt)} · Max ${a.maxScore ?? 100}${s?.score != null ? ` · You scored ${s.score}` : ""}`, status: s ? (s.gradedAt ? "Graded" : "Submitted") : "To do" };
    }),
  };
}

async function teacherAssignments(user: Viewer): Promise<SectionData> {
  const list = await db.select().from(assignments).where(eq(assignments.teacherId, user.id)).orderBy(desc(assignments.dueAt));
  const subs = list.length ? await db.select({ a: submissions.assignmentId, c: sql<number>`count(*)::int` }).from(submissions).where(inArray(submissions.assignmentId, list.map((a) => a.id))).groupBy(submissions.assignmentId) : [];
  const counts = new Map(subs.map((s) => [s.a, s.c]));
  return { description: "Assignments you set and how many students handed in.", rows: list.map((a) => ({ title: a.title, detail: `Due ${day(a.dueAt)}`, status: `${counts.get(a.id) ?? 0} submitted` })) };
}

async function resultsFor(user: Viewer, onlyUnpublished = false): Promise<SectionData> {
  const filter = user.role === "teacher"
    ? await (async () => { const ids = await myClassIds(user); return ids.length ? inArray(results.classId, ids) : sql`false`; })()
    : onlyUnpublished ? eq(results.published, false) : undefined;
  const list = await db
    .select({ score: results.score, grade: results.grade, published: results.published, exam: exams.title, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName })
    .from(results).leftJoin(exams, eq(results.examId, exams.id)).leftJoin(users, eq(results.studentId, users.id))
    .where(filter).orderBy(desc(results.createdAt)).limit(150);
  return {
    description: onlyUnpublished ? "Results waiting for academic approval before students can see them." : "Marks and grades recorded.",
    rows: list.map((r) => ({ title: `${nm(r)} · ${r.exam ?? "Assessment"}`, detail: `Score ${r.score ?? "pending"} · Grade ${r.grade ?? "not graded"}`, status: r.published ? "Released" : "Needs approval" })),
  };
}

async function resitsFor(user: Viewer): Promise<SectionData> {
  const list = await db.select({ reason: resitRequests.reason, status: resitRequests.status, createdAt: resitRequests.createdAt, exam: exams.title, teacherId: exams.teacherId, studentId: resitRequests.studentId })
    .from(resitRequests).leftJoin(exams, eq(resitRequests.examId, exams.id)).orderBy(desc(resitRequests.createdAt)).limit(150);
  const rows = list.filter((r) => user.role === "student" ? r.studentId === user.id : user.role === "teacher" ? r.teacherId === user.id : true);
  return { description: user.role === "student" ? "Resit or re-mark requests you made." : "Resit and re-mark requests to review.", rows: rows.map((r) => ({ title: r.exam ?? "Exam", detail: `${r.reason ?? "No reason given"} · ${day(r.createdAt)}`, status: r.status })) };
}

async function studentRequests(user: Viewer): Promise<SectionData> {
  const [resits, pauses, tickets] = await Promise.all([
    db.select().from(resitRequests).where(eq(resitRequests.studentId, user.id)),
    db.select().from(pauseRequests).where(eq(pauseRequests.studentId, user.id)),
    db.select().from(supportTickets).where(eq(supportTickets.userId, user.id)),
  ]);
  return {
    description: "Everything you asked the school for: resits, study pauses and support requests.",
    links: [{ href: "/student/reviews", label: "Share a review or rate a teacher" }],
    rows: [
      ...resits.map((r) => ({ title: "Resit or re-mark", detail: r.reason ?? "", status: r.status })),
      ...pauses.map((p) => ({ title: "Pause studies", detail: p.reason ?? "", status: p.status })),
      ...tickets.map((t) => ({ title: t.subject, detail: t.body.slice(0, 140), status: t.status })),
    ],
  };
}

async function myCertificates(user: Viewer): Promise<SectionData> {
  const list = await db.select().from(certificates).where(eq(certificates.studentId, user.id)).orderBy(desc(certificates.issuedAt));
  return { description: "Certificates you have earned. Share the verify code with employers.", rows: list.map((c) => ({ title: `Level ${c.level ?? "-"}`, detail: `Issued ${day(c.issuedAt)} · Verify code ${c.verifyCode}` })) };
}

async function rooms(user: Viewer): Promise<SectionData> {
  const ids = user.role === "super_admin" ? null : await myClassIds(user);
  const list = await db.select().from(discussionRooms).where(ids === null ? undefined : or(eq(discussionRooms.visibility, "public"), ids.length ? inArray(discussionRooms.classId, ids) : sql`false`)).orderBy(desc(discussionRooms.createdAt)).limit(60);
  return { description: "Rooms where learners practise together.", rows: list.map((r) => ({ title: r.title, detail: `${r.language ?? "Any language"} · ${r.level ?? "All levels"}${r.topic ? ` · ${r.topic}` : ""}`, status: r.status })) };
}

async function practice(): Promise<SectionData> {
  return {
    description: "Practise every day. Ask Father-DLA to quiz you.",
    links: [{ href: "/student/ai-tutor", label: "Practise with Father-DLA" }],
    rows: [
      { title: "Flashcards", detail: "Ask Father-DLA: “Make 10 flashcards for my level.”" },
      { title: "Pronunciation", detail: "Ask Father-DLA for a pronunciation guide and read the words aloud." },
      { title: "Conversation", detail: "Join a discussion room to practise speaking with classmates." },
    ],
  };
}

async function hocAttendance(): Promise<SectionData> {
  const list = await db.select({ status: attendance.status, markedAt: attendance.markedAt, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName })
    .from(attendance).leftJoin(users, eq(attendance.studentId, users.id)).orderBy(desc(attendance.markedAt)).limit(150);
  return { description: "Latest attendance marks from every class.", rows: list.map((a) => ({ title: nm(a), detail: when(a.markedAt), status: a.status })) };
}

async function pauses(): Promise<SectionData> {
  const list = await db.select({ reason: pauseRequests.reason, status: pauseRequests.status, createdAt: pauseRequests.createdAt, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName })
    .from(pauseRequests).leftJoin(users, eq(pauseRequests.studentId, users.id)).orderBy(desc(pauseRequests.createdAt)).limit(100);
  return { description: "Students asking to pause their studies.", rows: list.map((p) => ({ title: nm(p), detail: `${p.reason ?? "No reason"} · ${day(p.createdAt)}`, status: p.status })) };
}

async function teacherDocuments(): Promise<SectionData> {
  const list = await db.select({ name: documents.name, status: documents.status, createdAt: documents.createdAt, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName })
    .from(documents).innerJoin(users, eq(documents.ownerId, users.id)).where(eq(users.role, "teacher")).orderBy(desc(documents.createdAt)).limit(100);
  return { description: "Documents uploaded by teachers.", rows: list.map((d) => ({ title: `${nm(d)} · ${d.name}`, detail: day(d.createdAt), status: d.status })) };
}

async function evaluations(): Promise<SectionData> {
  const list = await db
    .select({ firstName: users.firstName, lastName: users.lastName, displayName: users.displayName, avg: sql<number>`round(avg(${teacherRatings.rating})::numeric, 1)::float`, n: sql<number>`count(*)::int` })
    .from(teacherRatings).innerJoin(users, eq(users.id, teacherRatings.teacherId))
    .groupBy(users.firstName, users.lastName, users.displayName).orderBy(desc(sql`avg(${teacherRatings.rating})`));
  return { description: "How students rate each teacher (all ratings, including unpublished).", rows: list.map((t) => ({ title: nm(t), detail: `${t.avg}/5 from ${t.n} student${t.n === 1 ? "" : "s"}` })) };
}

async function hocReports(): Promise<SectionData> {
  const [students, teachersN, attTotal, attPresent, resTotal, resPass] = await Promise.all([
    count(users, eq(users.role, "student")),
    count(users, eq(users.role, "teacher")),
    count(attendance),
    count(attendance, eq(attendance.status, "present")),
    count(results, sql`${results.score} is not null`),
    count(results, sql`${results.score} >= 50`),
  ]);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "no data yet");
  return {
    description: "Live academic figures.",
    rows: [
      { title: "Students", detail: String(students) }, { title: "Teachers", detail: String(teachersN) },
      { title: "Attendance rate", detail: pct(attPresent, attTotal) }, { title: "Pass rate (50 and above)", detail: pct(resPass, resTotal) },
    ],
  };
}

async function verification(): Promise<SectionData> {
  const list = await db.select().from(payments).where(eq(payments.status, "pending")).orderBy(payments.createdAt).limit(100);
  return { description: "Payments waiting for you to verify.", rows: list.map((p) => ({ title: `${money(p.amount, p.currency)} · ${p.method}`, detail: `${p.reference ?? "No reference"} · ${day(p.createdAt)}`, status: p.status })) };
}

async function unpaid(): Promise<SectionData> {
  const list = await db.select({ amount: feeSchedules.amount, paid: feeSchedules.paid, currency: feeSchedules.currency, dueDate: feeSchedules.dueDate, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName, reg: users.registrationNumber })
    .from(feeSchedules).leftJoin(users, eq(feeSchedules.studentId, users.id)).where(sql`${feeSchedules.paid} < ${feeSchedules.amount}`).orderBy(feeSchedules.dueDate).limit(200);
  return { description: "Students who still owe fees.", rows: list.map((f) => ({ title: `${nm(f)}${f.reg ? ` · ${f.reg}` : ""}`, detail: `Owes ${money(f.amount - f.paid, f.currency)} · due ${day(f.dueDate)}`, status: f.dueDate && new Date(f.dueDate) < new Date() ? "Overdue" : "Pending" })) };
}

async function aging(): Promise<SectionData> {
  const list = await db.select().from(feeSchedules).where(and(sql`${feeSchedules.paid} < ${feeSchedules.amount}`, lt(feeSchedules.dueDate, today()))).orderBy(feeSchedules.dueDate).limit(200);
  return {
    description: "Overdue balances grouped by how late they are.",
    rows: list.map((f) => {
      const days = Math.floor((Date.now() - new Date(f.dueDate!).getTime()) / 86_400_000);
      return { title: money(f.amount - f.paid, f.currency), detail: `${days} days overdue · due ${day(f.dueDate)}`, status: days > 60 ? "Over 60 days" : days > 30 ? "31 to 60 days" : "0 to 30 days" };
    }),
  };
}

async function discountList(): Promise<SectionData> {
  const list = await db.select().from(discounts).orderBy(desc(discounts.createdAt)).limit(100);
  return { description: "Discounts and scholarships granted.", rows: list.map((d) => ({ title: d.name, detail: `${d.amount.toLocaleString()} · ${day(d.createdAt)}`, status: d.approved ? "Approved" : "Awaiting approval" })) };
}

async function refunds(): Promise<SectionData> {
  const list = await db.select().from(payments).where(or(eq(payments.status, "reversed"), eq(payments.status, "rejected"))).orderBy(desc(payments.createdAt)).limit(100);
  return { description: "Payments that were reversed or rejected.", rows: list.map((p) => ({ title: `${money(p.amount, p.currency)} · ${p.method}`, detail: day(p.createdAt), status: p.status })) };
}

async function financeReports(): Promise<SectionData> {
  const [row] = await db.select({ billed: sql<number>`coalesce(sum(${feeSchedules.amount}),0)::int`, paid: sql<number>`coalesce(sum(${feeSchedules.paid}),0)::int` }).from(feeSchedules);
  const pending = await count(payments, eq(payments.status, "pending"));
  const invoiceCount = await count(invoices);
  const receiptCount = await count(receipts);
  return {
    description: "Money in and out.",
    links: [{ href: "/api/portal/documents/results", label: "Download a sample statement" }],
    rows: [
      { title: "Billed", detail: money(row.billed) }, { title: "Collected", detail: money(row.paid) }, { title: "Outstanding", detail: money(Math.max(row.billed - row.paid, 0)) },
      { title: "Payments awaiting verification", detail: String(pending) }, { title: "Invoices", detail: String(invoiceCount) }, { title: "Receipts", detail: String(receiptCount) },
    ],
  };
}

async function fees(): Promise<SectionData> {
  const list = await db.select().from(feeStructures).orderBy(desc(feeStructures.createdAt));
  return { description: "Fee amounts per programme and term.", rows: list.map((f) => ({ title: f.name, detail: money(f.amount, f.currency) })) };
}

function applicantInfo(slug: string): SectionData | null {
  if (slug === "placement-test") {
    return {
      description: "A short test places you at the right level.",
      links: [{ href: "/contact", label: "Book your placement test" }],
      rows: [
        { title: "Format", detail: "Reading, listening and a short speaking check, about 45 minutes." },
        { title: "Result", detail: "The school office tells you your level and the intake you can join." },
        { title: "Bring", detail: "A pen and a valid ID." },
      ],
    };
  }
  if (slug === "fee-info") {
    return {
      description: "How to pay your fees.",
      links: [{ href: "/pay-now", label: "Pay now" }, { href: "/classes-2027", label: "See intake dates" }],
      rows: [
        { title: "Pay online", detail: "Use Pay now. Keep your reference and upload the proof if asked." },
        { title: "Verification", detail: "Finance verifies each payment, usually within one working day." },
        { title: "Start date", detail: "You join the next intake after your payment is verified." },
      ],
    };
  }
  return null;
}

async function overview(slug: string): Promise<SectionData> {
  const [students, teachersN, applicants, pendingPay, openIncidents, pendingRatings, tickets] = await Promise.all([
    count(users, eq(users.role, "student")), count(users, eq(users.role, "teacher")), count(users, eq(users.role, "applicant")),
    count(payments, eq(payments.status, "pending")), count(incidents, eq(incidents.status, "open")),
    count(teacherRatings, eq(teacherRatings.published, false)), count(supportTickets, eq(supportTickets.status, "open")),
  ]);
  const all: Record<string, SectionRow[]> = {
    "dashboard-academics": [{ title: "Students", detail: String(students) }, { title: "Teachers", detail: String(teachersN) }, { title: "Teacher ratings to approve", detail: String(pendingRatings) }],
    "dashboard-finance": [{ title: "Payments awaiting verification", detail: String(pendingPay) }],
    "dashboard-attendance": [{ title: "Attendance marks recorded", detail: String(await count(attendance)) }],
    "dashboard-safety": [{ title: "Open incidents", detail: String(openIncidents) }],
    reports: [{ title: "Students", detail: String(students) }, { title: "Teachers", detail: String(teachersN) }, { title: "Applicants", detail: String(applicants) }, { title: "Open tickets", detail: String(tickets) }],
  };
  return { description: "Live figures from the school database.", rows: all[slug] ?? [] };
}

async function adminExtras(slug: string): Promise<SectionData | null> {
  switch (slug) {
    case "audit-log":
    case "security": {
      const list = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
      return { description: "Everything admins changed, newest first.", rows: list.map((a) => ({ title: a.action, detail: `${a.entityType} · ${when(a.createdAt)}` })) };
    }
    case "roles": {
      const list = await db.select().from(roles);
      return { description: "Roles available in the system.", rows: list.map((r) => ({ title: r.name ?? String(r.id), detail: r.description ?? "" })) };
    }
    case "reported-content": {
      const list = await db.select().from(incidents).where(eq(incidents.status, "open")).orderBy(desc(incidents.createdAt)).limit(100);
      return { description: "Flagged content waiting for action.", links: [{ href: "/admin/incidents", label: "Open incident centre" }], rows: list.map((i) => ({ title: i.type, detail: `${i.location ?? ""} · ${day(i.createdAt)}`, status: i.status })) };
    }
    case "muted-users": {
      const list = await db.select().from(incidents).where(or(eq(incidents.status, "muted"), eq(incidents.status, "banned"))).orderBy(desc(incidents.createdAt)).limit(100);
      return { description: "Users who are muted or banned.", rows: list.map((i) => ({ title: i.type, detail: day(i.createdAt), status: i.status })) };
    }
    case "instructors": {
      const list = await db.select().from(users).where(and(eq(users.role, "teacher"), isNull(users.deletedAt))).orderBy(users.firstName);
      return { description: "Teachers shown to the public.", rows: list.map((u) => ({ title: nm(u), detail: u.email })) };
    }
    case "dashboard-academics": case "dashboard-finance": case "dashboard-attendance": case "dashboard-safety": case "reports":
      return overview(slug);
    case "refunds": return refunds();
    case "attendance": return hocAttendance();
    case "help-desk": return null;
    case "backups":
      return { description: "Your database is hosted on Supabase, which keeps automatic backups.", links: [{ href: "https://supabase.com/dashboard", label: "Open Supabase backups" }], rows: [{ title: "Automatic backups", detail: "Managed in the Supabase project dashboard." }] };
    case "integrations":
      return {
        description: "Connected services and whether each one is configured.",
        rows: [
          { title: "Supabase (accounts and data)", detail: "Database and sign-in", status: process.env.SUPABASE_SERVICE_ROLE_KEY ? "Connected" : "Missing key" },
          { title: "Father-DLA AI (Groq)", detail: "AI tutor", status: process.env.GROQ_API_KEY ? "Connected" : process.env.GEMINI_API_KEY ? "Using Gemini" : "Missing key" },
        ],
      };
    case "transcripts": case "id-replacement": case "resume": {
      const list = await db.select().from(supportTickets).where(sql`${supportTickets.subject} ilike ${`%${slug === "transcripts" ? "transcript" : slug === "resume" ? "resume" : "id"}%`}`).orderBy(desc(supportTickets.createdAt)).limit(100);
      return { description: "Requests from students. Students send these from their Requests page.", rows: list.map((t) => ({ title: t.subject, detail: t.body.slice(0, 140), status: t.status })) };
    }
    default: return null;
  }
}

/** Real data for any dashboard section that does not have its own page. */
export async function portalSection(portal: string, slug: string, user: Viewer): Promise<SectionData | null> {
  try {
    if (slug === "inbox") return await inbox(user);
    if (slug === "notifications" && portal !== "admin") return await myNotifications(user);
    if (slug === "calendar" && portal !== "admin") return await calendar(user);
    if (slug === "help-desk" && portal !== "hoc") return await helpDesk(user);
    if (slug === "documents" || slug === "teacher-documents") return slug === "teacher-documents" ? await teacherDocuments() : await myDocuments(user);
    if (slug === "profile" || slug === "settings" && portal !== "admin") return await profile(user);
    if (slug === "discussion-rooms" && portal !== "admin") return await rooms(user);

    if (portal === "admin") return (await adminSection(slug)) ?? (await adminExtras(slug));
    if (portal === "student") {
      if (slug === "classes") return await classesOf(user);
      if (slug === "assignments") return await studentAssignments(user);
      if (slug === "requests") return await studentRequests(user);
      if (slug === "certificates") return await myCertificates(user);
      if (slug === "practice") return await practice();
    }
    if (portal === "teacher") {
      if (slug === "assignments") return await teacherAssignments(user);
      if (slug === "results" || slug === "gradebook") return await resultsFor(user);
      if (slug === "resits") return await resitsFor(user);
    }
    if (portal === "hoc") {
      if (slug === "attendance") return await hocAttendance();
      if (slug === "results") return await resultsFor(user, true);
      if (slug === "resits") return await resitsFor(user);
      if (slug === "dead-semester") return await pauses();
      if (slug === "reports") return await hocReports();
      if (slug === "evaluations") return await evaluations();
      if (slug === "materials") return (await adminSection("materials"));
    }
    if (portal === "finance") {
      if (slug === "verification") return await verification();
      if (slug === "unpaid") return await unpaid();
      if (slug === "debtors") return await aging();
      if (slug === "paused-schedules") return await pauses();
      if (slug === "discounts") return await discountList();
      if (slug === "refunds") return await refunds();
      if (slug === "reports") return await financeReports();
      if (slug === "fee-structures") return await fees();
    }
    if (portal === "applicant") return applicantInfo(slug);
    return null;
  } catch (error) {
    console.warn(`Section "${portal}/${slug}" could not load:`, error);
    return { description: "This section could not load right now. Try again shortly.", rows: [] };
  }
}
