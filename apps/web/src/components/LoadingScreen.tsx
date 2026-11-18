export function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-4">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-violet-100 border-t-brand-600" />
        <p className="text-sm font-medium text-slate-500">Loading your workspace…</p>
      </div>
    </div>
  );
}
