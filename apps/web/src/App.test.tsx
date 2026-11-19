import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderApp(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('application routing', () => {
  it('redirects an unauthenticated visitor to login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } },
        401,
      ),
    );

    renderApp();

    expect(await screen.findByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  });

  it('shows a real empty-workspace state for an authenticated user', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) {
        return jsonResponse({
          user: {
            id: '9d788ef3-f6ce-421b-ab25-a759fbb5f3ec',
            email: 'user@example.test',
            name: 'Test User',
            avatarUrl: null,
            createdAt: new Date().toISOString(),
          },
        });
      }
      if (url.endsWith('/api/workspaces')) return jsonResponse({ workspaces: [] });
      return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, 404);
    });

    renderApp();

    expect(await screen.findByRole('heading', { name: 'No workspaces yet' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'New workspace' })).toBeEnabled();
  });
});
