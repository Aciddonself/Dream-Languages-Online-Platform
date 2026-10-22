export function ResultsSlip({
  studentName,
  registrationNumber,
  className,
  term,
  subjects,
  average,
  grade,
  verifyCode,
}: {
  studentName: string;
  registrationNumber: string;
  className: string;
  term: string;
  subjects: { name: string; score: number; grade: string }[];
  average: number;
  grade: string;
  verifyCode: string;
}) {
  return (
    <div
      className="rounded-2xl p-6 max-w-md mx-auto glass"
      style={{ background: "var(--surface-strong)" }}
    >
      <div className="text-center border-b border-[var(--border-strong)] pb-3 mb-4">
        <div className="text-xs uppercase tracking-widest opacity-60">Dream Languages Uganda</div>
        <div className="text-lg font-bold">Results Slip</div>
        <div className="text-xs opacity-60">{term}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <div><span className="opacity-60">Name:</span> <b>{studentName}</b></div>
        <div><span className="opacity-60">Reg No:</span> <b>{registrationNumber}</b></div>
        <div><span className="opacity-60">Class:</span> <b>{className}</b></div>
        <div><span className="opacity-60">Verify:</span> <b className="font-mono text-xs">{verifyCode}</b></div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-strong)]">
            <th className="text-left py-1">Subject</th>
            <th className="text-right py-1">Score</th>
            <th className="text-right py-1">Grade</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => (
            <tr key={s.name} className="border-b border-[var(--border)]">
              <td className="py-1">{s.name}</td>
              <td className="text-right py-1">{s.score}</td>
              <td className="text-right py-1 font-semibold">{s.grade}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="text-xs opacity-60">Average</div>
          <div className="text-xl font-bold">{average.toFixed(1)}%</div>
        </div>
        <div className="text-center">
          <div className="text-xs opacity-60">Overall Grade</div>
          <div className="text-2xl font-bold text-[var(--brand-primary)]">{grade}</div>
        </div>
        <span className="stamp text-[var(--success)]">CLEARED</span>
      </div>
      <div className="mt-4 text-[10px] text-center opacity-60">
        Verify this slip at /verify/{verifyCode}
      </div>
    </div>
  );
}