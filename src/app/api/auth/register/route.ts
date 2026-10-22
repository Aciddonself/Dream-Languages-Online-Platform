import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { createRegistrationNumber } from "@/lib/registration";
import { isProfilePhotoJpeg } from "@/lib/pdf";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(32).optional(),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  address: z.string().trim().max(500).optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().trim().max(100).optional(),
  nextOfKinName: z.string().trim().max(160).optional(),
  nextOfKinRelationship: z.string().trim().max(80).optional(),
  nextOfKinPhone: z.string().trim().max(32).optional(),
  nextOfKinAddress: z.string().trim().max(500).optional(),
  studyFormat: z.enum(["regular", "intensive", "super_intensive"]).optional(),
  studyDurationMonths: z.coerce.number().int().min(1).max(2).optional(),
  studyMode: z.enum(["physical", "online"]).optional(),
  isInternational: z.boolean().optional(),
});

const photoExtensions: Record<string, string> = {
  "image/jpeg": ".jpg",
};
const maxPhotoBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
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
    !parsed.data.nextOfKinAddress || !parsed.data.studyFormat || !parsed.data.studyDurationMonths || !parsed.data.studyMode
  ) {
    return NextResponse.json({ error: "Complete all student and next-of-kin details and upload a JPG, PNG, or WebP profile photo up to 5 MB" }, { status: 400 });
  }
  if (photo && !isProfilePhotoJpeg(new Uint8Array(await photo.arrayBuffer()))) {
    return NextResponse.json({ error: "The profile photo could not be read as a JPEG. Please reselect the image and try again." }, { status: 415 });
  }

  const {
    email, firstName, lastName, phone, departmentId, address, dateOfBirth, nationality,
    nextOfKinName, nextOfKinRelationship, nextOfKinPhone, nextOfKinAddress, studyFormat,
    studyDurationMonths, studyMode, isInternational,
  } = parsed.data;
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  const avatarStorageKey = photo ? `${randomUUID()}${photoExtensions[photo.type]}` : null;
  const storageRoot = path.join(process.cwd(), "private_uploads");
  if (photo && avatarStorageKey) {
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    await writeFile(path.join(storageRoot, avatarStorageKey), Buffer.from(await photo.arrayBuffer()), { flag: "wx", mode: 0o600 });
  }

  try {
    const [user] = await db.insert(users).values({
      email,
      passwordHash,
      role: "applicant",
      status: "applicant",
      firstName,
      lastName,
      phone,
      departmentId: departmentId || null,
      displayName: `${firstName} ${lastName}`,
      registrationNumber: createRegistrationNumber(),
      address: address || null,
      dateOfBirth: dateOfBirth || null,
      nationality: nationality || null,
      nextOfKinName: nextOfKinName || null,
      nextOfKinRelationship: nextOfKinRelationship || null,
      nextOfKinPhone: nextOfKinPhone || null,
      nextOfKinAddress: nextOfKinAddress || null,
      studyFormat: studyFormat || null,
      studyDurationMonths: studyDurationMonths || null,
      studyMode: studyMode || null,
      isInternational: isInternational ?? false,
      avatarUrl: avatarStorageKey ? "/api/portal/profile-photo" : null,
      avatarStorageKey,
    }).onConflictDoNothing().returning();

    if (!user) {
      if (avatarStorageKey) await unlink(path.join(storageRoot, avatarStorageKey));
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      message: "Application received. The administrator will review it and provide login credentials if accepted.",
    }, { status: 201 });
  } catch (error) {
    if (avatarStorageKey) {
      try {
        await unlink(path.join(storageRoot, avatarStorageKey));
      } catch (cleanupError) {
        console.error("Could not clean up failed applicant profile photo:", cleanupError);
      }
    }
    throw error;
  }
}
