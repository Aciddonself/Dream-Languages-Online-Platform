import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { teacherApplications } from "@/db/schema";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const allowedExtensions: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

function field(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the application form" }, { status: 400 });
  }

  const isVolunteer = field(form, "isVolunteer") === "true";
  const requiredFields = ["firstName", "lastName", "email", "phone", "address", "languageTaught", "nextOfKinName", "nextOfKinRelationship", "nextOfKinPhone", "nextOfKinAddress"];
  if (requiredFields.some((name) => !field(form, name))) return NextResponse.json({ error: "Complete all required personal and next-of-kin details" }, { status: 400 });
  const email = field(form, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  const validPhone = (value: string) => {
    const normalized = value.replace(/[\s().-]/g, "");
    return /^\+?[1-9]\d{7,14}$/.test(normalized);
  };
  if (!validPhone(field(form, "phone")) || !validPhone(field(form, "nextOfKinPhone"))) {
    return NextResponse.json({ error: "Enter valid phone numbers with country codes for yourself and your next of kin" }, { status: 400 });
  }

  const payPerSessionText = field(form, "payPerSession");
  const payPerSession = payPerSessionText ? Number(payPerSessionText) : null;
  const availability = field(form, "availability");
  const referenceName = field(form, "referenceName");
  const referencePhone = field(form, "referencePhone");
  if (!isVolunteer && !validPhone(referencePhone)) {
    return NextResponse.json({ error: "Enter a valid workplace reference phone number with country code" }, { status: 400 });
  }
  if (!isVolunteer && (!Number.isSafeInteger(payPerSession) || (payPerSession ?? 0) <= 0 || !["full_time", "part_time"].includes(availability) || !referenceName || !referencePhone)) {
    return NextResponse.json({ error: "Paid applications need expected pay per session, schedule preference, and a workplace reference with a phone number" }, { status: 400 });
  }

  const fileKeys = isVolunteer ? ["cv", "coverLetter"] : ["cv", "coverLetter", "recommendation"];
  const files: { key: string; file: File; extension: string; id: string }[] = [];
  for (const key of fileKeys) {
    const value = form.get(key);
    if (!(value instanceof File) || value.size < 1 || value.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${key} is required and must be no larger than 10 MB` }, { status: 400 });
    }
    const extension = allowedExtensions[value.type];
    if (!extension) return NextResponse.json({ error: `${key} must be a PDF, DOC, or DOCX file` }, { status: 415 });
    files.push({ key, file: value, extension, id: randomUUID() });
  }

  const storageRoot = path.join(process.cwd(), "private_uploads");
  const filePaths = new Map<string, string>();
  try {
    await mkdir(storageRoot, { recursive: true, mode: 0o700 });
    for (const item of files) {
      const filePath = path.join(storageRoot, `${item.id}${item.extension}`);
      await writeFile(filePath, Buffer.from(await item.file.arrayBuffer()), { flag: "wx", mode: 0o600 });
      filePaths.set(item.key, filePath);
    }
    const [application] = await db.insert(teacherApplications).values({
      firstName: field(form, "firstName"),
      lastName: field(form, "lastName"),
      email,
      phone: field(form, "phone"),
      address: field(form, "address"),
      languageTaught: field(form, "languageTaught"),
      isVolunteer,
      payPerSession: isVolunteer ? null : payPerSession,
      availability: isVolunteer ? null : availability,
      nextOfKinName: field(form, "nextOfKinName"),
      nextOfKinRelationship: field(form, "nextOfKinRelationship"),
      nextOfKinPhone: field(form, "nextOfKinPhone"),
      nextOfKinAddress: field(form, "nextOfKinAddress"),
      referenceName: isVolunteer ? null : referenceName,
      referencePhone: isVolunteer ? null : referencePhone,
      cvPath: filePaths.get("cv")!,
      coverLetterPath: filePaths.get("coverLetter")!,
      recommendationPath: filePaths.get("recommendation") ?? null,
    }).returning({ id: teacherApplications.id });
    return NextResponse.json({ ok: true, applicationId: application.id }, { status: 201 });
  } catch (error) {
    for (const filePath of filePaths.values()) {
      try {
        await unlink(filePath);
      } catch (cleanupError) {
        console.error("Could not clean up failed teacher application upload:", cleanupError);
      }
    }
    console.error("Could not save teacher application:", error);
    return NextResponse.json(
      { error: "We could not save your application right now. Please try again later or email info@dreamlanguagesug.com for help." },
      { status: 500 },
    );
  }
}
