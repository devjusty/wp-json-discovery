import { describe, expect, it } from 'vitest';
import { mergeRecentScans } from './scanFeed.js';

describe('mergeRecentScans', () => {
  it('merges saved scans and recent runs into one sorted feed with saved state', () => {
    const recentRuns = [
      { domain: 'unsaved.example.com', lastScannedAt: '2026-06-30T12:00:00.000Z', lastStatus: 'ok' },
      { domain: 'saved.example.com', lastScannedAt: '2026-06-30T10:00:00.000Z', lastStatus: 'failed' }
    ];

    const savedScans = [
      { domain: 'saved.example.com', saved_at: '2026-06-30T09:30:00.000Z', notes: 'keep this' },
      { domain: 'older-saved.example.com', saved_at: '2026-06-30T11:15:00.000Z', notes: '' }
    ];

    expect(mergeRecentScans(recentRuns, savedScans)).toEqual([
      {
        domain: 'unsaved.example.com',
        isSaved: false,
        savedAt: null,
        notes: null,
        lastScannedAt: '2026-06-30T12:00:00.000Z',
        lastStatus: 'ok'
      },
      {
        domain: 'older-saved.example.com',
        isSaved: true,
        savedAt: '2026-06-30T11:15:00.000Z',
        notes: '',
        lastScannedAt: null,
        lastStatus: null
      },
      {
        domain: 'saved.example.com',
        isSaved: true,
        savedAt: '2026-06-30T09:30:00.000Z',
        notes: 'keep this',
        lastScannedAt: '2026-06-30T10:00:00.000Z',
        lastStatus: 'failed'
      }
    ]);
  });
});
