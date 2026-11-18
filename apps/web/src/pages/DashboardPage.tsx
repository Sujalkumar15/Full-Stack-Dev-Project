import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { BrandMark } from "../components/BrandMark";
import { ApiError, apiRequest } from "../lib/api";
import type { Workspace } from "../types/api";

export function DashboardPage() {
  const { workspaceId = "" } = useParams();
  const { user, logout } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ data: { workspace: Workspace } }>(`/workspaces/${workspaceId}`)
      .then((response) => { if (active) setWorkspace(response.data.workspace); })
      .catch((caught) => { if (active) setError(caught instanceof ApiError ? caught.message : "Unable to open this workspace."); });
    return () => { active = false; };
  }, [workspaceId]);

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"><BrandMark /><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 md:block">{user?.displayName ?? user?.email}</span><button onClick={() => void logout()} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Sign out</button></div></div></header>
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[230px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 lg:min-h-[calc(100vh-8rem)]"><Link to="/workspaces" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">← All workspaces</Link><div className="mt-5 border-t border-slate-100 pt-5"><p className="px-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Workspace</p><div className="mt-3 rounded-xl bg-violet-50 px-3 py-3"><p className="font-semibold text-ink">{workspace?.name ?? "Loading…"}</p><p className="mt-1 text-xs font-semibold text-brand-600">{workspace?.role ?? ""}</p></div></div><nav className="mt-5 space-y-1"><span className="flex rounded-xl bg-ink px-3 py-2.5 text-sm font-semibold text-white">Overview</span><span className="flex rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400">Projects · coming next</span></nav></aside>
        <section>
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert"><p className="font-semibold">Workspace unavailable</p><p className="mt-1 text-sm">{error}</p><Link to="/workspaces" className="mt-4 inline-flex text-sm font-semibold underline">Return to workspaces</Link></div> : null}
          {!error ? <><div className="rounded-3xl bg-ink p-8 text-white shadow-card sm:p-10"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-300">Workspace overview</p><h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Welcome to {workspace?.name ?? "your workspace"}</h1><p className="mt-4 max-w-2xl leading-7 text-slate-300">Your secure tenant is ready. Project planning and Kanban workflows will be added in the next implementation phase.</p></div><div className="mt-6 grid gap-5 sm:grid-cols-3">{[["Role", workspace?.role ?? "—"], ["Members", "Secure access"], ["Projects", "Coming next"]].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><p className="text-sm font-medium text-slate-400">{label}</p><p className="mt-2 text-lg font-bold text-ink">{value}</p></div>)}</div></> : null}
        </section>
      </div>
    </main>
  );
}
