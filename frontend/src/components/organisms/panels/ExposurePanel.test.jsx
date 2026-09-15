import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ExposurePanel from './ExposurePanel.jsx';

describe('ExposurePanel', () => {
  it('does not claim unsupported exposure values are observed', () => {
    render(<ExposurePanel exposure={{ records: [] }} />);

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/No successful exposure evidence/i)).toBeInTheDocument();
  });

  it('renders record evidence arrays and preserves unavailable reasons', () => {
    render(<ExposurePanel exposure={{ records: [
      { id: 'rest', label: 'REST API', value: 'Public', evidence: [{ status: 'observed', source: '/wp-json/' }] },
      { id: 'users', label: 'Users', value: 'Unknown', evidence: [{ status: 'unavailable', source: '/users', reason: 'Authentication required' }] }
    ] }} />);

    expect(screen.getByText('REST API')).toBeInTheDocument();
    expect(screen.getByText(/Observed.*\/wp-json\//)).toBeInTheDocument();
    expect(screen.getByText(/Unavailable.*Authentication required/)).toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('keeps successful evidence when unavailable evidence appears first', () => {
    render(<ExposurePanel exposure={{ records: [
      { id: 'rest', label: 'REST API', value: 'Public', evidence: [
        { status: 'unavailable', source: '/wp-json/', reason: 'First probe blocked' },
        { status: 'observed', source: '/wp-json/root' }
      ] }
    ] }} />);

    expect(screen.getByText('REST API')).toBeInTheDocument();
    expect(screen.getByText(/Observed.*\/wp-json\/root/)).toBeInTheDocument();
    expect(screen.getByText(/First probe blocked/)).toBeInTheDocument();
  });

  it('keeps unavailable reasons when successful evidence appears first', () => {
    render(<ExposurePanel exposure={{ records: [
      { id: 'rest', label: 'REST API', value: 'Public', evidence: [
        { status: 'observed', source: '/wp-json/root' },
        { status: 'unavailable', source: '/wp-json/alternate', reason: 'Alternate probe blocked' }
      ] }
    ] }} />);

    expect(screen.getByText('REST API')).toBeInTheDocument();
    expect(screen.getByText(/Observed.*\/wp-json\/root/)).toBeInTheDocument();
    expect(screen.getByText(/Alternate probe blocked/)).toBeInTheDocument();
  });

  it.each([
    [{ status: 'inferred', source: '/hint' }, { status: 'observed', source: '/confirmed' }],
    [{ status: 'observed', source: '/confirmed' }, { status: 'inferred', source: '/hint' }]
  ])('uses deterministic successful-status precedence regardless of evidence order', (first, second) => {
    render(<ExposurePanel exposure={{ records: [
      { id: 'rest', label: 'REST API', value: 'Public', evidence: [first, second] }
    ] }} />);

    expect(screen.getByText(/Observed.*\/confirmed/)).toBeInTheDocument();
  });

  it('labels corroborated evidence explicitly', () => {
    render(<ExposurePanel exposure={{ records: [
      { id: 'rest', label: 'REST API', value: 'Public', evidence: { status: 'corroborated', source: '/verified' } }
    ] }} />);

    expect(screen.getByText('Corroborated · Source: /verified')).toBeInTheDocument();
  });

  it.each([
    [
      { status: 'observed', source: '/zulu' },
      { status: 'inferred', source: '/alpha' },
      { status: 'observed', source: '/zulu' }
    ],
    [
      { status: 'observed', source: '/zulu' },
      { status: 'observed', source: '/zulu' },
      { status: 'inferred', source: '/alpha' }
    ]
  ])('canonicalizes and deduplicates sources regardless of evidence order', (first, second, third) => {
    render(<ExposurePanel exposure={{ records: [
      { id: 'rest', label: 'REST API', value: 'Public', evidence: [first, second, third] }
    ] }} />);

    expect(screen.getByText('Observed · Source: /alpha, /zulu')).toBeInTheDocument();
  });

  it('preserves record-level unavailable source and reason without evidence entries', () => {
    render(<ExposurePanel exposure={{ records: [
      {
        id: 'settings',
        label: 'Settings endpoint',
        evidence: null,
        evidenceLevel: 'unavailable',
        source: '/wp/v2/settings',
        reason: 'Authentication required'
      }
    ] }} />);

    expect(screen.getByText(/Settings endpoint: Unavailable.*\/wp\/v2\/settings.*Authentication required/)).toBeInTheDocument();
    expect(screen.queryByText(/No successful exposure evidence/)).not.toBeInTheDocument();
  });

  it.each([
    [
      { status: 'unavailable', source: '/zulu', reason: 'Second probe failed' },
      { status: 'unavailable', source: '/alpha', reason: 'First probe failed' },
      { status: 'unavailable', source: '/zulu', reason: 'Second probe failed' }
    ],
    [
      { status: 'unavailable', source: '/alpha', reason: 'First probe failed' },
      { status: 'unavailable', source: '/zulu', reason: 'Second probe failed' }
    ]
  ])('canonicalizes unavailable evidence entries regardless of evidence order', (first, second, third) => {
    render(<ExposurePanel exposure={{ records: [
      { id: 'rest', label: 'REST API', evidence: [first, second, third].filter(Boolean) }
    ] }} />);

    const unavailable = screen.getByLabelText('Unavailable exposure evidence');
    expect(unavailable.textContent.indexOf('/alpha')).toBeLessThan(unavailable.textContent.indexOf('/zulu'));
    expect(unavailable.textContent.match(/First probe failed/g)).toHaveLength(1);
    expect(unavailable.textContent.match(/Second probe failed/g)).toHaveLength(1);
  });

  it('does not fabricate legacy exposure results for missing or null fields', () => {
    const { rerender } = render(<ExposurePanel exposure={{ userEnumeration: { open: true } }} />);

    expect(screen.queryByText('REST API')).not.toBeInTheDocument();
    expect(screen.getByText('User enumeration')).toBeInTheDocument();

    rerender(<ExposurePanel exposure={{ restApiAvailable: null, userEnumeration: null }} />);
    expect(screen.queryByText('REST API')).not.toBeInTheDocument();
    expect(screen.queryByText('User enumeration')).not.toBeInTheDocument();
    expect(screen.getByText(/No successful exposure evidence/i)).toBeInTheDocument();
  });

  it('does not crash for records-only exposure payloads', () => {
    expect(() => render(<ExposurePanel exposure={{ records: [
      { id: 'rest', label: 'REST API', value: 'Public', evidence: { status: 'observed' } }
    ] }} />)).not.toThrow();
  });

  it('renders unknown evidence status as unavailable', () => {
    render(<ExposurePanel exposure={{ records: [
      { id: 'rest', label: 'REST API', value: 'Unknown', evidence: { status: 'mystery', reason: 'Malformed evidence' } }
    ] }} />);

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Malformed evidence/)).toBeInTheDocument();
  });

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
