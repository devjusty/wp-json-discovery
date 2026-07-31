process.env.NODE_ENV = 'test';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('fetchDnsDumpsterDomain', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.DNS_DUMPSTER_API_KEY;

  beforeEach(() => {
    jest.resetModules();
    process.env.DNS_DUMPSTER_API_KEY = 'test-dns-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.DNS_DUMPSTER_API_KEY;
    } else {
      process.env.DNS_DUMPSTER_API_KEY = originalKey;
    }
  });

  it('throws 503 when the API key is missing', async () => {
    delete process.env.DNS_DUMPSTER_API_KEY;
    const { fetchDnsDumpsterDomain } = await import('./dnsdumpster.js');

    await expect(fetchDnsDumpsterDomain('example.com')).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 503,
      message: expect.stringMatching(/not configured/i)
    });
  });

  it('returns normalized DNS records on success', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      a: [{ host: 'example.com', ips: [{ ip: '1.2.3.4', asn: '1', asn_name: 'TEST', country: 'US' }] }],
      ns: [],
      mx: [],
      cname: [],
      txt: ['v=spf1 -all'],
      total_a_recs: 1
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));

    const { fetchDnsDumpsterDomain } = await import('./dnsdumpster.js');
    const result = await fetchDnsDumpsterDomain('example.com');

    expect(result.domain).toBe('example.com');
    expect(result.totalARecs).toBe(1);
    expect(result.a).toHaveLength(1);
    expect(result.txt).toEqual(['v=spf1 -all']);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.dnsdumpster.com/domain/example.com',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-API-Key': 'test-dns-key' })
      })
    );
  });

  it('maps rate-limit responses to 429 AppError', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'content-type': 'application/json' }
    }));

    const { fetchDnsDumpsterDomain } = await import('./dnsdumpster.js');

    await expect(fetchDnsDumpsterDomain('example.com')).rejects.toMatchObject({
      name: 'AppError',
      statusCode: 429,
      message: 'Rate limit exceeded'
    });
  });

  it('maps upstream failures to NetworkError', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ error: 'Upstream failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    }));

    const { fetchDnsDumpsterDomain } = await import('./dnsdumpster.js');

    await expect(fetchDnsDumpsterDomain('example.com')).rejects.toMatchObject({
      name: 'NetworkError',
      statusCode: 502
    });
  });
});
