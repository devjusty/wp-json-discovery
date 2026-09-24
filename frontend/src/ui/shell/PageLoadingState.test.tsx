import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageLoadingState } from './PageLoadingState';

describe('PageLoadingState', () => {
  it('owns loading main landmark', () => {
    render(<PageLoadingState label="Loading scanner..." />);

    expect(screen.getByRole('main')).toHaveTextContent('Loading scanner...');
    expect(screen.getByRole('status')).toHaveTextContent('Loading scanner...');
  });
});
