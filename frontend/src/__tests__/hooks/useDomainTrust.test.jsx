import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mapTrustSnapshot } from '../../services/trust.js';
import { useDomainTrust } from '../../hooks/useDomainTrust.js';
import { setWarningStatus } from '../../api/trust.js';

vi.mock('../../api/trust.js', () => ({
  fetchDomainTrust: vi.fn(async () => ({
    envelope: { envelopeId: 'env_12' },
    warnings: [{ id: 12, status: 'open', severity: 'warn' }]
  })),
  setWarningStatus: vi.fn(async (_id, status) => ({ warning: { id: 12, status } })),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return Wrapper;
}

describe('mapTrustSnapshot', () => {
  it('returns unknown state when no envelope exists', () => {
    const mapped = mapTrustSnapshot({ warnings: [] });
    expect(mapped.status).toBe('unknown');
  });

  it('maps unresolved warnings into warning trust state', () => {
    const mapped = mapTrustSnapshot({
      envelope: { envelopeId: 'env_1' },
      warnings: [{ status: 'open', severity: 'warn' }]
    });
    expect(mapped.status).toBe('warning');
    expect(mapped.unresolvedCount).toBe(1);
  });
});

describe('useDomainTrust', () => {
  it('loads trust state and updates warning status', async () => {
    const { result } = renderHook(() => useDomainTrust('example.com'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.trust.status).toBe('warning');

    await result.current.updateWarningStatus({ id: 12, status: 'resolved' });

    expect(setWarningStatus).toHaveBeenCalledWith(12, 'resolved');
  });
});
