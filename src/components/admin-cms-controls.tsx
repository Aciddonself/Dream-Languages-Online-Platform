"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GlassButton, GlassInput } from "@/components/ui/glass";

export type CmsPage = {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  status: "draft" | "preview" | "published" | "unpublished" | "archived";
  seoTitle: string | null;
  seoDescription: string | null;
  version: number;
};

async function submitCms(url: string, method: "POST" | "PATCH", payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json() as { error?: string | { formErrors?: string[]; fieldErrors?: Record<string, string[]> } };
  if (!response.ok) {
    const error = result.error;
    const message = typeof error === "string" ? error
      : error?.formErrors?.[0] ?? Object.values(error?.fieldErrors ?? {}).flat()[0];
    throw new Error(message ?? "Could not save the website content.");
  }
}

export function AdminNewsCreate() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/cms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "news",
          title: data.get("title"),
          slug: data.get("slug"),
          excerpt: data.get("excerpt"),
          body: data.get("body"),
          status: data.get("status"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "Could not save this website update.");
        return;
      }
      setSuccess(`Website update saved as ${result.post.status}.`);
      form.reset();
      router.refresh();
    } catch {
      setError("Unable to save the website update.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <GlassInput name="title" placeholder="News/update title" maxLength={180} required />
      <GlassInput name="slug" placeholder="Website slug (optional)" maxLength={128} />
      <GlassInput name="excerpt" placeholder="Short preview (optional)" maxLength={500} />
      <textarea className="glass min-h-36 w-full rounded-xl px-4 py-3 text-sm" name="body" placeholder="Website update" maxLength={20000} required />
      <select className="glass w-full rounded-xl px-3 py-2.5" name="status" defaultValue="draft">
        <option value="draft">Save as draft</option><option value="published">Publish to website</option>
      </select>
      <GlassButton type="submit" disabled={busy}>{busy ? "Saving..." : "Save website update"}</GlassButton>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
      {success && <p className="text-sm text-[var(--success)]" role="status">{success}</p>}
    </form>
  );
}

export function AdminCmsPageCreate() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await submitCms("/api/admin/cms", "POST", {
        kind: "page",
        title: data.get("title"),
        slug: data.get("slug"),
        body: data.get("body"),
        seoTitle: data.get("seoTitle"),
        seoDescription: data.get("seoDescription"),
        status: data.get("status"),
      });
      form.reset();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the page.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <GlassInput name="title" placeholder="Page title" maxLength={180} required />
      <GlassInput name="slug" placeholder="Page URL, e.g. about-dla (optional)" maxLength={128} />
      <textarea className="glass min-h-36 w-full rounded-xl px-4 py-3 text-sm" name="body" placeholder="Page content (plain text)" maxLength={30000} required />
      <GlassInput name="seoTitle" placeholder="SEO title (optional)" maxLength={180} />
      <textarea className="glass min-h-20 w-full rounded-xl px-4 py-3 text-sm" name="seoDescription" placeholder="SEO description (optional)" maxLength={320} />
      <select className="glass w-full rounded-xl px-3 py-2.5" name="status" defaultValue="draft">
        <option value="draft">Save as draft</option>
        <option value="published">Publish page</option>
      </select>
      <GlassButton type="submit" disabled={busy}>{busy ? "Saving..." : "Create website page"}</GlassButton>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
    </form>
  );
}

export function AdminCmsPageEditor({ page }: { page: CmsPage }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await submitCms("/api/admin/cms", "PATCH", {
        action: "save_page",
        pageId: page.id,
        expectedVersion: page.version,
        title: data.get("title"),
        slug: data.get("slug"),
        body: data.get("body"),
        seoTitle: data.get("seoTitle"),
        seoDescription: data.get("seoDescription"),
        status: data.get("status"),
      });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the page.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3 rounded-xl border border-white/10 p-4" onSubmit={submit}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs opacity-70">
        <span>Version {page.version} · {page.status}</span>
        {page.status === "published" && <a className="underline" href={`/pages/${page.slug}`} target="_blank" rel="noreferrer">View published page</a>}
      </div>
      <GlassInput name="title" aria-label="Page title" defaultValue={page.title} maxLength={180} required />
      <GlassInput name="slug" aria-label="Page URL slug" defaultValue={page.slug} maxLength={128} required />
      <textarea className="glass min-h-36 w-full rounded-xl px-4 py-3 text-sm" name="body" aria-label="Page content" defaultValue={page.body ?? ""} maxLength={30000} required />
      <GlassInput name="seoTitle" aria-label="SEO title" defaultValue={page.seoTitle ?? ""} maxLength={180} />
      <textarea className="glass min-h-20 w-full rounded-xl px-4 py-3 text-sm" name="seoDescription" aria-label="SEO description" defaultValue={page.seoDescription ?? ""} maxLength={320} />
      <div className="flex flex-wrap gap-3">
        <select className="glass min-w-40 rounded-xl px-3 py-2.5" name="status" defaultValue={page.status}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
          <option value="archived">Archived</option>
        </select>
        <GlassButton type="submit" disabled={busy}>{busy ? "Saving..." : "Save page"}</GlassButton>
      </div>
      {error && <p className="text-sm text-[var(--danger)]" role="alert">{error}</p>}
    </form>
  );
}

export function AdminReviewDecision({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(action: "approve_review" | "reject_review") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/cms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewId }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not update review status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to update this review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="text-xs font-semibold underline" disabled={busy} onClick={() => void decide("approve_review")}>Approve</button>
      <button className="text-xs font-semibold underline" disabled={busy} onClick={() => void decide("reject_review")}>Reject</button>
      {error && <span className="text-xs text-[var(--danger)]" role="alert">{error}</span>}
    </div>
  );
}
