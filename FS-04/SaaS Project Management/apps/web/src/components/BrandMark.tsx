export function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-600 shadow-lg shadow-violet-950/20">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" aria-hidden="true">
          <path d="M6 7.5h12M6 12h8M6 16.5h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className={`text-lg font-bold tracking-tight ${inverted ? "text-white" : "text-ink"}`}>Northstar</span>
    </div>
  );
}
