import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvestigationsPage from './InvestigationsPage';
import { fetchInvestigations } from '../../api/client.js';
import { loadAnonymousInvestigation } from '../../services/anonymousInvestigations.js';

const mockedFetchInvestigations = vi.mocked(fetchInvestigations);
const mockedLoadAnonymousInvestigation = vi.mocked(loadAnonymousInvestigation);

vi.mock('../../services/anonymousInvestigations.js', () => ({
  loadAnonymousInvestigation: vi.fn(),
  saveAnonymousInvestigation: vi.fn(),
}));

vi.mock('../../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client.js')>();
  return {
    ...actual,
    fetchInvestigations: vi.fn(),
  };
});

const summary = {
  id: 'inv-remote',
  domain: { submitted: 'Remote.example', normalized: 'https://remote.example' },
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-11T12:00:00.000Z',
  latestSessionId: 'session-remote',
  selectedCapabilityCount: 3,
  completedCapabilityCount: 2,
  findingsCount: 4
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
    mockedFetchInvestigations.mockResolvedValue({ investigations: [] } as never);
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
    mockedFetchInvestigations.mockResolvedValue({ investigations: [summary] } as never);
    const onResumeInvestigation = vi.fn();

    renderPage({ isAuthenticated: true, onResumeInvestigation });

    expect(await screen.findByText('remote.example')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /resume remote\.example/i }));
    expect(onResumeInvestigation).toHaveBeenCalledWith('inv-remote');
  });

  it('shows loading and empty states', async () => {
    let resolveRequest;
    mockedFetchInvestigations.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }) as never);
    renderPage({ isAuthenticated: true });
    expect(screen.getByText('Loading investigations')).toBeInTheDocument();
    resolveRequest({ investigations: [] } as never);
    expect(await screen.findByText(/no investigations yet/i)).toBeInTheDocument();

  });

  it('shows API errors with a retry action', async () => {
    mockedFetchInvestigations.mockRejectedValue(new Error('Network unavailable'));
    renderPage({ isAuthenticated: true });
    expect(await screen.findByText('Could not load investigations')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeEnabled();
  });
});
