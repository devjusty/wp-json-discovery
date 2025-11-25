import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { runSitemapScan } from '../api/client.js';
import { logEvent } from '../services/logger.js';

export function useSitemapScan() {
  const sitemapMutation = useMutation({
    mutationFn: runSitemapScan,
    onSuccess: (data) => {
      toast.success(`Sitemap scan complete (${data?.pages?.length ?? 0} pages)`);
      logEvent('sitemap.scan.complete', {
        domain: data?.domain,
        totals: data?.totals,
        sitemapCount: data?.sitemap?.sitemaps?.length ?? 0,
        pages: (data?.pages ?? []).map((page) => ({
          url: page.url,
          statusCode: page.statusCode,
          flags: page.flags
        }))
      });
    },
    onError: (error) => {
      const message = error?.message ?? 'Sitemap scan failed';
      toast.error(message);
      logEvent('sitemap.scan.error', { message, stack: error?.stack });
    }
  });

  const startSitemapScan = ({ domain, sitemapUrl, maxPages }) => {
    if (!domain) {
      toast.error('Run a domain scan first.');
      return;
    }
    sitemapMutation.mutate({ domain, sitemapUrl, maxPages });
  };

  return {
    startSitemapScan,
    result: sitemapMutation.data,
    isRunning: sitemapMutation.isPending,
    error: sitemapMutation.error
  };
}
