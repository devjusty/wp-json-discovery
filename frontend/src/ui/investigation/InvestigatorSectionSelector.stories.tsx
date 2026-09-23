import type { Meta, StoryObj } from '@storybook/react-vite';
import { InvestigatorSectionSelector } from './InvestigatorSectionSelector';

const meta = { title: 'Investigation/Section selector', component: InvestigatorSectionSelector } satisfies Meta<typeof InvestigatorSectionSelector>;
export default meta;
export const Responsive: StoryObj<typeof meta> = { args: { sections: [{ id: 'overview', label: 'Overview' }, { id: 'findings', label: 'Findings' }], activeSection: 'overview', onChange: () => undefined } };
