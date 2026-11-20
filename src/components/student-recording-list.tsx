import { GlassCard } from "@/components/ui/glass";

type Recording = { id: string; title: string; description: string | null; fileName: string | null; createdAt: Date; className: string };

export function StudentRecordingList({ recordings }: { recordings: Recording[] }) {
  return <div className="grid gap-4">{recordings.map((recording) => <GlassCard className="p-4" key={recording.id}>
    <h2 className="font-semibold">{recording.title}</h2>
    <p className="mb-3 text-sm opacity-65">{recording.className} · Added {recording.createdAt.toLocaleDateString()}{recording.description ? ` · ${recording.description}` : ""}</p>
    <video className="max-h-[32rem] w-full rounded-xl bg-black" controls preload="metadata" src={`/api/portal/recordings/${recording.id}`} aria-label={recording.title} />
  </GlassCard>)}{!recordings.length && <GlassCard className="p-5 text-sm opacity-65">There are no recorded classes for your enrolled classes yet.</GlassCard>}</div>;
}
