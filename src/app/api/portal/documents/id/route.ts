import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { classes, departments, enrolments, levels } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createTextPdf, readDlaLogoJpeg, readProfilePhotoJpeg } from "@/lib/pdf";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "Student access required" }, { status: 403 });
  if (!user.registrationNumber) return NextResponse.json({ error: "Your student ID is available after a registration number is assigned." }, { status: 409 });
  if (!user.avatarStorageKey) return NextResponse.json({ error: "Upload a passport photo before downloading your student ID." }, { status: 409 });
  if (!user.documentStampedAt || !user.documentStamperName || !user.documentStamperTitle) {
    return NextResponse.json({ error: "Your student ID is waiting for an official administrator or Head of Academics stamp." }, { status: 409 });
  }

  const [academicProfile] = await db.select({
    department: departments.name,
    level: levels.name,
  }).from(enrolments)
    .innerJoin(classes, eq(enrolments.classId, classes.id))
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .leftJoin(levels, eq(classes.levelId, levels.id))
    .where(and(eq(enrolments.studentId, user.id), eq(enrolments.status, "active")))
    .limit(1);

  const name = user.displayName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const portrait = await readProfilePhotoJpeg(user.avatarStorageKey);
  if (!portrait) return NextResponse.json({ error: "A supported passport photo is required to issue your student ID." }, { status: 409 });
  const date = new Intl.DateTimeFormat("en-UG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Kampala",
  }).format(user.documentStampedAt);
  const pdf = createTextPdf("Dream Languages Uganda Student Identity Card", [
    "DREAM LANGUAGES AND ADULT LITERACY UGANDA LIMITED",
    "",
    `Student: ${name}`,
    `Registration number: ${user.registrationNumber}`,
    `Programme: ${academicProfile?.department ?? "Placement pending"}`,
    `Level: ${academicProfile?.level ?? "Not assigned"}`,
    `Status: ${user.status}`,
    `Issued: ${date}`,
    "",
    "This digital identity card is issued to the registered student named above.",
    "The current DLA logo, passport photo and official staff stamp are included.",
  ], portrait, {
    stamperName: user.documentStamperName,
    stamperTitle: user.documentStamperTitle,
    date,
    logoJpeg: await readDlaLogoJpeg(),
  });
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dla-student-id-${user.registrationNumber.replaceAll("/", "-")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
