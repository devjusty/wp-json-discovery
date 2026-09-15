import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScanProgress from './ScanProgress';

const state = (status) => ({
  status,
  outcome: { status, result: null, error: null }
});

const states = {
  wordpress: state('success'),
  homepage: state('running')
};

describe('ScanProgress', () => {
  it('renders four initial capabilities in product order', () => {
    render(<ScanProgress capabilityStates={states} />);

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Identity'),
      expect.stringContaining('Exposure'),
      expect.stringContaining('Homepage'),
      expect.stringContaining('WordPress API')
    ]);
  });

  it.each(['pending', 'running', 'complete', 'unavailable', 'failed'])(
    'represents %s without relying on color',
    (status) => {
      render(
        <ScanProgress
          capabilityStates={{
            wordpress: state(status === 'complete' ? 'success' : status),
            homepage: state(status === 'complete' ? 'success' : status)
          }}
        />
      );

      expect(screen.getAllByText(new RegExp(status, 'i')).length).toBeGreaterThan(0);
    }
  );

  it('keeps completed summary visible and exposes aggregate progress', () => {
    render(
      <ScanProgress
        capabilityStates={{ wordpress: state('success'), homepage: state('success') }}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('4 of 4');
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('WordPress API')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
