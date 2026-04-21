import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDomainTrust, setWarningStatus } from '../api/trust.js';
import { mapTrustSnapshot } from '../services/trust.js';

export function useDomainTrust(domain) {
  const queryClient = useQueryClient();

  const trustQuery = useQuery({
    queryKey: ['trust', domain],
    queryFn: () => fetchDomainTrust(domain),
    enabled: Boolean(domain),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => setWarningStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trust', domain] });
    },
  });

  return {
    trust: mapTrustSnapshot(trustQuery.data),
    rawTrust: trustQuery.data,
    isLoading: trustQuery.isLoading,
    isUpdating: statusMutation.isPending,
    error: trustQuery.error,
    updateWarningStatus: statusMutation.mutateAsync,
  };
}
