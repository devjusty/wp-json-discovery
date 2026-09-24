import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { InvestigatorShell } from './InvestigatorShell';
import type { Investigation } from '../../domain/investigation/model';

describe('InvestigatorShell', () => {
  it('exposes required contextual sections through selector and navigation', () => {
    const sections = ['overview', 'findings', 'evidence', 'assets', 'history', 'tools'].map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }));
    render(<InvestigatorShell readModel={{ title: 'example.com', status: 'incomplete', sections, capabilities: [] }} commands={{ onSectionChange: vi.fn() }}><p>investigation</p></InvestigatorShell>);

    expect(screen.getByRole('navigation', { name: 'Investigation sections' })).toHaveTextContent('OverviewFindingsEvidenceAssetsHistoryTools');
    expect(screen.getByRole('combobox', { name: 'Investigation section' })).toHaveValue('overview');
  });

  it('changes active content for every contextual section', async () => {
    const user = userEvent.setup();
    const sections = ['overview', 'findings', 'evidence', 'assets', 'history', 'tools'].map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }));
    render(<StatefulInvestigatorShell sections={sections} />);
    const selector = screen.getByRole('navigation', { name: 'Investigation sections' });

    for (const section of sections) {
      await user.click(within(selector).getByRole('button', { name: section.label }));
      expect(screen.getByRole('region', { name: section.label })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: section.label })).toHaveAttribute('data-active', 'true');
    }
  });

  it('provides one main landmark and keyboard navigation', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<AppShell navigation={{ items: [{ id: 'scan', label: 'Scan' }, { id: 'admin', label: 'Admin' }], activeId: 'scan' }} commands={{ onNavigate }}><p>content</p></AppShell>);

    expect(screen.getByRole('main')).toHaveTextContent('content');
    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('admin');
  });

  it('exposes partial state and scoped retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<InvestigatorShell readModel={{ title: 'example.com', status: 'partial', sections: [{ id: 'overview', label: 'Overview' }], capabilities: [
      { name: 'homepage', status: 'success' },
      { name: 'exposure', status: 'failed', retryable: true },
      { name: 'assets', status: 'unavailable', retryable: true },
      { name: 'history', status: 'failed', retryable: false },
    ] }} commands={{ onSectionChange: vi.fn(), onRetry }}><p>investigation</p></InvestigatorShell>);

    expect(screen.getByText('Partial investigation')).toBeInTheDocument();
    expect(screen.getByText('Successful evidence remains available.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry exposure' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry assets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry history' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry exposure' }));
    expect(onRetry).toHaveBeenCalledWith('exposure');
  });

  it('does not claim successful evidence when no capability succeeded', () => {
    render(<InvestigatorShell readModel={{ title: 'example.com', status: 'failed', sections: [{ id: 'overview', label: 'Overview' }], capabilities: [{ name: 'exposure', status: 'failed', retryable: false }] }} commands={{ onSectionChange: vi.fn() }}><p>investigation</p></InvestigatorShell>);

    expect(screen.queryByText('Successful evidence remains available.')).not.toBeInTheDocument();
  });

  it('renders report modules from the investigation read model', () => {
    render(
      <InvestigatorShell
        readModel={{
          title: 'example.com',
          status: 'complete',
          sections: [
            { id: 'overview', label: 'Overview' },
            { id: 'findings', label: 'Findings' },
            { id: 'evidence', label: 'Evidence' },
          ],
          capabilities: [{ name: 'exposure', status: 'success' }],
          investigation: createInvestigationReadModel(),
        }}
        activeSection="overview"
        contentLandmark="div"
        commands={{ onSectionChange: vi.fn() }}
      >
        <main><p>legacy scan content</p></main>
      </InvestigatorShell>,
    );

    expect(screen.getByRole('heading', { name: 'Investigator overview' })).toBeInTheDocument();
    expect(screen.getByText('legacy scan content')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('renders meaningful panels for every reachable section', async () => {
    const user = userEvent.setup();
    render(<StatefulReportShell />);
    const navigation = screen.getByRole('navigation', { name: 'Investigation sections' });

    for (const section of ['Overview', 'Findings', 'Evidence', 'Assets', 'History', 'Tools']) {
      await user.click(within(navigation).getByRole('button', { name: section }));
      const heading = section === 'Overview'
        ? 'Investigator overview'
        : section === 'Findings'
          ? 'Ranked findings'
          : section === 'Evidence'
            ? 'Evidence provenance'
            : section;
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: 'Retry wordpress' }));
    expect(screen.getByText('retry wordpress')).toBeInTheDocument();
  });

  it('updates displayed capability status when retry command changes session model', async () => {
    const user = userEvent.setup();
    render(<RetryingReportShell />);

    await user.click(within(screen.getByRole('navigation', { name: 'Investigation sections' })).getByRole('button', { name: 'Tools' }));
    expect(screen.getByRole('listitem')).toHaveTextContent('wordpress failed');
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByRole('listitem')).toHaveTextContent('wordpress success');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});

function createInvestigationReadModel(): Investigation {
  return {
    id: 'investigation-1',
    submittedUrl: 'https://example.com',
    normalizedUrl: 'https://example.com',
    redirectChain: ['https://example.com'],
    createdAt: '2026-01-01T00:00:00.000Z',
    capabilities: [{ name: 'exposure', status: 'success' }],
    observationTimeline: [],
    evidence: [],
    findings: [],
  };
}

function StatefulInvestigatorShell({ sections }: { sections: ReadonlyArray<{ id: string; label: string }> }) {
  const [activeSection, setActiveSection] = useState('overview');
  return (
    <InvestigatorShell
      readModel={{ title: 'example.com', status: 'incomplete', sections, capabilities: [] }}
      activeSection={activeSection}
      commands={{ onSectionChange: setActiveSection }}
    >
      <p>existing page content</p>
    </InvestigatorShell>
  );
}

function StatefulReportShell() {
  const [activeSection, setActiveSection] = useState('overview');
  const [retryMessage, setRetryMessage] = useState('');
  const sections = ['overview', 'findings', 'evidence', 'assets', 'history', 'tools'].map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }));
  return (
    <>
      <InvestigatorShell
        readModel={{ title: 'example.com', status: 'partial', sections, capabilities: [{ name: 'wordpress', status: 'failed', retryable: true }], investigation: createInvestigationReadModel() }}
        activeSection={activeSection}
        commands={{ onSectionChange: setActiveSection, onRetry: (name) => setRetryMessage(`retry ${name}`) }}
      >
        <p>{retryMessage}</p>
      </InvestigatorShell>
    </>
  );
}

function RetryingReportShell() {
  const [activeSection, setActiveSection] = useState('overview');
  const [status, setStatus] = useState<'failed' | 'success'>('failed');
  const sections = ['overview', 'tools'].map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }));
  return (
    <InvestigatorShell
      readModel={{
        title: 'example.com',
        status: status === 'failed' ? 'partial' : 'complete',
        sections,
        capabilities: [{ name: 'wordpress', status, retryable: status === 'failed' }],
        investigation: createInvestigationReadModel(),
      }}
      activeSection={activeSection}
      commands={{ onSectionChange: setActiveSection, onRetry: () => setStatus('success') }}
    >
      <p>{status}</p>
    </InvestigatorShell>
  );
}
