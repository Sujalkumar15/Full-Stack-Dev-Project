import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Issue, IssuePriority, IssueStatus } from "../types/api";

interface KanbanBoardProps {
  issues: Issue[];
  canEdit: boolean;
  pendingIssueId?: string;
  onEdit: (issue: Issue) => void;
  onStatusChange: (issue: Issue, status: IssueStatus) => void;
}

const columns: Array<{ status: IssueStatus; title: string; accent: string; dot: string }> = [
  { status: "TODO", title: "To Do", accent: "border-slate-200", dot: "bg-slate-400" },
  { status: "IN_PROGRESS", title: "In Progress", accent: "border-violet-200", dot: "bg-violet-500" },
  { status: "DONE", title: "Done", accent: "border-emerald-200", dot: "bg-emerald-500" },
];

const priorityStyle: Record<IssuePriority, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-sky-50 text-sky-700",
  HIGH: "bg-amber-50 text-amber-700",
  URGENT: "bg-rose-50 text-rose-700",
};

function IssueCard({ issue, canEdit, isPending, onEdit }: { issue: Issue; canEdit: boolean; isPending: boolean; onEdit: (issue: Issue) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: issue.id, disabled: !canEdit || isPending, data: { issue } });
  const assigneeName = issue.assignee?.displayName ?? issue.assignee?.email ?? "Unassigned";
  const initials = issue.assignee ? assigneeName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() : "—";
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`group rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_-24px_rgba(23,32,51,.6)] transition ${isDragging ? "z-50 rotate-1 opacity-70 shadow-xl" : "hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg"} ${isPending ? "animate-pulse opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-black tracking-[0.08em] text-slate-400">{issue.identifier}</span><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black tracking-wide ${priorityStyle[issue.priority]}`}>{issue.priority}</span>{canEdit ? <button ref={setActivatorNodeRef} type="button" {...listeners} {...attributes} className="grid h-7 w-7 cursor-grab place-items-center rounded-lg text-sm text-slate-300 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing" aria-label={`Move ${issue.identifier}`}>⠿</button> : null}</div></div>
      <button type="button" onClick={() => onEdit(issue)} className="mt-2 w-full text-left" aria-label={`Edit ${issue.identifier}`}>
        <h3 className="mt-3 text-sm font-bold leading-5 text-ink">{issue.title}</h3>
        {issue.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{issue.description}</p> : null}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-[11px] font-medium text-slate-400">{isPending ? "Saving…" : "Updated " + new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(issue.updatedAt))}</span>
          <span title={assigneeName} className={`grid h-7 w-7 place-items-center rounded-full text-[9px] font-black ${issue.assignee ? "bg-violet-100 text-brand-700" : "bg-slate-100 text-slate-400"}`}>{initials}</span>
        </div>
      </button>
    </article>
  );
}

function KanbanColumn({ status, title, accent, dot, issues, canEdit, pendingIssueId, onEdit }: (typeof columns)[number] & { issues: Issue[]; canEdit: boolean; pendingIssueId?: string; onEdit: (issue: Issue) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status }, disabled: !canEdit });
  return (
    <section ref={setNodeRef} className={`min-h-72 rounded-2xl border bg-slate-50/80 p-3 transition ${accent} ${isOver ? "ring-4 ring-violet-100" : ""}`}>
      <header className="flex items-center justify-between px-1 py-2"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${dot}`} /><h2 className="text-sm font-bold text-ink">{title}</h2></div><span className="grid h-7 min-w-7 place-items-center rounded-lg bg-white px-2 text-xs font-bold text-slate-500 shadow-sm">{issues.length}</span></header>
      <div className="mt-2 space-y-3">
        {issues.map((issue) => <IssueCard key={issue.id} issue={issue} canEdit={canEdit} isPending={pendingIssueId === issue.id} onEdit={onEdit} />)}
        {!issues.length ? <div className={`grid min-h-32 place-items-center rounded-xl border border-dashed p-5 text-center text-xs leading-5 ${isOver ? "border-brand-500 bg-violet-50 text-brand-700" : "border-slate-200 text-slate-400"}`}>{isOver ? "Drop issue here" : "No issues in this stage"}</div> : null}
      </div>
    </section>
  );
}

export function KanbanBoard({ issues, canEdit, pendingIssueId, onEdit, onStatusChange }: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));

  function dragEnd(event: DragEndEvent) {
    const issue = issues.find((candidate) => candidate.id === event.active.id);
    const status = event.over?.data.current?.status as IssueStatus | undefined;
    if (issue && status && issue.status !== status) onStatusChange(issue, status);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => <KanbanColumn key={column.status} {...column} issues={issues.filter((issue) => issue.status === column.status)} canEdit={canEdit} pendingIssueId={pendingIssueId} onEdit={onEdit} />)}
      </div>
    </DndContext>
  );
}
