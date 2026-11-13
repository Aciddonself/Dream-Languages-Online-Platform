import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { classes, enrolments, materials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createMaterialDownload, MATERIAL_TYPES } from "@/lib/class-material-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { materialId } = await params;
  const [material] = await db.select().from(materials).where(eq(materials.id, materialId)).limit(1);
  if (!material?.classId || !material.type || !material.uploadComplete) return NextResponse.json({ error: "Material not found" }, { status: 404 });

  if (user.role === "student") {
    const [enrollment] = await db.select({ id: enrolments.id }).from(enrolments).where(and(
      eq(enrolments.studentId, user.id), eq(enrolments.classId, material.classId), eq(enrolments.status, "active"),
    )).limit(1);
    if (!enrollment) return NextResponse.json({ error: "You are not enrolled in this class" }, { status: 403 });
  } else if (user.role === "teacher") {
    const [schoolClass] = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, material.classId), eq(classes.teacherId, user.id))).limit(1);
    if (!schoolClass) return NextResponse.json({ error: "You cannot access this class material" }, { status: 403 });
  } else if (!["head_academics", "super_admin"].includes(user.role)) {
    return NextResponse.json({ error: "Portal access required" }, { status: 403 });
  }

  const name = material.fileName || `${material.title}${MATERIAL_TYPES[material.type] ?? ""}`;
  if (material.storagePath) {
    const inline = material.type.startsWith("video/") || material.type.startsWith("audio/");
    const signedUrl = await createMaterialDownload(material.storagePath, inline ? undefined : name);
    return NextResponse.redirect(signedUrl, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }

  // Legacy files from before materials moved to Supabase Storage.
  const extension = MATERIAL_TYPES[material.type];
  if (!extension) return NextResponse.json({ error: "Unsupported material type" }, { status: 415 });
  try {
    const content = await readFile(path.join(process.cwd(), "private_uploads", `${material.id}${extension}`));
    const safeTitle = name.replace(/[^\w .-]/g, "").trim().slice(0, 100) || "class-material";
    const inline = material.type.startsWith("video/") || material.type.startsWith("audio/");
    return new Response(new Uint8Array(content), { headers: {
      "Content-Type": material.type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeTitle}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    console.error("Legacy class material is missing from private storage:", { materialId, error });
    return NextResponse.json({ error: "This older material is not available on this server" }, { status: 500 });
  }
}
