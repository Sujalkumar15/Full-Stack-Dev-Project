import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { IssueFormModal } from "../components/IssueFormModal";
import { KanbanBoard } from "../components/KanbanBoard";
import { LoadingScreen } from "../components/LoadingScreen";
import { ProjectFormModal } from "../components/ProjectFormModal";
import { WorkspaceShell } from "../components/WorkspaceShell";
import { useWorkspaceData } from "../hooks/useWorkspaceData";
import { ApiError, apiRequest } from "../lib/api";
import type { Issue, IssueStatus, Project, WorkspaceMember } from "../types/api";

export function ProjectBoardPage() {
  const { workspaceId = "", projectId = "" } = useParams();
  const navigate = useNavigate();
  const { workspace, projects, setProjects, isLoading: workspaceLoading, error: workspaceError, reload } = useWorkspaceData(workspaceId);
  const [project, setProject] = useState<Project | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [editingProject, setEditingProject] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [pendingIssueId, setPendingIssueId] = useState("");

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError("");
    Promise.all([
      apiRequest<{ data: { project: Project } }>(`/workspaces/${workspaceId}/projects/${projectId}`),
      apiRequest<{ data: { issues: Issue[] } }>(`/workspaces/${workspaceId}/projects/${projectId}/issues`),
      apiRequest<{ data: { members: WorkspaceMember[] } }>(`/workspaces/${workspaceId}/members`),
    ]).then(([projectResponse, issuesResponse, membersResponse]) => {
      if (!active) return;
      setProject(projectResponse.data.project);
      setIssues(issuesResponse.data.issues);
      setMembers(membersResponse.data.members);
    }).catch((caught) => {
      if (active) setError(caught instanceof ApiError ? caught.message : "Unable to load this project.");
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [workspaceId, projectId]);

  if (workspaceLoading || isLoading) return <LoadingScreen />;
  if (!workspace || !project || workspaceError || error) {
    return <main className="grid min-h-screen place-items-center bg-canvas p-6"><div className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-card"><h1 className="text-xl font-bold text-ink">Project unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-500">{workspaceError || error || "This project could not be found."}</p><Link to={workspace ? `/workspaces/${workspace.id}/dashboard` : "/workspaces"} className="mt-6 inline-flex rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white">Return to workspace</Link></div></main>;
  }

  const activeWorkspace = workspace;
  const activeProject = project;
  const canManageProject = activeWorkspace.role === "OWNER" || activeWorkspace.role === "ADMIN";
  const canEditIssues = activeWorkspace.role !== "VIEWER";

  function saveProject(saved: Project) {
    setProject(saved);
    setProjects((current) => current.map((item) => item.id === saved.id ? saved : item));
    setEditingProject(false);
  }

  function createProject(saved: Project) {
    setCreatingProject(false);
    setProjects((current) => [saved, ...current]);
    navigate(`/workspaces/${activeWorkspace.id}/projects/${saved.id}`);
  }

  async function removeProject() {
    if (!window.confirm(`Delete ${activeProject.name} and all of its issues? This cannot be undone.`)) return;
    try {
      await apiRequest(`/workspaces/${activeWorkspace.id}/projects/${activeProject.id}`, { method: "DELETE" });
      navigate(`/workspaces/${activeWorkspace.id}/dashboard`);
    } catch (caught) {
      setFeedback(caught instanceof ApiError ? caught.message : "Unable to delete the project.");
    }
  }

  function issueSaved(saved: Issue) {
    const existed = issues.some((item) => item.id === saved.id);
    setIssues((current) => existed ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
    setCreatingIssue(false);
    setEditingIssue(null);
    if (!existed) setProject((current) => current ? { ...current, issueCount: current.issueCount + 1 } : current);
    void reload();
  }

  function issueDeleted(issueId: string) {
    setIssues((current) => current.filter((item) => item.id !== issueId));
    setEditingIssue(null);
    setProject((current) => current ? { ...current, issueCount: Math.max(0, current.issueCount - 1) } : current);
    void reload();
  }

  async function changeStatus(issue: Issue, status: IssueStatus) {
    setFeedback("");
    setPendingIssueId(issue.id);
    setIssues((current) => current.map((item) => item.id === issue.id ? { ...item, status } : item));
    try {
      const response = await apiRequest<{ data: { issue: Issue } }>(`/workspaces/${activeWorkspace.id}/projects/${activeProject.id}/issues/${issue.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setIssues((current) => current.map((item) => item.id === issue.id ? response.data.issue : item));
    } catch (caught) {
      setIssues((current) => current.map((item) => item.id === issue.id ? issue : item));
      setFeedback(caught instanceof ApiError ? `Status update failed: ${caught.message}` : "Status update failed. The issue was moved back.");
    } finally {
      setPendingIssueId("");
    }
  }

  return (
    <WorkspaceShell workspace={workspace} projects={projects} activeProjectId={project.id} onCreateProject={canManageProject ? () => setCreatingProject(true) : undefined}>
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8 sm:py-9">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div className="min-w-0"><div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Link to={`/workspaces/${workspace.id}/dashboard`} className="hover:text-brand-600">Projects</Link><span>/</span><span className="truncate text-slate-500">{project.key}</span></div><div className="mt-3 flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink text-[11px] font-black text-white">{project.key.slice(0, 3)}</span><div className="min-w-0"><h1 className="truncate text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">{project.name}</h1><p className="mt-1 truncate text-sm text-slate-400">{project.description || "Plan, prioritize, and move work forward."}</p></div></div></div>
          <div className="flex flex-wrap items-center gap-2">{canManageProject ? <><button onClick={() => setEditingProject(true)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-brand-700">Project settings</button><button onClick={() => void removeProject()} className="rounded-xl border border-transparent px-3 py-2.5 text-sm font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600">Delete</button></> : null}{canEditIssues ? <button onClick={() => setCreatingIssue(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200 hover:bg-brand-700"><span className="text-lg">+</span> Create issue</button> : null}</div>
        </div>

        <div className="mt-7 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-brand-600">▦</span><div><p className="text-sm font-bold text-ink">Kanban board</p><p className="text-xs text-slate-400">{issues.length} {issues.length === 1 ? "issue" : "issues"} · drag cards to update status</p></div></div><div className="hidden items-center gap-2 text-xs font-semibold text-slate-400 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />Changes save automatically</div></div>
        {feedback ? <div role="alert" className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"><span>{feedback}</span><button onClick={() => setFeedback("")} aria-label="Dismiss message">×</button></div> : null}
        <div className="mt-5"><KanbanBoard issues={issues} canEdit={canEditIssues} pendingIssueId={pendingIssueId} onEdit={setEditingIssue} onStatusChange={(issue, status) => void changeStatus(issue, status)} /></div>
        {!issues.length && canEditIssues ? <div className="mt-5 rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-5 py-7 text-center"><p className="font-bold text-ink">This board is ready for its first issue.</p><p className="mt-1 text-sm text-slate-500">Capture one concrete outcome and move it across the workflow.</p><button onClick={() => setCreatingIssue(true)} className="mt-4 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white">Create first issue</button></div> : null}
      </div>

      {editingProject ? <ProjectFormModal workspaceId={workspace.id} project={project} onClose={() => setEditingProject(false)} onSaved={saveProject} /> : null}
      {creatingProject ? <ProjectFormModal workspaceId={workspace.id} onClose={() => setCreatingProject(false)} onSaved={createProject} /> : null}
      {creatingIssue ? <IssueFormModal workspaceId={workspace.id} projectId={project.id} members={members} canDelete={canManageProject} onClose={() => setCreatingIssue(false)} onSaved={issueSaved} /> : null}
      {editingIssue ? <IssueFormModal workspaceId={workspace.id} projectId={project.id} members={members} issue={editingIssue} canDelete={canManageProject} onClose={() => setEditingIssue(null)} onSaved={issueSaved} onDeleted={issueDeleted} /> : null}
    </WorkspaceShell>
  );
}
