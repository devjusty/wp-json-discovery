import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { logEvent, rotateActivityLog } from '../services/logger.js';

export function useActivityLog() {
  const rotateLogsMutation = useMutation({
    mutationFn: rotateActivityLog,
    onSuccess: (data) => {
      toast.success('Activity log rotated.');
      logEvent('logs.rotation_triggered', {
        filename: data?.filename ?? 'unknown',
        triggeredAt: new Date().toISOString()
      });
    },
    onError: (error) => {
      const message = error?.message ?? 'Failed to rotate logs.';
      toast.error(message);
      logEvent('logs.rotation_failed', { message });
    }
  });

  return {
    isRotatingLogs: rotateLogsMutation.isPending,
    rotateLogs: () => rotateLogsMutation.mutate()
  };
}
