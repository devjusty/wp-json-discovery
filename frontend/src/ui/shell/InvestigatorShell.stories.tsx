import type { Meta, StoryObj } from '@storybook/react-vite';
import { InvestigatorShell } from './InvestigatorShell';

const meta = { title: 'Shell/Investigator shell', component: InvestigatorShell } satisfies Meta<typeof InvestigatorShell>;
export default meta;
export const Partial: StoryObj<typeof meta> = { args: { readModel: { title: 'example.com', status: 'partial', sections: [{ id: 'overview', label: 'Overview' }] }, commands: { onSectionChange: () => undefined, onRetry: () => undefined }, children: 'Investigator report' } };
