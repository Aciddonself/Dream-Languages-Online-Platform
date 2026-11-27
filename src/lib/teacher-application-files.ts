import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

const bucket = "teacher-applications";
const referencePrefix = `supabase://${bucket}/`;
const allowedTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function teacherApplicationFileReference(key: string) {
  return `${referencePrefix}${key}`;
}

export function isTeacherApplicationFileReference(value: string) {
  return value.startsWith(referencePrefix);
}

function objectKey(reference: string) {
  const key = reference.slice(referencePrefix.length);
  if (!/^[0-9a-f-]{36}\.(pdf|doc|docx)$/i.test(key)) throw new Error("Invalid teacher application document reference");
  return key;
}

export async function storeTeacherApplicationFile(key: string, bytes: Uint8Array, contentType: string) {
  if (!allowedTypes.includes(contentType)) throw new Error("Unsupported teacher application document type");
  const storage = createSupabaseAdminClient().storage;
  const upload = () => storage.from(bucket).upload(key, bytes, { contentType, cacheControl: "3600", upsert: false });

  let { error } = await upload();
  if (error && (error.statusCode === "404" || error.message.toLowerCase().includes("bucket not found"))) {
    const created = await storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: String(10 * 1024 * 1024),
      allowedMimeTypes: allowedTypes,
    });
    if (!created.error || created.error.message.toLowerCase().includes("already exists")) ({ error } = await upload());
  }
  if (error) {
    const failure = new Error(`Teacher application document upload failed: ${error.message}`);
    Object.assign(failure, { code: error.statusCode ?? "STORAGE_UPLOAD_FAILED", statusCode: error.statusCode ?? null });
    throw failure;
  }
}

export async function readTeacherApplicationFile(reference: string) {
  const { data, error } = await createSupabaseAdminClient().storage.from(bucket).download(objectKey(reference));
  if (error || !data) {
    const failure = new Error(error?.message ?? "Document is unavailable in private storage");
    Object.assign(failure, { code: error?.statusCode ?? "STORAGE_DOWNLOAD_FAILED", statusCode: error?.statusCode ?? null });
    throw failure;
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function deleteTeacherApplicationFile(reference: string) {
  const { error } = await createSupabaseAdminClient().storage.from(bucket).remove([objectKey(reference)]);
  if (error) throw new Error(`Teacher application document cleanup failed: ${error.message}`);
}
