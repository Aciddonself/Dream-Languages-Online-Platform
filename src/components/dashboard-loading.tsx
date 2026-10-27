export function DashboardLoading({ title }: { title: string }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 md:px-8" aria-busy="true">
      <section role="status" aria-label={title}>
        <p className="mb-6 text-sm opacity-70">{title}</p>
        <div className="skeleton mb-6 h-9 w-56" />
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="glass space-y-4 rounded-xl p-5" key={index}>
              <div className="skeleton h-3 w-2/3" />
              <div className="skeleton h-8 w-1/3" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass skeleton h-56 rounded-xl md:col-span-2" />
          <div className="glass skeleton h-56 rounded-xl" />
        </div>
        <span className="sr-only">Please wait while your dashboard loads.</span>
      </section>
    </main>
  );
}
