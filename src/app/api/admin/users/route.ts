import { NextResponse } from "next/server";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, classes, departments, enrolments, feeSchedules, levels, users } from "@/db/schema";
import { getCurrentUser, syncAuthBan } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { validateNewPassword } from "@/lib/password-policy";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { isAdministrator, roleHome } from "@/lib/rbac";
import { nextRegistrationNumber } from "@/lib/registration";
import { createTextPdf, isProfilePhotoJpeg, readProfilePhotoJpeg } from "@/lib/pdf";
import { deleteStudentPhoto, storeStudentPhoto } from "@/lib/student-photos";
import { sendEmail } from "@/lib/email";
import { getCourseTuition } from "@/lib/course-pricing";

const COURSE_LEVEL_CODES = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const TEACHING_SELECTION_CODES = ["A1", "A2", "B1", "B2", "C1", "C2", "A1-A2", "B1-B2", "C1-C2", "GENERAL"] as const;
type TeachingSelection = typeof TEACHING_SELECTION_CODES[number];

async function assignTeacherLevels(tx: any, teacherId: string, departmentId: string, selections: TeachingSelection[]) {
  const [department] = await tx.select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(and(eq(departments.id, departmentId), eq(departments.isLanguage, true), isNull(departments.deletedAt)))
    .for("update")
    .limit(1);
  if (!department) throw Object.assign(new Error("Choose an active language department."), { code: "INVALID_TEACHING_DEPARTMENT" });

  const existingLevels = await tx.select({ id: levels.id, code: levels.code })
    .from(levels).where(eq(levels.departmentId, department.id)).for("update");
  const levelsByCode = new Map<string, { id: string; code: string }>(existingLevels.map((level: { id: string; code: string }) => [level.code.toUpperCase(), level]));
  for (const [order, code] of COURSE_LEVEL_CODES.entries()) {
    if (levelsByCode.has(code)) continue;
    const [createdLevel] = await tx.insert(levels).values({ departmentId: department.id, code, name: code, order }).returning({ id: levels.id, code: levels.code });
    if (createdLevel) levelsByCode.set(code, createdLevel);
  }

  const selectedCodes = selections.includes("GENERAL") ? [...COURSE_LEVEL_CODES] : [...new Set(selections.flatMap((selection) => {
    if (selection === "A1-A2") return ["A1", "A2"];
    if (selection === "B1-B2") return ["B1", "B2"];
    if (selection === "C1-C2") return ["C1", "C2"];
    return [selection];
  }))];
  const allClasses = await tx.select({ id: classes.id, name: classes.name, levelId: classes.levelId, teacherId: classes.teacherId })
    .from(classes).where(and(eq(classes.departmentId, department.id), isNull(classes.deletedAt))).for("update");

  for (const schoolClass of allClasses as Array<{ id: string; name: string; levelId: string | null; teacherId: string | null }>) {
    if (schoolClass.levelId) continue;
    const classLevelCode = schoolClass.name.match(/(?:^|[^A-Z0-9])(A1|A2|B1|B2|C1|C2)(?=$|[^A-Z0-9])/i)?.[1]?.toUpperCase();
    const matchingLevel = classLevelCode ? levelsByCode.get(classLevelCode) : undefined;
    if (matchingLevel) {
      await tx.update(classes).set({ levelId: matchingLevel.id }).where(eq(classes.id, schoolClass.id));
      schoolClass.levelId = matchingLevel.id;
    }
  }

  const targetClasses: Array<{ id: string; name: string; teacherId: string | null }> = [];
  for (const code of selectedCodes) {
    const level = levelsByCode.get(code);
    if (!level) throw Object.assign(new Error(`Level ${code} is unavailable for ${department.name}.`), { code: "TEACHING_LEVEL_MISSING" });
    const matchingClasses = (allClasses as Array<{ id: string; name: string; levelId: string | null; teacherId: string | null }>)
      .filter((schoolClass) => schoolClass.levelId === level.id);
    const availableClasses = matchingClasses.filter((schoolClass) => schoolClass.teacherId === teacherId || !schoolClass.teacherId);
    if (availableClasses.length) {
      targetClasses.push(...availableClasses.map(({ id, name, teacherId }) => ({ id, name, teacherId })));
    } else {
      const [createdClass] = await tx.insert(classes).values({
        name: `${department.name} ${code}`,
        departmentId: department.id,
        levelId: level.id,
      }).returning({ id: classes.id, name: classes.name, teacherId: classes.teacherId });
      if (createdClass) targetClasses.push(createdClass);
    }
  }

  const previousClasses = await tx.select({ id: classes.id, name: classes.name }).from(classes)
    .where(and(eq(classes.teacherId, teacherId), isNull(classes.deletedAt)));
  await tx.update(classes).set({ teacherId: null }).where(and(eq(classes.teacherId, teacherId), isNull(classes.deletedAt)));
  const targetIds = targetClasses.map((schoolClass) => schoolClass.id);
  if (targetIds.length) await tx.update(classes).set({ teacherId }).where(inArray(classes.id, targetIds));
  await tx.update(users).set({ departmentId: department.id, updatedAt: new Date() }).where(eq(users.id, teacherId));

  return {
    departmentName: department.name,
    levelCodes: selectedCodes,
    classes: targetClasses.map(({ id, name }) => ({ id, name })),
    previousClasses,
  };
}

const createUserSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(10).max(256),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "head_academics", "teacher", "finance", "student", "applicant"]),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  classId: z.string().uuid().optional().or(z.literal("")),
  teachingLevels: z.array(z.enum(TEACHING_SELECTION_CODES)).optional(),
}).strict();

/** Creates (or updates) the Supabase Auth identity for a profile row. Returns the auth user id. */
async function upsertAuthIdentity(account: { id: string; email: string; authId: string | null }, password: string) {
  const admin = createSupabaseAdminClient();
  if (account.authId) {
    const { error } = await admin.auth.admin.updateUserById(account.authId, { password });
    if (error) {
      const failure = new Error(`Supabase Auth password update failed: ${error.message}`);
      Object.assign(failure, { code: error.code ?? "AUTH_PASSWORD_UPDATE_FAILED", status: error.status ?? null });
      throw failure;
    }
    return account.authId;
  }
  const { data, error } = await admin.auth.admin.createUser({ email: account.email, password, email_confirm: true });
  if (error || !data.user) {
    const failure = new Error(`Supabase Auth user creation failed: ${error?.message ?? "No user returned"}`);
    Object.assign(failure, { code: error?.code ?? "AUTH_USER_CREATE_FAILED", status: error?.status ?? null });
    throw failure;
  }
  return data.user.id;
}

function logUserManagementError(label: string, error: unknown) {
  const detail = error && typeof error === "object"
    ? error as { name?: string; code?: string; status?: number | null; statusCode?: string | null; message?: string }
    : {};
  const safeMessage = (detail.message ?? "").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]").slice(0, 240);
  console.error(label, {
    errorName: detail.name ?? "Error",
    errorCode: detail.code ?? "unknown",
    status: detail.status ?? detail.statusCode ?? null,
    message: safeMessage || undefined,
  });
}

async function createUserRequest(req: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!isAdministrator(actor.role)) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
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
  const body = {
    ...Object.fromEntries(["email", "password", "firstName", "lastName", "role", "departmentId", "classId"].map((key) => [key, form.get(key)])),
    teachingLevels: form.getAll("teachingLevel"),
  };
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, firstName, lastName, role, departmentId, classId, teachingLevels = [] } = parsed.data;
  let selectedClass: { id: string; teacherId: string | null; departmentId: string | null } | undefined;
  if (role === "student") {
    if (!classId) return NextResponse.json({ error: "Choose the class this student will join." }, { status: 400 });
    [selectedClass] = await db.select({ id: classes.id, teacherId: classes.teacherId, departmentId: classes.departmentId })
      .from(classes).where(and(eq(classes.id, classId), isNull(classes.deletedAt))).limit(1);
    if (!selectedClass) return NextResponse.json({ error: "Choose an active class in the selected language department." }, { status: 400 });
    if (!departmentId || selectedClass.departmentId !== departmentId) {
      return NextResponse.json({ error: "Choose a class that belongs to the selected language department." }, { status: 400 });
    }
  } else if (classId) {
    return NextResponse.json({ error: "Only a student account is assigned to an enrolled class during creation." }, { status: 400 });
  }
  if (role === "teacher" && !teachingLevels.length) {
    return NextResponse.json({ error: "Choose one or more levels or ranges for this teacher." }, { status: 400 });
  }
  if (role !== "teacher" && teachingLevels.length) {
    return NextResponse.json({ error: "A teaching level can only be selected for a teacher account." }, { status: 400 });
  }
  if (["student", "applicant", "teacher"].includes(role) && !departmentId) {
    return NextResponse.json({ error: "Choose the user's language department before creating the account." }, { status: 400 });
  }
  if (departmentId) {
    const [department] = await db.select({ id: departments.id }).from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.isLanguage, true), isNull(departments.deletedAt))).limit(1);
    if (!department) return NextResponse.json({ error: "Choose an active language department." }, { status: 400 });
  }
  if (role === "admin") {
    if (actor.role !== "super_admin") return NextResponse.json({ error: "Only the super admin can create the administrator account" }, { status: 403 });
    const [existingAdmin] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.role, "admin"), ne(users.status, "archived"), isNull(users.deletedAt))).limit(1);
    if (existingAdmin) return NextResponse.json({ error: "The administrator account already exists. Only one admin account is allowed." }, { status: 409 });
  }
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
    [user] = await db.transaction(async (tx: any) => {
      const [createdUser] = await tx.insert(users)
        .values({
          email,
          authId,
          role,
          departmentId: selectedClass?.departmentId ?? (departmentId || null),
          status: role === "applicant" ? "applicant" : "registered",
          firstName,
          lastName,
          displayName: `${firstName} ${lastName}`,
          registrationNumber: role === "student" || role === "applicant" ? await nextRegistrationNumber(tx) : undefined,
          avatarUrl: avatarStorageKey ? "/api/portal/profile-photo" : null,
          avatarStorageKey,
        })
        .onConflictDoNothing()
        .returning({ id: users.id, email: users.email, role: users.role, registrationNumber: users.registrationNumber });
      if (createdUser && role === "teacher" && teachingLevels.length) {
        await assignTeacherLevels(tx, createdUser.id, departmentId!, teachingLevels);
      }
      if (createdUser && role === "student" && selectedClass) {
        await tx.insert(enrolments).values({ studentId: createdUser.id, classId: selectedClass.id, status: "active" }).onConflictDoNothing();
      }
      return createdUser ? [createdUser] : [];
    });
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
    if (error && typeof error === "object" && "code" in error && error.code === "TEACHING_LEVEL_TAKEN") {
      return NextResponse.json({ error: error instanceof Error ? error.message : "One selected level already has an active teacher." }, { status: 409 });
    }
    throw error;
  }
  if (!user) {
    const { error: deleteAuthError } = await createSupabaseAdminClient().auth.admin.deleteUser(authId);
    if (deleteAuthError) console.error("Could not clean up duplicate Auth identity:", deleteAuthError);
    if (avatarStorageKey) await deleteStudentPhoto(avatarStorageKey);
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      action: "create_user",
      entityType: "user",
      entityId: user.id,
      after: { role: user.role },
      ip: clientIp(req),
    });
  } catch (error) {
    // The account is already provisioned. A logging failure must not tell the admin that creation failed.
    console.error("User created but audit log failed:", error instanceof Error ? error.name : "Unknown error");
  }
  return NextResponse.json({ ok: true, redirectTo: roleHome(user.role), user }, { status: 201 });
}

async function updateUserRequest(req: Request) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!isAdministrator(actor.role)) return NextResponse.json({ error: "Administrator access required" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = z.discriminatedUnion("action", [
    z.object({ action: z.literal("archive_others"), confirmation: z.literal("ARCHIVE OTHER ACCOUNTS") }),
    z.object({ userId: z.string().uuid(), action: z.literal("admit_applicant") }),
    z.object({ userId: z.string().uuid(), action: z.literal("set_department"), departmentId: z.string().uuid() }),
    z.object({ userId: z.string().uuid(), action: z.literal("set_class"), classId: z.string().uuid() }),
    z.object({
      userId: z.string().uuid(), action: z.literal("set_teacher_level"), departmentId: z.string().uuid(),
      teachingLevels: z.array(z.enum(TEACHING_SELECTION_CODES)).optional(),
      teachingLevel: z.enum(TEACHING_SELECTION_CODES).optional(),
    }),
    z.object({
      userId: z.string().uuid(), action: z.literal("edit_profile"),
      firstName: z.string().trim().min(1).max(100),
      lastName: z.string().trim().min(1).max(100),
      phone: z.string().trim().max(40).optional().or(z.literal("")),
      departmentId: z.string().uuid().optional().or(z.literal("")),
    }),
    z.object({ userId: z.string().uuid(), action: z.literal("permanently_delete"), confirmation: z.literal("PERMANENTLY DELETE") }),
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
  const action = parsed.data;

  if (action.action === "set_teacher_level") {
    const [account] = await db.select().from(users).where(eq(users.id, action.userId)).limit(1);
    if (!account || account.deletedAt || account.status === "archived") return NextResponse.json({ error: "Active teacher account not found." }, { status: 404 });
    if (account.role !== "teacher") return NextResponse.json({ error: "Teaching levels can only be assigned to a teacher account." }, { status: 400 });
    const teachingSelections = action.teachingLevels?.length ? action.teachingLevels : action.teachingLevel ? [action.teachingLevel] : [];
    if (!teachingSelections.length) return NextResponse.json({ error: "Choose one or more levels or ranges for this teacher." }, { status: 400 });
    try {
      const assigned = await db.transaction(async (tx: any) => {
        const result = await assignTeacherLevels(tx, account.id, action.departmentId, teachingSelections);
        await tx.insert(auditLogs).values({
          actorId: actor.id,
          action: "assign_teacher_levels",
          entityType: "user",
          entityId: account.id,
          before: { classes: result.previousClasses.map((schoolClass: { id: string; name: string }) => schoolClass) },
          after: { departmentId: action.departmentId, departmentName: result.departmentName, levels: result.levelCodes, classes: result.classes },
          ip: clientIp(req),
        });
        return result;
      });
      return NextResponse.json({ ok: true, levelCodes: assigned.levelCodes, classCount: assigned.classes.length });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (["TEACHING_LEVEL_TAKEN", "INVALID_TEACHING_DEPARTMENT", "TEACHING_LEVEL_MISSING"].includes(code)) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Could not assign the selected teaching level." }, { status: code === "TEACHING_LEVEL_TAKEN" ? 409 : 400 });
      }
      throw error;
    }
  }

  if (action.action === "set_class") {
    const [account] = await db.select().from(users).where(eq(users.id, action.userId)).limit(1);
    if (!account || account.deletedAt || account.status === "archived") return NextResponse.json({ error: "Active account not found." }, { status: 404 });
    if (account.role !== "student") return NextResponse.json({ error: "This class selector is only for students. Assign teachers by language level." }, { status: 400 });
    if (actor.role === "admin" && ["admin", "super_admin"].includes(account.role)) return NextResponse.json({ error: "Administrator accounts cannot be edited here." }, { status: 403 });

    const assigned = await db.transaction(async (tx: any) => {
      const [schoolClass] = await tx.select({ id: classes.id, name: classes.name, departmentId: classes.departmentId })
        .from(classes).where(and(eq(classes.id, action.classId), isNull(classes.deletedAt))).for("update").limit(1);
      if (!schoolClass) return { error: "Choose an active class." };

      const previous = await tx.select({ id: enrolments.classId, name: classes.name }).from(enrolments)
        .innerJoin(classes, eq(enrolments.classId, classes.id))
        .where(and(eq(enrolments.studentId, account.id), eq(enrolments.status, "active")));

      const [existingEnrollment] = await tx.select({ id: enrolments.id })
        .from(enrolments).where(and(eq(enrolments.studentId, account.id), eq(enrolments.classId, schoolClass.id))).limit(1);
      if (existingEnrollment) {
        await tx.update(enrolments).set({ status: "active" }).where(eq(enrolments.id, existingEnrollment.id));
      } else {
        await tx.insert(enrolments).values({ studentId: account.id, classId: schoolClass.id, status: "active" }).onConflictDoNothing();
      }
      await tx.update(users).set({ departmentId: schoolClass.departmentId, updatedAt: new Date() }).where(eq(users.id, account.id));
      await tx.insert(auditLogs).values({
        actorId: actor.id,
        action: "assign_student_class",
        entityType: "user",
        entityId: account.id,
        before: { classes: previous.map((item: { id: string; name: string }) => ({ id: item.id, name: item.name })) },
        after: { classId: schoolClass.id, className: schoolClass.name, departmentId: schoolClass.departmentId },
        ip: clientIp(req),
      });
      return { classId: schoolClass.id };
    });
    if ("error" in assigned) return NextResponse.json({ error: assigned.error }, { status: assigned.error === "Choose an active class." ? 400 : 409 });
    return NextResponse.json({ ok: true, ...assigned });
  }

  if (action.action === "set_department") {
    const [account] = await db.select().from(users).where(eq(users.id, action.userId)).limit(1);
    if (!account || account.deletedAt) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (actor.role === "admin" && ["admin", "super_admin"].includes(account.role)) return NextResponse.json({ error: "Administrator accounts cannot be edited here" }, { status: 403 });
    const [department] = await db.select({ id: departments.id }).from(departments)
      .where(and(eq(departments.id, action.departmentId), eq(departments.isLanguage, true), isNull(departments.deletedAt))).limit(1);
    if (!department) return NextResponse.json({ error: "Choose an active language department" }, { status: 400 });
    await db.transaction(async (tx: any) => {
      await tx.update(users).set({ departmentId: department.id, updatedAt: new Date() }).where(eq(users.id, account.id));
      await tx.insert(auditLogs).values({
        actorId: actor.id,
        action: "assign_language_department",
        entityType: "user",
        entityId: account.id,
        before: { departmentId: account.departmentId },
        after: { departmentId: department.id },
        ip: clientIp(req),
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action.action === "edit_profile") {
    const [account] = await db.select().from(users).where(eq(users.id, action.userId)).limit(1);
    if (!account || account.deletedAt) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (account.id === actor.id) return NextResponse.json({ error: "Edit your own administrator profile from account settings." }, { status: 403 });
    if (actor.role === "admin" && ["admin", "super_admin"].includes(account.role)) return NextResponse.json({ error: "Only the super administrator can edit an administrator account." }, { status: 403 });
    if (["student", "teacher"].includes(account.role) && action.departmentId !== account.departmentId) {
      return NextResponse.json({ error: "Change this user's language department through the assigned class controls." }, { status: 400 });
    }
    if (["student", "applicant", "teacher"].includes(account.role) && !action.departmentId) {
      return NextResponse.json({ error: "Choose a language department for this account." }, { status: 400 });
    }
    if (action.departmentId) {
      const [department] = await db.select({ id: departments.id }).from(departments)
        .where(and(eq(departments.id, action.departmentId), eq(departments.isLanguage, true), isNull(departments.deletedAt))).limit(1);
      if (!department) return NextResponse.json({ error: "Choose an active language department." }, { status: 400 });
    }
    await db.transaction(async (tx: any) => {
      await tx.update(users).set({
        firstName: action.firstName,
        lastName: action.lastName,
        displayName: `${action.firstName} ${action.lastName}`,
        phone: action.phone || null,
        departmentId: action.departmentId || null,
        updatedAt: new Date(),
      }).where(eq(users.id, account.id));
      await tx.insert(auditLogs).values({
        actorId: actor.id,
        action: "edit_user_profile",
        entityType: "user",
        entityId: account.id,
        before: { firstName: account.firstName, lastName: account.lastName, departmentId: account.departmentId },
        after: { firstName: action.firstName, lastName: action.lastName, departmentId: action.departmentId || null },
        ip: clientIp(req),
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action.action === "permanently_delete") {
    if (action.userId === actor.id) return NextResponse.json({ error: "You cannot permanently delete your own account." }, { status: 403 });
    if (actor.role !== "super_admin" && actor.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    const [account] = await db.select().from(users).where(eq(users.id, action.userId)).limit(1);
    if (!account || account.status !== "archived" || !account.deletedAt) return NextResponse.json({ error: "Only archived accounts can be permanently deleted." }, { status: 409 });
    if (account.role === "super_admin" || (actor.role === "admin" && account.role === "admin")) {
      return NextResponse.json({ error: "Only the super administrator can permanently delete another administrator, and the super administrator account is protected." }, { status: 403 });
    }
    try {
      await db.transaction(async (tx: any) => {
        await tx.delete(users).where(eq(users.id, account.id));
      });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code === "23503") {
        return NextResponse.json({ error: "This account is linked to school records that must be retained. It remains archived and cannot be permanently deleted while those records depend on it." }, { status: 409 });
      }
      throw error;
    }
    let authDeleted = true;
    if (account.authId) {
      const { error } = await createSupabaseAdminClient().auth.admin.deleteUser(account.authId);
      authDeleted = !error;
      if (error) console.error("Permanently deleted account profile but could not remove its Supabase Auth identity.", error.code ?? error.message);
    }
    if (account.avatarStorageKey) {
      await deleteStudentPhoto(account.avatarStorageKey).catch((error) => console.error("Could not remove archived user photo after account deletion.", error instanceof Error ? error.name : "Unknown error"));
    }
    return NextResponse.json({ ok: true, authDeleted, message: authDeleted ? "Archived account permanently deleted." : "Account data was deleted, but its Supabase sign-in identity needs administrator cleanup." });
  }

  if (action.action === "archive_others") {
    if (actor.role !== "super_admin") return NextResponse.json({ error: "Only the super admin can archive accounts in bulk" }, { status: 403 });
    const archived = await db.transaction(async (tx: any) => {
      const accounts = await tx.update(users)
        .set({ status: "archived", deletedAt: new Date(), updatedAt: new Date() })
        .where(ne(users.id, actor.id))
        .returning({ id: users.id, authId: users.authId });
      await tx.insert(auditLogs).values({
        actorId: actor.id,
        action: "archive_other_accounts",
        entityType: "user_directory",
        after: { archivedCount: accounts.length },
        ip: clientIp(req),
      });
      return accounts;
    });
    const authIds = archived.flatMap((account: { authId: string | null }) => account.authId ? [account.authId] : []);
    const banResults = await Promise.allSettled(authIds.map((authId: string) => syncAuthBan(authId, "archived")));
    const failedBans = banResults.filter((result) => result.status === "rejected").length;
    return NextResponse.json({
      ok: failedBans === 0,
      archivedCount: archived.length,
      failedAuthBans: failedBans,
      message: failedBans
        ? "Other accounts have been archived in the LMS. Some Auth bans need attention; archived accounts are still blocked by the LMS."
        : "All other accounts have been archived and can no longer sign in. Their records are retained.",
    }, { status: failedBans ? 502 : 200 });
  }

  if (action.action === "set_password") {
    if (action.userId === actor.id) {
      return NextResponse.json({ error: "Use administrator password recovery to change your own password" }, { status: 403 });
    }
    const { password, userId } = action;
    const passwordProblem = await validateNewPassword(password);
    if (passwordProblem) return NextResponse.json({ error: passwordProblem }, { status: 400 });
    const [account] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!account || account.deletedAt) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (actor.role === "admin" && ["admin", "super_admin"].includes(account.role)) {
      return NextResponse.json({ error: "Only the super admin can manage another administrator's credentials" }, { status: 403 });
    }
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

  if (action.action === "set_status") {
    const status = action.status;
    if (action.userId === actor.id) {
      return NextResponse.json({ error: "Administrators cannot change or disable their own account from user management" }, { status: 403 });
    }
    const outcome = await db.transaction(async (tx: any) => {
      const [account] = await tx.select().from(users).where(eq(users.id, action.userId)).limit(1);
      if (!account) return { error: "Account not found", status: 404 as const };
      if (actor.role === "admin" && ["admin", "super_admin"].includes(account.role)) {
        return { error: "Only the super admin can change an administrator account", status: 403 as const };
      }
      const [updated] = await tx.update(users)
        .set({ status, deletedAt: status === "archived" ? new Date() : status === "active" ? null : account.deletedAt, updatedAt: new Date() })
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
    if (outcome.authId) {
      try {
        await syncAuthBan(outcome.authId, outcome.user.status);
      } catch (error) {
        console.error("Could not synchronize account status with Supabase Auth:", error instanceof Error ? error.name : "Unknown error");
        return NextResponse.json({
          error: "The LMS status was saved, but the sign-in block did not sync with Supabase. Refresh and retry, then check Supabase Auth if it continues.",
          user: outcome.user,
        }, { status: 502 });
      }
    }
    return NextResponse.json({ ok: true, user: outcome.user });
  }

  const outcome = await db.transaction(async (tx: any) => {
    const [applicant] = await tx.select().from(users).where(eq(users.id, action.userId)).limit(1);
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
    `Duration: ${admitted.studyDurationMonths === 0 ? "Full level" : admitted.studyDurationMonths ? `${admitted.studyDurationMonths} month(s)` : "To be confirmed"}`,
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
    subject: `Dream Languages Uganda admission confirmed: ${admitted.registrationNumber ?? ""}`,
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

export async function POST(req: Request) {
  try {
    return await createUserRequest(req);
  } catch (error) {
    logUserManagementError("Admin user creation failed", error);
    return NextResponse.json({ error: "Could not create the account. Check Supabase Auth and database availability, then try again." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    return await updateUserRequest(req);
  } catch (error) {
    logUserManagementError("Admin user update failed", error);
    return NextResponse.json({ error: "Could not update the account. Check Supabase Auth and database availability, then try again." }, { status: 500 });
  }
}


