import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvestigationsPage from './InvestigationsPage';
import { loadAnonymousInvestigation } from '../../services/anonymousInvestigations.js';

const mockedLoadAnonymousInvestigation = vi.mocked(loadAnonymousInvestigation);

vi.mock('../../services/anonymousInvestigations.js', () => ({
  loadAnonymousInvestigation: vi.fn(),
  saveAnonymousInvestigation: vi.fn(),
}));

const remoteInvestigation = {
  id: 'inv-remote',
  submittedUrl: 'Remote.example',
  normalizedUrl: 'https://remote.example',
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-11T12:00:00.000Z',
  redirectChain: ['https://remote.example'],
  capabilities: [
    { name: 'html', status: 'success', result: { findings: [{ id: 'finding-1' }] } },
    { name: 'wp-json', status: 'success', result: { findings: [{ id: 'finding-2' }, { id: 'finding-3' }, { id: 'finding-4' }] } },
    { name: 'sitemap', status: 'queued' },
  ],
  observationTimeline: [],
  evidence: [],
  findings: [{ id: 'finding-1' }, { id: 'finding-2' }, { id: 'finding-3' }, { id: 'finding-4' }],
};

function renderPage(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <InvestigationsPage isAuthenticated={false} {...props} />
    </QueryClientProvider>
  );
}

function localSnapshot(domain = 'local.example') {
  return {
    domain: { submitted: domain, normalized: `https://${domain}` },
    record: {
      recordType: 'session',
      session: {
        id: 'local-session',
        investigationId: 'local-investigation',
        status: 'completed',
        startedAt: '2026-09-10T12:00:00.000Z',
        completedAt: '2026-09-10T12:01:00.000Z',
        selectedCapabilities: [
          { id: 'html', dependencies: [] },
          { id: 'wp-json', dependencies: [] }
        ],
        capabilityStates: {
          html: {
            status: 'success',
            outcome: { status: 'success', result: { findings: [{ id: 'finding-1' }] }, error: null },
            retry: { status: 'not-retryable' }
          },
          'wp-json': {
            status: 'failed',
            outcome: {
              status: 'failed',
              result: null,
              error: { code: 'failed', message: 'Failed', retryable: false }
            },
            retry: { status: 'not-retryable' }
          }
        },
        overall: { status: 'incomplete' }
      },
      persistedAt: '2026-09-10T12:01:00.000Z'
    }
  };
}

describe('InvestigationsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedLoadAnonymousInvestigation.mockReturnValue(null);
  });

  it('renders local summary and sends local resume callback', async () => {
    mockedLoadAnonymousInvestigation.mockReturnValue(localSnapshot() as never);
    const onResumeLocal = vi.fn();

    renderPage({ onResumeLocal });

    expect(screen.getByText('Local')).toBeInTheDocument();
    expect(screen.getByText('local.example')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /resume local\.example/i }));
    expect(onResumeLocal).toHaveBeenCalledTimes(1);
  });

  it('renders authenticated summaries and resumes by persisted id', async () => {
    const investigationStore = { list: vi.fn().mockResolvedValue([remoteInvestigation]), get: vi.fn(), save: vi.fn(), claim: vi.fn() };
    const onResumeInvestigation = vi.fn();

    renderPage({ isAuthenticated: true, authSession: { getUserId: () => 'user-1', getAccessToken: async () => 'token' }, investigationStore, onResumeInvestigation });

    expect(await screen.findByText('remote.example')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /resume remote\.example/i }));
    expect(onResumeInvestigation).toHaveBeenCalledWith('inv-remote');
  });

  it('shows loading and empty states', async () => {
    let resolveRequest;
    const investigationStore = { list: vi.fn().mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; })), get: vi.fn(), save: vi.fn(), claim: vi.fn() };
    renderPage({ isAuthenticated: true, authSession: { getUserId: () => 'user-1', getAccessToken: async () => 'token' }, investigationStore });
    expect(screen.getByText('Loading investigations')).toBeInTheDocument();
    resolveRequest([]);
    expect(await screen.findByText(/no investigations yet/i)).toBeInTheDocument();

  });

  it('shows API errors with a retry action', async () => {
    const investigationStore = { list: vi.fn().mockRejectedValue(new Error('Network unavailable')), get: vi.fn(), save: vi.fn(), claim: vi.fn() };
    renderPage({ isAuthenticated: true, authSession: { getUserId: () => 'user-1', getAccessToken: async () => 'token' }, investigationStore });
    expect(await screen.findByText('Could not load investigations')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeEnabled();
  });
});
