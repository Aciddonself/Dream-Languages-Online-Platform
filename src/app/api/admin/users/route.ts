import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, departments, feeSchedules, users } from "@/db/schema";
import { getCurrentUser, syncAuthBan } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { validateNewPassword } from "@/lib/password-policy";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { roleHome } from "@/lib/rbac";
import { nextRegistrationNumber } from "@/lib/registration";
import { createTextPdf, isProfilePhotoJpeg, readProfilePhotoJpeg } from "@/lib/pdf";
import { deleteStudentPhoto, storeStudentPhoto } from "@/lib/student-photos";
import { sendEmail } from "@/lib/email";
import { getCourseTuition } from "@/lib/course-pricing";

const createUserSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(10).max(256),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(["super_admin", "head_academics", "teacher", "finance", "student", "applicant"]),
}).strict();

/** Creates (or updates) the Supabase Auth identity for a profile row. Returns the auth user id. */
async function upsertAuthIdentity(account: { id: string; email: string; authId: string | null }, password: string) {
  const admin = createSupabaseAdminClient();
  if (account.authId) {
    const { error } = await admin.auth.admin.updateUserById(account.authId, { password });
    if (error) throw new Error("Could not update credentials");
    return account.authId;
  }
  const { data, error } = await admin.auth.admin.createUser({ email: account.email, password, email_confirm: true });
  if (error || !data.user) throw new Error("Could not create credentials");
  return data.user.id;
}

export async function POST(req: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  const limited = await rateLimit("admin-users", actor.id, 30, "10 m");
  if (!limited.ok) return tooManyRequests(limited.retryAfter);

  let form: FormData;
  let photo: File | null;
  try {
    form = await req.formData();
    const file = form.get("profilePhoto");
    photo = file instanceof File ? file : null;
  } catch {
    return NextResponse.json({ error: "Could not read the new user form" }, { status: 400 });
  }
  const body = Object.fromEntries(["email", "password", "firstName", "lastName", "role"].map((key) => [key, form.get(key)]));
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, firstName, lastName, role } = parsed.data;
  if (role === "student" && (!photo || photo.size < 1 || photo.size > 5 * 1024 * 1024 || photo.type !== "image/jpeg")) {
    return NextResponse.json({ error: "Upload a passport photo in JPG format (up to 5 MB) when creating a student." }, { status: 400 });
  }
  if (role !== "student" && photo) {
    return NextResponse.json({ error: "Passport photo upload is available when creating a student account." }, { status: 400 });
  }
  if (photo && (photo.size < 1 || photo.size > 5 * 1024 * 1024 || photo.type !== "image/jpeg")) {
    return NextResponse.json({ error: "Upload a JPG profile photo up to 5 MB." }, { status: 400 });
  }
  const photoBytes = photo ? new Uint8Array(await photo.arrayBuffer()) : null;
  if (photoBytes && !isProfilePhotoJpeg(photoBytes)) {
    return NextResponse.json({ error: "The profile photo could not be read as a JPEG. Please reselect it and try again." }, { status: 415 });
  }
  const passwordProblem = await validateNewPassword(password);
  if (passwordProblem) return NextResponse.json({ error: passwordProblem }, { status: 400 });
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const authId = await upsertAuthIdentity({ id: "", email, authId: null }, password);
  const avatarStorageKey = photoBytes ? `${randomUUID()}.jpg` : null;
  let user;
  try {
    if (avatarStorageKey && photoBytes) await storeStudentPhoto(avatarStorageKey, photoBytes);
    [user] = await db.transaction(async (tx: any) => tx
      .insert(users)
      .values({
        email,
        authId,
        role,
        status: role === "applicant" ? "applicant" : "registered",
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        registrationNumber: role === "student" || role === "applicant" ? await nextRegistrationNumber(tx) : undefined,
        avatarUrl: avatarStorageKey ? "/api/portal/profile-photo" : null,
        avatarStorageKey,
      })
      .onConflictDoNothing()
      .returning({ id: users.id, email: users.email, role: users.role, registrationNumber: users.registrationNumber }));
  } catch (error) {
    const { error: deleteAuthError } = await createSupabaseAdminClient().auth.admin.deleteUser(authId);
    if (deleteAuthError) console.error("Could not clean up Auth identity after user creation failed:", deleteAuthError);
    if (avatarStorageKey) {
      try {
        await deleteStudentPhoto(avatarStorageKey);
      } catch (cleanupError) {
        console.error("Could not clean up student photo after user creation failed:", cleanupError);
      }
    }
    throw error;
  }
  if (!user) {
    const { error: deleteAuthError } = await createSupabaseAdminClient().auth.admin.deleteUser(authId);
    if (deleteAuthError) console.error("Could not clean up duplicate Auth identity:", deleteAuthError);
    if (avatarStorageKey) await deleteStudentPhoto(avatarStorageKey);
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  await db.insert(auditLogs).values({
    actorId: actor.id,
    action: "create_user",
    entityType: "user",
    entityId: user.id,
    after: { role: user.role },
    ip: clientIp(req),
  });
  return NextResponse.json({ ok: true, redirectTo: roleHome(user.role), user }, { status: 201 });
}

export async function PATCH(req: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "super_admin") return NextResponse.json({ error: "Administrator access required" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = z.discriminatedUnion("action", [
    z.object({ userId: z.string().uuid(), action: z.literal("admit_applicant") }),
    z.object({
      userId: z.string().uuid(),
      action: z.literal("set_status"),
      status: z.enum(["active", "on_hold", "paused", "withdrawn", "archived"]),
    }),
    z.object({
      userId: z.string().uuid(),
      action: z.literal("set_password"),
      password: z.string().min(10).max(256),
    }),
  ]).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.action === "set_password") {
    if (parsed.data.userId === actor.id) {
      return NextResponse.json({ error: "Use administrator password recovery to change your own password" }, { status: 403 });
    }
    const { password, userId } = parsed.data;
    const passwordProblem = await validateNewPassword(password);
    if (passwordProblem) return NextResponse.json({ error: passwordProblem }, { status: 400 });
    const [account] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!account || account.deletedAt) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const authId = await upsertAuthIdentity(account, password);
    await db.transaction(async (tx: any) => {
      await tx.update(users).set({ authId, updatedAt: new Date() }).where(eq(users.id, account.id));
      await tx.insert(auditLogs).values({
        actorId: actor.id,
        action: "issue_user_credentials",
        entityType: "user",
        entityId: account.id,
        after: { role: account.role },
      });
    });
    await syncAuthBan(authId, account.status);
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "set_status") {
    const status = parsed.data.status;
    if (parsed.data.userId === actor.id) {
      return NextResponse.json({ error: "Administrators cannot change or disable their own account from user management" }, { status: 403 });
    }
    const outcome = await db.transaction(async (tx: any) => {
      const [account] = await tx.select().from(users).where(eq(users.id, parsed.data.userId)).limit(1);
      if (!account) return { error: "Account not found", status: 404 as const };
      const [updated] = await tx.update(users)
        .set({ status, updatedAt: new Date() })
        .where(eq(users.id, account.id))
        .returning({ id: users.id, status: users.status, role: users.role });
      await tx.insert(auditLogs).values({
        actorId: actor.id,
        action: "change_user_status",
        entityType: "user",
        entityId: account.id,
        before: { status: account.status, role: account.role },
        after: { status: updated.status, role: updated.role },
      });
      return { user: updated, authId: account.authId };
    });
    if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    // Blocked statuses are banned at the Auth server so refresh tokens stop working as well.
    if (outcome.authId) await syncAuthBan(outcome.authId, outcome.user.status);
    return NextResponse.json({ ok: true, user: outcome.user });
  }

  const outcome = await db.transaction(async (tx: any) => {
    const [applicant] = await tx.select().from(users).where(eq(users.id, parsed.data.userId)).limit(1);
    if (!applicant || applicant.role !== "applicant") return { error: "Applicant account not found", status: 404 as const };
    if (!applicant.avatarStorageKey) {
      return { error: "Upload the applicant's passport photo before admitting them as a student.", status: 409 as const };
    }

    const [student] = await tx
      .update(users)
      .set({
        role: "student",
        status: "registered",
        registrationNumber: applicant.registrationNumber ?? await nextRegistrationNumber(tx),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, applicant.id), eq(users.role, "applicant")))
      .returning({ id: users.id, role: users.role, status: users.status, registrationNumber: users.registrationNumber });
    if (!student) return { error: "This application has already been reviewed", status: 409 as const };

    const tuition = getCourseTuition({
      isInternational: applicant.isInternational,
      studyFormat: applicant.studyFormat,
      studyDurationMonths: applicant.studyDurationMonths,
    });
    let feeScheduleId: string | null = null;
    if (tuition) {
      const [existingSchedule] = await tx.select({ id: feeSchedules.id }).from(feeSchedules).where(eq(feeSchedules.studentId, student.id)).limit(1);
      if (!existingSchedule) {
        const [createdSchedule] = await tx.insert(feeSchedules).values({
          studentId: student.id,
          amount: tuition.amount,
          currency: tuition.currency,
          dueDate: new Date().toISOString().slice(0, 10),
          status: "unpaid",
        }).returning({ id: feeSchedules.id });
        feeScheduleId = createdSchedule.id;
      }
    }

    await tx.insert(auditLogs).values({
      actorId: actor.id,
      action: "admit_applicant",
      entityType: "user",
      entityId: student.id,
      before: { role: applicant.role, status: applicant.status },
      after: { role: student.role, status: student.status, registrationNumber: student.registrationNumber, feeScheduleId },
    });
    return { student };
  });
  if ("error" in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  const [admitted] = await db.select({
    email: users.email,
    displayName: users.displayName,
    firstName: users.firstName,
    lastName: users.lastName,
    phone: users.phone,
    registrationNumber: users.registrationNumber,
    address: users.address,
    dateOfBirth: users.dateOfBirth,
    nationality: users.nationality,
    nextOfKinName: users.nextOfKinName,
    nextOfKinRelationship: users.nextOfKinRelationship,
    nextOfKinPhone: users.nextOfKinPhone,
    nextOfKinAddress: users.nextOfKinAddress,
    avatarStorageKey: users.avatarStorageKey,
    studyFormat: users.studyFormat,
    studyDurationMonths: users.studyDurationMonths,
    studyMode: users.studyMode,
    isInternational: users.isInternational,
    departmentName: departments.name,
  }).from(users).leftJoin(departments, eq(users.departmentId, departments.id)).where(eq(users.id, outcome.student.id)).limit(1);
  const name = admitted.displayName || `${admitted.firstName ?? ""} ${admitted.lastName ?? ""}`.trim();
  const portrait = await readProfilePhotoJpeg(admitted.avatarStorageKey);
  const detailLines = [
    "Dream Languages Uganda",
    `Student: ${name}`,
    `Registration number: ${admitted.registrationNumber ?? "Pending"}`,
    `Email: ${admitted.email}`,
    `Phone: ${admitted.phone ?? "Not provided"}`,
    `Address: ${admitted.address ?? "Not provided"}`,
    `Date of birth: ${admitted.dateOfBirth ?? "Not provided"}`,
    `Nationality: ${admitted.nationality ?? "Not provided"}`,
    `Preferred language or programme: ${admitted.departmentName ?? "To be confirmed"}`,
    `Study format: ${admitted.studyFormat?.replaceAll("_", " ") ?? "To be confirmed"}`,
    `Duration: ${admitted.studyDurationMonths ? `${admitted.studyDurationMonths} month(s)` : "To be confirmed"}`,
    `Study mode: ${admitted.studyMode ?? "To be confirmed"}`,
    `Fee currency: ${admitted.isInternational ? "USD" : "UGX"}`,
    `Next of kin: ${admitted.nextOfKinName ?? "Not provided"}`,
    `Relationship: ${admitted.nextOfKinRelationship ?? "Not provided"}`,
    `Next of kin phone: ${admitted.nextOfKinPhone ?? "Not provided"}`,
    `Next of kin address: ${admitted.nextOfKinAddress ?? "Not provided"}`,
  ];
  const applicationPdf = createTextPdf("Dream Languages Uganda Student Application Form", [
    ...detailLines,
    "",
    "This is the application information supplied to Dream Languages Uganda.",
  ], portrait);
  const admissionPdf = createTextPdf("Dream Languages Uganda Admission Form", [
    ...detailLines,
    `Admission approved: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "Keep this form for your records. Your class timetable and fee schedule are available through the student portal.",
  ], portrait);
  const email = await sendEmail({
    to: admitted.email,
    subject: `Dream Languages Uganda admission confirmed — ${admitted.registrationNumber ?? ""}`,
    html: `<p>Hello ${name.replace(/[&<>"]/g, "")},</p><p>Your student application has been approved. Your registration number is <strong>${admitted.registrationNumber ?? "pending"}</strong>.</p><p>Your application form and admission form are attached as PDFs. Sign in to the student portal to view your classes and fees.</p><p>Dream Languages Uganda</p>`,
    dedupeKey: `admission:${outcome.student.id}`,
    attachments: [
      { filename: "dla-application-form.pdf", content: applicationPdf, contentType: "application/pdf" },
      { filename: "dla-admission-form.pdf", content: admissionPdf, contentType: "application/pdf" },
    ],
  });
  return NextResponse.json({
    ok: true,
    user: outcome.student,
    emailSent: email.sent,
    emailWarning: email.sent ? undefined : email.error,
  });
}
