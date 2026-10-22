import { GlassCard } from "@/components/ui/glass";
export default function AboutPage() {
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/site-media/dla-about.jpg" alt="Learners taking part in a DLA class" className="h-full min-h-64 w-full rounded-2xl object-cover" />
      </GlassCard>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Emma Denis", "teacher-emma-denis.jpg"],
          ["Dr. Regan Lugoloobi", "dr-regan-lugoloobi.jpg"],
          ["Joseph Mabadiliko", "teacher-joseph-mabadiliko.jpg"],
          ["Hildburg", "teacher-hildburg.jpg"],
        ].map(([name, image]) => (
          <GlassCard className="overflow-hidden" key={name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/site-media/${image}`} alt={name} className="h-56 w-full object-cover" loading="lazy" />
            <div className="p-4 font-semibold">{name}</div>
          </GlassCard>
        ))}
      </section>
    </main>
  );
}