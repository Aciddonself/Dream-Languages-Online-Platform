"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { GlassButton, GlassInput } from "@/components/ui/glass";

type ClassOption = { id: string; name: string };
type ExamOption = { id: string; title: string; assessmentType: string; classId: string | null };
type StudentOption = { id: string; name: string; classId: string; className: string };

export function AssessmentManager({
  classes,
  exams,
  students,
  canReviewPromotion,
}: {
  classes: ClassOption[];
  exams: ExamOption[];
  students: StudentOption[];
  canReviewPromotion: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setMessage("");
    setBusy(true);
    const data = new FormData(form);
    try {
      const response = await fetch("/api/academic/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          description: data.get("description"),
          classId: data.get("classId"),
          assessmentType: data.get("assessmentType"),
          startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : undefined,
          endsAt: data.get("endsAt") ? new Date(String(data.get("endsAt"))).toISOString() : undefined,
          durationMinutes: Number(data.get("durationMinutes")),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Could not create assessment.");
        return;
      }
      setMessage("Assessment published for the selected class.");
      form.reset();
      router.refresh();
    } catch {
      setError("Unable to create the assessment. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function publishResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setMessage("");
    setBusy(true);
    const data = new FormData(form);
    try {
      const response = await fetch("/api/academic/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: data.get("examId"),
          studentId: data.get("studentId"),
          score: Number(data.get("score")),
          grade: data.get("grade"),
          comments: data.get("comments"),
          specialCase: data.get("specialCase") === "on",
          specialCaseReason: data.get("specialCaseReason"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Could not publish result.");
        return;
      }
      setMessage(result.promotionStatus === "promoted"
        ? `Result published. Student promoted to the next level. ${result.promotionReason}`
        : result.promotionStatus
          ? `Result published. Promotion status: ${result.promotionStatus}. ${result.promotionReason ?? ""}`
          : "Result published.");
      form.reset();
      router.refresh();
    } catch {
      setError("Unable to publish the result. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function correctResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setMessage("");
    setBusy(true);
    const data = new FormData(form);
    try {
      const response = await fetch("/api/academic/results", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: data.get("correctionExamId"),
          studentId: data.get("correctionStudentId"),
          score: Number(data.get("correctionScore")),
          grade: data.get("correctionGrade"),
          comments: data.get("correctionComments"),
          reason: data.get("correctionReason"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Could not correct published marks.");
        return;
      }
      setMessage("Published mark corrected and the change recorded in the audit log.");
      form.reset();
      router.refresh();
    } catch {
      setError("Unable to correct the published mark. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={createAssessment}>
        <GlassInput name="title" placeholder="Assessment title" maxLength={160} required />
        <select className="glass w-full px-4 py-2.5" name="classId" defaultValue="" required>
          <option value="">Select class</option>
          {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
        </select>
        <select className="glass w-full px-4 py-2.5" name="assessmentType" defaultValue="test">
          <option value="test">Test</option><option value="exam">Examination</option><option value="final_exam">Final examination</option>
        </select>
        <GlassInput name="durationMinutes" type="number" min={5} max={480} defaultValue={60} required />
        <GlassInput name="startsAt" type="datetime-local" aria-label="Assessment start time" />
        <GlassInput name="endsAt" type="datetime-local" aria-label="Assessment end time" />
        <GlassInput name="description" placeholder="Instructions or description (optional)" maxLength={2000} />
        <GlassButton type="submit" disabled={busy || !classes.length}>{busy ? "Saving..." : "Create and publish assessment"}</GlassButton>
      </form>

      <div className="border-t border-white/10 pt-5">
        <h3 className="font-semibold mb-3">Publish assessment result</h3>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={publishResult}>
          <select className="glass w-full px-4 py-2.5" name="examId" defaultValue="" required>
            <option value="">Select assessment</option>
            {exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.title} ({exam.assessmentType.replaceAll("_", " ")})</option>)}
          </select>
          <select className="glass w-full px-4 py-2.5" name="studentId" defaultValue="" required>
            <option value="">Select enrolled student</option>
            {students.map((student) => <option key={`${student.classId}:${student.id}`} value={student.id}>{student.className} · {student.name}</option>)}
          </select>
          <GlassInput name="score" type="number" min={0} max={100} placeholder="Score (%)" required />
          <GlassInput name="grade" placeholder="Grade (optional)" maxLength={8} />
          <GlassInput name="comments" placeholder="Teacher comments (optional)" maxLength={2000} />
          {canReviewPromotion && (
            <>
              <label className="flex items-center gap-2 text-sm"><input name="specialCase" type="checkbox" /> Record a promotion exception</label>
              <GlassInput name="specialCaseReason" placeholder="Required reason for exception" maxLength={1000} />
            </>
          )}
          <GlassButton type="submit" disabled={busy || !exams.length || !students.length}>{busy ? "Publishing..." : "Publish result"}</GlassButton>
        </form>
      </div>

      {canReviewPromotion && (
        <div className="border-t border-white/10 pt-5">
          <h3 className="font-semibold mb-3">Correct a published mark</h3>
          <p className="mb-3 text-sm opacity-70">Corrections are audited. A corrected final-exam pass requires academic review before class progression; already-promoted students need an administrative placement review.</p>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={correctResult}>
            <select className="glass w-full px-4 py-2.5" name="correctionExamId" defaultValue="" required>
              <option value="">Select assessment</option>
              {exams.map((exam) => <option key={`correction-${exam.id}`} value={exam.id}>{exam.title} ({exam.assessmentType.replaceAll("_", " ")})</option>)}
            </select>
            <select className="glass w-full px-4 py-2.5" name="correctionStudentId" defaultValue="" required>
              <option value="">Select student</option>
              {students.map((student) => <option key={`correction-${student.classId}:${student.id}`} value={student.id}>{student.className} · {student.name}</option>)}
            </select>
            <GlassInput name="correctionScore" type="number" min={0} max={100} placeholder="Correct score (%)" required />
            <GlassInput name="correctionGrade" placeholder="Correct grade (optional)" maxLength={8} />
            <GlassInput name="correctionComments" placeholder="Corrected comments (optional)" maxLength={2000} />
            <GlassInput name="correctionReason" placeholder="Reason for correction (required)" minLength={3} maxLength={1000} required />
            <GlassButton type="submit" disabled={busy || !exams.length || !students.length}>{busy ? "Saving..." : "Save mark correction"}</GlassButton>
          </form>
        </div>
      )}

      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      {message && <p className="text-sm text-[var(--success)]" role="status">{message}</p>}
    </div>
  );
}
