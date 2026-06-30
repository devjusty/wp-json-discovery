process.env.NODE_ENV = 'test';

import { describe, expect, it } from '@jest/globals';
import { summarizeSecurityHeaders } from '../utils/securityHeaders.js';

describe('summarizeSecurityHeaders', () => {
  it('marks present headers and preserves raw values', () => {
    const summary = summarizeSecurityHeaders(new Headers({
      'content-security-policy': "default-src 'self'",
      'x-frame-options': 'SAMEORIGIN',
      'x-content-type-options': 'nosniff'
    }));

    const csp = summary.items.find((item) => item.key === 'content-security-policy');
    const xfo = summary.items.find((item) => item.key === 'x-frame-options');
    const referrer = summary.items.find((item) => item.key === 'referrer-policy');

    expect(csp).toMatchObject({
      present: true,
      value: 'Present',
      rawValue: "default-src 'self'"
    });
    expect(xfo).toMatchObject({
      present: true,
      value: 'Present',
      rawValue: 'SAMEORIGIN'
    });
    expect(referrer).toMatchObject({
      present: false,
      value: 'Missing',
      rawValue: null
    });
  });
});
