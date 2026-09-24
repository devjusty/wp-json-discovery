import type { Meta, StoryObj } from '@storybook/react-vite';
import { AdminInbox, type AdminInboxItem } from './AdminInbox';

const items: AdminInboxItem[] = [
  {
    id: 'scan:failed:example.com',
    kind: 'failed-scan',
    title: 'Failed scan for example.com',
    status: 'failed',
    evidence: 'Timeout after 30 seconds.',
    action: { label: 'Rescan', onSelect: () => undefined },
    priority: 10,
  },
  {
    id: 'unsupported:wc/v3',
    kind: 'unsupported-namespace',
    title: 'Unsupported namespace wc/v3',
    status: 'attention',
    evidence: 'Detected on 2 domains; last seen today.',
    action: { label: 'Promote', onSelect: () => undefined },
    priority: 30,
  },
  {
    id: 'asset:convertkit',
    kind: 'discovered-asset',
    title: 'Unknown plugin asset convertkit',
    status: 'review',
    evidence: '2 occurrences across 1 path.',
    action: { label: 'Create plugin entry', onSelect: () => undefined },
    priority: 40,
  },
  {
    id: 'maintenance:database',
    kind: 'maintenance',
    title: 'Database maintenance due',
    status: 'scheduled',
    evidence: 'No completed maintenance run is recorded.',
    action: { label: 'Run maintenance', onSelect: () => undefined },
    priority: 20,
  },
];

const meta = {
  title: 'Admin/Operational inbox',
  component: AdminInbox,
} satisfies Meta<typeof AdminInbox>;

export default meta;

export const WithOperationalItems: StoryObj<typeof meta> = {
  args: { items },
};

export const Empty: StoryObj<typeof meta> = {
  args: { items: [] },
};
