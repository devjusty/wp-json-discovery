import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvestigatorOverview } from './InvestigatorOverview';
import type { Investigation } from '../../domain/investigation/model';

const investigation: Investigation = {
  id: 'inv-1',
  submittedUrl: 'https://example.com',
  normalizedUrl: 'https://example.com',
  redirectChain: ['https://example.com', 'https://www.example.com'],
  createdAt: '2026-09-23T10:00:00Z',
  capabilities: [
    { name: 'homepage', status: 'success', result: { title: 'Example' } },
    { name: 'exposure', status: 'failed', error: { code: 'TIMEOUT', message: 'Timed out', retryable: true } },
  ],
  observationTimeline: [],
  evidence: [],
  findings: [],
};

describe('InvestigatorOverview', () => {
  it('groups site identity, exposure, next inspection, and changes', () => {
    render(<InvestigatorOverview investigation={investigation} onInspect={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'What this site is' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Exposure' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inspect next' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Changes' })).toBeInTheDocument();
    expect(screen.getByText('https://www.example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inspect exposure' })).toBeInTheDocument();
  });
});
