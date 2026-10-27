export type NavItem = { href: string; label: string; icon?: string; group?: string };

type Entry = [slug: string, label: string, icon: string];

function build(base: string, groups: Record<string, Entry[]>, overviewHref = base): NavItem[] {
  const items: NavItem[] = [];
  for (const [group, entries] of Object.entries(groups)) {
    for (const [slug, label, icon] of entries) {
      items.push({ href: slug === "" ? overviewHref : `${base}/${slug}`, label, icon, group });
    }
  }
  return items;
}

const admin = build("/admin", {
  Dashboards: [
    ["", "Overview (KPIs)", "🏠"],
    ["dashboard-academics", "Academics", "🎓"],
    ["dashboard-finance", "Finance", "💰"],
    ["dashboard-attendance", "Attendance", "✅"],
    ["dashboard-safety", "Safety", "🛡️"],
  ],
  Apps: [
    ["calendar", "Calendar", "🗓️"],
    ["chat", "Chat and Community", "💬"],
    ["inbox", "Inbox", "📥"],
    ["notifications", "Notifications", "🔔"],
  ],
  People: [
    ["applications", "Applications", "📋"],
    ["students", "Students", "🧑‍🎓"],
    ["teachers", "Teachers", "👩‍🏫"],
    ["head-of-academics", "Head of Academics", "🎖️"],
    ["finance-staff", "Finance staff", "🧾"],
    ["admins", "Admins", "🔑"],
    ["users", "Users and accounts", "👥"],
    ["roles", "Roles and permissions", "🔐"],
    ["volunteers", "Teacher applications", "🙋"],
  ],
  Academics: [
    ["academic", "Languages and Departments", "🌍"],
    ["programmes", "Programmes and Levels", "📚"],
    ["terms", "Terms and Intakes", "📆"],
    ["classes", "Classes", "🏫"],
    ["timetable", "Timetable", "⏱️"],
    ["live-classes", "Live Classes", "🎥"],
    ["attendance", "Attendance", "✅"],
    ["exams", "Exams and Tests", "📝"],
    ["results", "Results", "📊"],
    ["resits", "Resit and Re-mark requests", "🔁"],
    ["certificates", "Certificates", "🏅"],
    ["materials", "Learning materials library", "📄"],
  ],
  Finance: [
    ["fee-structures", "Fee structures", "🏷️"],
    ["payments", "Payments", "💳"],
    ["holds", "Holds", "⏸️"],
    ["receipts", "Receipts", "🧾"],
    ["refunds", "Refunds", "↩️"],
    ["debtors", "Debtors", "📉"],
    ["finance", "Finance overview", "💰"],
    ["payment-settings", "Payment settings", "⚙️"],
  ],
  Communication: [
    ["news", "News and Announcements", "📰"],
    ["holidays", "Holiday approvals", "🌴"],
    ["email", "Email Centre", "✉️"],
    ["sms", "Bulk SMS", "📱"],
    ["push", "Push notifications", "📣"],
    ["discussion-rooms", "Discussion rooms", "🗣️"],
    ["community-groups", "Community groups", "👪"],
  ],
  "Website CMS": [
    ["cms", "Pages and Courses", "📝"],
    ["blog", "Blog / News", "🗞️"],
    ["instructors", "Instructors", "🧑‍🏫"],
    ["testimonials", "Testimonials", "⭐"],
    ["faqs", "FAQs", "❓"],
    ["partners", "Partners", "🤝"],
    ["gallery", "Gallery", "🖼️"],
    ["timetable-files", "Timetable files", "🗂️"],
  ],
  Requests: [
    ["dead-semester", "Dead-semester", "⏳"],
    ["resume", "Resume", "▶️"],
    ["transcripts", "Transcript", "📜"],
    ["id-replacement", "ID replacement", "🪪"],
    ["complaints", "Complaints", "📮"],
  ],
  Safety: [
    ["incidents", "Incident Centre", "🚨"],
    ["reported-content", "Reported content", "🚩"],
    ["muted-users", "Muted / banned users", "🔇"],
  ],
  System: [
    ["reports", "Reports and Analytics", "📈"],
    ["father-dla", "Father-DLA monitoring", "🤖"],
    ["audit-log", "Audit log", "🕵️"],
    ["security", "Security centre", "🔒"],
    ["backups", "Backups", "💾"],
    ["settings", "Settings", "⚙️"],
    ["integrations", "Integrations", "🔌"],
    ["help-desk", "Help desk tickets", "🎫"],
  ],
});

const hoc = build("/hoc", {
  Dashboards: [["", "Overview", "🏠"]],
  Apps: [
    ["calendar", "Calendar", "🗓️"],
    ["community", "Chat and Community", "💬"],
    ["inbox", "Inbox", "📥"],
    ["notifications", "Notifications", "🔔"],
  ],
  Academics: [
    ["teachers", "Teachers", "👩‍🏫"],
    ["timetable", "Classes and Timetable", "⏱️"],
    ["live-classes", "Live Classes", "🎥"],
    ["attendance", "Attendance (all)", "✅"],
    ["exams", "Exams approval queue", "📝"],
    ["results", "Results approval and publishing", "📊"],
    ["student-documents", "Student IDs and document stamps", "🪪"],
    ["holidays", "Holiday approvals", "🌴"],
    ["resits", "Resit / Re-mark requests", "🔁"],
    ["dead-semester", "Dead-semester recommendations", "⏳"],
    ["materials", "Materials review", "📄"],
    ["teacher-documents", "Teacher documents", "🗂️"],
    ["father-dla", "Father-DLA assistant", "🤖"],
  ],
  Insights: [
    ["reports", "Reports (pass rates, attendance)", "📈"],
    ["evaluations", "Course evaluations", "🗳️"],
  ],
});

const teacher = build("/teacher", {
  Dashboards: [["", "Overview", "🏠"]],
  Apps: [
    ["calendar", "Calendar", "🗓️"],
    ["community", "Community", "💬"],
    ["discussion-rooms", "Discussion rooms", "🗣️"],
    ["inbox", "Inbox", "📥"],
    ["notifications", "Notifications", "🔔"],
  ],
  Teaching: [
    ["classes", "My Classes", "📚"],
    ["live", "Live Class (Start / Join)", "🎥"],
    ["attendance", "Attendance", "✅"],
    ["materials", "Materials", "📄"],
    ["assignments", "Assignments (Kanban)", "🗂️"],
    ["exams", "Tests and Exams", "📝"],
    ["results", "Results", "📊"],
    ["gradebook", "Gradebook", "📒"],
    ["resits", "Resit / Re-mark requests", "🔁"],
  ],
  Account: [
    ["documents", "My Documents", "📁"],
    ["profile", "My Profile", "🙍"],
  ],
});

const finance = build("/finance", {
  Dashboards: [["", "Overview", "🏠"]],
  Apps: [
    ["calendar", "Calendar (due dates)", "🗓️"],
    ["inbox", "Inbox", "📥"],
    ["notifications", "Notifications", "🔔"],
  ],
  Finance: [
    ["fee-structures", "Fee structures", "🏷️"],
    ["verification", "Payment verification queue", "🔍"],
    ["payments", "Record payment", "💳"],
    ["receipts", "Receipts", "🧾"],
    ["holds", "Holds", "⏸️"],
    ["unpaid", "Unpaid students", "📉"],
    ["paused-schedules", "Paused-student fee schedules", "⏳"],
    ["refunds", "Refunds", "↩️"],
    ["discounts", "Discounts / Scholarships", "🎁"],
    ["debtors", "Debtors aging", "📆"],
    ["reports", "Reports and Export", "📈"],
  ],
});

const student = build("/student", {
  Dashboards: [["", "Overview", "🏠"]],
  Apps: [
    ["calendar", "Calendar", "🗓️"],
    ["community", "Community", "💬"],
    ["discussion-rooms", "Discussion rooms", "🗣️"],
    ["inbox", "Inbox", "📥"],
    ["notifications", "Notifications", "🔔"],
  ],
  Learning: [
    ["classes", "My Classes", "📚"],
    ["timetable", "Timetable", "⏱️"],
    ["attendance", "Attendance", "✅"],
    ["assignments", "Assignments", "🗂️"],
    ["exams", "Tests and Exams", "📝"],
    ["results", "Results", "📊"],
    ["materials", "Learning materials", "📄"],
    ["practice", "Practice (Flashcards, Pronunciation)", "🎯"],
    ["ai-tutor", "Father-DLA AI Tutor", "🤖"],
  ],
  Account: [
    ["fees", "Fees", "💰"],
    ["requests", "Requests", "📨"],
    ["documents", "Documents", "📁"],
    ["certificates", "Certificates", "🏅"],
    ["help-desk", "Support / Help desk", "🎫"],
    ["reviews", "Share a Review", "⭐"],
    ["profile", "Profile and ID card", "🪪"],
    ["settings", "Settings", "⚙️"],
  ],
});

const applicant = build("/applicant", {
  Dashboards: [["", "Application tracker", "📍"]],
  Application: [
    ["documents", "Documents upload", "📄"],
    ["placement-test", "Placement test", "📝"],
    ["fee-info", "Fee payment info", "💰"],
  ],
  Apps: [
    ["inbox", "Inbox", "📥"],
    ["notifications", "Notifications", "🔔"],
  ],
});

export const PORTAL_NAVS: Record<string, NavItem[]> = { admin, hoc, teacher, finance, student, applicant };

export function navForPath(pathname: string): NavItem[] | null {
  const portal = pathname.split("/")[1];
  return PORTAL_NAVS[portal] ?? null;
}
