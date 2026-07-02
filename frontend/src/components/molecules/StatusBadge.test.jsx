import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge.jsx';

describe('StatusBadge', () => {
  it('renders a label with the requested tone class', () => {
    render(<StatusBadge label="Healthy" tone="success" />);

    const badge = screen.getByText('Healthy');
    expect(badge).toHaveAttribute('data-slot', 'badge');
    expect(badge).toHaveClass('status-badge');
    expect(badge).toHaveClass('status-badge--success');
  });
});
