export default function AdminDashboardLoading() {
  return (
    <main className="min-h-screen px-5 py-10 md:px-8" aria-busy="true">
      <div className="mx-auto max-w-7xl">
        <div role="status" className="mb-8 flex items-center gap-3 text-sm font-semibold">
          <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
          <span>Loading administrator dashboard…</span>
        </div>
        <span className="sr-only">Loading administrator dashboard</span>
        <div aria-hidden="true" className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="glass h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div aria-hidden="true" className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="glass h-64 animate-pulse rounded-2xl md:col-span-2" />
          <div className="glass h-64 animate-pulse rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
