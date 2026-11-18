import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { BrandMark } from "../components/BrandMark";
import { ApiError, apiRequest } from "../lib/api";
import type { Workspace } from "../types/api";

export function WorkspacesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const notice = (location.state as { notice?: string } | null)?.notice;

  useEffect(() => {
    let active = true;
    apiRequest<{ data: { workspaces: Workspace[] } }>("/workspaces")
      .then((response) => { if (active) setWorkspaces(response.data.workspaces); })
      .catch((caught) => { if (active) setError(caught instanceof ApiError ? caught.message : "Unable to load your workspaces."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  function selectWorkspace(workspace: Workspace) {
    localStorage.setItem("selectedWorkspaceId", workspace.id);
    navigate(`/workspaces/${workspace.id}/dashboard`);
  }

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <BrandMark />
          <div className="flex items-center gap-4"><span className="hidden text-sm text-slate-500 sm:block">{user?.email}</span><button onClick={() => void logout()} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-ink">Sign out</button></div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        {notice ? <div className="mb-7 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">{notice}</div> : null}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Your organization</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">Choose a workspace</h1><p className="mt-3 max-w-xl text-slate-500">Each workspace keeps its members, roles, and project data securely separated.</p></div>
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500">{workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}</div>
        </div>
        {error ? <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700" role="alert">{error}</div> : null}
        {isLoading ? <div className="mt-10 grid gap-5 md:grid-cols-2"><div className="h-44 animate-pulse rounded-2xl bg-slate-200/70" /><div className="h-44 animate-pulse rounded-2xl bg-slate-200/70" /></div> : null}
        {!isLoading && !error ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {workspaces.map((workspace) => (
              <button key={workspace.id} onClick={() => selectWorkspace(workspace)} className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-card transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-xl hover:shadow-slate-200/50">
                <div className="flex items-start justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-lg font-bold text-brand-600">{workspace.name.charAt(0).toUpperCase()}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tracking-wide text-slate-600">{workspace.role}</span></div>
                <h2 className="mt-5 text-xl font-bold text-ink">{workspace.name}</h2><p className="mt-1 text-sm text-slate-400">{workspace.slug}</p><div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-brand-600"><span>Open workspace</span><span className="transition group-hover:translate-x-1">→</span></div>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
