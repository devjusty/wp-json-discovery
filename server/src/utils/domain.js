import net from 'node:net';
import { parseDomainIdentity } from '@wp-json-discovery/contracts';

const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.lan'];

export function sanitizeDomain(input) {
  if (typeof input !== 'string') {
    return null;
  }

  const raw = input.trim();
  let trimmed = raw.toLowerCase();
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.username || url.password || url.port || !['http:', 'https:'].includes(url.protocol)) return null;
      trimmed = url.hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  trimmed = trimmed.replace(/^www\./, '');
  if (!trimmed || trimmed.length > 253) {
    return null;
  }

  if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return null;
  }

  if (trimmed === 'localhost' || BLOCKED_SUFFIXES.some((suffix) => trimmed.endsWith(suffix))) {
    return null;
  }

  if (net.isIP(trimmed)) {
    return null;
  }

  if (!trimmed.includes('.')) {
    return null;
  }

  const labels = trimmed.split('.');
  const labelsValid = labels.every((label) => (
    label.length > 0
    && label.length <= 63
    && /^[a-z0-9-]+$/.test(label)
    && !label.startsWith('-')
    && !label.endsWith('-')
  ));

  if (!labelsValid) {
    return null;
  }

  const tld = labels[labels.length - 1];
  if (/^\d+$/.test(tld)) {
    return null;
  }

  return parseDomainIdentity({ submitted: input, normalized: trimmed }).normalized;
}
