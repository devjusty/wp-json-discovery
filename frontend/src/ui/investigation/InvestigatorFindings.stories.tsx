import type { Meta, StoryObj } from '@storybook/react-vite';
import { InvestigatorFindings } from './InvestigatorFindings';
import type { Investigation } from '../../domain/investigation/model';

const investigation = { findings: [{ id: 'finding', capability: 'exposure', summary: 'Admin endpoint is discoverable', evidenceIds: [], confidence: 'high' }] } as unknown as Investigation;
const meta = { title: 'Investigation/Findings', component: InvestigatorFindings } satisfies Meta<typeof InvestigatorFindings>;
export default meta;
export const Ranked: StoryObj<typeof meta> = { args: { investigation, onSelectEvidence: () => undefined } };
