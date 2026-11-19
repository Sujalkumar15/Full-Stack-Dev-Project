import { useEffect, useState, type FormEvent } from 'react';
import type {
  AddWorkspaceMemberRequest,
  WorkspaceMemberSummary,
  WorkspaceRole,
} from '@collaborative-workspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, MailPlus, Trash2, UserRound, Users, X } from 'lucide-react';

import {
  addWorkspaceMember,
  ApiError,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMember,
} from '../lib/api';

interface MembersDialogProps {
  open: boolean;
  workspaceId: string;
  workspaceName: string;
  workspaceRole: WorkspaceRole;
  onClose: () => void;
}

const assignableRoles = ['ADMIN', 'MEMBER', 'GUEST'] as const;

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The member operation could not be completed.';
}

export function MembersDialog({
  open,
  workspaceId,
  workspaceName,
  workspaceRole,
  onClose,
}: MembersDialogProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AddWorkspaceMemberRequest['role']>('MEMBER');
  const [success, setSuccess] = useState<string | null>(null);
  const canManage = workspaceRole === 'OWNER' || workspaceRole === 'ADMIN';
  const rolesForActor =
    workspaceRole === 'OWNER'
      ? assignableRoles
      : assignableRoles.filter((item) => item !== 'ADMIN');

  const members = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => listWorkspaceMembers(workspaceId),
    enabled: open,
  });
  const addMember = useMutation({
    mutationFn: (input: AddWorkspaceMemberRequest) => addWorkspaceMember(workspaceId, input),
    onSuccess: async (member) => {
      setEmail('');
      setRole('MEMBER');
      setSuccess(`${member.user.name} was added to the workspace.`);
      await queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
  });
  const changeRole = useMutation({
    mutationFn: ({
      userId,
      nextRole,
    }: {
      userId: string;
      nextRole: AddWorkspaceMemberRequest['role'];
    }) => updateWorkspaceMember(workspaceId, userId, { role: nextRole }),
    onSuccess: async (member) => {
      setSuccess(`${member.user.name}'s role is now ${member.role}.`);
      await queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
  });
  const removeMember = useMutation({
    mutationFn: (member: WorkspaceMemberSummary) =>
      removeWorkspaceMember(workspaceId, member.user.id).then(() => member),
    onSuccess: async (member) => {
      setSuccess(`${member.user.name} was removed from the workspace.`);
      await queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
  });

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setSuccess(null);
      addMember.reset();
      changeRole.reset();
      removeMember.reset();
    }
  }, [open]);

  if (!open) return null;

  const mutationError = addMember.error ?? changeRole.error ?? removeMember.error;
  const mutationPending = addMember.isPending || changeRole.isPending || removeMember.isPending;

  function resetFeedback() {
    setSuccess(null);
    addMember.reset();
    changeRole.reset();
    removeMember.reset();
  }

  function submitMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();
    addMember.mutate({ email, role });
  }

  function canManageMember(member: WorkspaceMemberSummary): boolean {
    if (!canManage || member.role === 'OWNER') return false;
    return !(workspaceRole === 'ADMIN' && member.role === 'ADMIN');
  }

  function confirmRemove(member: WorkspaceMemberSummary) {
    resetFeedback();
    if (window.confirm(`Remove ${member.user.name} from ${workspaceName}?`)) {
      removeMember.mutate(member);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm"
        aria-label="Close members dialog"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="members-dialog-title"
        className="relative flex max-h-[min(760px,90dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-stone-950/20"
      >
        <header className="flex items-start gap-3 border-b border-stone-200 px-5 py-4 sm:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
            <Users className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="members-dialog-title" className="font-semibold text-stone-900">
              Workspace members
            </h2>
            <p className="mt-1 truncate text-sm text-stone-500">{workspaceName}</p>
          </div>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        {canManage ? (
          <form
            className="border-b border-stone-100 bg-stone-50/70 p-5 sm:px-6"
            onSubmit={submitMember}
          >
            <label className="block text-xs font-semibold text-stone-600" htmlFor="member-email">
              Add an existing account
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_auto]">
              <input
                id="member-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="person@example.com"
                autoComplete="email"
                required
                disabled={mutationPending}
                className="min-w-0 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as AddWorkspaceMemberRequest['role'])
                }
                aria-label="New member role"
                disabled={mutationPending}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-emerald-500 disabled:opacity-60"
              >
                {rolesForActor.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={mutationPending}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
              >
                {addMember.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <MailPlus className="size-4" />
                )}
                Add
              </button>
            </div>
            <p className="mt-2 text-xs text-stone-400">
              The person must already have a registered account. Owner access cannot be assigned
              here.
            </p>
          </form>
        ) : (
          <div className="border-b border-stone-100 bg-stone-50 px-5 py-3 text-sm text-stone-500 sm:px-6">
            You can view members. Only workspace owners and administrators can manage them.
          </div>
        )}

        {success ? (
          <div
            role="status"
            className="border-b border-emerald-100 bg-emerald-50 px-5 py-2.5 text-sm text-emerald-800 sm:px-6"
          >
            {success}
          </div>
        ) : null}
        {mutationError ? (
          <div
            role="alert"
            className="border-b border-rose-100 bg-rose-50 px-5 py-2.5 text-sm text-rose-700 sm:px-6"
          >
            {errorMessage(mutationError)}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {members.isLoading ? (
            <div className="grid min-h-48 place-items-center text-sm text-stone-500">
              <span className="flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" /> Loading members…
              </span>
            </div>
          ) : members.isError ? (
            <div className="rounded-xl bg-rose-50 px-4 py-8 text-center">
              <p className="text-sm text-rose-700">{errorMessage(members.error)}</p>
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-rose-700 underline"
                onClick={() => void members.refetch()}
              >
                Try again
              </button>
            </div>
          ) : members.data?.length ? (
            <ul className="space-y-1" aria-label="Workspace member list">
              {members.data.map((member) => {
                const manageable = canManageMember(member);
                return (
                  <li
                    key={member.user.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl px-2 py-3 hover:bg-stone-50 sm:flex-nowrap sm:px-3"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-semibold text-stone-600">
                      {member.user.name.slice(0, 1).toUpperCase() || (
                        <UserRound className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-800">
                        {member.user.name}
                      </span>
                      <span className="block truncate text-xs text-stone-500">
                        {member.user.email}
                      </span>
                    </span>
                    {manageable ? (
                      <select
                        value={member.role}
                        aria-label={`Role for ${member.user.name}`}
                        disabled={mutationPending}
                        onChange={(event) => {
                          resetFeedback();
                          changeRole.mutate({
                            userId: member.user.id,
                            nextRole: event.target.value as AddWorkspaceMemberRequest['role'],
                          });
                        }}
                        className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs font-medium text-stone-600 outline-none focus:border-emerald-500 disabled:opacity-60"
                      >
                        {rolesForActor.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                        {member.role}
                      </span>
                    )}
                    {manageable ? (
                      <button
                        type="button"
                        aria-label={`Remove ${member.user.name}`}
                        disabled={mutationPending}
                        onClick={() => confirmRemove(member)}
                        className="grid size-8 place-items-center rounded-lg text-stone-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid min-h-48 place-items-center text-center">
              <div>
                <Users className="mx-auto size-6 text-stone-300" />
                <p className="mt-3 text-sm font-medium text-stone-700">No members found</p>
                <p className="mt-1 text-xs text-stone-400">
                  Add a registered account to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
