import ScanStatusStack from './ScanStatusStack.jsx';

export default {
  component: ScanStatusStack,
  tags: ['autodocs', 'ai-generated', 'needs-work'],
  args: {
    session: {
      domain: 'example.com',
      overallStatus: 'idle',
      capabilities: {}
    }
  },
};

export const Idle = {};

export const Scanning = {
  args: {
    isScanning: true,
    session: {
      domain: 'example.com',
      overallStatus: 'running',
      capabilities: {
        wordpress: { status: 'running', result: null, error: null }
      }
    }
  },
};

export const HomepageRunning = {
  args: {
    session: {
      domain: 'example.com',
      overallStatus: 'running',
      capabilities: {
        homepage: { status: 'running', result: null, error: null }
      }
    }
  },
};

export const WithErrors = {
  args: {
    session: {
      domain: 'example.com',
      overallStatus: 'incomplete',
      capabilities: {
        wordpress: { status: 'failed', result: null, error: { code: 'auth_required', message: 'REST API blocked', retryable: true } },
        homepage: { status: 'failed', result: null, error: { message: 'Homepage source analysis failed.', retryable: true } }
      }
    }
  },
};
