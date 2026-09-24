import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvestigatorFindings } from './InvestigatorFindings';
import type { Finding, Investigation } from '../../domain/investigation/model';

const findings: Finding[] = [
  { id: 'low', capability: 'homepage', summary: 'Low signal', evidenceIds: [], confidence: 'low' },
  { id: 'high', capability: 'exposure', summary: 'Admin endpoint is discoverable', evidenceIds: [], confidence: 'high' },
];

describe('InvestigatorFindings', () => {
  it('renders domain-ranked findings in provided order', () => {
    const investigation = { findings } as unknown as Investigation;
    render(<InvestigatorFindings investigation={investigation} onSelectEvidence={vi.fn()} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Low signal');
    expect(items[1]).toHaveTextContent('Admin endpoint is discoverable');
  });
});
