import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const bucket = "student-photos";

export async function storeStudentPhoto(key: string, bytes: Uint8Array) {
  const storage = createSupabaseAdminClient().storage;
  const upload = () => storage.from(bucket).upload(key, bytes, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  let { error } = await upload();
  // Recover if the production bucket was missed during database migrations.
  if (error && (error.message.toLowerCase().includes("bucket not found") || error.statusCode === "404")) {
    const created = await storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: String(5 * 1024 * 1024),
      allowedMimeTypes: ["image/jpeg"],
    });
    if (!created.error || created.error.message.toLowerCase().includes("already exists")) {
      ({ error } = await upload());
    }
  }
  if (error) throw new Error(`Could not save the student photo: ${error.message}`);
}

export async function deleteStudentPhoto(key: string) {
  const { error } = await createSupabaseAdminClient().storage.from(bucket).remove([key]);
  if (error) throw new Error(`Could not remove the previous student photo: ${error.message}`);
}

export async function readStudentPhoto(key: string) {
  const { data, error } = await createSupabaseAdminClient().storage.from(bucket).download(key);
  if (!error && data) return new Uint8Array(await data.arrayBuffer());

  try {
    return new Uint8Array(await readFile(path.join(process.cwd(), "private_uploads", key)));
  } catch (legacyError) {
    if ((legacyError as NodeJS.ErrnoException).code !== "ENOENT") throw legacyError;
    throw new Error(`Could not load the student photo from private storage: ${error?.message ?? "file not found"}`);
  }
}
