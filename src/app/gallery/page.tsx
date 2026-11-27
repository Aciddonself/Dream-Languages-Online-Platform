import Image from "next/image";
import { GlassCard } from "@/components/ui/glass";
import { getSiteImages } from "@/lib/site-images";
import { SITE_IMAGE_SLOTS } from "@/lib/site-image-slots";

export const dynamic = "force-dynamic";

const photographs = [
  { slot: "gallery_class", title: "Language class" },
  { slot: "gallery_german", title: "German learners" },
  { slot: "gallery_learning", title: "Learning together" },
  { slot: "gallery_literacy", title: "Adult literacy" },
  { slot: "gallery_classroom", title: "Classroom learning" },
  { slot: "gallery_nursing", title: "Dream Nurses Class 2024" },
  { slot: "gallery_community", title: "DLA learning community" },
  { slot: "gallery_course", title: "Language programme" },
  { slot: "gallery_edu_tours", title: "Edu-Tours" },
] as const;

export default async function GalleryPage() {
  const images = await getSiteImages();
  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-2">DLA Gallery</h1>
      <p className="opacity-70 mb-6">Classes, programmes, and community moments from Dream Languages Uganda.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photographs.map((photo) => {
          const image = images[photo.slot];
          const fallback = SITE_IMAGE_SLOTS.find((slot) => slot.id === photo.slot)?.fallback ?? "/site-media/hero-language-class.jpg";
          return <GlassCard className="overflow-hidden" key={photo.slot}>
            <div className="gallery-photo-frame">
              <Image className="gallery-photo" src={image?.url ?? fallback} alt={image?.altText ?? photo.title} fill quality={90} sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" unoptimized={Boolean(image)} />
            </div>
            <div className="p-4 font-semibold">{photo.title}</div>
          </GlassCard>;
        })}
      </div>
    </main>
  );
}
