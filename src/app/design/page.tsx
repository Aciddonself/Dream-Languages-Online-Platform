import { GlassCard, GlassButton, GlassInput, Badge } from "@/components/ui/glass";
import { StudentIdCard } from "@/components/id-card";
import { ResultsSlip } from "@/components/results-slip";
import Link from "next/link";

export default function DesignPage() {
  return (
    <main className="min-h-screen px-6 py-10 max-w-6xl mx-auto space-y-10">
      <h1 className="display-font text-4xl font-bold">Design System Showcase</h1>
      <p className="opacity-70">Liquid Glass interface components — Apple iOS 27</p>

      <section>
        <h2 className="text-2xl font-bold mb-3">Glass Cards</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <GlassCard className="p-5 tilt" tilt><div className="font-semibold">Default Glass</div><p className="text-sm opacity-70 mt-1">Frosted surface with specular highlight.</p></GlassCard>
          <GlassCard className="p-5" strong><div className="font-semibold">Strong Glass</div><p className="text-sm opacity-70 mt-1">Higher blur for modals/sidebars.</p></GlassCard>
          <GlassCard className="p-5"><div className="font-semibold">Badges</div><div className="flex flex-wrap gap-2 mt-2"><Badge tone="primary">Primary</Badge><Badge tone="success">Paid</Badge><Badge tone="warning">Hold</Badge><Badge tone="danger">Overdue</Badge></div></GlassCard>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-3">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <GlassButton>Primary glass</GlassButton>
          <GlassButton variant="glass">Glass</GlassButton>
          <GlassButton variant="ghost">Ghost</GlassButton>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <span className="text-sm">Toggle:</span>
          <div className="toggle" data-on="false" />
          <div className="toggle" data-on="true" />
        </div>
        <div className="mt-4 max-w-xs">
          <GlassInput placeholder="Glass input field" />
        </div>
        <div className="mt-4 max-w-xs">
          <div className="progress-tube"><span style={{ width: "62%" }} /></div>
        </div>
        <div className="mt-4 flex gap-3">
          <span className="stamp text-[#16a08b] border-[#16a08b]">PAID</span>
          <span className="stamp text-[#cf2e2e] border-[#cf2e2e]">ON HOLD</span>
          <span className="stamp text-[var(--info)] border-[var(--info)]">CLEARED</span>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-3">Vocabulary Flashcard (3D flip)</h2>
        <div className="flip-card w-64 h-40 cursor-pointer">
          <div className="flip-card-inner">
            <div className="flip-face glass flex items-center justify-center text-2xl font-bold">Hallo</div>
            <div className="flip-face flip-back glass flex items-center justify-center text-xl">Hello (English)</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-3">Study notes surface</h2>
        <div className="notebook p-4 rounded-md max-w-md">
          <p>My personal study notes go here, line by line...</p>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-3">Student ID Card</h2>
        <StudentIdCard name="Kamoga Ronald" registrationNumber="DLA/2026/GER/0042" department="German" level="A1" />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-3">Results Slip</h2>
        <ResultsSlip
          studentName="Kamoga Ronald"
          registrationNumber="DLA/2026/GER/0042"
          className="German A1 - Morning"
          term="Term 1 2026"
          subjects={[
            { name: "Grammar", score: 82, grade: "A" },
            { name: "Vocabulary", score: 75, grade: "B" },
            { name: "Listening", score: 68, grade: "C" },
            { name: "Speaking", score: 90, grade: "A" },
          ]}
          average={78.75}
          grade="B"
          verifyCode="DLA-VERIFY-0042"
        />
      </section>

      <Link href="/" className="text-[var(--brand-primary)]">← Back home</Link>
    </main>
  );
}