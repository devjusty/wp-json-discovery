import { describe, expect, it } from '@jest/globals';
import { assertHostResolvesToPublicAddresses, isPrivateAddress } from '../utils/network.js';

describe('network helpers', () => {
  it('treats private and local addresses as blocked', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('10.0.0.5')).toBe(true);
    expect(isPrivateAddress('172.16.0.1')).toBe(true);
    expect(isPrivateAddress('192.168.1.10')).toBe(true);
    expect(isPrivateAddress('169.254.10.20')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
  });

  it('rejects hostnames that resolve to private addresses', async () => {
    await expect(
      assertHostResolvesToPublicAddresses('example.com', {
        lookup: async () => [{ address: '127.0.0.1', family: 4 }]
      })
    ).rejects.toThrow(/private address/i);
  });
});
