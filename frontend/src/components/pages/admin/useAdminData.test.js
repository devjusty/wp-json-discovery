import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useAdminData from './useAdminData.js';

function buildInput(overrides = {}) {
  return {
    data: {
      activityLogs: [
        { id: 1, type: 'scan.complete', payload: { domain: 'alpha.com' } },
        { id: 2, type: 'scan.error', payload: { domain: 'beta.com' } },
        { id: 3, type: 'scan.complete', payload: { domain: 'gamma.com' } },
        { id: 4, type: 'metrics.heartbeat', payload: {} }
      ],
      unsupportedPlugins: [
        {
          namespace: 'wc/v3',
          domains: ['alpha.com', 'beta.com'],
          firstDetectedAt: '2026-03-01T00:00:00.000Z',
          lastDetectedAt: '2026-03-15T00:00:00.000Z'
        },
        {
          namespace: 'yoast/v1',
          domains: ['alpha.com'],
          firstDetectedAt: '2026-03-05T00:00:00.000Z',
          lastDetectedAt: '2026-03-12T00:00:00.000Z'
        }
      ],
      heartbeat: {
        recent: [
          {
            timestamp: '2026-03-19T10:10:00.000Z',
            payload: { scanDurationMs: { p95: 1200 }, errors: { total: 3 } }
          },
          {
            timestamp: '2026-03-19T10:00:00.000Z',
            payload: { scanDurationMs: { p95: 900 }, errors: { total: 1 } }
          }
        ]
      },
      files: {
        db: { sizeBytes: 1000 },
        wal: { sizeBytes: 250 },
        shm: { sizeBytes: 100 }
      }
    },
    activeSection: 'logs',
    logTypeFilter: 'scan.complete',
    unsupportedNamespacePrefix: 'wc/',
    unsupportedSort: 'domainsDesc',
    domainsQuery: 'alpha',
    domainsSort: 'namespacesDesc',
    pluginCatalogQuery: '',
    pluginCatalogSort: 'labelAsc',
    themeCatalogQuery: '',
    themeCatalogSort: 'labelAsc',
    ...overrides
  };
}

describe('useAdminData', () => {
  it('derives filtered/sorted snapshot-backed datasets', () => {
    const { result } = renderHook(() => useAdminData(buildInput()));

    expect(result.current.isSnapshotBackedSection).toBe(true);
    expect(result.current.logTypes).toEqual(['metrics.heartbeat', 'scan.complete', 'scan.error']);
    expect(result.current.filteredActivityLogs).toHaveLength(2);
    expect(result.current.filteredUnsupportedEntries).toHaveLength(1);
    expect(result.current.filteredUnsupportedEntries[0].namespace).toBe('wc/v3');
    expect(result.current.filteredDomainEntries).toHaveLength(1);
    expect(result.current.filteredDomainEntries[0].domain).toBe('alpha.com');
    expect(result.current.recentScans).toHaveLength(2);
    expect(result.current.heartbeatP95Series).toEqual([900, 1200]);
    expect(result.current.heartbeatErrorSeries).toEqual([1, 3]);
    expect(result.current.sqliteFootprintBytes).toBe(1350);
  });

  it('handles missing data safely', () => {
    const { result } = renderHook(() => useAdminData(buildInput({ data: null, activeSection: 'plugins' })));

    expect(result.current.isSnapshotBackedSection).toBe(false);
    expect(result.current.activityLogs).toEqual([]);
    expect(result.current.filteredActivityLogs).toEqual([]);
    expect(result.current.recentScans).toEqual([]);
    expect(result.current.sqliteFootprintBytes).toBe(null);
  });
});
