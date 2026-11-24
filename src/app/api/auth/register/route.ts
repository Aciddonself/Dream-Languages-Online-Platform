import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { departments, notifications, users } from "@/db/schema";
import { nextRegistrationNumber } from "@/lib/registration";
import { isProfilePhotoJpeg } from "@/lib/pdf";
import { deleteStudentPhoto, storeStudentPhoto } from "@/lib/student-photos";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(32).optional(),
  departmentId: z.string().uuid(),
  address: z.string().trim().max(500).optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().trim().max(100).optional(),
  nextOfKinName: z.string().trim().max(160).optional(),
  nextOfKinRelationship: z.string().trim().max(80).optional(),
  nextOfKinPhone: z.string().trim().max(32).optional(),
  nextOfKinAddress: z.string().trim().max(500).optional(),
  studyFormat: z.enum(["regular", "intensive", "super_intensive"]).optional(),
  studyDurationMonths: z.preprocess((value) => { if (value === "full_level") return 0; if (value === "" || value === null || value === undefined) return undefined; return Number(value); }, z.number().int().min(0).max(4).optional()),
  studyMode: z.enum(["physical", "online"]).optional(),
  requestedIntake: z.string().trim().max(64).optional(),
  isInternational: z.boolean().optional(),
});

const photoExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
};
const maxPhotoBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const limited = await rateLimit("register", clientIp(request), 5, "1 h");
  if (!limited.ok) return tooManyRequests(limited.retryAfter);
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return NextResponse.json({ error: "User accounts and login credentials are issued by a school administrator." }, { status: 403 });
  }
  let body: unknown;
  let photo: File | null = null;
  try {
    const form = await request.formData();
    const file = form.get("profilePhoto");
    photo = file instanceof File ? file : null;
    body = {
      email: form.get("email"),
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      phone: form.get("phone"),
      departmentId: form.get("departmentId"),
      address: form.get("address"),
      dateOfBirth: form.get("dateOfBirth"),
      nationality: form.get("nationality"),
      nextOfKinName: form.get("nextOfKinName"),
      nextOfKinRelationship: form.get("nextOfKinRelationship"),
      nextOfKinPhone: form.get("nextOfKinPhone"),
      nextOfKinAddress: form.get("nextOfKinAddress"),
      studyFormat: form.get("studyFormat"),
      studyDurationMonths: form.get("studyDurationMonths"),
      studyMode: form.get("studyMode"),
      requestedIntake: form.get("requestedIntake"),
      isInternational: form.get("isInternationalValue") === "true",
    };
  } catch {
    return NextResponse.json({ error: "Could not read the registration form" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (
    !photo || photo.size < 1 || photo.size > maxPhotoBytes || !photoExtensions[photo.type] ||
    !parsed.data.address || !parsed.data.dateOfBirth || !parsed.data.nationality ||
    !parsed.data.nextOfKinName || !parsed.data.nextOfKinRelationship || !parsed.data.nextOfKinPhone ||
    !parsed.data.nextOfKinAddress || !parsed.data.studyFormat || parsed.data.studyDurationMonths === undefined || !parsed.data.studyMode
  ) {
    return NextResponse.json({ error: "Complete all student and next-of-kin details and upload a JPG, PNG, or WebP profile photo up to 5 MB" }, { status: 400 });
  }
  const photoBytes = photo ? new Uint8Array(await photo.arrayBuffer()) : null;
  if (!photoBytes || !isProfilePhotoJpeg(photoBytes)) {
    return NextResponse.json({ error: "The profile photo could not be read as a JPEG. Please reselect the image and try again." }, { status: 415 });
  }

  const [selectedDepartment] = await db.select({ id: departments.id }).from(departments)
    .where(and(eq(departments.id, parsed.data.departmentId), eq(departments.isLanguage, true), isNull(departments.deletedAt)))
    .limit(1);
  if (!selectedDepartment) {
    return NextResponse.json({ error: "Choose an active language department before submitting your application." }, { status: 400 });
  }

  const {
    email, firstName, lastName, phone, departmentId, address, dateOfBirth, nationality,
    nextOfKinName, nextOfKinRelationship, nextOfKinPhone, nextOfKinAddress, studyFormat,
    studyDurationMonths, studyMode, requestedIntake, isInternational,
  } = parsed.data;
  const avatarStorageKey = `${randomUUID()}${photoExtensions[photo.type]}`;
  let stage: "photo_storage" | "application_database" = "photo_storage";
  let photoStored = false;
  try {
    await storeStudentPhoto(avatarStorageKey, photoBytes);
    photoStored = true;
    stage = "application_database";
    const [user] = await db.transaction(async (tx: any) => tx.insert(users).values({
      email,
      role: "applicant",
      status: "applicant",
      firstName,
      lastName,
      phone,
      departmentId: departmentId || null,
      displayName: `${firstName} ${lastName}`,
      registrationNumber: await nextRegistrationNumber(tx),
      address: address || null,
      dateOfBirth: dateOfBirth || null,
      nationality: nationality || null,
      nextOfKinName: nextOfKinName || null,
      nextOfKinRelationship: nextOfKinRelationship || null,
      nextOfKinPhone: nextOfKinPhone || null,
      nextOfKinAddress: nextOfKinAddress || null,
      studyFormat: studyFormat || null,
      studyDurationMonths: studyDurationMonths ?? null,
      studyMode: studyMode || null,
      requestedIntake: requestedIntake || null,
      isInternational: isInternational ?? false,
      avatarUrl: avatarStorageKey ? "/api/portal/profile-photo" : null,
      avatarStorageKey,
    }).onConflictDoNothing().returning());

    if (!user) {
      try {
        await deleteStudentPhoto(avatarStorageKey);
      } catch (cleanupError) {
        console.error("Could not clean up duplicate applicant photo:", cleanupError);
      }
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    try {
      const admins = await db.select({ id: users.id }).from(users).where(and(
        inArray(users.role, ["super_admin", "admin"]), inArray(users.status, ["active", "registered"]),
        isNull(users.deletedAt),
      ));
      if (admins.length) {
        await db.insert(notifications).values(admins.map((admin) => ({
          userId: admin.id,
          title: "New student application received",
          body: `${firstName} ${lastName} applied to ${selectedDepartment.name}. Review the application in Admin → Users → Admission applications.`,
        })));
      }
    } catch (notificationError) {
      console.error("Application was saved, but the administrator notification could not be delivered", notificationError instanceof Error ? notificationError.message : "unknown error");
    }
    return NextResponse.json({
      ok: true,
      message: "Application received. The administrator will review it and provide login credentials if accepted.",
    }, { status: 201 });
  } catch (error) {
    const detail = error && typeof error === "object" ? error as { name?: string; code?: string; statusCode?: string | null; message?: string } : {};
    console.error("Applicant submission failed", {
      stage,
      errorName: detail.name ?? "Error",
      errorCode: detail.code ?? "unknown",
      storageStatus: detail.statusCode ?? null,
      storageMessage: stage === "photo_storage" ? detail.message?.slice(0, 240) ?? "No provider message" : undefined,
    });
    if (photoStored) {
      try {
        await deleteStudentPhoto(avatarStorageKey);
      } catch (cleanupError) {
        const cleanup = cleanupError && typeof cleanupError === "object" ? cleanupError as { name?: string; code?: string } : {};
        console.error("Could not clean up failed applicant profile photo", { errorName: cleanup.name ?? "Error", errorCode: cleanup.code ?? "unknown" });
      }
    }
    return NextResponse.json(
      stage === "photo_storage"
        ? { error: "We could not securely save your photo right now. Please try again later.", code: "STUDENT_PHOTO_STORAGE_UNAVAILABLE" }
        : { error: "We could not record your application right now. Please try again later.", code: "APPLICATION_SAVE_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

