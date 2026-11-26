import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { PortalShell } from "@/components/portal-shell";
import { GlassCard } from "@/components/ui/glass";
import { FinanceStudentFeesManager } from "@/components/finance-student-fees-manager";
import { db } from "@/db";
import { classes, departments, enrolments, feeSchedules, feeStructures, levels, payments, users } from "@/db/schema";
import { requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";
const nav = [
  { href: "/finance", label: "Dashboard", icon: "🏠" },
  { href: "/finance/payments", label: "Payments", icon: "💳" },
  { href: "/finance/students", label: "Students by language", icon: "👥" },
  { href: "/finance/holds", label: "Holds", icon: "⏸️" },
  { href: "/finance/reports", label: "Reports", icon: "📊" },
];

export default async function FinanceStudentsPage({ searchParams }: { searchParams: Promise<{ departmentId?: string; q?: string }> }) {
  await requireRole(["finance", "admin", "super_admin"]);
  const { departmentId = "", q = "" } = await searchParams;
  const term = q.trim().slice(0, 80);
  const departmentsList = await db.select({ id: departments.id, name: departments.name }).from(departments)
    .where(and(eq(departments.isLanguage, true), isNull(departments.deletedAt))).orderBy(asc(departments.name));
  const studentRows = await db.select({
    id: users.id, name: users.displayName, firstName: users.firstName, lastName: users.lastName,
    email: users.email, registrationNumber: users.registrationNumber, departmentId: users.departmentId,
    departmentName: departments.name,
  }).from(users).leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.role, "student"), or(eq(users.status, "active"), eq(users.status, "registered")), isNull(users.deletedAt),
      departmentId === "unassigned" ? isNull(users.departmentId) : departmentId ? eq(users.departmentId, departmentId) : undefined,
      term ? or(ilike(users.displayName, "%" + term + "%"), ilike(users.email, "%" + term + "%"), ilike(users.registrationNumber, "%" + term + "%")) : undefined))
    .orderBy(asc(departments.name), asc(users.displayName), asc(users.registrationNumber)).limit(500);
  const ids = studentRows.map((student) => student.id);
  const classLevels = ids.length ? await db.select({
    studentId: enrolments.studentId, levelId: levels.id, code: levels.code, name: levels.name,
    departmentId: departments.id, departmentName: departments.name,
  }).from(enrolments)
    .innerJoin(classes, and(eq(enrolments.classId, classes.id), isNull(classes.deletedAt)))
    .innerJoin(levels, eq(classes.levelId, levels.id))
    .innerJoin(departments, and(eq(classes.departmentId, departments.id), isNull(departments.deletedAt), eq(departments.isLanguage, true)))
    .where(and(inArray(enrolments.studentId, ids), eq(enrolments.status, "active")))
    .orderBy(asc(levels.order), asc(levels.code)) : [];
  const currentLevel = new Map<string, { id: string; code: string }>();
  const levelOptions = new Map<string, { id: string; code: string; name: string; departmentId: string; departmentName: string }>();
  for (const row of classLevels) {
    if (!currentLevel.has(row.studentId)) currentLevel.set(row.studentId, { id: row.levelId, code: row.code });
    levelOptions.set(row.departmentId + ":" + row.levelId, { id: row.levelId, code: row.code, name: row.name, departmentId: row.departmentId, departmentName: row.departmentName });
  }
  const departmentLevels = await db.select({
    id: levels.id, code: levels.code, name: levels.name, departmentId: departments.id, departmentName: departments.name,
  }).from(levels).innerJoin(departments, and(eq(levels.departmentId, departments.id), isNull(departments.deletedAt), eq(departments.isLanguage, true)))
    .orderBy(asc(departments.name), asc(levels.order), asc(levels.code));
  for (const row of departmentLevels) {
    levelOptions.set(row.departmentId + ":" + row.id, {
      id: row.id, code: row.code, name: row.name, departmentId: row.departmentId, departmentName: row.departmentName,
    });
  }
  const schedules = ids.length ? await db.select({
    id: feeSchedules.id, studentId: feeSchedules.studentId, amount: feeSchedules.amount, paid: feeSchedules.paid,
    currency: feeSchedules.currency, dueDate: feeSchedules.dueDate, status: feeSchedules.status,
    levelId: feeStructures.levelId, levelCode: levels.code,
  }).from(feeSchedules).leftJoin(feeStructures, eq(feeSchedules.feeStructureId, feeStructures.id))
    .leftJoin(levels, eq(feeStructures.levelId, levels.id)).where(inArray(feeSchedules.studentId, ids))
    .orderBy(desc(feeSchedules.createdAt)) : [];
  const paidPayments = ids.length ? await db.select({
    id: payments.id, studentId: payments.studentId, amount: payments.amount, currency: payments.currency,
    method: payments.method, createdAt: payments.createdAt,
  }).from(payments).where(and(inArray(payments.studentId, ids), eq(payments.status, "verified")))
    .orderBy(desc(payments.createdAt)) : [];
  const byStudent = new Map<string, typeof schedules>();
  for (const schedule of schedules) {
    if (!schedule.studentId) continue;
    const list = byStudent.get(schedule.studentId) ?? [];
    list.push(schedule);
    byStudent.set(schedule.studentId, list);
  }
  const receiptsByStudent = new Map<string, typeof paidPayments>();
  for (const payment of paidPayments) {
    if (!payment.studentId) continue;
    const list = receiptsByStudent.get(payment.studentId) ?? [];
    list.push(payment);
    receiptsByStudent.set(payment.studentId, list);
  }
  const students = studentRows.map((student) => {
    const assigned = currentLevel.get(student.id);
    return {
      id: student.id,
      name: student.name || [student.firstName, student.lastName].filter(Boolean).join(" ") || student.email,
      email: student.email,
      registrationNumber: student.registrationNumber,
      departmentId: student.departmentId,
      departmentName: student.departmentName,
      currentLevelId: assigned?.id ?? null,
      currentLevelCode: assigned?.code ?? null,
      receipts: (receiptsByStudent.get(student.id) ?? []).map((payment) => ({
        paymentId: payment.id, amount: payment.amount, currency: payment.currency,
        method: payment.method, paidAt: payment.createdAt.toLocaleDateString(),
      })),
      schedules: (byStudent.get(student.id) ?? []).map((schedule) => ({
        ...schedule, dueDate: schedule.dueDate ? String(schedule.dueDate) : "",
        levelId: schedule.levelId ?? assigned?.id ?? null,
        levelCode: schedule.levelCode ?? assigned?.code ?? null,
      })),
    };
  });
  return <PortalShell title="Students by language" nav={nav}>
    <h1 className="display-font mb-2 text-3xl font-bold">Student fees by language and level</h1>
    <p className="mb-5 text-sm opacity-70">Set and edit each student’s fees manually by language department and level. Payments update the paid total; this page manages fees due, currency and due date.</p>
    <GlassCard className="mb-5 p-4">
      <form method="get" className="flex flex-wrap gap-2">
        <input name="q" defaultValue={term} placeholder="Search name, email or registration number" className="glass min-w-56 flex-1 px-4 py-2.5" />
        <select name="departmentId" defaultValue={departmentId} className="glass min-w-56 px-3 py-2.5">
          <option value="">All language departments</option><option value="unassigned">Department unassigned</option>
          {departmentsList.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="submit" className="glass rounded-xl px-4 py-2.5 font-semibold">Filter students</button>
        {(term || departmentId) && <Link href="/finance/students" className="glass rounded-xl px-4 py-2.5">Clear</Link>}
      </form>
    </GlassCard>
    <FinanceStudentFeesManager students={students} levels={[...levelOptions.values()]} />
  </PortalShell>;
}
