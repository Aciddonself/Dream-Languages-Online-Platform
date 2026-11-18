import type { MetadataRoute } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { DEFAULT_DEPARTMENTS } from "@/lib/public-content";

const siteUrl = "https://dreamlanguagesug.online";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    ["", 1], ["courses", 0.9], ["departments", 0.9], ["apply", 0.9],
    ["about", 0.7], ["services", 0.7], ["faqs", 0.7], ["timetable", 0.7],
    ["blog", 0.7], ["gallery", 0.6], ["testimonials", 0.6], ["contact", 0.6],
    ["dla-opportunities", 0.7], ["my-dla-shop", 0.6], ["classes-2027", 0.5],
  ].map(([path, priority]) => ({
    url: path ? `${siteUrl}/${path}` : siteUrl,
    lastModified: now,
    changeFrequency: path === "blog" ? "weekly" : "monthly",
    priority: Number(priority),
  }));

  let languageCodes = DEFAULT_DEPARTMENTS.map((department) => department.code.toLowerCase());
  try {
    const rows = await db.select({ code: departments.code }).from(departments)
      .where(and(eq(departments.isLanguage, true), isNull(departments.deletedAt)));
    if (rows.length) languageCodes = rows.map((row) => row.code.toLowerCase());
  } catch (error) {
    console.warn("Could not load dynamic sitemap entries", error instanceof Error ? error.name : "UnknownError");
  }

  return [
    ...pages,
    ...languageCodes.map((code) => ({
      url: `${siteUrl}/departments/${encodeURIComponent(code)}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
