import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EvidenceDisclosure } from './EvidenceDisclosure';
import type { Evidence } from '../../domain/investigation/model';

const evidence: Evidence[] = [
  { id: 'observed-1', kind: 'observed', capability: 'homepage', value: 'WordPress', source: { locator: '/wp-json', observedAt: '2026-01-01T00:00:00.000Z' } },
  { id: 'inference-1', kind: 'inference', capability: 'homepage', value: 'Likely CMS', source: {} },
  { id: 'trace-1', kind: 'request-trace', capability: 'homepage', value: 'Response received', source: { request: { method: 'GET', url: 'https://example.com/wp-json', status: 200 } } },
  { id: 'trace-2', kind: 'request-trace', capability: 'homepage', value: 'Sitemap response', source: { request: { method: 'GET', url: 'https://example.com/sitemap.xml', status: 200 } } },
  { id: 'absence-1', kind: 'absence', capability: 'exposure', value: 'No exposed admin endpoint', source: {} },
];

describe('EvidenceDisclosure', () => {
  it('labels provenance and keeps request trace and raw body collapsed', async () => {
    const user = userEvent.setup();
    render(<EvidenceDisclosure evidence={evidence} rawBody={'{"secret":false}'} />);

    expect(screen.getByText('Observed')).toBeInTheDocument();
    expect(screen.getByText('Inference')).toBeInTheDocument();
    expect(screen.getAllByText('Request trace')).toHaveLength(2);
    expect(screen.getByText('Absence')).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes('/wp-json'))).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes('Observed 2026-01-01T00:00:00.000Z'))).toBeInTheDocument();
    expect(screen.queryByText('GET https://example.com/wp-json')).not.toBeInTheDocument();
    expect(screen.queryByText('{"secret":false}')).not.toBeInTheDocument();

    const traceButtons = screen.getAllByRole('button', { name: 'Show request trace' });
    await user.click(traceButtons[0]);
    expect(screen.getByText((text) => text.includes('GET https://example.com/wp-json'))).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Show request trace' })[0]);
    expect(screen.getByText((text) => text.includes('GET https://example.com/sitemap.xml'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show raw body' }));
    expect(screen.getByText('{"secret":false}')).toBeInTheDocument();
  });
});
