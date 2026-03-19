import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ScanStatusStack from './ScanStatusStack.jsx';

describe('ScanStatusStack', () => {
  it('renders scanning and homepage-running statuses', () => {
    render(
      <ScanStatusStack
        isScanning
        activeDomain="example.com"
        homepageIsRunning
      />
    );

    expect(screen.getByText('Scanning example.com…')).toBeInTheDocument();
    expect(screen.getByText('Analyzing homepage source signals for example.com…')).toBeInTheDocument();
  });

  it('renders auth hints when scan requires auth', () => {
    render(
      <ScanStatusStack
        scanError={{
          code: 'auth_required',
          message: 'Authentication required'
        }}
      />
    );

    expect(screen.getByText('Authentication required')).toBeInTheDocument();
    expect(screen.getByText(/requires application passwords/i)).toBeInTheDocument();
  });

  it('renders homepage error fallback message', () => {
    render(<ScanStatusStack homepageError={{ message: 'Homepage request failed' }} />);

    expect(screen.getByText('Homepage request failed')).toBeInTheDocument();
  });
});
