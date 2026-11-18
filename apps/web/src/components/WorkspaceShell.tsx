import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronsUpDown,
  CircleHelp,
  FilePlus2,
  Files,
  Home,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';

import { getHealth } from '../lib/api';

function useCloseOnOutsideClick(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        close();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [close, ref]);
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  useCloseOnOutsideClick(workspaceMenuRef, () => setWorkspaceMenuOpen(false));

  return (
    <aside className="flex h-full w-[278px] shrink-0 flex-col border-r border-stone-200/80 bg-[#f7f8f6]">
      <div className="relative px-3 pb-2 pt-3" ref={workspaceMenuRef}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-stone-200/70"
            aria-expanded={workspaceMenuOpen}
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-900 text-sm font-semibold text-white shadow-sm">
              C
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-stone-800">
                Your workspace
              </span>
              <span className="block truncate text-xs text-stone-500">Local setup</span>
            </span>
            <ChevronsUpDown className="size-4 text-stone-400" />
          </button>
          {onClose ? (
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-200/70"
              aria-label="Close navigation"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {workspaceMenuOpen ? (
          <div className="absolute left-3 right-3 top-[62px] z-30 rounded-xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-900/10">
            <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Workspaces
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-stone-100 px-2 py-2 text-sm text-stone-700">
              <span className="grid size-7 place-items-center rounded-md bg-stone-900 text-xs font-semibold text-white">
                C
              </span>
              <span className="flex-1">Your workspace</span>
              <span className="text-xs text-stone-400">Current</span>
            </div>
            <p className="px-2 pb-1 pt-2 text-xs leading-5 text-stone-500">
              Additional workspaces will appear here after they are created.
            </p>
          </div>
        ) : null}
      </div>

      <nav className="space-y-0.5 px-3" aria-label="Workspace navigation">
        <button type="button" className="sidebar-link sidebar-link-active">
          <Home className="size-[17px]" />
          Home
        </button>
        <button type="button" className="sidebar-link">
          <Search className="size-[17px]" />
          Search
          <kbd className="ml-auto rounded border border-stone-300 bg-white px-1.5 py-0.5 text-[10px] text-stone-400">
            ⌘K
          </kbd>
        </button>
      </nav>

      <div className="mt-5 flex min-h-0 flex-1 flex-col px-3">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Pages
          </span>
          <button
            type="button"
            className="grid size-6 place-items-center rounded-md text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Create a page"
            title="Page creation is not connected yet"
            disabled
          >
            <Plus className="size-4" />
          </button>
        </div>

        <div className="mx-1 mt-2 rounded-xl border border-dashed border-stone-300/90 bg-white/55 px-4 py-5 text-center">
          <Files className="mx-auto size-5 text-stone-400" />
          <p className="mt-2 text-xs font-medium text-stone-600">No pages yet</p>
          <p className="mt-1 text-[11px] leading-4 text-stone-400">
            Your page tree will live here.
          </p>
        </div>
      </div>

      <div className="space-y-0.5 border-t border-stone-200/80 p-3">
        <button type="button" className="sidebar-link">
          <Settings className="size-[17px]" />
          Settings
        </button>
        <button type="button" className="sidebar-link">
          <CircleHelp className="size-[17px]" />
          Help &amp; support
        </button>
      </div>
    </aside>
  );
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
      <span className={`size-1.5 rounded-full ${color}`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useCloseOnOutsideClick(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm transition hover:border-stone-300 hover:text-stone-800"
        aria-label="Open profile menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <UserRound className="size-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-64 rounded-xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-900/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="grid size-9 place-items-center rounded-full bg-stone-100 text-stone-500">
              <UserRound className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-stone-800">Account not connected</p>
              <p className="text-xs text-stone-400">Authentication comes next</p>
            </div>
          </div>
          <div className="my-1 h-px bg-stone-100" />
          <button type="button" className="menu-item" disabled>
            <Settings className="size-4" />
            Account settings
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceShell() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh min-h-[620px] overflow-hidden bg-[#fbfcfa] text-stone-900">
      <div className="hidden lg:block">
        <Sidebar />
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
            <Sidebar onClose={() => setMobileSidebarOpen(false)} />
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
          <PanelLeftClose className="hidden size-4 text-stone-300 lg:block" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-stone-700">Home</p>
            <p className="truncate text-xs text-stone-400">Workspace overview</p>
          </div>
          <ApiStatus />
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="Notifications"
          >
            <Bell className="size-[18px]" />
          </button>
          <ProfileMenu />
        </header>

        <section className="relative flex min-h-0 flex-1 overflow-y-auto">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_50%_0%,rgba(217,249,233,0.55),transparent_65%)]" />
          <div className="relative mx-auto flex w-full max-w-5xl flex-col px-5 py-10 sm:px-10 sm:py-14 lg:px-16">
            <div className="mb-12 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  <Sparkles className="size-3.5" />
                  Fresh workspace
                </p>
                <h1 className="text-3xl font-semibold tracking-[-0.035em] text-stone-900 sm:text-4xl">
                  A clear place to think together.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
                  Pages, comments, and real-time collaboration will come together here as your
                  workspace grows.
                </p>
              </div>
              <button
                type="button"
                className="hidden rounded-lg p-2 text-stone-400 hover:bg-white hover:text-stone-700 sm:block"
                aria-label="More workspace options"
              >
                <MoreHorizontal className="size-5" />
              </button>
            </div>

            <div className="grid flex-1 place-items-center rounded-2xl border border-stone-200/90 bg-white/90 px-6 py-16 shadow-[0_1px_2px_rgba(28,25,23,0.03),0_20px_50px_rgba(28,25,23,0.04)] sm:px-12">
              <div className="max-w-sm text-center">
                <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100/50">
                  <FilePlus2 className="size-7" strokeWidth={1.7} />
                </div>
                <h2 className="mt-6 text-xl font-semibold tracking-[-0.02em] text-stone-800">
                  No pages yet
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  This workspace is ready for its first document. Page creation will be connected in
                  the next implementation milestone.
                </p>
                <button
                  type="button"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45"
                  disabled
                  title="Page creation is not connected yet"
                >
                  <Plus className="size-4" />
                  Create your first page
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
