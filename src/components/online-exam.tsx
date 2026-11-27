"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Question = { id: string; prompt: string; options: string[]; points: number };
type AttemptPayload = { attempt: { status: string; deadline: string; answers: Record<string, string> }; questions: Question[] };

export function OnlineExam({ examId, eligible, existingStatus }: { examId: string; eligible: boolean; existingStatus?: string }) {
  const [status, setStatus] = useState<"ready" | "loading" | "in_progress" | "submitted">(existingStatus === "submitted" ? "submitted" : "ready");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const autoSubmitted = useRef(false);

  const send = useCallback(async (action: "start" | "save" | "submit", currentAnswers?: Record<string, string>) => {
    const response = await fetch(`/api/portal/exams/${examId}/attempt`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "start" ? { action } : { action, answers: currentAnswers ?? answers }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Assessment request failed.");
    return data;
  }, [examId, answers]);

  async function startOrResume() {
    setStatus("loading"); setError("");
    try {
      const data = await send("start") as AttemptPayload;
      autoSubmitted.current = false;
      setQuestions(data.questions);
      setAnswers(data.attempt.answers ?? {});
      setDeadline(new Date(data.attempt.deadline).getTime());
      if (data.attempt.status === "submitted") setStatus("submitted");
      else setStatus("in_progress");
    } catch (cause) { setStatus("ready"); setError(cause instanceof Error ? cause.message : "Could not start assessment."); }
  }

  async function submit(currentAnswers: Record<string, string>) {
    try {
      const data = await send("submit", currentAnswers);
      setStatus("submitted"); setError("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not submit assessment.";
      if (message.toLowerCase().includes("already been submitted")) { setStatus("submitted"); return; }
      setError(message);
    }
  }

  useEffect(() => {
    if (status !== "in_progress" || deadline === null) return;
    const tick = () => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [status, deadline]);

  useEffect(() => {
    if (status !== "in_progress" || deadline === null || seconds > 0 || Date.now() < deadline || autoSubmitted.current) return;
    autoSubmitted.current = true;
    void submit(answers);
    // Submit once when the server deadline is reached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, status, deadline, answers]);

  useEffect(() => {
    if (status !== "in_progress") return;
    const timer = window.setTimeout(() => {
      void send("save", answers).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not save answers."));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [answers, status, send]);

  if (status === "submitted") return <div className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm">Assessment submitted. Your teacher will review and publish the official result.</div>;
  if (status === "in_progress") return <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
    <div className="sticky top-2 z-10 flex items-center justify-between rounded-xl bg-[var(--surface)] p-3 shadow"><strong>Time left: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</strong><span className="text-xs opacity-65">Answers save automatically</span></div>
    {questions.map((question, index) => <fieldset key={question.id} className="rounded-xl border border-white/10 p-4">
      <legend className="px-1 text-sm font-semibold">{index + 1}. {question.prompt} <span className="font-normal opacity-60">({question.points} pt{question.points === 1 ? "" : "s"})</span></legend>
      <div className="mt-2 grid gap-2">{question.options.map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-white/5"><input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))} />{option}</label>)}</div>
    </fieldset>)}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="button" onClick={() => { if (window.confirm("Submit your assessment now? You cannot change answers afterward.")) void submit(answers); }} className="rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white">Submit assessment</button>
  </div>;

  return <div className="mt-3">
    <button type="button" disabled={!eligible || status === "loading"} onClick={() => void startOrResume()} className="rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{status === "loading" ? "Loading…" : existingStatus === "in_progress" ? "Resume assessment" : "Start assessment"}</button>
    {!eligible && <p className="mt-2 text-xs opacity-65">Meet the attendance or fee requirement before starting.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
