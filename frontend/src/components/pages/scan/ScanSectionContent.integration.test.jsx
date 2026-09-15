import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ScanSectionContent from './ScanSectionContent.jsx';

vi.mock('../../organisms/summary/ScanSummary.jsx', () => ({
  default: () => <div>Scan summary</div>
}));

function buildProps() {
  return {
    activeSection: 'overview',
    session: {
      domain: 'example.com',
      selection: { capabilityIds: ['wordpress'], options: { wordpress: {} } },
      capabilities: {
        wordpress: {
          status: 'success',
          result: {
            domain: 'example.com',
            identity: { value: 'WordPress', evidence: { status: 'corroborated', source: '/wp-json' } },
            exposure: { records: [{ id: 'rest', label: 'REST API', value: 'Public', evidence: { status: 'observed', source: '/wp-json' } }] },
            findings: [{ id: 'users', title: 'User enumeration', evidence: { status: 'observed', source: '/users' } }]
          },
          error: null
        }
      }
    },
    scanSettings: { capabilityIds: ['wordpress'], options: { wordpress: {} } },
    onScanSettingsChange: vi.fn(),
    onRunCapability: vi.fn(),
    onRetryCapability: vi.fn(),
    sitemapFilter: 'all',
    setSitemapFilter: vi.fn(),
    unsupportedPlugins: [],
    unsupportedIsLoading: false,
    onRefreshUnsupported: vi.fn()
  };
}

describe('ScanSectionContent production renderer', () => {
  it('renders layered evidence through the real overview renderer', () => {
    render(<ScanSectionContent {...buildProps()} />);

    expect(screen.getByRole('region', { name: 'Identity layer' })).toHaveTextContent('Corroborated');
    expect(screen.getByRole('region', { name: 'Exposure checks' })).toHaveTextContent('Observed');
    expect(screen.getByRole('region', { name: 'Actionable findings' })).toHaveTextContent('User enumeration');
  });
});
