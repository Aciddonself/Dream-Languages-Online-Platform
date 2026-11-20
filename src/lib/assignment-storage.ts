import "server-only";

import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const bucket = "assignment-submissions";

function objectPath(key: string, extension: string) {
  return `assignment-${key}${extension}`;
}

export async function storeAssignmentFile(key: string, extension: string, contentType: string, bytes: Uint8Array) {
  const { error } = await createSupabaseAdminClient().storage.from(bucket).upload(objectPath(key, extension), bytes, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`Could not save the assignment file: ${error.message}`);
}

export async function deleteAssignmentFile(key: string, extension: string) {
  const { error } = await createSupabaseAdminClient().storage.from(bucket).remove([objectPath(key, extension)]);
  if (!error) return;

  // Older submissions were stored on the app server before durable storage was added.
  try {
    await unlink(path.join(process.cwd(), "private_uploads", objectPath(key, extension)));
  } catch (legacyError) {
    if ((legacyError as NodeJS.ErrnoException).code !== "ENOENT") throw legacyError;
    throw new Error(`Could not remove the assignment file: ${error.message}`);
  }
}

export async function readAssignmentFile(key: string, extension: string) {
  const object = objectPath(key, extension);
  const { data, error } = await createSupabaseAdminClient().storage.from(bucket).download(object);
  if (!error && data) return new Uint8Array(await data.arrayBuffer());

  try {
    return new Uint8Array(await readFile(path.join(process.cwd(), "private_uploads", object)));
  } catch (legacyError) {
    if ((legacyError as NodeJS.ErrnoException).code !== "ENOENT") throw legacyError;
    throw new Error(`Could not load the assignment file: ${error?.message ?? "file not found"}`);
  }
}
