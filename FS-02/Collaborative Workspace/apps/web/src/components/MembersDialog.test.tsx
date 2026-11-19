import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MembersDialog } from './MembersDialog';

const workspaceId = '85a2d2b0-2a48-4d98-9452-907837c49f21';
const joinedAt = '2026-11-19T10:00:00.000Z';
const createdAt = '2026-11-18T10:00:00.000Z';
const owner = {
  role: 'OWNER',
  joinedAt,
  user: {
    id: '47becc89-6223-4e12-b055-432baedc0939',
    email: 'owner@example.test',
    name: 'Workspace Owner',
    avatarUrl: null,
    createdAt,
  },
} as const;
const member = {
  role: 'MEMBER',
  joinedAt,
  user: {
    id: '6dbfd414-62a3-4acd-873c-6f7c44541091',
    email: 'member@example.test',
    name: 'Existing Member',
    avatarUrl: null,
    createdAt,
  },
} as const;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MembersDialog
        open
        workspaceId={workspaceId}
        workspaceName="Product Team"
        workspaceRole="OWNER"
        onClose={() => undefined}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MembersDialog', () => {
  it('lists workspace members with their names, emails, and roles', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ members: [owner, member] }));

    renderDialog();

    expect(await screen.findByText('Workspace Owner')).toBeVisible();
    expect(screen.getByText('owner@example.test')).toBeVisible();
    expect(screen.getByText('Existing Member')).toBeVisible();
    expect(screen.getByText('member@example.test')).toBeVisible();
    expect(screen.getByText('OWNER')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Role for Existing Member' })).toHaveValue(
      'MEMBER',
    );
  });

  it('adds an existing registered user and refreshes the member list', async () => {
    const addedMember = {
      ...member,
      role: 'GUEST',
      user: { ...member.user, email: 'new-member@example.test', name: 'New Member' },
    } as const;
    let listRequests = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith(`/api/workspaces/${workspaceId}/members`) && init?.method === 'POST') {
        return jsonResponse({ member: addedMember }, 201);
      }
      if (url.endsWith(`/api/workspaces/${workspaceId}/members`)) {
        listRequests += 1;
        return jsonResponse({ members: listRequests === 1 ? [owner] : [owner, addedMember] });
      }
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, 404);
    });

    renderDialog();
    await screen.findByText('Workspace Owner');
    fireEvent.change(screen.getByLabelText('Add an existing account'), {
      target: { value: 'new-member@example.test' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'New member role' }), {
      target: { value: 'GUEST' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'New Member was added to the workspace.',
    );
    expect(await screen.findByText('new-member@example.test')).toBeVisible();
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall?.[0]).toBe(`/api/workspaces/${workspaceId}/members`);
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      email: 'new-member@example.test',
      role: 'GUEST',
    });
    await waitFor(() => expect(listRequests).toBeGreaterThan(1));
  });
});
