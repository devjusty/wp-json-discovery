import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import InvestigationsPage from './InvestigationsPage';

function withProviders(Story) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Story />
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Pages/InvestigationsPage',
  component: InvestigationsPage,
  args: {
    isAuthenticated: false,
    onResumeLocal: () => undefined,
    onResumeInvestigation: () => undefined,
  },
  decorators: [withProviders],
} satisfies Meta<typeof InvestigationsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
