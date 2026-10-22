import Link from "next/link";
import { GlassCard, GlassButton } from "@/components/ui/glass";
import { getPublishedNews } from "@/lib/public-content";

export const revalidate = 60;

export default async function BlogPage() {
  const posts = await getPublishedNews();
  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-2">News & stories</h1>
      <p className="opacity-70 mb-6">Language learning, adult literacy, events, and updates from the DLA community.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {posts.map((post) => (
          <GlassCard className="overflow-hidden" key={post.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverUrl || "/site-media/learning-community.jpg"} alt="" className="h-48 w-full object-cover" loading="lazy" />
            <div className="p-5">
              {post.category && <div className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">{post.category}</div>}
              <h2 className="font-semibold">{post.title}</h2>
              <p className="mt-2 text-sm opacity-70">{post.excerpt ?? post.body?.slice(0, 180) ?? "News from Dream Languages and Adult Literacy."}</p>
              {post.body && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Read story</summary><p className="mt-2 whitespace-pre-wrap opacity-80">{post.body}</p></details>}
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
