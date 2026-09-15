import { describe, expect, it } from 'vitest';
import {
  evidenceReasons,
  evidenceSources,
  normalizeEvidence
} from './evidence.js';

describe('normalizeEvidence', () => {
  it('uses enclosing evidence level and reference provenance for canonical evidence', () => {
    const result = normalizeEvidence([
      { id: 'users', capabilityId: 'wordpress', locator: '/wp-json/wp/v2/users' },
      { id: 'root', capabilityId: 'wordpress', locator: '/wp-json/' }
    ], { evidenceLevel: 'observed' });

    expect(result.successful).toEqual([
      {
        id: 'root',
        capabilityId: 'wordpress',
        locator: '/wp-json/',
        status: 'observed',
        source: 'wordpress:/wp-json/'
      },
      {
        id: 'users',
        capabilityId: 'wordpress',
        locator: '/wp-json/wp/v2/users',
        status: 'observed',
        source: 'wordpress:/wp-json/wp/v2/users'
      }
    ]);
    expect(evidenceSources(result.successful)).toBe('wordpress:/wp-json/, wordpress:/wp-json/wp/v2/users');
  });

  it.each(['observed', 'corroborated', 'inferred'])('preserves canonical evidence level %s', (evidenceLevel) => {
    const result = normalizeEvidence(
      [{ id: 'evidence', capabilityId: 'capability', locator: '/source' }],
      { evidenceLevel }
    );

    expect(result.successful[0].status).toBe(evidenceLevel);
    expect(result.unavailable).toEqual([]);
  });

  it('normalizes canonical unavailable metadata without crashing on empty evidence', () => {
    const result = normalizeEvidence([], {
      evidenceLevel: 'unavailable',
      source: '/wp-json/',
      reason: 'Response was blocked'
    });

    expect(result.successful).toEqual([]);
    expect(result.unavailable).toEqual([{
      status: 'unavailable',
      source: '/wp-json/',
      reason: 'Response was blocked'
    }]);
    expect(evidenceReasons(result.unavailable)).toBe('Response was blocked');
  });

  it('preserves legacy per-entry statuses and canonicalizes mixed evidence', () => {
    const result = normalizeEvidence([
      { status: 'unavailable', source: '/zulu', reason: 'Second failure' },
      { status: 'observed', source: '/confirmed' },
      { status: 'unavailable', source: '/alpha', reason: 'First failure' },
      { status: 'unavailable', source: '/zulu', reason: 'Second failure' }
    ]);

    expect(result.successful).toEqual([{ status: 'observed', source: '/confirmed' }]);
    expect(result.unavailable).toEqual([
      { status: 'unavailable', source: '/alpha', reason: 'First failure' },
      { status: 'unavailable', source: '/zulu', reason: 'Second failure' }
    ]);
  });
});
