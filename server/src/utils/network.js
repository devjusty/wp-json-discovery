import net from 'node:net';
import { lookup } from 'node:dns/promises';

function ipv4ToNumber(address) {
  return address.split('.').reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0);
}

function inRange(address, start, end) {
  const numeric = ipv4ToNumber(address);
  return numeric >= ipv4ToNumber(start) && numeric <= ipv4ToNumber(end);
}

function isPrivateIpv4(address) {
  return (
    address === '0.0.0.0'
    || address === '127.0.0.1'
    || inRange(address, '10.0.0.0', '10.255.255.255')
    || inRange(address, '100.64.0.0', '100.127.255.255')
    || inRange(address, '169.254.0.0', '169.254.255.255')
    || inRange(address, '172.16.0.0', '172.31.255.255')
    || inRange(address, '192.168.0.0', '192.168.255.255')
  );
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase();
  return (
    normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('::ffff:127.')
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe8')
    || normalized.startsWith('fe9')
    || normalized.startsWith('fea')
    || normalized.startsWith('feb')
  );
}

export function isPrivateAddress(address) {
  if (typeof address !== 'string' || address.trim().length === 0) {
    return true;
  }

  const normalized = address.trim();
  const family = net.isIP(normalized);

  if (family === 4) {
    return isPrivateIpv4(normalized);
  }

  if (family === 6) {
    return isPrivateIpv6(normalized);
  }

  return true;
}

export async function assertHostResolvesToPublicAddresses(hostname, options = {}) {
  const { lookup: lookupImpl = lookup } = options;

  if (process.env.NODE_ENV === 'test' && options.lookup === undefined) {
    return [];
  }

  const records = await lookupImpl(hostname, { all: true });
  const addresses = Array.isArray(records) ? records : [records];

  if (addresses.length === 0) {
    throw new Error(`No DNS records found for ${hostname}`);
  }

  const blocked = addresses.find((record) => isPrivateAddress(record?.address));
  if (blocked) {
    throw new Error(`Host resolves to a private address (${blocked.address})`);
  }

  return addresses;
}
