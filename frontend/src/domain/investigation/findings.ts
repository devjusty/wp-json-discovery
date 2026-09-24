import type { Finding } from './model';

const confidenceRank: Readonly<Record<Finding['confidence'], number>> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function rankFindings(findings: ReadonlyArray<Finding>): Finding[] {
  return [...findings].sort((left, right) => (
    confidenceRank[right.confidence] - confidenceRank[left.confidence]
    || right.evidenceIds.length - left.evidenceIds.length
    || left.id.localeCompare(right.id)
  ));
}
