import { useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";
import type { Project } from "../types/api";
import { Modal } from "./Modal";

interface ProjectFormModalProps {
  workspaceId: string;
  project?: Project;
  onClose: () => void;
  onSaved: (project: Project) => void;
}

const inputClass = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-violet-100";

export function ProjectFormModal({ workspaceId, project, onClose, onSaved }: ProjectFormModalProps) {
  const [name, setName] = useState(project?.name ?? "");
  const [key, setKey] = useState(project?.key ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const response = await apiRequest<{ data: { project: Project } }>(
        project ? `/workspaces/${workspaceId}/projects/${project.id}` : `/workspaces/${workspaceId}/projects`,
        { method: project ? "PATCH" : "POST", body: JSON.stringify({ name, key, description: description || null }) },
      );
      onSaved(response.data.project);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to save the project.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal title={project ? "Edit project" : "Create a project"} description={project ? "Keep the project details clear for your team." : "Set up a focused home for a stream of work."} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
        <label className="block text-sm font-semibold text-slate-700">Project name<input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Website redesign" autoFocus required maxLength={80} /></label>
        <label className="block text-sm font-semibold text-slate-700">Project key<input className={`${inputClass} uppercase`} value={key} onChange={(event) => setKey(event.target.value.replace(/\s/g, "").toUpperCase())} placeholder="WEB" required minLength={2} maxLength={10} /><span className="mt-1.5 block text-xs font-normal text-slate-400">Used in issue identifiers, such as WEB-12.</span></label>
        <label className="block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span><textarea className={`${inputClass} min-h-28 resize-y`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this project responsible for?" maxLength={1000} /></label>
        <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={isSaving} className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60">{isSaving ? "Saving…" : project ? "Save changes" : "Create project"}</button></div>
      </form>
    </Modal>
  );
}
