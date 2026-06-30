process.env.NODE_ENV = 'test';

import { describe, it, expect } from '@jest/globals';
import { getRateLimitConfig, rateLimitKey } from './rateLimiter.js';

describe('getRateLimitConfig', () => {
  it('returns strict limits for unauthenticated requests', () => {
    const config = getRateLimitConfig({ user: null, path: '/api/proxy' });
    expect(config.points).toBe(10);
    expect(config.duration).toBe(60);
  });

  it('returns generous limits for admin users', () => {
    const config = getRateLimitConfig({ user: { role: 'admin' }, path: '/api/proxy' });
    expect(config.points).toBe(120);
    expect(config.duration).toBe(60);
  });

  it('returns standard limits for authenticated users', () => {
    const config = getRateLimitConfig({ user: { role: 'standard' }, path: '/api/unsupported-plugins' });
    expect(config.points).toBe(60);
    expect(config.duration).toBe(60);
  });

  it('returns stricter proxy limit for standard users', () => {
    const config = getRateLimitConfig({ user: { role: 'standard' }, path: '/api/proxy' });
    expect(config.points).toBe(5);
    expect(config.duration).toBe(60);
  });
});

describe('rateLimitKey', () => {
  it('uses user sub for authenticated requests', () => {
    const key = rateLimitKey({ user: { sub: 'auth0|user1' }, ip: '1.2.3.4' });
    expect(key).toBe('user:auth0|user1');
  });

  it('uses IP for unauthenticated requests', () => {
    const key = rateLimitKey({ user: null, ip: '1.2.3.4' });
    expect(key).toBe('ip:1.2.3.4');
  });
});
