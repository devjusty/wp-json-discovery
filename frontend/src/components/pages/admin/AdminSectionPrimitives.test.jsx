import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionLoadingState, SnapshotStatusCard } from './AdminSectionPrimitives.jsx';

describe('AdminSectionPrimitives', () => {
  it('renders the loading state inside a shadcn card', () => {
    render(<SectionLoadingState label="Loading plugins…" />);

    expect(screen.getByText('Loading plugins…').closest('[data-slot="card"]')).toBeInTheDocument();
  });

  it('renders snapshot status inside a shadcn card', () => {
    render(<SnapshotStatusCard label="Snapshot ready" tone="error" />);

    expect(screen.getByText('Snapshot ready').closest('[data-slot="card"]')).toBeInTheDocument();
  });
});
