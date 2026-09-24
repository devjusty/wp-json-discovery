import type { Meta, StoryObj } from '@storybook/react-vite';
import { InvestigatorShell } from '../shell/InvestigatorShell';
import { createInvestigatorReadModel } from '../../adapters/investigatorReadModel';
import { createInvestigation, type Investigation } from '../../domain/investigation/model';

const base = {
  id: 'story-investigation',
  submittedUrl: 'Example.com',
  normalizedUrl: 'https://example.com',
  redirectChain: ['https://example.com'],
  createdAt: '2026-09-23T10:00:00Z',
  observationTimeline: [],
  evidence: [],
  findings: [],
} as const;

const fixtures = {
  Idle: createInvestigation({ ...base, capabilities: [{ name: 'wordpress', status: 'queued' }] }),
  Running: createInvestigation({ ...base, capabilities: [{ name: 'wordpress', status: 'running' }] }),
  PartialWithRetry: createInvestigation({
    ...base,
    capabilities: [
      { name: 'wordpress', status: 'success', result: { api: 'observed' } },
      { name: 'homepage', status: 'failed', error: { code: 'timeout', message: 'Homepage timed out', retryable: true } },
    ],
  }),
  Complete: createInvestigation({ ...base, capabilities: [{ name: 'wordpress', status: 'success', result: { api: 'observed' } }] }),
  Unavailable: createInvestigation({
    ...base,
    capabilities: [{ name: 'homepage', status: 'unavailable', error: { code: 'blocked', message: 'Runner unavailable', retryable: false } }],
  }),
  AnonymousResume: createInvestigation({ ...base, capabilities: [{ name: 'wordpress', status: 'queued' }] }),
} satisfies Record<string, Investigation>;

const meta = {
  title: 'Investigation/Workflow',
  component: InvestigatorShell,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof InvestigatorShell>;
export default meta;

type Story = StoryObj<typeof meta>;

function renderFixture(investigation: Investigation) {
  const session = {
    investigationState: investigation,
    domain: { submitted: investigation.submittedUrl, normalized: investigation.normalizedUrl },
    capabilityStates: Object.fromEntries(investigation.capabilities.map((capability) => [capability.name, {
      status: capability.status,
      outcome: 'result' in capability || 'error' in capability ? {
        result: 'result' in capability ? capability.result : null,
        error: 'error' in capability ? capability.error : null,
      } : undefined,
    }])),
  };
  const readModel = createInvestigatorReadModel(session, false);
  return (
    <InvestigatorShell
      readModel={readModel}
      commands={{ onSectionChange: () => undefined, onRetry: () => undefined }}
      activeSection="overview"
    />
  );
}

export const Idle: Story = { args: storyArgs(fixtures.Idle), render: () => renderFixture(fixtures.Idle) };
export const Running: Story = { args: storyArgs(fixtures.Running), render: () => renderFixture(fixtures.Running) };
export const PartialWithRetry: Story = { args: storyArgs(fixtures.PartialWithRetry), render: () => renderFixture(fixtures.PartialWithRetry) };
export const Complete: Story = { args: storyArgs(fixtures.Complete), render: () => renderFixture(fixtures.Complete) };
export const Unavailable: Story = { args: storyArgs(fixtures.Unavailable), render: () => renderFixture(fixtures.Unavailable) };
export const AnonymousResume: Story = { args: storyArgs(fixtures.AnonymousResume), render: () => renderFixture(fixtures.AnonymousResume) };

function storyArgs(investigation: Investigation) {
  return {
    readModel: createInvestigatorReadModel({ investigationState: investigation }, false),
    commands: { onSectionChange: () => undefined, onRetry: () => undefined },
  };
}
