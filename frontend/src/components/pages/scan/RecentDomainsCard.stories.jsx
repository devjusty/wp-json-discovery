import { fn } from 'storybook/test';

import RecentDomainsCard from './RecentDomainsCard.jsx';

const items = [
  {
    domain: 'example.com',
    isSaved: true,
    savedAt: '2026-07-12T10:30:00.000Z',
    lastScannedAt: '2026-07-12T10:30:00.000Z',
    lastStatus: 'success',
    notes: 'Primary storefront',
  },
  {
    domain: 'docs.example.com',
    isSaved: true,
    savedAt: '2026-07-11T08:15:00.000Z',
    lastScannedAt: '2026-07-11T08:15:00.000Z',
    lastStatus: 'failed',
    notes: 'Review redirects',
  },
];

export default {
  component: RecentDomainsCard,
  tags: ['autodocs', 'ai-generated', 'needs-work'],
  args: {
    items,
    isLoading: false,
    isScanning: false,
    isExpanded: true,
    onToggleExpanded: fn(),
    onOpenHistory: fn(),
    onRescan: fn(),
    onSaved: fn(),
    onClearRecentDomains: fn(),
  },
};

export const Populated = {};

export const Loading = {
  args: {
    isLoading: true,
  },
};

export const Empty = {
  args: {
    items: [],
    isLoading: false,
  },
};
