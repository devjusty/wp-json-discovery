import { fn } from 'storybook/test';
import ScanSettingsPanel from './ScanSettingsPanel.jsx';

export default {
  component: ScanSettingsPanel,
  tags: ['autodocs', 'ai-generated', 'needs-work'],
};

export const RecommendedSelection = {
  args: {
    scanSettings: {
      capabilityIds: ['homepage', 'wordpress'],
      options: {
        homepage: {},
        wordpress: {}
      }
    },
    onScanSettingsChange: fn(),
    onSaveDefaults: fn(),
  },
};

export const SitemapConfigured = {
  args: {
    scanSettings: {
      capabilityIds: ['sitemap', 'wordpress'],
      options: {
        sitemap: { sitemapUrl: '/news-sitemap.xml', maxPages: 20 },
        wordpress: {}
      }
    },
    onScanSettingsChange: fn(),
    onSaveDefaults: fn(),
  },
};
