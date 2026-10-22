import { GlassCard } from "@/components/ui/glass";
import { getPublishedFaqs } from "@/lib/public-content";

export const revalidate = 60;

export default async function FaqsPage() {
  const list = await getPublishedFaqs();
  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <h1 className="display-font text-3xl font-bold mb-4">FAQs</h1>
      <div className="space-y-3">
        {(list.length ? list : [{
          id: "languages",
          question: "Which languages and programmes does DLA offer?",
          answer: "DLA provides international languages such as German, French, Spanish, Chinese (Mandarin), Arabic, and Dutch, as well as Kiswahili and local languages including Luganda and Runyakitara. Adult literacy and practical skills programmes are also available.",
        }]).map((f) => (
          <GlassCard key={f.id} className="p-5">
            <div className="font-semibold">{f.question}</div>
            <div className="text-sm opacity-70 mt-1">{f.answer}</div>
          </GlassCard>
        ))}
      </div>
    </main>
  );
}