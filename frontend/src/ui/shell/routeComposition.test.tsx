import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import App from '../../App';
import AppLayout from '../../components/templates/AppLayout';
import { AdminShell } from './AdminShell';
import { InvestigatorShell } from './InvestigatorShell';

const routeState = vi.hoisted(() => ({ activePage: 'scan' }));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    getAccessTokenSilently: vi.fn(),
    isAuthenticated: false,
    user: undefined,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { user: { role: 'admin' } } }),
}));

vi.mock('../../context/ScanContextHooks', () => ({
  useScanShellContext: () => ({
    activePage: routeState.activePage,
    setActivePage: (page) => { routeState.activePage = page; },
    setDomain: vi.fn(),
    startScan: vi.fn(),
    currentScanDomain: '',
    setSelectedInvestigationId: vi.fn(),
  }),
  useScanResultsContext: () => ({
    retryInvestigatorCapability: vi.fn(),
    investigatorSession: null,
  }),
}));

vi.mock('../../context/ScanContext', () => ({
  ScanProvider: ({ children }) => children,
}));

vi.mock('../../hooks/useActivityLog.js', () => ({
  useActivityLog: () => ({ isRotatingLogs: false, rotateLogs: vi.fn() }),
}));

vi.mock('../../api/client.js', () => ({
  fetchUserProfile: vi.fn(),
  setAuthUserProvider: vi.fn(),
  setTokenProvider: vi.fn(),
}));

vi.mock('../../services/scanCapabilities.js', () => ({
  setScanCapabilityContext: vi.fn(),
}));

vi.mock('../../adapters/legacyPageAdapters', () => ({
  loadAdminPage: () => Promise.resolve({ default: () => null }),
  loadHistoryPage: () => Promise.resolve({ default: () => null }),
  loadInvestigationsPage: () => Promise.resolve({ default: () => null }),
  loadScanPage: () => Promise.resolve({ default: () => null }),
}));

describe('production route landmark composition', () => {
  it.each(['scan', 'investigations', 'history', 'admin'])('renders auth controls in AppContent for %s route', (route) => {
    routeState.activePage = route;

    render(<App />);

    const headerActions = within(screen.getByRole('group', { name: 'Header actions' }));
    expect(headerActions.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it.each(['scan', 'history', 'investigations'])('renders exactly one main landmark for %s route', (route) => {
    render(
      <InvestigatorShell
        readModel={{ title: route, sections: [{ id: 'overview', label: 'Overview' }], capabilities: [] }}
        commands={{ onSectionChange: vi.fn() }}
        contentLandmark="main"
        contentMode="legacy"
        headerActions={<button type="button">New scan</button>}
        authActions={<><button type="button">User</button><button type="button">Log in</button></>}
      >
        <AppLayout title={route} embedded>
          <p>{route} content</p>
        </AppLayout>
      </InvestigatorShell>,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
    const headerActions = within(screen.getByRole('group', { name: 'Header actions' }));
    expect(headerActions.getAllByRole('button')).toHaveLength(3);
    expect(headerActions.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(headerActions.getAllByRole('button').map((button) => button.textContent)).toEqual(['New scan', 'User', 'Log in']);
  });

  it.each(['overview', 'findings', 'evidence', 'assets', 'history', 'tools'])('renders canonical content for investigator section %s', (section) => {
    render(
      <InvestigatorShell
        readModel={{
          title: 'example.com',
          sections: [{ id: section, label: section, description: `${section} description` }],
          capabilities: [],
          investigation: {
            id: 'inv-1',
            submittedUrl: 'example.com',
            normalizedUrl: 'https://example.com',
            redirectChain: ['https://example.com'],
            createdAt: '2026-09-23T12:00:00.000Z',
            capabilities: [],
            observationTimeline: [],
            evidence: [],
            findings: [],
          },
        }}
        commands={{ onSectionChange: vi.fn() }}
        activeSection={section}
      />,
    );

    expect(screen.getByRole('main')).not.toBeEmptyDOMElement();
  });

  it('renders exactly one main landmark for admin route', () => {
    render(
      <AdminShell
        navigation={{ items: [{ id: 'admin', label: 'Admin' }], activeId: 'admin' }}
        commands={{ onNavigate: vi.fn() }}
        authActions={<><button type="button">User</button><button type="button">Log in</button></>}
      >
        <AppLayout title="Admin" embedded>
          <p>admin content</p>
        </AppLayout>
      </AdminShell>,
    );

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    const headerActions = within(screen.getByRole('group', { name: 'Header actions' }));
    expect(headerActions.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });
});
