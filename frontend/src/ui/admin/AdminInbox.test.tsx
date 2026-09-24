import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminInbox, type AdminInboxItem } from './AdminInbox';

const fixtures: AdminInboxItem[] = [
  {
    id: 'unsupported:wc/v3',
    kind: 'unsupported-namespace',
    title: 'Unsupported namespace wc/v3',
    status: 'attention',
    evidence: 'Detected on 2 domains; last seen today.',
    action: { label: 'Promote', onSelect: vi.fn() },
    priority: 20,
  },
  {
    id: 'asset:convertkit',
    kind: 'discovered-asset',
    title: 'Unknown plugin asset convertkit',
    status: 'review',
    evidence: '2 occurrences across 1 path.',
    action: { label: 'Create plugin entry', onSelect: vi.fn() },
    priority: 30,
  },
  {
    id: 'scan:failed:example.com',
    kind: 'failed-scan',
    title: 'Failed scan for example.com',
    status: 'failed',
    evidence: 'Timeout after 30 seconds.',
    action: { label: 'Rescan', onSelect: vi.fn() },
    priority: 10,
  },
  {
    id: 'maintenance:database',
    kind: 'maintenance',
    title: 'Database maintenance due',
    status: 'scheduled',
    evidence: 'Last maintenance was 8 days ago.',
    action: { label: 'Run maintenance', onSelect: vi.fn() },
    priority: 40,
  },
];

describe('AdminInbox', () => {
  it('renders evidence-first items in operational priority order without bulk actions', () => {
    render(<AdminInbox items={fixtures} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.getAttribute('data-item-id'))).toEqual([
      'scan:failed:example.com',
      'unsupported:wc/v3',
      'asset:convertkit',
      'maintenance:database',
    ]);

    expect(screen.getByText('Failed scan for example.com')).toBeInTheDocument();
    expect(screen.getByText('Timeout after 30 seconds.')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rescan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bulk|select all|delete all/i })).not.toBeInTheDocument();
  });

  it('routes each item action through its read-model command', async () => {
    const actions = fixtures.map((item) => item.action.onSelect as ReturnType<typeof vi.fn>);
    render(<AdminInbox items={fixtures} />);

    for (const item of fixtures) {
      screen.getByRole('button', { name: item.action.label }).click();
    }

    actions.forEach((action) => expect(action).toHaveBeenCalledTimes(1));
  });
});
