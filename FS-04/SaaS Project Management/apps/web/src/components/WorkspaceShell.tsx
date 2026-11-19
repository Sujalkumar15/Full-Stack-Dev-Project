import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import type { Project, Workspace } from "../types/api";
import { BrandMark } from "./BrandMark";

interface WorkspaceShellProps {
  workspace: Workspace;
  projects: Project[];
  activeProjectId?: string;
  onCreateProject?: () => void;
  children: ReactNode;
}

export function WorkspaceShell({ workspace, projects, activeProjectId, onCreateProject, children }: WorkspaceShellProps) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const canManageProjects = workspace.role === "OWNER" || workspace.role === "ADMIN";
  const initials = (user?.displayName ?? user?.email ?? "U").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col bg-ink text-white">
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
        <BrandMark inverted />
        <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation">×</button>
      </div>
      <div className="px-4 pt-5">
        <Link to="/workspaces" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">← Switch workspace</Link>
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-brand-600 text-sm font-black">{workspace.name.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0"><p className="truncate text-sm font-bold">{workspace.name}</p><p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-300">{workspace.role}</p></div>
          </div>
        </div>
      </div>
      <nav className="mt-6 min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
        <Link onClick={() => setSidebarOpen(false)} to={`/workspaces/${workspace.id}/dashboard`} className={`mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${!activeProjectId ? "bg-white text-ink" : "text-slate-300 hover:bg-white/[0.07] hover:text-white"}`}><span aria-hidden>⌂</span> Overview</Link>
        <div className="mt-7 flex items-center justify-between px-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Projects</p>
          {canManageProjects && onCreateProject ? <button onClick={onCreateProject} className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-lg text-slate-300 hover:bg-white/20 hover:text-white" aria-label="Create project">+</button> : null}
        </div>
        <div className="mt-2 space-y-1">
          {projects.map((project) => (
            <Link key={project.id} onClick={() => setSidebarOpen(false)} to={`/workspaces/${workspace.id}/projects/${project.id}`} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${activeProjectId === project.id ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-white/[0.07] hover:text-white"}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-black ${activeProjectId === project.id ? "bg-white/15" : "bg-white/[0.07] text-slate-400"}`}>{project.key.slice(0, 3)}</span>
              <span className="truncate">{project.name}</span>
            </Link>
          ))}
          {!projects.length ? <p className="px-3 py-3 text-xs leading-5 text-slate-500">No projects in this workspace yet.</p> : null}
        </div>
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="relative">
          <button onClick={() => setAccountOpen((value) => !value)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[0.07]" aria-expanded={accountOpen}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-200 text-xs font-black text-brand-700">{initials}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{user?.displayName ?? "Account"}</span><span className="block truncate text-xs text-slate-400">{user?.email}</span></span><span className="text-slate-500">•••</span>
          </button>
          {accountOpen ? <div className="absolute bottom-14 left-0 right-0 rounded-xl border border-slate-200 bg-white p-1.5 text-ink shadow-xl"><button onClick={() => void logout()} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50">Sign out</button></div> : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 lg:block">{sidebar}</aside>
      {sidebarOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-ink/55 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" /><aside className="relative h-full w-[min(88vw,19rem)] shadow-2xl">{sidebar}</aside></div> : null}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setSidebarOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-lg text-ink" aria-label="Open navigation">☰</button>
        <p className="max-w-[55vw] truncate text-sm font-bold text-ink">{workspace.name}</p>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-xs font-black text-brand-700">{initials}</span>
      </header>
      <main className="min-h-screen">{children}</main>
    </div>
  );
}
