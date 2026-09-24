import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScanPage from './ScanPage';
import { loadAnonymousInvestigation, loadAuthenticatedInvestigationId } from '../../services/anonymousInvestigations.js';

const mocks = vi.hoisted(() => {
  const workflow = {
    start: vi.fn(),
    run: vi.fn(),
    retry: vi.fn(),
    resume: vi.fn(),
    claim: vi.fn(),
  };
  const setInvestigatorSession = vi.fn();
  const setSelectedInvestigationId = vi.fn();
  const shellContext = {
    domain: '',
    handleDomainChange: vi.fn(),
    setActivePage: vi.fn(),
    activeDomain: '',
    setInvestigatorDomain: vi.fn(),
    selectedInvestigationId: null,
    setSelectedInvestigationId,
  };
  return { workflow, createWorkflow: vi.fn(() => workflow), setInvestigatorSession, setSelectedInvestigationId, shellContext };
});

vi.mock('../../services/investigationSession.js', () => ({
  createInvestigatorWorkflow: mocks.createWorkflow,
  addInvestigationCapability: vi.fn((investigation) => investigation),
  getInvestigatorSelection: vi.fn(),
}));

vi.mock('../../context/ScanContext', () => ({
  useScanShellContext: () => mocks.shellContext,
  useScanResultsContext: () => ({
    session: null,
    investigatorSession: null,
    setInvestigatorSession: mocks.setInvestigatorSession,
    setInvestigatorRetryCapability: vi.fn(),
    isScanning: false,
    scanSettings: { capabilityIds: ['homepage'], options: { homepage: {} } },
    updateScanSettings: vi.fn(),
    saveScanDefaults: vi.fn(),
    runCapability: vi.fn(),
    retryCapability: vi.fn(),
  }),
}));

vi.mock('../templates/AppLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../molecules/forms/DomainForm', () => ({ default: ({ onSubmit, isScanning }) => (
  <button type="button" disabled={isScanning} onClick={() => onSubmit('example.com', 'Example.com')}>Scan site</button>
) }));
vi.mock('./ScanSidebarNav', () => ({ default: () => null }));
vi.mock('./scan/ScanSectionContent.jsx', () => ({ default: () => null }));
vi.mock('./scan/RecentDomainsCard.jsx', () => ({ default: () => null }));
vi.mock('./ScanStatusStack', () => ({ default: () => null }));
vi.mock('../../api/client.js', () => ({
  fetchUnsupportedPlugins: vi.fn().mockResolvedValue([]),
  fetchUserRecentRuns: vi.fn().mockResolvedValue({ items: [] }),
  request: vi.fn().mockResolvedValue({ ok: true, data: { domains: [] } }),
  clearUserRecentRuns: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('../../services/anonymousInvestigations.js', () => ({
  loadAnonymousInvestigation: vi.fn(() => null),
  loadAuthenticatedInvestigationId: vi.fn(() => null),
  removeAnonymousInvestigation: vi.fn(),
}));

const investigation = {
  id: 'investigation-1',
  submittedUrl: 'Example.com',
  normalizedUrl: 'https://example.com',
  redirectChain: ['https://example.com'],
  createdAt: '2026-09-23T12:00:00.000Z',
  capabilities: [{ name: 'homepage', status: 'success', result: { findings: [] } }],
  observationTimeline: [],
  evidence: [],
  findings: [],
};

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ScanPage
        authSession={{ getUserId: () => null, getAccessToken: async () => null }}
        isAuthenticated={false}
      />
    </QueryClientProvider>,
  );
}

describe('ScanPage workflow boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shellContext.selectedInvestigationId = null;
    mocks.shellContext.activeDomain = '';
    mocks.workflow.start.mockResolvedValue({
      investigation,
      session: { domain: { normalized: investigation.normalizedUrl }, selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' } },
    });
    mocks.workflow.resume.mockResolvedValue({
      investigation,
      session: { domain: { normalized: investigation.normalizedUrl }, selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' } },
    });
  });

  it('passes real AuthSession to workflow and delegates start', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Scan site' }));

    expect(mocks.createWorkflow).toHaveBeenCalledWith(expect.objectContaining({
      auth: expect.objectContaining({ getUserId: expect.any(Function), getAccessToken: expect.any(Function) }),
    }));
    expect(mocks.workflow.start).toHaveBeenCalledWith('Example.com', expect.any(Object));
  });

  it('does not call legacy API or capability runners from page', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Scan site' }));

    expect(mocks.workflow.run).not.toHaveBeenCalled();
    expect(mocks.workflow.retry).not.toHaveBeenCalled();
  });

  it('keeps authenticated claim flow at workflow boundary', async () => {
    const anonymousSnapshot = {
      domain: { submitted: 'Example.com', normalized: 'https://example.com' },
      record: { session: { investigationId: 'anonymous-inv' } },
    };
    const claimed = { ...investigation, id: 'authenticated-inv' };
    vi.mocked(loadAnonymousInvestigation).mockReturnValue(anonymousSnapshot as never);
    mocks.workflow.claim.mockResolvedValue({ investigation: claimed, session: { selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' } } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ScanPage
          authSession={{ getUserId: () => 'user-1', getAccessToken: async () => 'token' }}
          isAuthenticated
        />
      </QueryClientProvider>,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Import this investigation' }));

    expect(mocks.workflow.claim).toHaveBeenCalledWith('anonymous-inv');
    expect(mocks.setInvestigatorSession).toHaveBeenCalled();
  });

  it('resumes selected authenticated investigation instead of sentinel state', async () => {
    mocks.shellContext.selectedInvestigationId = 'selected-investigation';
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ScanPage
          authSession={{ getUserId: () => 'user-1', getAccessToken: async () => 'token' }}
          isAuthenticated
        />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.workflow.resume).toHaveBeenCalledWith('selected-investigation'));
  });

  it('clears selected investigation before starting authenticated submission', async () => {
    mocks.shellContext.selectedInvestigationId = 'previous-investigation';
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ScanPage
          authSession={{ getUserId: () => 'user-1', getAccessToken: async () => 'token' }}
          isAuthenticated
        />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Scan site' }));

    expect(mocks.setSelectedInvestigationId).toHaveBeenCalledWith('');
  });

  it('does not duplicate resume when active domain changes during request', async () => {
    let resolveResume;
    mocks.shellContext.selectedInvestigationId = 'selected-investigation';
    mocks.workflow.resume.mockReturnValue(new Promise((resolve) => { resolveResume = resolve; }));
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <ScanPage
          authSession={{ getUserId: () => 'user-1', getAccessToken: async () => 'token' }}
          isAuthenticated
        />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.workflow.resume).toHaveBeenCalledTimes(1));
    mocks.shellContext.activeDomain = 'https://example.com';
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ScanPage
          authSession={{ getUserId: () => 'user-1', getAccessToken: async () => 'token' }}
          isAuthenticated
        />
      </QueryClientProvider>,
    );

    expect(mocks.workflow.resume).toHaveBeenCalledTimes(1);
    resolveResume({ investigation, session: { domain: { normalized: investigation.normalizedUrl }, selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' } } });
  });

  it('does not duplicate anonymous resume when workflow is recreated', async () => {
    vi.mocked(loadAnonymousInvestigation).mockReturnValue({ record: { session: { investigationId: 'anonymous-investigation' } } } as never);
    mocks.createWorkflow.mockImplementation(() => ({ ...mocks.workflow }));
    let resolveResume;
    mocks.workflow.resume.mockReturnValue(new Promise((resolve) => { resolveResume = resolve; }));
    const firstAuthSession = { getUserId: () => null, getAccessToken: async () => null };
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <ScanPage authSession={firstAuthSession} isAuthenticated={false} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.workflow.resume).toHaveBeenCalledTimes(1));
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ScanPage authSession={{ getUserId: () => null, getAccessToken: async () => null }} isAuthenticated={false} />
      </QueryClientProvider>,
    );

    expect(mocks.workflow.resume).toHaveBeenCalledTimes(1);
    resolveResume({ investigation, session: { domain: { normalized: investigation.normalizedUrl }, selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' } } });
  });

  it('does not automatically retry failed persisted resume', async () => {
    mocks.shellContext.selectedInvestigationId = 'failed-investigation';
    mocks.setSelectedInvestigationId.mockImplementation((value) => {
      mocks.shellContext.selectedInvestigationId = value;
    });
    vi.mocked(loadAuthenticatedInvestigationId).mockReturnValue('failed-investigation');
    mocks.workflow.resume.mockRejectedValueOnce(new Error('resume failed'));
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <ScanPage
          authSession={{ getUserId: () => 'user-1', getAccessToken: async () => 'token' }}
          isAuthenticated
        />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(mocks.workflow.resume).toHaveBeenCalledTimes(1));

    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ScanPage
          authSession={{ getUserId: () => 'user-1', getAccessToken: async () => 'token' }}
          isAuthenticated
        />
      </QueryClientProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.workflow.resume).toHaveBeenCalledTimes(1);
    expect(mocks.setSelectedInvestigationId).not.toHaveBeenCalledWith('');
  });

  it('loads anonymous state strictly and renders recovery guidance for corrupt storage', async () => {
    vi.mocked(loadAnonymousInvestigation).mockImplementation(() => {
      throw new Error('Invalid anonymous investigation snapshot');
    });

    renderPage();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/saved investigation data could not be read/i));
    expect(loadAnonymousInvestigation).toHaveBeenCalledWith({ strict: true });
  });
});
