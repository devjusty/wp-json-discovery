import ScanStatusStack from './ScanStatusStack.jsx';

export default {
  component: ScanStatusStack,
  tags: ['autodocs', 'ai-generated', 'needs-work'],
  args: {
    activeDomain: 'example.com',
  },
};

export const Idle = {};

export const Scanning = {
  args: {
    isScanning: true,
  },
};

export const HomepageRunning = {
  args: {
    homepageIsRunning: true,
  },
};

export const WithErrors = {
  args: {
    scanError: {
      code: 'auth_required',
      message: 'REST API blocked',
    },
    homepageError: {
      message: 'Homepage source analysis failed.',
    },
  },
};
