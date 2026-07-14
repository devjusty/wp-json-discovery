import UnsupportedPluginsPanel from './UnsupportedPluginsPanel.jsx';

export default {
  component: UnsupportedPluginsPanel,
  tags: ['autodocs', 'ai-generated', 'needs-work'],
};

const samplePlugins = [
  {
    namespace: 'Unsupported/Example/Plugin',
    firstDetectedAt: '2026-07-01T12:00:00.000Z',
    lastDetectedAt: '2026-07-14T12:00:00.000Z',
    domains: ['example.com', 'docs.example.com'],
  },
  {
    namespace: 'Unsupported/Another/Plugin',
    firstDetectedAt: '2026-07-03T08:30:00.000Z',
    lastDetectedAt: '2026-07-10T15:45:00.000Z',
    domains: ['wp.example.org'],
  },
];

export const Loading = {
  args: {
    plugins: samplePlugins,
    isLoading: true,
    onRefresh: () => {},
    showDomains: true,
  },
};

export const Empty = {
  args: {
    plugins: [],
    isLoading: false,
    onRefresh: () => {},
    showDomains: true,
  },
};

export const Populated = {
  args: {
    plugins: samplePlugins,
    isLoading: false,
    onRefresh: () => {},
    showDomains: true,
  },
};
