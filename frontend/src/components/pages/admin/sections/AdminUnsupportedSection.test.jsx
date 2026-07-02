import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminUnsupportedSection from './AdminUnsupportedSection.jsx';

describe('AdminUnsupportedSection', () => {
  it('renders namespace rows in a shadcn table and keeps promote action wired', () => {
    render(
      <AdminUnsupportedSection
        unsupportedEntries={[{
          namespace: 'wc/v3',
          domains: ['example.com'],
          firstDetectedAt: '2026-03-01T00:00:00.000Z',
          lastDetectedAt: '2026-03-19T00:00:00.000Z'
        }]}
        unsupportedNamespacePrefix=""
        setUnsupportedNamespacePrefix={vi.fn()}
        unsupportedSort="lastSeenDesc"
        setUnsupportedSort={vi.fn()}
        filteredUnsupportedEntries={[{
          namespace: 'wc/v3',
          domains: ['example.com'],
          firstDetectedAt: '2026-03-01T00:00:00.000Z',
          lastDetectedAt: '2026-03-19T00:00:00.000Z'
        }]}
        unknownPluginAssetHints={[{
          slug: 'convertkit',
          occurrences: 2,
          pathCount: 1
        }]}
        onCreatePluginFromAsset={vi.fn()}
        onCreatePluginFromSuggestion={vi.fn()}
      />
    );

    expect(screen.getByRole('table', { name: 'Namespace unsupported plugins' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Promote wc/v3' })).toBeInTheDocument();
  });

  it('renders the sort control as a shadcn select trigger', () => {
    render(
      <AdminUnsupportedSection
        unsupportedEntries={[{
          namespace: 'wc/v3',
          domains: ['example.com'],
          firstDetectedAt: '2026-03-01T00:00:00.000Z',
          lastDetectedAt: '2026-03-19T00:00:00.000Z'
        }]}
        unsupportedNamespacePrefix=""
        setUnsupportedNamespacePrefix={vi.fn()}
        unsupportedSort="lastSeenDesc"
        setUnsupportedSort={vi.fn()}
        filteredUnsupportedEntries={[{
          namespace: 'wc/v3',
          domains: ['example.com'],
          firstDetectedAt: '2026-03-01T00:00:00.000Z',
          lastDetectedAt: '2026-03-19T00:00:00.000Z'
        }]}
        unknownPluginAssetHints={[]}
        onCreatePluginFromAsset={vi.fn()}
        onCreatePluginFromSuggestion={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Sort' }).closest('[data-slot="select-trigger"]')).toBeInTheDocument();
  });
});
