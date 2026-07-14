import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Auth0Provider } from '@auth0/auth0-react';
import { fn, expect, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';

import HistoryPage from './HistoryPage.jsx';

function withProviders(Story) {
  const StoryComponent = Story;

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <Auth0Provider
      domain="storybook.example.auth0.com"
      clientId="storybook-client-id"
      authorizationParams={{ redirect_uri: window.location.origin }}
    >
      <QueryClientProvider client={queryClient}>
        <StoryComponent />
      </QueryClientProvider>
    </Auth0Provider>
  );
}

const historyItems = [
  {
    domain: 'example.com',
    lastStatus: 'success',
    lastScannedAt: '2026-07-12T10:30:00.000Z',
    lastDurationMs: 2140,
    lastUnsupportedCount: 2,
  },
  {
    domain: 'docs.example.com',
    lastStatus: 'failed',
    lastScannedAt: '2026-07-11T08:15:00.000Z',
    lastDurationMs: 876,
    lastUnsupportedCount: 0,
  },
];

const runHistory = [
  {
    id: 'run-1',
    scannedAt: '2026-07-12T10:30:00.000Z',
    status: 'success',
    durationMs: 2140,
    unsupportedCount: 2,
  },
  {
    id: 'run-2',
    scannedAt: '2026-07-11T08:15:00.000Z',
    status: 'failed',
    durationMs: 876,
    unsupportedCount: 0,
    errorCategory: 'auth_required',
    errorMessage: 'REST API blocked',
  },
];

export default {
  component: HistoryPage,
  tags: ['autodocs', 'ai-generated', 'needs-work'],
  decorators: [withProviders],
  args: {
    onRescan: fn(),
    onUseDomain: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('http://localhost:4100/api/scan-history', () =>
          HttpResponse.json({
            items: historyItems,
            pagination: {
              total: historyItems.length,
            },
          })
        ),
        http.get('http://localhost:4100/api/scan-history/:domain', ({ params }) => {
          if (params.domain !== 'example.com') {
            return HttpResponse.json({ runs: [] });
          }

          return HttpResponse.json({ runs: runHistory });
        }),
      ],
    },
  },
};

export const Default = {};

export const WithRunsOpen = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    const row = await canvas.findByText('example.com');
    const tableRow = row.closest('tr');
    await user.click(within(tableRow).getByRole('button', { name: /view runs/i }));

    expect(await canvas.findByText(/recent runs for example\.com/i)).toBeInTheDocument();
    expect(await canvas.findByText(/Duration: 2.1s/i)).toBeInTheDocument();
  },
};
