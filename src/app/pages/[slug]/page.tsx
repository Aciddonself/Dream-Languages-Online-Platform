import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { GlassCard } from "@/components/ui/glass";
import { db } from "@/db";
import { cmsPages } from "@/db/schema";

export const revalidate = 60;

async function getPage(slug: string) {
  const [page] = await db.select({
    title: cmsPages.title,
    body: cmsPages.body,
    slug: cmsPages.slug,
    seoTitle: cmsPages.seoTitle,
    seoDescription: cmsPages.seoDescription,
  }).from(cmsPages)
    .where(and(eq(cmsPages.slug, slug), eq(cmsPages.status, "published")))
    .limit(1);
  return page;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Page not found", robots: { index: false, follow: false } };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    alternates: { canonical: `/pages/${page.slug}` },
  };
}

export default async function PublicCmsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <GlassCard className="p-6 sm:p-10" strong>
        <h1 className="display-font text-3xl font-bold">{page.title}</h1>
        <div className="mt-6 whitespace-pre-wrap break-words leading-8 opacity-85">{page.body}</div>
      </GlassCard>
    </main>
  );
}
