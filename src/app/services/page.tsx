import { GlassCard } from "@/components/ui/glass";
import Link from "next/link";

export default function ServicesPage() {
  const services = [
    {
      title: "All Language Courses",
      description: "Comprehensive language programmes from beginner (A1) to advanced (C2) across English, French, German, Spanish, Italian, Kiswahili, Luganda, Chinese, Japanese and more. Small class sizes, native-speaker instructors, and flexible scheduling.",
      icon: "🌍",
    },
    {
      title: "Exam Preparation Support",
      description: "Targeted preparation for Goethe, DELF/DALF, IELTS, TOEFL, TestDaF, HSK and other international language exams. Mock exams, personalised study plans, and expert feedback.",
      icon: "📝",
    },
    {
      title: "Work and Study Abroad Guidance",
      description: "End-to-end guidance for studying or working abroad. We support Ausbildung (German vocational training) and Au Pair programmes, including application review, document preparation, and interview coaching.",
      icon: "✈️",
    },
    {
      title: "Visa Application Support",
      description: "Step-by-step visa application assistance: document checklists, form filling guidance, appointment booking support, and interview preparation for student and work visas.",
      icon: "🛂",
    },
  ];

  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <h1 className="display-font text-4xl font-bold mb-2">Our Services</h1>
      <p className="opacity-70 mb-8">Everything DLA offers to help you learn, grow and succeed.</p>
      <div className="grid md:grid-cols-2 gap-6">
        {services.map((s) => (
          <GlassCard key={s.title} className="p-6">
            <div className="text-4xl mb-3">{s.icon}</div>
            <h2 className="display-font text-xl font-bold mb-2">{s.title}</h2>
            <p className="text-sm opacity-80 leading-relaxed">{s.description}</p>
          </GlassCard>
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link href="/apply" className="btn-glass btn-glass-primary inline-flex px-6 py-3 font-semibold">Apply Now</Link>
      </div>
    </main>
  );
}
