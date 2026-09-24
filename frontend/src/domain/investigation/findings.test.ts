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

  it('prioritizes consequence, evidence quality, breadth, and novelty before stable ties', () => {
    const findings: Finding[] = [
      { id: 'consequence-low', capability: 'x', summary: 'Low consequence', evidenceIds: ['a', 'b'], confidence: 'high', consequence: 'low', evidenceQuality: 'high', novelty: 'high' },
      { id: 'quality-low', capability: 'x', summary: 'Low quality', evidenceIds: ['a', 'b', 'c'], confidence: 'high', consequence: 'high', evidenceQuality: 'low', novelty: 'high' },
      { id: 'breadth-low', capability: 'x', summary: 'Low breadth', evidenceIds: ['a'], confidence: 'high', consequence: 'high', evidenceQuality: 'high', novelty: 'high' },
      { id: 'novelty-low', capability: 'x', summary: 'Low novelty', evidenceIds: ['a', 'b'], confidence: 'high', consequence: 'high', evidenceQuality: 'high', novelty: 'low' },
      { id: 'top', capability: 'x', summary: 'Top', evidenceIds: ['a', 'b'], confidence: 'high', consequence: 'high', evidenceQuality: 'high', novelty: 'high' },
    ];

    expect(rankFindings(findings).map(({ id }) => id)).toEqual([
      'top', 'novelty-low', 'breadth-low', 'quality-low', 'consequence-low',
    ]);
  });
});
