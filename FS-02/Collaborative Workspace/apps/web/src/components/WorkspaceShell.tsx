import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  PageSummary,
  UpdatePageRequest,
  WorkspaceSummary,
} from '@collaborative-workspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  ChevronsUpDown,
  FilePlus2,
  FileText,
  Home,
  LoaderCircle,
  Lock,
  Menu,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  ApiError,
  archivePage,
  createPage,
  deletePage,
  getHealth,
  getPage,
  getWorkspace,
  listPages,
  listWorkspaces,
  restorePage,
  updatePage,
  updateWorkspace,
} from '../lib/api';
import { UserMenu } from './UserMenu';
import { MembersDialog } from './MembersDialog';

const CollaborativeEditor = lazy(() =>
  import('./CollaborativeEditor').then((module) => ({ default: module.CollaborativeEditor })),
);

const accessRank = { READ: 1, COMMENT: 2, EDIT: 3, MANAGE: 4 } as const;

function can(page: PageSummary, required: keyof typeof accessRank) {
  return accessRank[page.access] >= accessRank[required];
}

function ApiStatus() {
  const health = useQuery({
    queryKey: ['api-health'],
    queryFn: ({ signal }) => getHealth(signal),
    refetchInterval: 60_000,
  });
  const label = health.isSuccess ? 'API ready' : health.isError ? 'API offline' : 'Checking API';
  const color = health.isSuccess
    ? 'bg-emerald-500'
    : health.isError
      ? 'bg-rose-500'
      : 'bg-amber-400';

  return (
    <div className="hidden items-center gap-2 rounded-full border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-500 sm:flex">
      <span className={`size-1.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}

interface PageTreeProps {
  workspaceId: string;
  pages: PageSummary[];
  parentId: string | null;
  selectedPageId: string | undefined;
  depth?: number;
  onCreateChild: (parentId: string) => void;
  onNavigate: (() => void) | undefined;
}

function PageTree({
  workspaceId,
  pages,
  parentId,
  selectedPageId,
  depth = 0,
  onCreateChild,
  onNavigate,
}: PageTreeProps) {
  const children = pages
    .filter((page) => page.parentId === parentId)
    .sort(
      (left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title),
    );

  return children.map((page) => (
    <div key={page.id}>
      <div
        className={`group flex items-center rounded-lg pr-1 ${
          selectedPageId === page.id ? 'bg-white shadow-sm ring-1 ring-stone-200/70' : ''
        }`}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <Link
          to={`/workspaces/${workspaceId}/pages/${page.id}`}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-stone-600 hover:text-stone-900"
        >
          {pages.some((candidate) => candidate.parentId === page.id) ? (
            <ChevronRight className="size-3.5 shrink-0 text-stone-400" />
          ) : (
            <FileText className="size-3.5 shrink-0 text-stone-400" />
          )}
          <span className="truncate">{page.title}</span>
          {page.visibility === 'RESTRICTED' ? (
            <Lock className="ml-auto size-3 shrink-0 text-stone-400" />
          ) : null}
        </Link>
        {can(page, 'EDIT') ? (
          <button
            type="button"
            className="grid size-6 shrink-0 place-items-center rounded text-stone-400 opacity-0 hover:bg-stone-200 hover:text-stone-700 group-hover:opacity-100"
            aria-label={`Add a subpage to ${page.title}`}
            onClick={() => onCreateChild(page.id)}
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </div>
      <PageTree
        workspaceId={workspaceId}
        pages={pages}
        parentId={page.id}
        selectedPageId={selectedPageId}
        depth={depth + 1}
        onCreateChild={onCreateChild}
        onNavigate={onNavigate}
      />
    </div>
  ));
}

interface SidebarProps {
  workspaceId: string;
  workspace: WorkspaceSummary | undefined;
  workspaces: WorkspaceSummary[];
  pages: PageSummary[];
  selectedPageId: string | undefined;
  isLoading: boolean;
  creating: boolean;
  onCreatePage: (title: string, parentId?: string) => void;
  onOpenMembers: () => void;
  onClose: (() => void) | undefined;
}

function Sidebar({
  workspaceId,
  workspace,
  workspaces,
  pages,
  selectedPageId,
  isLoading,
  creating,
  onCreatePage,
  onOpenMembers,
  onClose,
}: SidebarProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [creatingRoot, setCreatingRoot] = useState(false);
  const [title, setTitle] = useState('');

  function submitPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreatePage(title);
    setTitle('');
    setCreatingRoot(false);
  }

  return (
    <aside className="flex h-full w-[278px] shrink-0 flex-col border-r border-stone-200/80 bg-[#f7f8f6]">
      <div className="relative px-3 pb-2 pt-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-stone-200/70"
            aria-expanded={switcherOpen}
            onClick={() => setSwitcherOpen((value) => !value)}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-900 text-sm font-semibold text-white">
              {workspace?.name.slice(0, 1).toUpperCase() ?? 'C'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-stone-800">
                {workspace?.name ?? 'Loading workspace…'}
              </span>
              <span className="block text-xs text-stone-500">{workspace?.role ?? 'Workspace'}</span>
            </span>
            <ChevronsUpDown className="size-4 text-stone-400" />
          </button>
          {onClose ? (
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-200"
              aria-label="Close navigation"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {switcherOpen ? (
          <div className="absolute left-3 right-3 top-[62px] z-40 rounded-xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-900/10">
            <Link to="/" className="menu-item" onClick={onClose}>
              <ArrowLeft className="size-4" /> All workspaces
            </Link>
            <div className="my-1 h-px bg-stone-100" />
            {workspaces.map((item) => (
              <Link
                key={item.id}
                to={`/workspaces/${item.id}`}
                onClick={onClose}
                className={`menu-item ${item.id === workspaceId ? 'bg-stone-100 font-medium' : ''}`}
              >
                <span className="grid size-6 place-items-center rounded-md bg-stone-900 text-[10px] font-semibold text-white">
                  {item.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{item.name}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <nav className="space-y-0.5 px-3">
        <Link to={`/workspaces/${workspaceId}`} onClick={onClose} className="sidebar-link">
          <Home className="size-[17px]" /> Workspace home
        </Link>
        <button type="button" className="sidebar-link" disabled>
          <Search className="size-[17px]" /> Search
          <span className="ml-auto text-[10px] text-stone-400">Soon</span>
        </button>
      </nav>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Pages
          </span>
          <button
            type="button"
            className="grid size-6 place-items-center rounded-md text-stone-400 hover:bg-stone-200 hover:text-stone-700"
            aria-label="Create a page"
            onClick={() => setCreatingRoot(true)}
          >
            <Plus className="size-4" />
          </button>
        </div>

        {creatingRoot ? (
          <form onSubmit={submitPage} className="mb-2 flex items-center gap-1 px-1">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
              placeholder="Page title"
              maxLength={200}
              autoFocus
              required
            />
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-stone-900 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Add
            </button>
          </form>
        ) : null}

        {isLoading ? (
          <div className="space-y-2 px-2 py-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-7 animate-pulse rounded-lg bg-stone-200" />
            ))}
          </div>
        ) : pages.length ? (
          <PageTree
            workspaceId={workspaceId}
            pages={pages}
            parentId={null}
            selectedPageId={selectedPageId}
            onCreateChild={(parentId) => onCreatePage('Untitled', parentId)}
            onNavigate={onClose}
          />
        ) : (
          <div className="mx-1 mt-2 rounded-xl border border-dashed border-stone-300 bg-white/55 px-4 py-5 text-center">
            <FileText className="mx-auto size-5 text-stone-400" />
            <p className="mt-2 text-xs font-medium text-stone-600">No pages yet</p>
            <p className="mt-1 text-[11px] text-stone-400">Create a page to begin.</p>
          </div>
        )}
      </div>

      <div className="border-t border-stone-200/80 p-3">
        <button type="button" className="sidebar-link" onClick={onOpenMembers}>
          <Users className="size-[17px]" /> Members
          <Settings className="ml-auto size-3.5 text-stone-400" />
        </button>
      </div>
    </aside>
  );
}

function WorkspaceOverview({
  workspace,
  pages,
  onRename,
  renaming,
  onCreate,
}: {
  workspace: WorkspaceSummary;
  pages: PageSummary[];
  onRename: (name: string) => void;
  renaming: boolean;
  onCreate: () => void;
}) {
  const [name, setName] = useState(workspace.name);
  const canRename = workspace.role === 'OWNER' || workspace.role === 'ADMIN';

  useEffect(() => setName(workspace.name), [workspace.name]);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-10 sm:py-16">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
        <Sparkles className="size-3.5" /> Workspace overview
      </p>
      {canRename ? (
        <input
          className="mt-4 w-full bg-transparent text-4xl font-semibold tracking-[-0.045em] text-stone-900 outline-none"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name.trim() !== workspace.name && name.trim().length >= 2 && onRename(name)}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          maxLength={80}
          aria-label="Workspace name"
          disabled={renaming}
        />
      ) : (
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-stone-900">
          {workspace.name}
        </h1>
      )}
      <p className="mt-3 text-sm text-stone-500">
        {pages.length} {pages.length === 1 ? 'active page' : 'active pages'} · {workspace.role}
      </p>

      <div className="mt-12 rounded-2xl border border-stone-200 bg-white px-6 py-12 text-center shadow-sm">
        <FilePlus2 className="mx-auto size-8 text-emerald-600" />
        <h2 className="mt-4 text-lg font-semibold text-stone-800">
          {pages.length ? 'Choose a page from the sidebar' : 'Create the first page'}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-500">
          {pages.length
            ? 'Page settings and document details appear here when you select a page.'
            : 'Start with a project brief, meeting notes, or any document your team needs.'}
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="size-4" /> New page
        </button>
      </div>
    </div>
  );
}

interface PageDocumentProps {
  workspaceId: string;
  page: PageSummary;
  pages: PageSummary[];
  saving: boolean;
  onUpdate: (input: UpdatePageRequest) => void;
  onCreateChild: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onMove: (direction: -1 | 1) => void;
}

function PageDocument({
  workspaceId,
  page,
  pages,
  saving,
  onUpdate,
  onCreateChild,
  onArchive,
  onDelete,
  onRestore,
  onMove,
}: PageDocumentProps) {
  const [title, setTitle] = useState(page.title);
  useEffect(() => setTitle(page.title), [page.id, page.title]);

  const siblings = pages
    .filter((candidate) => candidate.parentId === page.parentId)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const siblingIndex = siblings.findIndex((candidate) => candidate.id === page.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-10 sm:py-12">
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
        <span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-600">
          {page.access}
        </span>
        <span>{page.visibility === 'RESTRICTED' ? 'Restricted page' : 'Workspace page'}</span>
        {saving ? <span className="text-emerald-700">Saving…</span> : null}
      </div>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => title.trim() && title.trim() !== page.title && onUpdate({ title })}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
        disabled={!can(page, 'EDIT') || saving}
        maxLength={200}
        className="mt-5 w-full bg-transparent text-4xl font-semibold tracking-[-0.045em] text-stone-900 outline-none disabled:opacity-70 sm:text-5xl"
        aria-label="Page title"
      />
      {page.archivedAt ? (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-8 text-center text-sm text-amber-800">
          This page is archived. Restore it to reconnect to the collaborative document.
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="mt-8 grid min-h-72 place-items-center rounded-2xl border border-stone-200 bg-white text-sm text-stone-500">
              <span className="flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" /> Loading the editor…
              </span>
            </div>
          }
        >
          <CollaborativeEditor workspaceId={workspaceId} pageId={page.id} />
        </Suspense>
      )}

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-800">Page settings</h2>
          <label className="mt-4 block text-xs font-medium text-stone-500">
            Visibility
            <select
              value={page.visibility}
              disabled={!can(page, 'MANAGE') || saving}
              onChange={(event) =>
                onUpdate({ visibility: event.target.value as PageSummary['visibility'] })
              }
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-emerald-500"
            >
              <option value="WORKSPACE">Everyone in the workspace</option>
              <option value="RESTRICTED">Restricted</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!can(page, 'EDIT') || saving}
            onClick={onCreateChild}
            className="mt-4 flex w-full items-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            <FilePlus2 className="size-4" /> Create subpage
          </button>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-800">Organization</h2>
          <p className="mt-2 text-xs leading-5 text-stone-500">
            Reorder this page among its siblings. Structural changes require manage access.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!can(page, 'MANAGE') || siblingIndex <= 0 || saving}
              onClick={() => onMove(-1)}
              className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-stone-600 disabled:opacity-40"
            >
              <ArrowUp className="size-4" /> Move up
            </button>
            <button
              type="button"
              disabled={!can(page, 'MANAGE') || siblingIndex >= siblings.length - 1 || saving}
              onClick={() => onMove(1)}
              className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm text-stone-600 disabled:opacity-40"
            >
              <ArrowDown className="size-4" /> Move down
            </button>
          </div>
        </section>
      </div>

      {can(page, 'MANAGE') ? (
        <section className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/60 p-5">
          <h2 className="text-sm font-semibold text-rose-900">Page lifecycle</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {page.archivedAt ? (
              <button type="button" onClick={onRestore} className="danger-action">
                <RotateCcw className="size-4" /> Restore page
              </button>
            ) : (
              <button type="button" onClick={onArchive} className="danger-action">
                <Archive className="size-4" /> Archive page
              </button>
            )}
            <button type="button" onClick={onDelete} className="danger-action text-rose-700">
              <Trash2 className="size-4" /> Delete permanently
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function WorkspaceShell() {
  const { workspaceId = '', pageId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const workspace = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => getWorkspace(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: listWorkspaces });
  const pages = useQuery({
    queryKey: ['pages', workspaceId],
    queryFn: () => listPages(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const page = useQuery({
    queryKey: ['page', workspaceId, pageId],
    queryFn: () => getPage(workspaceId, pageId!),
    enabled: Boolean(workspaceId && pageId),
  });

  const createMutation = useMutation({
    mutationFn: ({ title, parentId }: { title: string; parentId?: string }) =>
      createPage(workspaceId, parentId ? { title, parentId } : { title }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] });
      navigate(`/workspaces/${workspaceId}/pages/${created.id}`);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ targetPageId, input }: { targetPageId: string; input: UpdatePageRequest }) =>
      updatePage(workspaceId, targetPageId, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['page', workspaceId, updated.id], updated);
      await queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] });
    },
  });
  const renameWorkspaceMutation = useMutation({
    mutationFn: (name: string) => updateWorkspace(workspaceId, { name }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(['workspace', workspaceId], updated);
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
  const archiveMutation = useMutation({
    mutationFn: () => archivePage(workspaceId, pageId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] });
      navigate(`/workspaces/${workspaceId}`);
    },
  });
  const restoreMutation = useMutation({
    mutationFn: () => restorePage(workspaceId, pageId!),
    onSuccess: async (restored) => {
      queryClient.setQueryData(['page', workspaceId, restored.id], restored);
      await queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deletePage(workspaceId, pageId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] });
      navigate(`/workspaces/${workspaceId}`);
    },
  });
  const reorderMutation = useMutation({
    mutationFn: async (direction: -1 | 1) => {
      const selected = page.data;
      if (!selected) return;
      const siblings = (pages.data ?? [])
        .filter((candidate) => candidate.parentId === selected.parentId)
        .sort((left, right) => left.sortOrder - right.sortOrder);
      const index = siblings.findIndex((candidate) => candidate.id === selected.id);
      const neighbor = siblings[index + direction];
      if (!neighbor) return;
      await Promise.all([
        updatePage(workspaceId, selected.id, { sortOrder: neighbor.sortOrder }),
        updatePage(workspaceId, neighbor.id, { sortOrder: selected.sortOrder }),
      ]);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ['page', workspaceId, pageId] });
    },
  });

  const pageList = pages.data ?? [];
  const isSaving =
    updateMutation.isPending ||
    archiveMutation.isPending ||
    restoreMutation.isPending ||
    deleteMutation.isPending ||
    reorderMutation.isPending;
  const operationError =
    createMutation.error ??
    updateMutation.error ??
    archiveMutation.error ??
    restoreMutation.error ??
    deleteMutation.error ??
    reorderMutation.error;
  const errorMessage = useMemo(
    () =>
      operationError instanceof ApiError
        ? operationError.message
        : operationError
          ? 'The operation could not be completed.'
          : null,
    [operationError],
  );

  function createNewPage(title: string, parentId?: string) {
    createMutation.mutate(parentId ? { title, parentId } : { title });
  }

  function confirmDelete() {
    if (window.confirm('Permanently delete this page and all of its subpages?')) {
      deleteMutation.mutate();
    }
  }

  if (workspace.isError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[#f7f8f6] px-5 text-center">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-stone-500">
            It may not exist, or you may no longer have access.
          </p>
          <Link to="/" className="mt-5 inline-block text-sm font-semibold text-emerald-700">
            Return to workspaces
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-[620px] overflow-hidden bg-[#fbfcfa] text-stone-900">
      <div className="hidden lg:block">
        <Sidebar
          workspaceId={workspaceId}
          workspace={workspace.data}
          workspaces={workspaces.data ?? []}
          pages={pageList}
          selectedPageId={pageId}
          isLoading={pages.isLoading}
          creating={createMutation.isPending}
          onCreatePage={createNewPage}
          onOpenMembers={() => setMembersOpen(true)}
          onClose={undefined}
        />
      </div>
      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-stone-950/25 backdrop-blur-[2px]"
            aria-label="Close navigation"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative h-full shadow-2xl">
            <Sidebar
              workspaceId={workspaceId}
              workspace={workspace.data}
              workspaces={workspaces.data ?? []}
              pages={pageList}
              selectedPageId={pageId}
              isLoading={pages.isLoading}
              creating={createMutation.isPending}
              onCreatePage={createNewPage}
              onOpenMembers={() => {
                setMobileSidebarOpen(false);
                setMembersOpen(true);
              }}
              onClose={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-stone-200/75 bg-white/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-stone-700">
              {page.data?.title ?? workspace.data?.name ?? 'Loading…'}
            </p>
            <p className="truncate text-xs text-stone-400">
              {page.data ? workspace.data?.name : 'Workspace overview'}
            </p>
          </div>
          <ApiStatus />
          <UserMenu />
        </header>

        {errorMessage ? (
          <div
            role="alert"
            className="border-b border-rose-200 bg-rose-50 px-5 py-2 text-sm text-rose-700"
          >
            {errorMessage}
          </div>
        ) : null}

        <section className="min-h-0 flex-1 overflow-y-auto">
          {workspace.isLoading || pages.isLoading || (pageId && page.isLoading) ? (
            <div className="grid h-full place-items-center text-sm text-stone-500">
              <span className="flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" /> Loading…
              </span>
            </div>
          ) : pageId && page.isError ? (
            <div className="grid h-full place-items-center px-5 text-center">
              <div>
                <h1 className="text-xl font-semibold text-stone-800">Page unavailable</h1>
                <p className="mt-2 text-sm text-stone-500">
                  It may be restricted, archived, or deleted.
                </p>
                <Link
                  to={`/workspaces/${workspaceId}`}
                  className="mt-5 inline-block text-sm font-semibold text-emerald-700"
                >
                  Return to workspace
                </Link>
              </div>
            </div>
          ) : page.data ? (
            <PageDocument
              workspaceId={workspaceId}
              page={page.data}
              pages={pageList}
              saving={isSaving}
              onUpdate={(input) => updateMutation.mutate({ targetPageId: page.data!.id, input })}
              onCreateChild={() => createNewPage('Untitled', page.data!.id)}
              onArchive={() => archiveMutation.mutate()}
              onRestore={() => restoreMutation.mutate()}
              onDelete={confirmDelete}
              onMove={(direction) => reorderMutation.mutate(direction)}
            />
          ) : workspace.data ? (
            <WorkspaceOverview
              workspace={workspace.data}
              pages={pageList}
              renaming={renameWorkspaceMutation.isPending}
              onRename={(name) => renameWorkspaceMutation.mutate(name)}
              onCreate={() => createNewPage('Untitled')}
            />
          ) : null}
        </section>
      </main>
      {workspace.data ? (
        <MembersDialog
          open={membersOpen}
          workspaceId={workspaceId}
          workspaceName={workspace.data.name}
          workspaceRole={workspace.data.role}
          onClose={() => setMembersOpen(false)}
        />
      ) : null}
    </div>
  );
}
