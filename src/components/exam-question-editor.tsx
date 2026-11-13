"use client";

import { useEffect, useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";

type Question = { prompt: string; options: string[]; correctAnswer: string; points: number };
type Exam = { id: string; title: string };

export function ExamQuestionEditor({ exams }: { exams: Exam[] }) {
  const [examId, setExamId] = useState(exams[0]?.id ?? "");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    fetch(`/api/academic/exams/${examId}/questions`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load questions.");
      if (!cancelled) setQuestions((data.questions ?? []).map((item: { prompt: string; options: unknown; correctAnswer: string | null; points: number }) => ({
        prompt: item.prompt,
        options: Array.isArray(item.options) ? item.options.filter((value): value is string => typeof value === "string") : [],
        correctAnswer: item.correctAnswer ?? "",
        points: item.points ?? 1,
      })));
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load questions."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [examId]);

  function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const options = String(data.get("options") ?? "").split("\n").map((value) => value.trim()).filter(Boolean);
    const question = { prompt: String(data.get("prompt") ?? "").trim(), options, correctAnswer: String(data.get("correctAnswer") ?? "").trim(), points: Number(data.get("points")) };
    if (options.length < 2) { setError("Add at least two answer options, one per line."); return; }
    if (!options.includes(question.correctAnswer)) { setError("Correct answer must exactly match one of the answer options."); return; }
    setQuestions((current) => [...current, question]); setError(""); setMessage(""); form.reset();
  }

  async function saveQuestions() {
    if (!examId || !questions.length) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/academic/exams/${examId}/questions`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questions }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save questions.");
      setMessage(`${data.count} question(s) saved. Students can now take the assessment.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save questions."); }
    finally { setBusy(false); }
  }

  return <section className="border-t border-white/10 pt-5">
    <h3 className="font-semibold mb-2">Online assessment questions</h3>
    <p className="mb-3 text-sm opacity-65">Create multiple-choice questions. Each question is auto-graded. Questions lock after the first student starts.</p>
    {!exams.length ? <p className="text-sm opacity-65">Create an assessment first.</p> : <>
      <select aria-label="Select assessment to edit" className="glass mb-4 w-full px-4 py-2.5" value={examId} onChange={(event) => { setLoading(true); setError(""); setMessage(""); setExamId(event.target.value); }}>
        {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
      </select>
      {loading ? <p className="text-sm opacity-65">Loading questions…</p> : <>
        <ol className="mb-4 space-y-2">{questions.map((question, index) => <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm" key={`${index}-${question.prompt}`}>
          <div><strong>{index + 1}. {question.prompt}</strong><div className="mt-1 opacity-65">{question.options.join(" · ")} · {question.points} point(s)</div></div>
          <button type="button" className="text-xs underline" onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
        </li>)}</ol>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={addQuestion}>
          <textarea name="prompt" aria-label="Question" placeholder="Question" className="glass min-h-20 rounded-xl px-4 py-3 text-sm md:col-span-2" maxLength={4000} required />
          <textarea name="options" aria-label="Answer options" placeholder={'Answer options, one per line\nParis\nBerlin\nRome'} className="glass min-h-24 rounded-xl px-4 py-3 text-sm" maxLength={4000} required />
          <div className="grid gap-3"><GlassInput name="correctAnswer" placeholder="Correct answer (must match an option)" maxLength={500} required /><GlassInput name="points" type="number" min={1} max={100} defaultValue={1} required /></div>
          <GlassButton type="submit" variant="glass">Add question</GlassButton>
        </form>
        <div className="mt-3"><GlassButton type="button" disabled={busy || loading || !questions.length} onClick={() => void saveQuestions()}>{busy ? "Saving…" : "Save question set"}</GlassButton></div>
      </>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    </>}
  </section>;
}
