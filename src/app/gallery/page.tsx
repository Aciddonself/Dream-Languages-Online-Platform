import { GlassCard } from "@/components/ui/glass";

const photographs = [
  { src: "hero-language-class.jpg", title: "Language class", alt: "Students participating in a DLA language class" },
  { src: "german-class.jpg", title: "German learners", alt: "Learners studying German" },
  { src: "language-learning.jpg", title: "Learning together", alt: "DLA language learners in class" },
  { src: "adult-literacy.jpg", title: "Adult literacy", alt: "Adult literacy learners at DLA" },
  { src: "classroom-learning.jpg", title: "Classroom learning", alt: "Students in a DLA classroom" },
  { src: "nursing-class.jpg", title: "Dream Nurses Class 2024", alt: "Dream Nurses Class 2024 at DLA" },
  { src: "learning-community.jpg", title: "DLA learning community", alt: "DLA students learning together" },
  { src: "course-language.jpg", title: "Language programme", alt: "Learners taking part in a DLA language programme" },
  { src: "adult-literacy.jpg", title: "Adult literacy", alt: "Adult literacy learners at DLA" },
  { src: "classroom-learning.jpg", title: "Classroom learning", alt: "Students in a DLA classroom" },
  { src: "edu-tours.jpg", title: "Edu-Tours", alt: "DLA Edu-Tours partner" },
];

export default function GalleryPage() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-2">DLA Gallery</h1>
      <p className="opacity-70 mb-6">Classes, programmes, and community moments from Dream Languages Uganda.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photographs.map((photo) => (
          <GlassCard className="overflow-hidden" key={photo.src}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="h-60 w-full object-cover" src={`/site-media/${photo.src}`} alt={photo.alt} loading="lazy" />
            <div className="p-4 font-semibold">{photo.title}</div>
          </GlassCard>
        ))}
      </div>
    </main>
  );
}
