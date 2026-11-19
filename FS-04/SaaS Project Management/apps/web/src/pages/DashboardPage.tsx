import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LoadingScreen } from "../components/LoadingScreen";
import { ProjectFormModal } from "../components/ProjectFormModal";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { useWorkspaceData } from "../hooks/useWorkspaceData";
import type { Project } from "../types/api";

export function DashboardPage() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const { workspace, projects, setProjects, isLoading, error } = useWorkspaceData(workspaceId);
  const [creatingProject, setCreatingProject] = useState(false);

  if (isLoading) return <LoadingScreen />;
  if (!workspace || error) {
    return <main className="grid min-h-screen place-items-center bg-canvas p-6"><div className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-card"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-xl text-rose-600">!</div><h1 className="mt-5 text-xl font-bold text-ink">Workspace unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-500">{error || "This workspace could not be found."}</p><Link to="/workspaces" className="mt-6 inline-flex rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white">Return to workspaces</Link></div></main>;
  }

  const activeWorkspace = workspace;
  const canManage = activeWorkspace.role === "OWNER" || activeWorkspace.role === "ADMIN";
  const issueTotal = projects.reduce((sum, project) => sum + project.issueCount, 0);

  function projectCreated(project: Project) {
    setProjects((current) => [project, ...current]);
    setCreatingProject(false);
    navigate(`/workspaces/${activeWorkspace.id}/projects/${project.id}`);
  }

  return (
    <WorkspaceShell workspace={workspace} projects={projects} onCreateProject={canManage ? () => setCreatingProject(true) : undefined}>
      <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 sm:py-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-brand-600">Workspace overview</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-ink sm:text-4xl">Good work starts with clarity.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Create focused projects, capture the next action, and keep delivery moving across the board.</p></div>
          {canManage ? <button onClick={() => setCreatingProject(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-brand-700"><span className="text-lg">+</span> New project</button> : null}
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[{ label: "Active projects", value: projects.length, detail: "Across this workspace", tone: "bg-violet-50 text-brand-700" }, { label: "Tracked issues", value: issueTotal, detail: "All project boards", tone: "bg-sky-50 text-sky-700" }, { label: "Your access", value: workspace.role, detail: "Database-verified role", tone: "bg-emerald-50 text-emerald-700" }].map((stat) => <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><div className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${stat.tone}`}>{stat.label}</div><p className="mt-4 text-3xl font-black tracking-tight text-ink">{stat.value}</p><p className="mt-1 text-xs text-slate-400">{stat.detail}</p></article>)}
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white shadow-card">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-7"><div><h2 className="text-lg font-bold text-ink">Projects</h2><p className="mt-1 text-sm text-slate-400">Your workspace delivery areas</p></div>{canManage && projects.length ? <button onClick={() => setCreatingProject(true)} className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-brand-700">Create project</button> : null}</header>
          {projects.length ? <div className="divide-y divide-slate-100">{projects.map((project) => <Link key={project.id} to={`/workspaces/${workspace.id}/projects/${project.id}`} className="group flex items-center gap-4 px-5 py-5 transition hover:bg-slate-50/80 sm:px-7"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-[11px] font-black text-white">{project.key.slice(0, 3)}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold text-ink group-hover:text-brand-700">{project.name}</span><span className="mt-1 block truncate text-xs text-slate-400">{project.description || "No description yet"}</span></span><span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 sm:block">{project.issueCount} {project.issueCount === 1 ? "issue" : "issues"}</span><span className="text-xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-600">→</span></Link>)}</div> : <div className="px-6 py-16 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-50 text-2xl text-brand-600">◇</div><h3 className="mt-5 text-lg font-bold text-ink">Create your first project</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">Projects organize related issues into a clear, shared delivery board.</p>{canManage ? <button onClick={() => setCreatingProject(true)} className="mt-6 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">Create project</button> : <p className="mt-5 text-sm font-semibold text-slate-400">Ask a workspace admin to create a project.</p>}</div>}
        </section>
      </div>
      {creatingProject ? <ProjectFormModal workspaceId={workspace.id} onClose={() => setCreatingProject(false)} onSaved={projectCreated} /> : null}
    </WorkspaceShell>
  );
}
