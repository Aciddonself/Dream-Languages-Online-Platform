import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/hoc", "/teacher", "/student", "/finance", "/applicant", "/api", "/login", "/admin-login", "/register"],
    },
    sitemap: "https://dreamlanguagesug.online/sitemap.xml",
    host: "https://dreamlanguagesug.online",
  };
}
