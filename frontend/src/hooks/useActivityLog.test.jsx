import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rotateActivityLog: vi.fn(),
  logEvent: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: mocks.toastError,
    success: mocks.toastSuccess
  }
}));

vi.mock('../services/logger.js', () => ({
  logEvent: mocks.logEvent,
  rotateActivityLog: mocks.rotateActivityLog
}));

const { useActivityLog } = await import('./useActivityLog.js');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });

  return function Wrapper({ children }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useActivityLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes rotateLogs that rotates the activity log and reports success', async () => {
    mocks.rotateActivityLog.mockResolvedValue({ filename: 'activity-2026-07-31.log' });

    const { result } = renderHook(() => useActivityLog(), { wrapper: createWrapper() });

    expect(result.current.isRotatingLogs).toBe(false);

    act(() => {
      result.current.rotateLogs();
    });

    await waitFor(() => {
      expect(mocks.rotateActivityLog).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith('Activity log rotated.');
    });
    expect(mocks.logEvent).toHaveBeenCalledWith(
      'logs.rotation_triggered',
      expect.objectContaining({ filename: 'activity-2026-07-31.log' })
    );
    expect(result.current.isRotatingLogs).toBe(false);
  });

  it('reports rotation failures without throwing', async () => {
    mocks.rotateActivityLog.mockRejectedValue(new Error('rotate denied'));

    const { result } = renderHook(() => useActivityLog(), { wrapper: createWrapper() });

    act(() => {
      result.current.rotateLogs();
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('rotate denied');
    });
    expect(mocks.logEvent).toHaveBeenCalledWith('logs.rotation_failed', { message: 'rotate denied' });
  });
});
