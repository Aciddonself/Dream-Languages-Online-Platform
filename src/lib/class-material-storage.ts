import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const CLASS_MATERIALS_BUCKET = "class-materials";

export const MATERIAL_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/aac": ".aac",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

export function cleanMaterialName(value: string) {
  return value.replace(/[\\/\u0000-\u001f]/g, "-").replace(/\.\./g, "-").trim().slice(0, 180) || "learning-material";
}

export async function createMaterialUpload(path: string) {
  const { data, error } = await createSupabaseAdminClient().storage
    .from(CLASS_MATERIALS_BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (error || !data) throw new Error(`Could not prepare the private upload: ${error?.message ?? "no upload token"}`);
  return data;
}

export async function classMaterialExists(path: string) {
  const [folder, name] = path.split("/");
  const { data, error } = await createSupabaseAdminClient().storage
    .from(CLASS_MATERIALS_BUCKET).list(folder, { limit: 100, search: name });
  if (error) throw new Error(`Could not confirm the uploaded material: ${error.message}`);
  return Boolean(data?.some((item) => item.name === name));
}

export async function createMaterialDownload(path: string, fileName?: string) {
  const { data, error } = await createSupabaseAdminClient().storage
    .from(CLASS_MATERIALS_BUCKET).createSignedUrl(path, 4 * 60 * 60, fileName ? { download: cleanMaterialName(fileName) } : { download: false });
  if (error || !data?.signedUrl) throw new Error(`Could not prepare the material download: ${error?.message ?? "no signed URL"}`);
  return data.signedUrl;
}

export async function removeClassMaterial(path: string) {
  const { error } = await createSupabaseAdminClient().storage.from(CLASS_MATERIALS_BUCKET).remove([path]);
  if (error) throw new Error(`Could not remove the private material: ${error.message}`);
}
