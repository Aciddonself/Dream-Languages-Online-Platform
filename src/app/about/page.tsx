import Image from "next/image";
import { GlassCard } from "@/components/ui/glass";
import { getSiteImages } from "@/lib/site-images";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const images = await getSiteImages();
  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-4">About Dream Languages Uganda</h1>
      <GlassCard className="grid gap-6 p-6 md:grid-cols-2 md:p-8" strong>
        <div className="space-y-4">
          <p>Dream Languages And Adult Literacy Uganda Limited (DLA) is a language and adult education school in Kampala, Uganda, offering language learning and practical skills training for learners of all ages and backgrounds.</p>
          <p>Our learning approach supports flexible schedules, practical communication, and opportunities to use language skills in everyday and professional settings.</p>
          <h2 className="text-xl font-semibold">Our Mission</h2>
          <p>To provide accessible and quality adult education and language training that empowers individuals to achieve their personal and professional goals, enhance their knowledge and skills, and contribute to their communities.</p>
        </div>
        <div className="about-feature-image">
          <Image src={images.about_hero?.url ?? "/site-media/dla-about.jpg"} alt={images.about_hero?.altText ?? "Learners taking part in a DLA class"} fill quality={90} sizes="(max-width: 767px) 100vw, 50vw" unoptimized={Boolean(images.about_hero)} />
        </div>
      </GlassCard>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { name: "Emma Denis", file: "teacher-emma-denis.jpg", slot: "about_emma" as const },
          { name: "Dr. Regan Lugoloobi", file: "dr-regan-lugoloobi.jpg", slot: "about_regan" as const },
          { name: "Joseph Mabadiliko", file: "teacher-joseph-mabadiliko.jpg", slot: "about_joseph" as const },
          { name: "Hildburg", file: "teacher-hildburg.jpg", slot: "about_hildburg" as const },
        ].map(({ name, file, slot }) => (
          <GlassCard className="overflow-hidden" key={name}>
            <div className="people-photo-frame">
              <Image src={images[slot]?.url ?? `/site-media/${file}`} alt={images[slot]?.altText ?? name} fill quality={90} sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw" unoptimized={Boolean(images[slot])} />
            </div>
            <div className="p-4 font-semibold">{name}</div>
          </GlassCard>
        ))}
      </section>
    </main>
  );
}
