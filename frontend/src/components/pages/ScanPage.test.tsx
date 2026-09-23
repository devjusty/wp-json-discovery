import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScanPage from './ScanPage';
import { clearUserRecentRuns } from '../../api/client.js';

const mocks = vi.hoisted(() => ({
  domainForm: vi.fn(({ onSubmit, isScanning }) => (
    <button type="button" disabled={isScanning} onClick={() => onSubmit('example.com', 'Example.com')}>
      Scan site
    </button>
  )),
  updateScanSettings: vi.fn(),
  saveScanDefaults: vi.fn(),
  startScan: vi.fn(),
  scanResults: null,
  sidebar: vi.fn(),
  startInvestigation: vi.fn(),
  fetchInvestigation: vi.fn(),
  saveInvestigationSession: vi.fn(),
  claimAnonymousInvestigation: vi.fn(),
  createInvestigationSession: vi.fn(),
  addInvestigationCapability: vi.fn((session) => session),
  runInvestigationSession: vi.fn(),
  recoverInvestigationSession: vi.fn((session) => session),
  retryInvestigationCapability: vi.fn(),
  loadAnonymousInvestigation: vi.fn(() => null),
  loadAuthenticatedInvestigationId: vi.fn(() => null),
  saveAuthenticatedInvestigationId: vi.fn(),
  saveAnonymousInvestigation: vi.fn(),
  removeAnonymousInvestigation: vi.fn(),
  setInvestigatorDomain: vi.fn(),
  activeDomain: ''
}));

vi.mock('../templates/AppLayout', () => ({
  default: ({ children, sidebar, title }) => (
    <div>
      <h1>{title}</h1>
      {sidebar}
      {children}
    </div>
  )
}));

vi.mock('../molecules/forms/DomainForm', () => ({
  default: mocks.domainForm
}));

vi.mock('../../context/ScanContext', () => ({
  useScanShellContext: () => ({
    domain: 'example.com',
    handleDomainChange: vi.fn(),
    setActivePage: vi.fn(),
    startScan: mocks.startScan,
    activeDomain: mocks.activeDomain,
    setInvestigatorDomain: mocks.setInvestigatorDomain
  }),
  useScanResultsContext: () => mocks.scanResults
}));

function createScanResults(overrides = {}) {
  return {
    session: null,
    isScanning: false,
    scanSettings: {
      capabilityIds: ['homepage', 'wordpress'],
      options: { homepage: {}, wordpress: {} }
    },
    updateScanSettings: mocks.updateScanSettings,
    saveScanDefaults: mocks.saveScanDefaults,
    runCapability: vi.fn(),
    retryCapability: vi.fn(),
    ...overrides
  };
}

vi.mock('./scan/ScanSidebarNav', () => ({
  default: (props) => {
    mocks.sidebar(props);
    return (
      <nav aria-label="Scan navigation">
      <span data-testid="active-section">{props.activeSection}</span>
      <button type="button" disabled={!props.hasSession} onClick={() => props.onSectionChange('exposure')}>
        Exposure
      </button>
      <button type="button" onClick={() => props.onSectionChange('unsupported')}>
        Unsupported
      </button>
      <button type="button" onClick={() => props.onSectionChange('sitemap')}>
        Sitemap
      </button>
    </nav>
    );
  }
}));

vi.mock('./scan/RecentDomainsCard.jsx', () => ({
  default: ({ onClearRecentDomains, onRescan }) => (
    <section aria-label="Recent scanned domains">
      Recent domains
      <button type="button" onClick={() => onRescan('recent.example.com')}>Rescan recent domain</button>
      <button type="button" onClick={onClearRecentDomains}>Clear recent domains</button>
    </section>
  )
}));

vi.mock('./scan/ScanStatusStack', () => ({
  default: ({ session, onRetryCapability }) => session?.capabilityStates ? (
    <div>
      <p data-testid="session-domain">{session.domain?.normalized}</p>
      <p>Identity: observed</p>
      {session.capabilityStates.wordpress?.outcome?.result?.marker ? <p>{session.capabilityStates.wordpress.outcome.result.marker}</p> : null}
      {session.capabilityStates.wordpress?.status === 'success' ? <p>WordPress API: Complete</p> : null}
       {session.capabilityStates.homepage?.status === 'success' ? <p>Action: review homepage signals</p> : null}
       {session.capabilityStates.wordpress?.status === 'success' ? <p>Exposure: observed</p> : null}
       {session.capabilityStates.homepage?.status === 'failed' ? <button type="button" onClick={() => onRetryCapability('homepage')}>Retry Homepage</button> : null}
       {session.capabilityStates.sitemap?.status === 'failed' ? <button type="button" onClick={() => onRetryCapability('sitemap')}>Retry Sitemap</button> : null}
    </div>
  ) : <div>Scan status stack</div>
}));

vi.mock('../../api/client.js', () => ({
  fetchUnsupportedPlugins: vi.fn().mockResolvedValue([]),
  fetchUserRecentRuns: vi.fn().mockResolvedValue({ items: [] }),
  request: vi.fn().mockResolvedValue({ ok: true, data: { domains: [] } }),
  clearUserRecentRuns: vi.fn().mockResolvedValue({ ok: true }),
  startInvestigation: mocks.startInvestigation,
  fetchInvestigation: mocks.fetchInvestigation,
  saveInvestigationSession: mocks.saveInvestigationSession,
  claimAnonymousInvestigation: mocks.claimAnonymousInvestigation
}));

vi.mock('../../services/investigationSession.js', () => ({
  createInvestigationSession: mocks.createInvestigationSession,
  addInvestigationCapability: mocks.addInvestigationCapability,
  getInvestigatorSelection: vi.fn(() => ({
    capabilityIds: ['homepage', 'wordpress'],
    options: { homepage: {}, wordpress: {} }
  })),
  getCapabilityRunners: vi.fn(() => ({})),
  runInvestigationSession: mocks.runInvestigationSession,
  recoverInvestigationSession: mocks.recoverInvestigationSession,
  retryInvestigationCapability: mocks.retryInvestigationCapability
}));

vi.mock('../../services/scanCapabilities.js', () => ({
  CAPABILITY_IDS: { WORDPRESS: 'wordpress', HOMEPAGE: 'homepage', SITEMAP: 'sitemap', RECON: 'recon' },
  SCAN_CAPABILITIES: [
    { id: 'sitemap', label: 'Sitemap', description: 'Sitemap', required: false, defaultOptions: {}, availability: () => true },
    { id: 'recon', label: 'Domain recon', description: 'Recon', required: false, defaultOptions: {}, availability: () => false }
  ],
  getCapabilityRunners: vi.fn(() => ({})),
  getCapabilitySelection: vi.fn((id) => ({ id, dependencies: id === 'sitemap' ? ['wordpress'] : [] }))
}));

vi.mock('../../services/anonymousInvestigations.js', () => ({
  loadAnonymousInvestigation: mocks.loadAnonymousInvestigation,
  loadAuthenticatedInvestigationId: mocks.loadAuthenticatedInvestigationId,
  saveAuthenticatedInvestigationId: mocks.saveAuthenticatedInvestigationId,
  saveAnonymousInvestigation: mocks.saveAnonymousInvestigation,
  removeAnonymousInvestigation: mocks.removeAnonymousInvestigation,
  createClaimPayload: vi.fn((snapshot) => snapshot && ({ domain: snapshot.domain, anonymousRecord: snapshot.record }))
}));

vi.mock('../../utils/scanFeed.js', () => ({
  mergeRecentScans: vi.fn(() => [])
}));

describe('ScanPage', () => {
  beforeEach(() => {
    mocks.domainForm.mockClear();
    mocks.updateScanSettings.mockClear();
    mocks.saveScanDefaults.mockClear();
    mocks.startScan.mockClear();
    mocks.startInvestigation.mockReset();
    mocks.fetchInvestigation.mockReset();
    mocks.saveInvestigationSession.mockReset();
    mocks.claimAnonymousInvestigation.mockReset();
    mocks.createInvestigationSession.mockReset();
    mocks.runInvestigationSession.mockReset();
    mocks.recoverInvestigationSession.mockReset().mockImplementation((session) => session);
    mocks.retryInvestigationCapability.mockReset();
    mocks.loadAnonymousInvestigation.mockReset().mockReturnValue(null);
    mocks.loadAuthenticatedInvestigationId.mockReset().mockReturnValue(null);
    mocks.saveAuthenticatedInvestigationId.mockReset();
    mocks.saveAnonymousInvestigation.mockReset();
    mocks.removeAnonymousInvestigation.mockReset();
    mocks.setInvestigatorDomain.mockReset();
    mocks.activeDomain = '';
    mocks.scanResults = createScanResults();
  });

  it('starts canonical session and exposes progressive identity, exposure, and action layers', async () => {
    const user = userEvent.setup();
    const initial = { id: 'session-1', investigationId: 'inv-1', status: 'idle', domain: { submitted: 'Example.com', normalized: 'example.com' }, selectedCapabilities: [], capabilityStates: {}, overall: { status: 'incomplete' } };
    const running = { ...initial, status: 'running', capabilityStates: {
      wordpress: { status: 'running', retry: { status: 'not-retryable' } },
      homepage: { status: 'running', retry: { status: 'not-retryable' } }
    } };
    const complete = { ...initial, status: 'completed', selectedCapabilities: [{ id: 'homepage', dependencies: [] }, { id: 'wordpress', dependencies: [] }], capabilityStates: {
      wordpress: { status: 'success', outcome: { status: 'success', result: createWordpressResult(), error: null }, retry: { status: 'not-retryable' } },
      homepage: { status: 'success', outcome: { status: 'success', result: { action: true }, error: null }, retry: { status: 'not-retryable' } }
    }, overall: { status: 'complete' } };
    mocks.startInvestigation.mockResolvedValue({ investigation: { id: 'inv-1' }, sessionIds: ['session-1'] });
    mocks.createInvestigationSession.mockReturnValue(initial);
    mocks.runInvestigationSession.mockImplementation(async (session, runners, onChange) => {
      onChange(running);
      onChange(complete);
      return complete;
    });

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);
    expect(screen.getByRole('button', { name: /scan site/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /scan site/i }));

    expect(await screen.findByText(/identity/i)).toBeInTheDocument();
    expect(screen.getByText('Exposure: observed')).toBeInTheDocument();
    expect(screen.getByText(/action/i)).toBeInTheDocument();
  });

  it('sends registry dependencies when authenticated start persists selected capabilities', async () => {
    const user = userEvent.setup();
    const initial = {
      id: 'session-1',
      investigationId: 'inv-1',
      status: 'idle',
      domain: { submitted: 'Example.com', normalized: 'example.com' },
      selectedCapabilities: [
        { id: 'wordpress', dependencies: [] },
        { id: 'sitemap', dependencies: ['wordpress'] }
      ],
      capabilityStates: {},
      overall: { status: 'incomplete' }
    };
    mocks.startInvestigation.mockResolvedValue({ investigation: { id: 'inv-1' }, sessionIds: ['session-1'] });
    mocks.createInvestigationSession.mockReturnValue(initial);
    mocks.runInvestigationSession.mockResolvedValue(initial);

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: /scan site/i }));

    await waitFor(() => expect(mocks.startInvestigation).toHaveBeenCalledWith(
      { submitted: 'Example.com', normalized: 'example.com' },
      initial.selectedCapabilities
    ));
  });

  it('rescans recent domain through canonical submit and replaces stale session results', async () => {
    const user = userEvent.setup();
    const oldSession = {
      id: 'old-session',
      investigationId: 'old-investigation',
      status: 'completed',
      domain: { submitted: 'old.example.com', normalized: 'old.example.com' },
      selectedCapabilities: [{ id: 'wordpress', dependencies: [] }],
      capabilityStates: {
        wordpress: { status: 'success', outcome: { status: 'success', result: { marker: 'old evidence' }, error: null } }
      },
      capabilities: {},
      overall: { status: 'complete' }
    };
    const nextSession = {
      id: 'new-session',
      investigationId: 'new-investigation',
      status: 'running',
      domain: { submitted: 'recent.example.com', normalized: 'recent.example.com' },
      selectedCapabilities: [{ id: 'wordpress', dependencies: [] }],
      capabilityStates: {
        wordpress: { status: 'running', outcome: { status: 'running', result: null, error: null } }
      },
      overall: { status: 'incomplete' }
    };
    mocks.scanResults = createScanResults({ session: oldSession });
    mocks.startInvestigation.mockResolvedValue({ investigation: { id: 'new-investigation' }, sessionIds: ['new-session'] });
    mocks.createInvestigationSession.mockReturnValue(nextSession);
    mocks.runInvestigationSession.mockResolvedValue(nextSession);

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);
    expect(screen.getByText('old evidence')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /rescan recent domain/i }));

    expect(mocks.startInvestigation).toHaveBeenCalledWith(
      { submitted: 'recent.example.com', normalized: 'recent.example.com' },
      expect.anything()
    );
    expect(mocks.startScan).not.toHaveBeenCalled();
    expect(screen.getByTestId('session-domain')).toHaveTextContent('recent.example.com');
    expect(screen.queryByText('old evidence')).not.toBeInTheDocument();
  });

  it('clears stale results and shows rescan domain before authenticated start resolves', async () => {
    const user = userEvent.setup();
    let resolveStart;
    const oldSession = {
      status: 'completed',
      domain: { submitted: 'old.example.com', normalized: 'old.example.com' },
      capabilityStates: {
        wordpress: { status: 'success', outcome: { status: 'success', result: { marker: 'old evidence' } } }
      },
      capabilities: {}
    };
    const provisionalSession = {
      id: 'local-session',
      investigationId: 'local-investigation',
      status: 'idle',
      domain: { submitted: 'recent.example.com', normalized: 'recent.example.com' },
      selectedCapabilities: [],
      capabilityStates: {},
      overall: { status: 'incomplete' }
    };
    mocks.scanResults = createScanResults({ session: oldSession });
    mocks.startInvestigation.mockImplementation(() => new Promise((resolve) => { resolveStart = resolve; }));
    mocks.createInvestigationSession.mockReturnValue(provisionalSession);

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);
    expect(screen.getByText('old evidence')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /rescan recent domain/i }));

    expect(screen.queryByText('old evidence')).not.toBeInTheDocument();
    expect(screen.getByTestId('session-domain')).toHaveTextContent('recent.example.com');

    resolveStart({ investigation: { id: 'new-investigation' }, sessionIds: ['new-session'] });
  });

  it('keeps stale results cleared when authenticated rescan start fails', async () => {
    const user = userEvent.setup();
    const oldSession = {
      status: 'completed',
      domain: { submitted: 'old.example.com', normalized: 'old.example.com' },
      capabilityStates: {
        wordpress: { status: 'success', outcome: { status: 'success', result: { marker: 'old evidence' } } }
      },
      capabilities: {}
    };
    const provisionalSession = {
      id: 'local-session',
      investigationId: 'local-investigation',
      status: 'idle',
      domain: { submitted: 'recent.example.com', normalized: 'recent.example.com' },
      selectedCapabilities: [],
      capabilityStates: {},
      overall: { status: 'incomplete' }
    };
    mocks.scanResults = createScanResults({ session: oldSession });
    mocks.startInvestigation.mockRejectedValue(new Error('Start unavailable'));
    mocks.createInvestigationSession.mockReturnValue(provisionalSession);

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: /rescan recent domain/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Start unavailable');
    expect(screen.queryByText('old evidence')).not.toBeInTheDocument();
    expect(screen.getByTestId('session-domain')).toHaveTextContent('recent.example.com');
  });

  it('resumes authenticated investigation from retained identity on mount', async () => {
    const resumed = {
      id: 'session-2', investigationId: 'inv-2', status: 'completed',
      selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' }
    };
    mocks.loadAuthenticatedInvestigationId.mockReturnValue('inv-2');
    mocks.fetchInvestigation.mockResolvedValue({
      investigation: { id: 'inv-2', domain: { submitted: 'Example.com', normalized: 'example.com' } },
      latestSession: resumed
    });

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);

    expect(mocks.fetchInvestigation).toHaveBeenCalledWith('inv-2');
    expect(await screen.findByText(/identity/i)).toBeInTheDocument();
  });

  it('does not restore a retained investigation over an active legacy rescan', async () => {
    mocks.activeDomain = 'new.example.com';
    mocks.loadAuthenticatedInvestigationId.mockReturnValue('inv-previous');
    mocks.fetchInvestigation.mockResolvedValue({
      investigation: { id: 'inv-previous', domain: { submitted: 'Previous.com', normalized: 'previous.com' } },
      latestSession: { id: 'session-previous', investigationId: 'inv-previous', status: 'completed', selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' } }
    });

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);

    await act(async () => {});
    expect(mocks.fetchInvestigation).not.toHaveBeenCalled();
    expect(mocks.setInvestigatorDomain).not.toHaveBeenCalled();
  });

  it('recovers anonymous active snapshots without starting network work', async () => {
    const interrupted = {
      id: 'session-anonymous', investigationId: 'inv-anonymous', status: 'running',
      selectedCapabilities: [{ id: 'wordpress', dependencies: [] }],
      capabilityStates: { wordpress: { status: 'running', retry: { status: 'not-retryable' } } },
      overall: { status: 'incomplete' }
    };
    const recovered = { ...interrupted, domain: { submitted: 'Example.com', normalized: 'example.com' }, status: 'failed', capabilityStates: {
      wordpress: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'interrupted', message: 'Interrupted', retryable: true } }, retry: { status: 'not-retryable' } }
    } };
    mocks.loadAnonymousInvestigation.mockReturnValue({
      domain: { submitted: 'Example.com', normalized: 'example.com' },
      record: { recordType: 'session', session: interrupted, persistedAt: '2026-09-10T12:00:00.000Z' }
    });
    mocks.recoverInvestigationSession.mockReturnValue(recovered);

    render(<QueryClientProvider client={new QueryClient()}><ScanPage /></QueryClientProvider>);

    await waitFor(() => expect(mocks.saveAnonymousInvestigation).toHaveBeenCalledWith(expect.objectContaining({ session: recovered })));
    expect(mocks.setInvestigatorDomain).toHaveBeenCalledWith('example.com');
    expect(mocks.runInvestigationSession).not.toHaveBeenCalled();
  });

  it('recovers authenticated active snapshots and persists terminal state without running capabilities', async () => {
    const interrupted = {
      id: 'session-authenticated', investigationId: 'inv-authenticated', status: 'queued',
      selectedCapabilities: [{ id: 'wordpress', dependencies: [] }],
      capabilityStates: { wordpress: { status: 'queued', retry: { status: 'not-retryable' } } },
      overall: { status: 'incomplete' }
    };
    const recovered = { ...interrupted, domain: { submitted: 'Example.com', normalized: 'example.com' }, status: 'failed', capabilityStates: {
      wordpress: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'interrupted', message: 'Interrupted', retryable: true } }, retry: { status: 'not-retryable' } }
    } };
    mocks.loadAuthenticatedInvestigationId.mockReturnValue('inv-authenticated');
    mocks.fetchInvestigation.mockResolvedValue({
      investigation: { id: 'inv-authenticated', domain: { submitted: 'Example.com', normalized: 'example.com' } },
      latestSession: interrupted
    });
    mocks.recoverInvestigationSession.mockReturnValue(recovered);

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);

    await waitFor(() => expect(mocks.saveInvestigationSession).toHaveBeenCalledWith('inv-authenticated', recovered));
    expect(mocks.runInvestigationSession).not.toHaveBeenCalled();
  });

  it('reports authenticated resume failures without claiming anonymous data', async () => {
    mocks.loadAuthenticatedInvestigationId.mockReturnValue('missing-investigation');
    mocks.fetchInvestigation.mockRejectedValue(new Error('Investigation not found'));
    mocks.loadAnonymousInvestigation.mockReturnValue({
      domain: { submitted: 'Example.com', normalized: 'example.com' },
      record: { recordType: 'session', persistedAt: '2026-09-10T12:00:00.000Z', session: { id: 'session-1', investigationId: 'inv-1', status: 'completed', selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' } } }
    });

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be resumed/i);
    expect(screen.getByRole('button', { name: /import this investigation/i })).toBeInTheDocument();
    expect(mocks.claimAnonymousInvestigation).not.toHaveBeenCalled();
  });

  it('runs contextual sitemap through canonical investigator engine', async () => {
    const user = userEvent.setup();
    const canonical = {
      id: 'session-1', investigationId: 'inv-1', status: 'completed',
      domain: { submitted: 'Example.com', normalized: 'example.com' },
      selectedCapabilities: [{ id: 'wordpress', dependencies: [] }, { id: 'sitemap', dependencies: [] }],
      capabilityStates: {
        wordpress: { status: 'success', outcome: { status: 'success', result: createWordpressResult(), error: null }, retry: { status: 'not-retryable' } },
        sitemap: { status: 'idle', outcome: { status: 'idle', result: null, error: null }, retry: { status: 'not-retryable' } }
      },
      overall: { status: 'complete' }
    };
    mocks.startInvestigation.mockResolvedValue({ investigation: { id: 'inv-1' }, sessionIds: ['session-1'] });
    mocks.createInvestigationSession.mockReturnValue(canonical);
    mocks.addInvestigationCapability.mockImplementation((session) => ({
      ...session,
      capabilityStates: {
        ...session.capabilityStates,
        sitemap: { status: 'queued', outcome: { status: 'queued', result: null, error: null }, retry: { status: 'not-retryable' } }
      }
    }));
    mocks.runInvestigationSession.mockImplementation(async (session, runners, onChange) => {
      if (session.capabilityStates.sitemap?.status === 'idle') return session;
      const running = { ...session, status: 'running', capabilityStates: { ...session.capabilityStates, sitemap: { status: 'running', outcome: { status: 'running', result: null, error: null }, retry: { status: 'not-retryable' } } } };
      const complete = { ...session, status: 'completed', capabilityStates: { ...session.capabilityStates, sitemap: { status: 'success', outcome: { status: 'success', result: { pages: [{ url: 'https://example.com/one', statusCode: 200, ok: true, seo: { title: 'One' }, schema: { types: [] }, flags: [] }] }, error: null }, retry: { status: 'not-retryable' } } } };
      onChange(running);
      onChange(complete);
      return complete;
    });

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: /scan site/i }));
    await user.click(screen.getByRole('button', { name: 'Sitemap' }));
    await user.click(screen.getByRole('button', { name: 'Check sitemap' }));

    expect(mocks.runInvestigationSession).toHaveBeenCalledWith(expect.objectContaining({ investigationId: 'inv-1' }), expect.anything(), expect.anything(), expect.anything());
    expect(await screen.findByText('/one')).toBeInTheDocument();
    expect(mocks.saveInvestigationSession).toHaveBeenCalledWith('inv-1', expect.objectContaining({ capabilityStates: expect.objectContaining({ sitemap: expect.objectContaining({ status: 'success' }) }) }));
  });

  it('persists and renders a successful canonical sitemap retry', async () => {
    const user = userEvent.setup();
    const failed = {
      id: 'session-1', investigationId: 'inv-1', status: 'failed',
      domain: { submitted: 'Example.com', normalized: 'example.com' },
      selectedCapabilities: [{ id: 'wordpress', dependencies: [] }, { id: 'sitemap', dependencies: [] }],
      capabilityStates: {
        wordpress: { status: 'success', outcome: { status: 'success', result: createWordpressResult(), error: null }, retry: { status: 'not-retryable' } },
        sitemap: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'temporary', message: 'Timed out', retryable: true } }, retry: { status: 'retryable' } }
      },
      overall: { status: 'incomplete' }
    };
    const success = { ...failed, status: 'completed', capabilityStates: { ...failed.capabilityStates, sitemap: { status: 'success', outcome: { status: 'success', result: { pages: [{ url: 'https://example.com/retried', statusCode: 200, ok: true, seo: { title: 'Retried' }, schema: { types: [] }, flags: [] }] }, error: null }, retry: { status: 'not-retryable' } } }, overall: { status: 'complete' } };
    mocks.loadAnonymousInvestigation.mockReturnValue({ domain: failed.domain, record: { recordType: 'session', session: failed, persistedAt: '2026-09-10T12:00:00.000Z' } });
    mocks.retryInvestigationCapability.mockImplementation(async (session, id, runners, onChange) => {
      onChange(success);
      return success;
    });

    render(<QueryClientProvider client={new QueryClient()}><ScanPage /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: 'Sitemap' }));
    await user.click(screen.getByRole('button', { name: 'Retry Sitemap' }));

    expect(await screen.findByText('/retried')).toBeInTheDocument();
    expect(mocks.saveAnonymousInvestigation).toHaveBeenCalledWith(expect.objectContaining({ session: expect.objectContaining({ capabilityStates: expect.objectContaining({ sitemap: expect.objectContaining({ status: 'success' }) }) }) }));
  });

  it('serializes authenticated snapshots so an older write cannot follow completed evidence', async () => {
    const user = userEvent.setup();
    const initial = { id: 'session-1', investigationId: 'inv-1', status: 'idle', domain: { submitted: 'Example.com', normalized: 'example.com' }, selectedCapabilities: [], capabilityStates: {}, overall: { status: 'incomplete' } };
    const running = { ...initial, status: 'running' };
    const completed = { ...initial, status: 'completed', capabilityStates: { wordpress: { status: 'success', outcome: { status: 'success', result: createWordpressResult(), error: null } } } };
    const persistence = [];
    mocks.startInvestigation.mockResolvedValue({ investigation: { id: 'inv-1' }, sessionIds: ['session-1'] });
    mocks.createInvestigationSession.mockReturnValue(initial);
    mocks.saveInvestigationSession.mockImplementation((id, snapshot) => new Promise((resolve, reject) => {
      persistence.push({ id, snapshot, resolve, reject });
    }));
    mocks.runInvestigationSession.mockImplementation(async (session, runners, onChange) => {
      onChange(running);
      return completed;
    });

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: /scan site/i }));

    await waitFor(() => expect(persistence).toHaveLength(1));
    expect(persistence[0].snapshot.status).toBe('running');

    persistence[0].resolve();
    await waitFor(() => expect(persistence).toHaveLength(2));
    expect(persistence[1].snapshot.status).toBe('completed');
    expect(screen.queryByText(/local copy kept/i)).not.toBeInTheDocument();

    persistence[1].resolve();
    await waitFor(() => expect(mocks.saveInvestigationSession).toHaveBeenCalledTimes(2));
    expect(mocks.saveInvestigationSession.mock.calls.at(-1)[1].status).toBe('completed');
  });

  it('unlocks and activates Exposure navigation after a canonical scan', async () => {
    const user = userEvent.setup();
    const canonical = { id: 'session-1', investigationId: 'inv-1', status: 'completed', domain: { submitted: 'Example.com', normalized: 'example.com' }, selectedCapabilities: [{ id: 'homepage', dependencies: [] }, { id: 'wordpress', dependencies: [] }], capabilityStates: {
      wordpress: { status: 'success', outcome: { status: 'success', result: createWordpressResult(), error: null }, retry: { status: 'not-retryable' } },
      homepage: { status: 'success', outcome: { status: 'success', result: {}, error: null }, retry: { status: 'not-retryable' } }
    }, overall: { status: 'complete' } };
    mocks.createInvestigationSession.mockReturnValue(canonical);
    mocks.runInvestigationSession.mockResolvedValue(canonical);

    render(<QueryClientProvider client={new QueryClient()}><ScanPage /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: /scan site/i }));

    const exposure = screen.getByRole('button', { name: 'Exposure' });
    expect(exposure).toBeEnabled();
    await user.click(exposure);
    expect(screen.getByTestId('active-section')).toHaveTextContent('exposure');
  });

  it('keeps WordPress evidence visible when homepage fails and retries only homepage', async () => {
    const user = userEvent.setup();
    const session = { domain: { submitted: 'Example.com', normalized: 'example.com' }, status: 'failed', selectedCapabilities: [{ id: 'homepage', dependencies: [] }, { id: 'wordpress', dependencies: [] }], capabilityStates: {
      wordpress: { status: 'success', outcome: { status: 'success', result: createWordpressResult(), error: null }, retry: { status: 'not-retryable' } },
      homepage: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'blocked', message: 'Blocked', retryable: true } }, retry: { status: 'not-retryable' } }
    }, overall: { status: 'incomplete' } };
    mocks.startInvestigation.mockResolvedValue({ investigation: { id: 'inv-1' }, sessionIds: ['session-1'] });
    mocks.createInvestigationSession.mockReturnValue(session);
    mocks.runInvestigationSession.mockResolvedValue(session);
    mocks.retryInvestigationCapability.mockResolvedValue(session);

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: /scan site/i }));

    expect(screen.getByText(/WordPress API: Complete/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry homepage/i }));
    expect(mocks.retryInvestigationCapability).toHaveBeenCalledWith(expect.anything(), 'homepage', expect.anything(), expect.anything(), expect.anything());
  });

  it('restores anonymous snapshot without claiming it on authenticated mount', () => {
    mocks.loadAnonymousInvestigation.mockReturnValue({
      domain: { submitted: 'Example.com', normalized: 'example.com' },
      record: { recordType: 'session', persistedAt: '2026-09-10T12:00:00.000Z', session: { id: 'session-1', investigationId: 'inv-1', status: 'completed', selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' } } }
    });

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);

    expect(screen.getByRole('button', { name: /import this investigation/i })).toBeInTheDocument();
    expect(mocks.claimAnonymousInvestigation).not.toHaveBeenCalled();
  });

  it('keeps anonymous data when explicit import fails', async () => {
    const user = userEvent.setup();
    const snapshot = {
      domain: { submitted: 'Example.com', normalized: 'example.com' },
      record: { recordType: 'session', persistedAt: '2026-09-10T12:00:00.000Z', session: { id: 'session-1', investigationId: 'inv-1', status: 'completed', selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' } } }
    };
    mocks.loadAnonymousInvestigation.mockReturnValue(snapshot);
    mocks.claimAnonymousInvestigation.mockRejectedValue(new Error('Import failed'));
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);

    await user.click(screen.getByRole('button', { name: /import this investigation/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Import failed');
    expect(mocks.removeAnonymousInvestigation).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /import this investigation/i })).toBeInTheDocument();
  });

  it('hydrates and retains an anonymously imported investigation after claim succeeds', async () => {
    const user = userEvent.setup();
    const importedSession = {
      id: 'browser-session',
      investigationId: 'claimed-investigation',
      status: 'completed',
      selectedCapabilities: [{ id: 'wordpress', dependencies: [] }],
      capabilityStates: {
        wordpress: { status: 'success', outcome: { status: 'success', result: createWordpressResult(), error: null } }
      },
      overall: { status: 'complete' }
    };
    mocks.loadAnonymousInvestigation.mockReturnValue({
      domain: { submitted: 'Example.com', normalized: 'example.com' },
      record: { recordType: 'session', session: importedSession, persistedAt: '2026-09-10T12:00:00.000Z' }
    });
    mocks.claimAnonymousInvestigation.mockResolvedValue({
      investigation: { id: 'claimed-investigation', domain: { submitted: 'Example.com', normalized: 'example.com' } },
      sessionIds: ['browser-session'],
      latestSession: importedSession
    });
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: /import this investigation/i }));

    expect(await screen.findByText('WordPress API: Complete')).toBeInTheDocument();
    expect(mocks.setInvestigatorDomain).toHaveBeenCalledWith('example.com');
    expect(mocks.saveAuthenticatedInvestigationId).toHaveBeenCalledWith('claimed-investigation');
    expect(mocks.removeAnonymousInvestigation).toHaveBeenCalledOnce();
  });

  it('retries a failed restored anonymous capability with reconstructed selection', async () => {
    const user = userEvent.setup();
    const restoredSession = {
      id: 'session-1', investigationId: 'inv-1', status: 'failed',
      startedAt: '2026-09-10T11:00:00.000Z', completedAt: '2026-09-10T12:00:00.000Z',
      selectedCapabilities: [{ id: 'homepage', dependencies: [], options: { retryMode: 'safe' } }],
      capabilityStates: { homepage: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'blocked', message: 'Blocked', retryable: true } }, retry: { status: 'not-retryable' } } },
      overall: { status: 'incomplete' }
    };
    mocks.loadAnonymousInvestigation.mockReturnValue({ domain: { submitted: 'Example.com', normalized: 'example.com' }, record: { recordType: 'session', session: restoredSession, persistedAt: '2026-09-10T12:00:00.000Z' } });
    mocks.retryInvestigationCapability.mockResolvedValue(restoredSession);

    render(<QueryClientProvider client={new QueryClient()}><ScanPage /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: /retry homepage/i }));

    expect(mocks.retryInvestigationCapability).toHaveBeenCalledWith(expect.objectContaining({ selection: expect.objectContaining({ capabilityIds: ['homepage'], options: { homepage: { retryMode: 'safe' } } }) }), 'homepage', expect.anything(), expect.anything(), expect.anything());
  });

  it('renders canonical WordPress evidence through the real section renderer after homepage failure', async () => {
    const user = userEvent.setup();
    const wordpressResult = {
      domain: 'example.com', fetchedAt: '2026-09-10T12:00:00.000Z', summary: { name: 'Example', url: 'https://example.com', home: 'https://example.com' },
      namespaces: [], metrics: { durationMs: 10, namespacesCount: 0 }, plugins: { matched: [], unsupportedNamespaces: [] }, core: [],
      exposure: { restApiAvailable: true, userEnumeration: { open: false }, settingsExposed: { open: false }, xmlrpc: { enabled: false }, robotsTxt: { available: true }, sitemapXml: { available: true }, uploads: { indexable: false } },
      performance: null, contentOverview: null
    };
    const canonical = { id: 'session-1', investigationId: 'inv-1', status: 'failed', domain: { submitted: 'Example.com', normalized: 'example.com' }, selectedCapabilities: [{ id: 'homepage', dependencies: [] }, { id: 'wordpress', dependencies: [] }], capabilityStates: {
      wordpress: { status: 'success', outcome: { status: 'success', result: wordpressResult, error: null }, retry: { status: 'not-retryable' } },
      homepage: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'blocked', message: 'Homepage blocked', retryable: true } }, retry: { status: 'not-retryable' } }
    }, overall: { status: 'incomplete' } };
    mocks.startInvestigation.mockResolvedValue({ investigation: { id: 'inv-1' }, sessionIds: ['session-1'] });
    mocks.createInvestigationSession.mockReturnValue(canonical);
    mocks.runInvestigationSession.mockResolvedValue(canonical);

    render(<QueryClientProvider client={new QueryClient()}><ScanPage /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: /scan site/i }));

    expect(await screen.findByRole('region', { name: 'Scan summary' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Exposure checks' })).toBeInTheDocument();
    expect(screen.getByText('WordPress API: Complete')).toBeInTheDocument();
  });

  it('surfaces authenticated start and persistence failures and prevents duplicate starts', async () => {
    const user = userEvent.setup();
    let release;
    mocks.startInvestigation.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    mocks.createInvestigationSession.mockReturnValue({
      id: 'local-session',
      investigationId: 'local-investigation',
      status: 'idle',
      selectedCapabilities: [],
      capabilityStates: {},
      overall: { status: 'incomplete' }
    });
    render(<QueryClientProvider client={new QueryClient()}><ScanPage isAuthenticated /></QueryClientProvider>);
    const scanButton = screen.getByRole('button', { name: /scan site/i });
    await user.click(scanButton);
    expect(scanButton).toBeDisabled();
    await user.click(scanButton);
    expect(mocks.startInvestigation).toHaveBeenCalledOnce();
    release(Promise.reject(new Error('Start unavailable')));
    expect(await screen.findByRole('alert')).toHaveTextContent(/start unavailable/i);

    mocks.startInvestigation.mockResolvedValue({ investigation: { id: 'inv-1' }, sessionIds: ['session-1'] });
    mocks.createInvestigationSession.mockReturnValue({ id: 'session-1', investigationId: 'inv-1', status: 'completed', domain: { submitted: 'Example.com', normalized: 'example.com' }, selectedCapabilities: [], capabilityStates: {}, overall: { status: 'complete' } });
    mocks.runInvestigationSession.mockImplementation(async (session, runners, onChange) => { onChange(session); return session; });
    mocks.saveInvestigationSession.mockRejectedValue(new Error('Persistence unavailable'));
    await user.click(screen.getByRole('button', { name: /scan site/i }));
    expect(await screen.findByText(/persistence unavailable/i)).toBeInTheDocument();
  });

  it('surfaces retry failure and re-enables retry control', async () => {
    const user = userEvent.setup();
    const failed = { domain: { submitted: 'Example.com', normalized: 'example.com' }, status: 'failed', capabilityStates: { homepage: { status: 'failed', outcome: { status: 'failed', result: null, error: { code: 'blocked', message: 'Blocked', retryable: true } }, retry: { status: 'not-retryable' } } }, selectedCapabilities: [{ id: 'homepage', dependencies: [] }], overall: { status: 'incomplete' } };
    mocks.loadAnonymousInvestigation.mockReturnValue({ domain: failed.domain, record: { recordType: 'session', session: failed, persistedAt: '2026-09-10T12:00:00.000Z' } });
    mocks.retryInvestigationCapability.mockRejectedValue(new Error('Retry unavailable'));
    render(<QueryClientProvider client={new QueryClient()}><ScanPage /></QueryClientProvider>);
    await user.click(screen.getByRole('button', { name: /retry homepage/i }));
    expect(await screen.findByText(/retry unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry homepage/i })).toBeEnabled();
  });

  it('forwards live scan settings actions to the domain form', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAuthenticated />
      </QueryClientProvider>
    );

    expect(mocks.domainForm).toHaveBeenCalledWith(expect.objectContaining({
      scanSettings: {
        capabilityIds: ['homepage', 'wordpress'],
        options: { homepage: {}, wordpress: {} }
      },
      onScanSettingsChange: mocks.updateScanSettings,
      onSaveDefaults: mocks.saveScanDefaults
    }), undefined);
  });

  it('renders scan shell regions', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAuthenticated />
      </QueryClientProvider>
    );

    expect(screen.getByRole('navigation', { name: 'Scan navigation' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Recent scanned domains' })).toBeInTheDocument();
  });

  it('clears the current user recent scans from the scan card', async () => {
    const user = userEvent.setup();

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAuthenticated />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: /clear recent domains/i }));

    expect(clearUserRecentRuns).toHaveBeenCalledTimes(1);
  });

  it('shows overview when unsupported section loses admin access', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    const view = render(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAdmin isAuthenticated />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Unsupported' }));
    expect(screen.getByTestId('active-section')).toHaveTextContent('unsupported');

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAdmin={false} isAuthenticated />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('active-section')).toHaveTextContent('overview');
  });

  it('passes unavailable capability session state into sidebar navigation', () => {
    mocks.scanResults = createScanResults({
      session: {
        domain: 'example.com',
        selection: { capabilityIds: ['sitemap'], options: { sitemap: {} } },
        capabilities: { sitemap: { status: 'unavailable', error: { message: 'Unavailable' } } }
      }
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ScanPage />
      </QueryClientProvider>
    );

    expect(mocks.sidebar).toHaveBeenCalledWith(expect.objectContaining({
      session: expect.objectContaining({ capabilities: expect.objectContaining({ sitemap: expect.objectContaining({ status: 'unavailable' }) }) })
    }));
  });

  it.each(['complete', 'partial', 'failed', 'blocked'])('bridges aggregate status %s from investigator session', async (overallStatus) => {
    const initial = {
      id: 'session-1',
      investigationId: 'inv-1',
      status: 'idle',
      domain: { submitted: 'Example.com', normalized: 'example.com' },
      selectedCapabilities: [],
      capabilityStates: {},
      overall: { status: 'incomplete' }
    };
    const final = {
      ...initial,
      status: overallStatus === 'complete' ? 'completed' : 'failed',
      overall: { status: overallStatus }
    };
    mocks.startInvestigation.mockResolvedValue({ investigation: { id: 'inv-1' }, sessionIds: ['session-1'] });
    mocks.createInvestigationSession.mockReturnValue(initial);
    mocks.runInvestigationSession.mockResolvedValue(final);

    render(<QueryClientProvider client={new QueryClient()}><ScanPage /></QueryClientProvider>);
    await userEvent.setup().click(screen.getByRole('button', { name: /scan site/i }));

    await waitFor(() => expect(mocks.sidebar).toHaveBeenLastCalledWith(expect.objectContaining({
      session: expect.objectContaining({ overallStatus })
    })));
  });

  it('resets the active section when the scan session domain changes', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.scanResults = createScanResults({ session: { domain: 'first.example', selection: { capabilityIds: [], options: {} }, capabilities: {} } });

    const view = render(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAdmin />
      </QueryClientProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Unsupported' }));
    expect(screen.getByTestId('active-section')).toHaveTextContent('unsupported');

    view.rerender(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAdmin />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('active-section')).toHaveTextContent('unsupported');

    mocks.scanResults = createScanResults({ session: { domain: 'second.example', selection: { capabilityIds: [], options: {} }, capabilities: {} } });
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <ScanPage isAdmin />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('active-section')).toHaveTextContent('overview');
  });
});

function createWordpressResult() {
  return {
    domain: 'example.com',
    fetchedAt: '2026-09-10T12:00:00.000Z',
    summary: { name: 'Example', url: 'https://example.com', home: 'https://example.com' },
    namespaces: [],
    metrics: { durationMs: 10, namespacesCount: 0 },
    plugins: { matched: [], unsupportedNamespaces: [] },
    core: [],
    exposure: { restApiAvailable: true, userEnumeration: { open: false }, settingsExposed: { open: false }, xmlrpc: { enabled: false }, robotsTxt: { available: true }, sitemapXml: { available: true }, uploads: { indexable: false } },
    performance: null,
    contentOverview: null
  };
}
