import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('application shell', () => {
  it('renders an honest empty workspace state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          service: 'collaborative-workspace-api',
          timestamp: new Date().toISOString(),
          requestId: 'test-request',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getAllByText('No pages yet')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Create your first page' })).toBeDisabled();
    expect(await screen.findByText('API ready')).toBeInTheDocument();
  });
});
