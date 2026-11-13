import { GlassCard } from "@/components/ui/glass";
import { MaterialDeleteButton } from "@/components/material-delete-button";

export function ClassMaterialCard({ item, canDelete = false }: { canDelete?: boolean; item: {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  fileName?: string | null;
  type?: string | null;
  createdAt: Date;
  className: string | null;
} }) {
  const kind = item.type?.startsWith("video/") ? "Video" : item.type?.startsWith("audio/") ? "Audio" : "Document";
  return (
    <GlassCard className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="font-semibold">{item.title}</div><div className="text-sm opacity-65">{item.className ?? "Class"} · {kind} · {item.description ?? item.fileName ?? "Learning material"} · {item.createdAt.toLocaleDateString()}</div></div>
        <div className="flex items-center gap-3">{item.fileUrl && kind === "Document" && <a className="shrink-0 font-semibold underline" href={item.fileUrl}>Download</a>}{canDelete && <MaterialDeleteButton materialId={item.id} />}</div>
      </div>
      {item.fileUrl && kind === "Video" && <video className="mt-4 max-h-[32rem] w-full rounded-xl bg-black" src={item.fileUrl} controls preload="metadata" aria-label={item.title} />}
      {item.fileUrl && kind === "Audio" && <audio className="mt-4 w-full" src={item.fileUrl} controls preload="metadata" aria-label={item.title} />}
    </GlassCard>
  );
}
