const foundationItems = [
  "Tenant-aware data model",
  "Typed API foundation",
  "Containerized PostgreSQL",
];

export function App() {
  return (
    <main className="min-h-screen bg-canvas px-6 py-16 text-ink sm:px-10">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
        <div className="grid gap-12 px-8 py-12 md:grid-cols-[1.4fr_1fr] md:px-14 md:py-16">
          <div>
            <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-brand-600">
              Foundation ready
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
              Project management built for focused teams.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              A clean starting point for a secure, multi-tenant workspace where teams can plan projects and deliver work.
            </p>
          </div>

          <aside className="rounded-2xl bg-ink p-6 text-white" aria-label="Foundation status">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">System status</p>
            <ul className="mt-6 space-y-4">
              {foundationItems.map((item) => (
                <li className="flex items-center gap-3 text-sm" key={item}>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
