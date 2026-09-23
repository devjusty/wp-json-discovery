import type { Meta, StoryObj } from '@storybook/react-vite';
import { InvestigatorOverview } from './InvestigatorOverview';
import type { Investigation } from '../../domain/investigation/model';

const investigation = { id: 'story', submittedUrl: 'https://example.com', normalizedUrl: 'https://example.com', redirectChain: ['https://example.com'], createdAt: '2026-09-23T10:00:00Z', capabilities: [{ name: 'homepage', status: 'success', result: 'ready' }], observationTimeline: [], evidence: [], findings: [] } as Investigation;
const meta = { title: 'Investigation/Overview', component: InvestigatorOverview } satisfies Meta<typeof InvestigatorOverview>;
export default meta;
export const Default: StoryObj<typeof meta> = { args: { investigation, onInspect: () => undefined } };
