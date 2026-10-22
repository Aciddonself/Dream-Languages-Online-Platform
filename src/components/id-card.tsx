import { cn } from "@/lib/utils";

export function StudentIdCard({
  name,
  registrationNumber,
  department,
  level,
  photoUrl,
}: {
  name: string;
  registrationNumber: string;
  department: string;
  level: string;
  photoUrl?: string;
}) {
  return (
    <div
      className="relative w-[340px] max-w-full rounded-2xl overflow-hidden select-none glass"
      style={{ background: "var(--surface-strong)" }}
    >
      <div
        className="h-2 w-full"
        style={{ background: "linear-gradient(90deg, var(--brand-primary), var(--brand-accent))" }}
      />
      <div className="relative p-5">
        <div className="flex items-center gap-3 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dla-logo.png"
            alt="DLA"
            className="h-9 w-auto"
          />
          <div>
            <div className="text-xs uppercase tracking-widest opacity-70">Dream Languages Uganda</div>
            <div className="text-sm font-bold">Student Identity Card</div>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div             className="w-20 h-24 rounded-lg overflow-hidden glass flex items-center justify-center">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">👤</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold truncate">{name}</div>
            <div className="text-xs opacity-70 mt-1">Registration No.</div>
            <div className="font-mono text-sm font-semibold tracking-wider">{registrationNumber}</div>
            <div className="text-xs opacity-70 mt-2">{department} · {level}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-[10px] opacity-60">Valid for current academic year</div>
          <div className="glass p-1 rounded">
            <div className="w-12 h-12 grid grid-cols-4 gap-px">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className={cn("bg-[var(--brand-secondary)]", (i * 7 + 3) % 5 === 0 ? "opacity-20" : "opacity-80")} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}