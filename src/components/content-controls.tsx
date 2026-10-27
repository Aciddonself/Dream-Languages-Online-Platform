"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { GlassButton, GlassInput } from "@/components/ui/glass";

async function post(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Something went wrong. Please try again.");
  return result;
}

export function PartnerAdd() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      await post("/api/admin/content", { action: "add_partner", name: data.get("name"), website: data.get("website") ?? "", logoUrl: data.get("logoUrl") ?? "" });
      toast.success(`Partner "${String(data.get("name"))}" added to the website.`);
      form.reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the partner.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <GlassInput name="name" placeholder="Partner name" maxLength={160} required />
      <GlassInput name="website" type="url" placeholder="Website (https://...) optional" maxLength={300} />
      <GlassInput name="logoUrl" type="url" placeholder="Logo image URL (optional)" maxLength={500} />
      <GlassButton type="submit" disabled={busy}>{busy ? "Adding..." : "Add partner"}</GlassButton>
    </form>
  );
}

export function PartnerRemove({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Remove ${name} from the website?`)) return;
    setBusy(true);
    try {
      await post("/api/admin/content", { action: "remove_partner", id });
      toast.success(`${name} was removed.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the partner.");
    } finally {
      setBusy(false);
    }
  }

  return <button className="text-xs font-semibold underline" disabled={busy} onClick={() => void remove()}>Remove</button>;
}

export function TeacherRatingDecision({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(action: "approve_teacher_rating" | "reject_teacher_rating") {
    setBusy(true);
    try {
      await post("/api/admin/content", { action, id });
      toast.success(action === "approve_teacher_rating" ? "Rating published on the website." : "Rating rejected.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the rating.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-3">
      <button className="text-xs font-semibold underline" disabled={busy} onClick={() => void decide("approve_teacher_rating")}>Approve</button>
      <button className="text-xs font-semibold underline" disabled={busy} onClick={() => void decide("reject_teacher_rating")}>Reject</button>
    </div>
  );
}

export function TeacherRatingForm({ teachers }: { teachers: { id: string; name: string }[] }) {
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const result = await post("/api/portal/teacher-ratings", {
        teacherId: data.get("teacherId"),
        rating: Number(data.get("rating")),
        comment: String(data.get("comment") ?? "") || undefined,
      });
      toast.success(result.message ?? "Rating submitted.");
      form.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your rating.");
    } finally {
      setBusy(false);
    }
  }

  if (!teachers.length) return <p className="text-sm opacity-70">No teachers are available to rate yet.</p>;
  return (
    <form className="space-y-3" onSubmit={submit}>
      <select className="glass w-full rounded-xl px-3 py-2.5 text-sm" name="teacherId" required defaultValue="">
        <option value="" disabled>Choose a teacher</option>
        {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select className="glass rounded-xl px-3 py-2.5 text-sm" name="rating" defaultValue="5">
        <option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option>
      </select>
      <textarea className="glass min-h-24 w-full rounded-xl px-4 py-3 text-sm" name="comment" maxLength={600} placeholder="Say something about your teacher (optional)" />
      <p className="text-xs opacity-65">Ratings are shown on the website only after an administrator approves them. Rating the same teacher again replaces your earlier rating.</p>
      <GlassButton type="submit" disabled={busy}>{busy ? "Submitting..." : "Submit rating"}</GlassButton>
    </form>
  );
}
