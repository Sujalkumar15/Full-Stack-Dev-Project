import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Blocks, Plus, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ApiError, createWorkspace, listWorkspaces } from '../lib/api';
import { UserMenu } from './UserMenu';

export function WorkspaceHome() {
  const queryClient = useQueryClient();
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: listWorkspaces });
  const [name, setName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const createMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: async () => {
      setName('');
      setShowCreate(false);
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate({ name });
  }

  return (
    <main className="min-h-dvh bg-[#f7f8f6]">
      <header className="border-b border-stone-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5 font-semibold text-stone-900">
            <span className="grid size-8 place-items-center rounded-lg bg-stone-900 text-white">
              <Blocks className="size-4" />
            </span>
            Collabspace
          </Link>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              <Sparkles className="size-3.5" />
              Your workspaces
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-stone-900 sm:text-4xl">
              Pick up where your team left off.
            </h1>
            <p className="mt-3 text-sm text-stone-500">
              Create a workspace or open one you already belong to.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
          >
            <Plus className="size-4" />
            New workspace
          </button>
        </div>

        {showCreate ? (
          <form
            onSubmit={handleCreate}
            className="mt-8 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:flex-row"
          >
            <input
              className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Workspace name"
              minLength={2}
              maxLength={80}
              autoFocus
              required
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {createMutation.isPending ? 'Creating…' : 'Create workspace'}
            </button>
          </form>
        ) : null}

        {createMutation.error ? (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {createMutation.error instanceof ApiError
              ? createMutation.error.message
              : 'Unable to create the workspace.'}
          </p>
        ) : null}

        {workspaces.isLoading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-40 animate-pulse rounded-2xl bg-stone-200/70" />
            ))}
          </div>
        ) : workspaces.isError ? (
          <div className="mt-10 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            Unable to load your workspaces. Please refresh and try again.
          </div>
        ) : workspaces.data?.length ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.data.map((workspace) => (
              <Link
                key={workspace.id}
                to={`/workspaces/${workspace.id}`}
                className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-stone-900/5"
              >
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-lg font-semibold text-emerald-700">
                    {workspace.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold tracking-wide text-stone-500">
                    {workspace.role}
                  </span>
                </div>
                <h2 className="mt-5 truncate text-base font-semibold text-stone-800">
                  {workspace.name}
                </h2>
                <p className="mt-1 flex items-center gap-1 text-xs text-stone-400 group-hover:text-emerald-700">
                  Open workspace <ArrowRight className="size-3" />
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
            <Blocks className="mx-auto size-7 text-stone-400" />
            <h2 className="mt-4 font-semibold text-stone-800">No workspaces yet</h2>
            <p className="mt-2 text-sm text-stone-500">
              Create your first workspace to start organizing pages.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
