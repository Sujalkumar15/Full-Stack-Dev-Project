import { useState, type FormEvent } from "react";
import { ApiError, apiRequest } from "../lib/api";
import type { Issue, IssuePriority, IssueStatus, WorkspaceMember } from "../types/api";
import { Modal } from "./Modal";

interface IssueFormModalProps {
  workspaceId: string;
  projectId: string;
  members: WorkspaceMember[];
  issue?: Issue;
  canDelete?: boolean;
  onClose: () => void;
  onSaved: (issue: Issue) => void;
  onDeleted?: (issueId: string) => void;
}

const inputClass = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-violet-100";

export function IssueFormModal({ workspaceId, projectId, members, issue, canDelete, onClose, onSaved, onDeleted }: IssueFormModalProps) {
  const [title, setTitle] = useState(issue?.title ?? "");
  const [description, setDescription] = useState(issue?.description ?? "");
  const [priority, setPriority] = useState<IssuePriority>(issue?.priority ?? "MEDIUM");
  const [status, setStatus] = useState<IssueStatus>(issue?.status ?? "TODO");
  const [assigneeMembershipId, setAssigneeMembershipId] = useState(issue?.assigneeMembershipId ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const response = await apiRequest<{ data: { issue: Issue } }>(
        issue ? `/workspaces/${workspaceId}/projects/${projectId}/issues/${issue.id}` : `/workspaces/${workspaceId}/projects/${projectId}/issues`,
        {
          method: issue ? "PATCH" : "POST",
          body: JSON.stringify({ title, description: description || null, priority, status, assigneeMembershipId: assigneeMembershipId || null }),
        },
      );
      onSaved(response.data.issue);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to save the issue.");
    } finally {
      setIsSaving(false);
    }
  }

  async function remove() {
    if (!issue || !onDeleted || !window.confirm(`Delete ${issue.identifier}? This cannot be undone.`)) return;
    setError("");
    setIsDeleting(true);
    try {
      await apiRequest(`/workspaces/${workspaceId}/projects/${projectId}/issues/${issue.id}`, { method: "DELETE" });
      onDeleted(issue.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to delete the issue.");
      setIsDeleting(false);
    }
  }

  return (
    <Modal title={issue ? `Edit ${issue.identifier}` : "Create an issue"} description="Capture enough context for the next person to move the work forward." onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
        <label className="block text-sm font-semibold text-slate-700">Title<input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to be done?" autoFocus required maxLength={180} /></label>
        <label className="block text-sm font-semibold text-slate-700">Description <span className="font-normal text-slate-400">(optional)</span><textarea className={`${inputClass} min-h-28 resize-y`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add context, constraints, or acceptance criteria…" maxLength={10000} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">Status<select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as IssueStatus)}><option value="TODO">To Do</option><option value="IN_PROGRESS">In Progress</option><option value="DONE">Done</option></select></label>
          <label className="block text-sm font-semibold text-slate-700">Priority<select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value as IssuePriority)}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">Assignee<select className={inputClass} value={assigneeMembershipId} onChange={(event) => setAssigneeMembershipId(event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option key={member.membershipId} value={member.membershipId}>{member.displayName ?? member.email}</option>)}</select></label>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div>{issue && canDelete ? <button type="button" disabled={isDeleting} onClick={() => void remove()} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">{isDeleting ? "Deleting…" : "Delete issue"}</button> : null}</div>
          <div className="flex gap-3"><button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={isSaving || isDeleting} className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60">{isSaving ? "Saving…" : issue ? "Save changes" : "Create issue"}</button></div>
        </div>
      </form>
    </Modal>
  );
}
