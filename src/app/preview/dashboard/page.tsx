import { notFound } from "next/navigation";
import { Users, GraduationCap, Wallet, CalendarCheck } from "lucide-react";
import { PortalShell } from "@/components/portal-shell";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashChart } from "@/components/dashboard/charts";
import { CalendarPage } from "@/components/calendar-page";

const nav: { href: string; label: string; icon: string; group?: "Apps" | "Pages" }[] = [
  { href: "/preview/dashboard", label: "Admin Dashboard", icon: "🏠" },
  { href: "/preview/dashboard#calendar", label: "Calendar", icon: "🗓️", group: "Apps" },
  { href: "/preview/dashboard#chat", label: "Community", icon: "💬", group: "Apps" },
  { href: "/preview/dashboard#kanban", label: "Assignments", icon: "🗂️", group: "Apps" },
  { href: "/preview/dashboard#inbox", label: "Inbox", icon: "📥", group: "Apps" },
  { href: "/preview/dashboard#invoices", label: "Invoices", icon: "🧾", group: "Apps" },
  { href: "/preview/dashboard#blog", label: "News (CMS)", icon: "📰", group: "Apps" },
  { href: "/login", label: "Sign in", icon: "🔐", group: "Pages" },
];

const day = (offset: number, hour: number, length = 1) => {
  const start = new Date();
  start.setDate(start.getDate() + offset);
  start.setHours(hour, 0, 0, 0);
  return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + length * 3600_000).toISOString() };
};

const events = [
  { id: "1", title: "German A1 – Morning", room: "Room 2", ...day(0, 9, 2) },
  { id: "2", title: "French B1 – Evening", room: "Room 4", ...day(1, 17, 2) },
  { id: "3", title: "Kiswahili A2 – Weekend", room: "Online", ...day(2, 10, 2) },
  { id: "4", title: "Exam: Dutch A1", room: "Hall", ...day(4, 14, 3) },
  { id: "5", title: "Fee due date – Term 2", room: null, ...day(6, 8, 1) },
];

export default function DashboardPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <PortalShell title="Admin Console" nav={nav}>
      <section className="greeting-banner">
        <div>
          <h1>Good afternoon, Admin 👋</h1>
          <p>Here is what is happening at DLA today. Demo data only.</p>
        </div>
      </section>

      <div className="kpi-grid">
        <KpiCard label="Active students" value="1,248" change={12.4} icon={<Users size={18} />} />
        <KpiCard label="Teachers" value="38" change={3.1} icon={<GraduationCap size={18} />} />
        <KpiCard label="Fees collected (UGX)" value="86.4M" change={8.7} icon={<Wallet size={18} />} />
        <KpiCard label="Attendance rate" value="91%" change={-2.3} icon={<CalendarCheck size={18} />} />
      </div>

      <div className="dash-grid">
        <section className="dash-card span-2">
          <h2>Enrolment by month</h2>
          <DashChart kind="bar" categories={["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"]} series={[{ name: "Students", data: [120, 160, 140, 210, 180, 240, 260] }]} />
        </section>
        <section className="dash-card">
          <h2>Students by language</h2>
          <DashChart kind="donut" labels={["German", "French", "English", "Other"]} series={[38, 24, 22, 16]} />
        </section>
        <section className="dash-card span-2">
          <h2>Weekly attendance</h2>
          <DashChart kind="line" categories={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]} series={[{ name: "Present %", data: [92, 90, 94, 88, 91, 85] }]} />
        </section>
        <section className="dash-card">
          <h2>Term fee collection</h2>
          <DashChart kind="radialBar" labels={["Collected"]} series={[72]} />
        </section>
      </div>

      <section id="calendar" className="dash-card">
        <h2>Calendar</h2>
        <CalendarPage events={events} />
      </section>
    </PortalShell>
  );
}
