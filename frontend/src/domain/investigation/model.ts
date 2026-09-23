export type CapabilityStatus = 'queued' | 'running' | 'success' | 'failed' | 'unavailable';

export type EvidenceKind = 'observed' | 'inference' | 'request-trace' | 'absence';

export type CapabilityError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type CapabilityRun = {
  name: string;
  status: CapabilityStatus;
  error?: CapabilityError;
  reason?: string;
  startedAt?: string;
  completedAt?: string;
};

export type EvidenceSource = {
  locator?: string;
  observedAt?: string;
  evidenceIds?: string[];
  request?: {
    method: string;
    url: string;
    status?: number;
  };
};

export type Evidence = {
  id: string;
  kind: EvidenceKind;
  capability: string;
  value: unknown;
  source: EvidenceSource;
};

export type Finding = {
  id: string;
  capability: string;
  summary: string;
  evidenceIds: string[];
  confidence: 'low' | 'medium' | 'high';
};

export type Observation = {
  id: string;
  capability: string;
  observedAt: string;
  value: unknown;
};

export type Investigation = {
  id: string;
  submittedUrl: string;
  normalizedUrl: string;
  redirectChain: string[];
  createdAt: string;
  capabilities: CapabilityRun[];
  observationTimeline: Observation[];
  evidence: Evidence[];
  findings: Finding[];
};

export type CreateInvestigationInput = Pick<
  Investigation,
  'id' | 'submittedUrl' | 'normalizedUrl' | 'redirectChain' | 'createdAt'
> & Partial<Pick<Investigation, 'capabilities' | 'observationTimeline' | 'evidence' | 'findings'>>;

export const createInvestigation = (input: CreateInvestigationInput): Investigation => ({
  id: input.id,
  submittedUrl: input.submittedUrl,
  normalizedUrl: input.normalizedUrl,
  redirectChain: [...input.redirectChain],
  createdAt: input.createdAt,
  capabilities: input.capabilities ? input.capabilities.map((capability) => ({ ...capability })) : [],
  observationTimeline: input.observationTimeline ? [...input.observationTimeline] : [],
  evidence: input.evidence ? [...input.evidence] : [],
  findings: input.findings ? [...input.findings] : [],
});

export const getCapabilityState = (
  investigation: Investigation,
  capabilityName: string,
): CapabilityRun | undefined => investigation.capabilities.find(
  (capability) => capability.name === capabilityName,
);

export const isPartialInvestigation = (investigation: Investigation): boolean => investigation.capabilities.some(
  ({ status }) => status !== 'success',
);
