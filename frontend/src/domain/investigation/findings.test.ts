import { describe, expect, it } from 'vitest';
import { rankFindings } from './findings';
import type { Finding } from './model';

describe('rankFindings', () => {
  it('orders confidence, evidence breadth, and ID deterministically', () => {
    const findings: Finding[] = [
      { id: 'z-low', capability: 'homepage', summary: 'Low', evidenceIds: ['one'], confidence: 'low' },
      { id: 'b-high', capability: 'wordpress', summary: 'High narrow', evidenceIds: ['two'], confidence: 'high' },
      { id: 'a-high', capability: 'wordpress', summary: 'High broad', evidenceIds: ['two', 'three'], confidence: 'high' },
    ];

    expect(rankFindings(findings).map(({ id }) => id)).toEqual(['a-high', 'b-high', 'z-low']);
  });
});
