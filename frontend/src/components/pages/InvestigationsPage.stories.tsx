import type { Meta, StoryObj } from '@storybook/react-vite';
import InvestigationsPage from './InvestigationsPage';

const meta = {
  title: 'Pages/InvestigationsPage',
  component: InvestigationsPage,
  args: {
    isAuthenticated: false,
    onResumeLocal: () => undefined,
    onResumeInvestigation: () => undefined,
  },
} satisfies Meta<typeof InvestigationsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
