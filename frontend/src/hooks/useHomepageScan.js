import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { runHomepageScan } from '../api/client.js';
import { logEvent } from '../services/logger.js';

export function useHomepageScan() {
  const homepageMutation = useMutation({
    mutationFn: runHomepageScan,
    onSuccess: (data) => {
      toast.success(`Homepage scan complete for ${data.domain}`);
      logEvent('homepage.scan.complete', {
        domain: data.domain,
        source: data.source,
        metaCount: data.insights?.meta?.length ?? 0,
        assetCount: data.insights?.assets?.length ?? 0,
        frameworks: data.insights?.frameworks ?? [],
        assetSample: (data.insights?.assets ?? []).slice(0, 20).map((asset) => ({
          path: asset.path,
          type: asset.type,
          count: asset.count,
          slug: asset.slug,
          matches: asset.matches
        })),
        snapshotBytes: JSON.stringify(data).length
      });
    },
    onError: (error) => {
      const message = error?.message ?? 'Homepage scan failed';
      toast.error(message);
      logEvent('homepage.scan.error', { message });
    }
  });

  const startHomepageScan = useCallback((domain) => {
    if (!domain) {
      toast.error('Enter a domain before running the homepage scan.');
      return;
    }

    logEvent('homepage.scan.started', { domain, triggeredAt: new Date().toISOString() });
    homepageMutation.mutate({ domain });
  }, [homepageMutation]);

  return {
    startHomepageScan,
    result: homepageMutation.data,
    isRunning: homepageMutation.isPending,
    error: homepageMutation.error
  };
}
