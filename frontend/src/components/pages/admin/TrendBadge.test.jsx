import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TrendBadge from './TrendBadge.jsx';

describe('TrendBadge', () => {
  it('renders the trend shell with the badge primitive', () => {
    render(<TrendBadge label="Requests" values={[10, 15]} lowerIsBetter={false} />);

    expect(screen.getByText('Requests').closest('[data-slot="badge"]')).toBeInTheDocument();
    expect(screen.getByText('Requests').closest('[data-slot="badge"]')).toHaveClass('trend-badge');
  });
});
