export function AttendanceRing({ percentage, hasSessions }: { percentage: number; hasSessions: boolean }) {
  const display = hasSessions ? `${percentage}%` : "—";
  const label = hasSessions
    ? `Attendance for completed classes: ${percentage}%`
    : "Attendance is available after your first completed class";

  return (
    <div className="attendance-ring-wrap" role="img" aria-label={label}>
      <svg className="attendance-ring" viewBox="0 0 120 120" aria-hidden="true">
        <circle className="attendance-ring-track" cx="60" cy="60" r="48" pathLength="100" />
        <circle
          className="attendance-ring-value"
          cx="60"
          cy="60"
          r="48"
          pathLength="100"
          strokeDasharray={`${hasSessions ? percentage : 0} 100`}
        />
      </svg>
      <span className="attendance-ring-label">
        <strong>{display}</strong>
        <small>attendance</small>
      </span>
    </div>
  );
}
