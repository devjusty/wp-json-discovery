import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ExposurePanel from './ExposurePanel.jsx';

describe('ExposurePanel', () => {
  it('renders homepage security headers in the exposure list', () => {
    render(
      <ExposurePanel
        exposure={{
          restApiAvailable: true,
          userEnumeration: { open: false, total: 0, statusCode: 200, sample: null },
          settingsExposed: { open: false, statusCode: 200 },
          xmlrpc: { enabled: false, statusCode: 200 },
          robotsTxt: { available: true, statusCode: 200 },
          sitemapXml: { available: true, statusCode: 200 },
          uploads: { indexable: false, statusCode: 200 }
        }}
        homepageSecurityHeaders={{
          items: [
            {
              key: 'content-security-policy',
              label: 'Content Security Policy',
              description: 'Homepage response header',
              present: true,
              rawValue: "default-src 'self'"
            }
          ]
        }}
      />
    );

    expect(screen.getByText('Content Security Policy')).toBeInTheDocument();
    expect(screen.getByText('Present')).toBeInTheDocument();
    expect(screen.getByText("default-src 'self'")).toBeInTheDocument();
  });
});
