import Link from "next/link";
import { GlassCard, GlassButton } from "@/components/ui/glass";
import { getPublishedNews } from "@/lib/public-content";
import { NewsMediaCarousel } from "@/components/news-media-carousel";
import { NewsCarouselErrorBoundary } from "@/components/news-carousel-error-boundary";
import { isVideo } from "@/lib/media";

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  let posts: Awaited<ReturnType<typeof getPublishedNews>> = [];
  try {
    const result = await getPublishedNews();
    posts = Array.isArray(result) ? result.filter((post) => post && typeof post.title === "string") : [];
  } catch (error) {
    console.error("Could not prepare public news page", error instanceof Error ? error.name : "UnknownError");
    posts = [];
  }
  const slides = posts.map((post) => ({
    title: post.title,
    url: typeof post.coverUrl === "string" && post.coverUrl.trim() ? post.coverUrl : "/site-media/learning-community.jpg",
    excerpt: typeof post.excerpt === "string" ? post.excerpt : null,
  }));
  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-2">News & stories</h1>
      <p className="opacity-70 mb-6">Language learning, adult literacy, events, and updates from the DLA community.</p>
      <NewsCarouselErrorBoundary><NewsMediaCarousel slides={slides} /></NewsCarouselErrorBoundary>
      <div className="grid gap-4 md:grid-cols-3">
        {posts.map((post) => (
          <GlassCard className="overflow-hidden" key={post.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {isVideo(post.coverUrl ?? "")
              ? <video src={post.coverUrl ?? undefined} controls playsInline className="h-48 w-full bg-[var(--brand-secondary)] object-contain" aria-label={`${post.title} video`} />
              : <img src={typeof post.coverUrl === "string" && post.coverUrl.trim() ? post.coverUrl : "/site-media/learning-community.jpg"} alt={post.coverUrl ? post.title : "DLA learners in a community setting"} className="h-48 w-full bg-[var(--surface)] object-contain p-1" loading="lazy" />}
            <div className="p-5">
              {typeof post.category === "string" && post.category && <div className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">{post.category}</div>}
              <h2 className="font-semibold">{post.title}</h2>
              <p className="mt-2 text-sm opacity-70">{typeof post.excerpt === "string" ? post.excerpt : typeof post.body === "string" ? post.body.slice(0, 180) : "News from Dream Languages and Adult Literacy."}</p>
              {typeof post.body === "string" && post.body && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Read story</summary><p className="mt-2 whitespace-pre-wrap opacity-80">{post.body}</p></details>}
            </div>
          </GlassCard>
        ))}
      </div>
      {!posts.length && (
        <GlassCard className="p-6" strong>
          <h2 className="font-semibold">Learn with DLA</h2>
          <p className="mt-2 text-sm opacity-70">Explore learner stories including German language learning, adult literacy, and practical skills programmes.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/courses"><GlassButton variant="glass">Explore courses</GlassButton></Link>
            <Link href="/apply"><GlassButton>Apply for admission</GlassButton></Link>
          </div>
        </GlassCard>
      )}
    </main>
  );
}
