import type {
  AddWorkspaceMemberRequest,
  CreatePageRequest,
  CreateWorkspaceRequest,
  LoginRequest,
  PageSummary,
  PublicUser,
  RegisterRequest,
  SetPagePermissionRequest,
  UpdatePageRequest,
  UpdateWorkspaceMemberRequest,
  UpdateWorkspaceRequest,
  WorkspaceMemberSummary,
  WorkspaceSummary,
} from '@collaborative-workspace/shared';
import { healthResponseSchema, type HealthResponse } from '@collaborative-workspace/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(path, { ...init, credentials: 'include', headers });
  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: unknown };
  } | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'REQUEST_FAILED',
      payload?.error?.message ?? 'The request could not be completed.',
      payload?.error?.details,
    );
  }
  return payload as T;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', {
    credentials: 'include',
    signal: signal ?? null,
  });
  if (!response.ok) throw new Error('The API is unavailable.');
  return healthResponseSchema.parse(await response.json());
}

export function register(input: RegisterRequest): Promise<{ user: PublicUser }> {
  return apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(input) });
}

export function login(input: LoginRequest): Promise<{ user: PublicUser }> {
  return apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

export function logout(): Promise<void> {
  return apiRequest('/api/auth/logout', { method: 'POST' });
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  try {
    return (await apiRequest<{ user: PublicUser }>('/api/auth/me')).user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return (await apiRequest<{ workspaces: WorkspaceSummary[] }>('/api/workspaces')).workspaces;
}

export async function createWorkspace(input: CreateWorkspaceRequest): Promise<WorkspaceSummary> {
  return (
    await apiRequest<{ workspace: WorkspaceSummary }>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).workspace;
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceSummary> {
  return (await apiRequest<{ workspace: WorkspaceSummary }>(`/api/workspaces/${workspaceId}`))
    .workspace;
}

export async function updateWorkspace(
  workspaceId: string,
  input: UpdateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  return (
    await apiRequest<{ workspace: WorkspaceSummary }>(`/api/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  ).workspace;
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberSummary[]> {
  return (
    await apiRequest<{ members: WorkspaceMemberSummary[] }>(
      `/api/workspaces/${workspaceId}/members`,
    )
  ).members;
}

export async function addWorkspaceMember(
  workspaceId: string,
  input: AddWorkspaceMemberRequest,
): Promise<WorkspaceMemberSummary> {
  return (
    await apiRequest<{ member: WorkspaceMemberSummary }>(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).member;
}

export async function updateWorkspaceMember(
  workspaceId: string,
  userId: string,
  input: UpdateWorkspaceMemberRequest,
): Promise<WorkspaceMemberSummary> {
  return (
    await apiRequest<{ member: WorkspaceMemberSummary }>(
      `/api/workspaces/${workspaceId}/members/${userId}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    )
  ).member;
}

export function removeWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
  return apiRequest(`/api/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' });
}

export async function listPages(
  workspaceId: string,
  includeArchived = false,
): Promise<PageSummary[]> {
  const query = includeArchived ? '?includeArchived=true' : '';
  return (
    await apiRequest<{ pages: PageSummary[] }>(`/api/workspaces/${workspaceId}/pages${query}`)
  ).pages;
}

export async function createPage(
  workspaceId: string,
  input: CreatePageRequest,
): Promise<PageSummary> {
  return (
    await apiRequest<{ page: PageSummary }>(`/api/workspaces/${workspaceId}/pages`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).page;
}

export async function getPage(workspaceId: string, pageId: string): Promise<PageSummary> {
  return (await apiRequest<{ page: PageSummary }>(`/api/workspaces/${workspaceId}/pages/${pageId}`))
    .page;
}

export async function updatePage(
  workspaceId: string,
  pageId: string,
  input: UpdatePageRequest,
): Promise<PageSummary> {
  return (
    await apiRequest<{ page: PageSummary }>(`/api/workspaces/${workspaceId}/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  ).page;
}

export async function archivePage(workspaceId: string, pageId: string): Promise<PageSummary> {
  return (
    await apiRequest<{ page: PageSummary }>(
      `/api/workspaces/${workspaceId}/pages/${pageId}/archive`,
      { method: 'POST' },
    )
  ).page;
}

export async function restorePage(workspaceId: string, pageId: string): Promise<PageSummary> {
  return (
    await apiRequest<{ page: PageSummary }>(
      `/api/workspaces/${workspaceId}/pages/${pageId}/restore`,
      { method: 'POST' },
    )
  ).page;
}

export function deletePage(workspaceId: string, pageId: string): Promise<void> {
  return apiRequest(`/api/workspaces/${workspaceId}/pages/${pageId}`, { method: 'DELETE' });
}

export function setPagePermission(
  workspaceId: string,
  pageId: string,
  userId: string,
  input: SetPagePermissionRequest,
): Promise<{ permission: { userId: string; access: string } }> {
  return apiRequest(`/api/workspaces/${workspaceId}/pages/${pageId}/permissions/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export interface CollaborationCredentials {
  token: string;
  expiresAt: string;
  endpoint: string;
  access: PageSummary['access'];
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    color: string;
  };
}

export function getCollaborationCredentials(
  workspaceId: string,
  pageId: string,
): Promise<CollaborationCredentials> {
  return apiRequest(`/api/workspaces/${workspaceId}/pages/${pageId}/collaboration-token`, {
    method: 'POST',
  });
}
