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
