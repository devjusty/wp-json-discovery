import { describe, expect, it } from '@jest/globals';
import { domainIdentitySchema } from '@wp-json-discovery/contracts';
import { sanitizeDomain } from './domain.js';

describe('sanitizeDomain', () => {
  it.each([
    ['example.com', 'example.com'],
    ['  EXAMPLE.COM  ', 'example.com'],
    ['sub.example.co.uk', 'sub.example.co.uk'],
    ['https://www.Example.com/wp-json/?context=view', 'example.com'],
    ['http://WWW.Example.com/path?query=value', 'example.com'],
  ])('returns normalized valid domain for %j', (input, expected) => {
    expect(sanitizeDomain(input)).toBe(expected);
  });

  it.each([
    'localhost',
    'service.local',
    'service.localhost',
    'service.internal',
    'service.lan',
    '127.0.0.1',
    '::1',
    'bad..example.com',
    '-bad.example.com',
    'bad-.example.com',
    'bad_label.example.com',
    'example.123',
    `${'a'.repeat(253)}.com`,
  ])('rejects unsafe or invalid domain %j', (input) => {
    expect(sanitizeDomain(input)).toBeNull();
  });

  it.each([null, undefined, 123, {}, ['example.com']])(
    'rejects non-string input %j',
    (input) => {
      expect(sanitizeDomain(input)).toBeNull();
    },
  );

  it('rejects malformed domain identity at shared boundary', () => {
    expect(domainIdentitySchema.safeParse({ submitted: 'example.com' }).success).toBe(false);
    expect(domainIdentitySchema.safeParse({
      submitted: 'example.com',
      normalized: 'example.com',
      extra: true,
    }).success).toBe(false);
  });

  it('accepts sanitized domain identity and preserves normalized utility output', () => {
    const normalized = sanitizeDomain('  EXAMPLE.COM  ');
    const identity = domainIdentitySchema.parse({
      submitted: '  EXAMPLE.COM  ',
      normalized,
    });

    expect(identity).toEqual({ submitted: '  EXAMPLE.COM  ', normalized: 'example.com' });
    expect(normalized).toBe('example.com');
  });
});
