import type { Finding } from './model';

const confidenceRank: Readonly<Record<Finding['confidence'], number>> = {
  high: 3,
  medium: 2,
  low: 1,
};

const dimensionRank: Readonly<Record<'low' | 'medium' | 'high', number>> = {
  high: 3,
  medium: 2,
  low: 1,
};

const rankDimension = (value: 'low' | 'medium' | 'high' | undefined, fallback: number) => (
  value ? dimensionRank[value] : fallback
);

export function rankFindings(findings: ReadonlyArray<Finding>): Finding[] {
  return [...findings].sort((left, right) => (
    rankDimension(right.consequence, confidenceRank[right.confidence]) - rankDimension(left.consequence, confidenceRank[left.confidence])
    || rankDimension(right.evidenceQuality, right.evidenceIds.length > 0 ? 2 : 1) - rankDimension(left.evidenceQuality, left.evidenceIds.length > 0 ? 2 : 1)
    || right.evidenceIds.length - left.evidenceIds.length
    || rankDimension(right.novelty, 2) - rankDimension(left.novelty, 2)
    || confidenceRank[right.confidence] - confidenceRank[left.confidence]
    || left.id.localeCompare(right.id)
  ));
}
