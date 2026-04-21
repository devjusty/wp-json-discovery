import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { createDeepAuditJob, fetchDeepAuditJob } from '../api/trust.js';
import { logEvent } from '../services/logger.js';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'capped']);
const POLL_INTERVAL_MS = 1000;

export function useSitemapScan() {
  const [result, setResult] = useState(null);
  const activePollRef = useRef(null);

  const sitemapMutation = useMutation({
    mutationFn: createDeepAuditJob,
    onSuccess: async ({ job }) => {
      if (!job?.jobId) {
        throw new Error('Deep audit job id missing');
      }

      const data = await pollJobUntilComplete(job.jobId);
      const pageCount = data?.result?.pages?.length ?? 0;
      setResult(data?.result ?? null);
      toast.success(`Sitemap scan complete (${pageCount} pages)`);
      logEvent('sitemap.scan.complete', {
        domain: data?.domain,
        totals: data?.result?.totals,
        sitemapCount: data?.result?.sitemap?.sitemaps?.length ?? 0,
        pages: (data?.result?.pages ?? []).map((page) => ({
          url: page.url,
          statusCode: page.statusCode,
          flags: page.flags
        })),
        jobId: job.jobId,
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
    setResult(null);
    sitemapMutation.mutate({ domain, sitemapUrl, maxPages });
  };

  async function pollJobUntilComplete(jobId) {
    if (activePollRef.current) {
      clearTimeout(activePollRef.current);
      activePollRef.current = null;
    }

    while (true) {
      const data = await fetchDeepAuditJob(jobId);
      const status = data?.job?.status;

      if (TERMINAL_STATUSES.has(status)) {
        if (status === 'failed') {
          throw new Error(data?.job?.errorMessage ?? 'Sitemap scan failed');
        }
        return data.job;
      }

      await new Promise((resolve) => {
        activePollRef.current = setTimeout(resolve, POLL_INTERVAL_MS);
      });
    }
  }

  return {
    startSitemapScan,
    result,
    isRunning: sitemapMutation.isPending,
    error: sitemapMutation.error
  };
}
