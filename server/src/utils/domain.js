import net from 'node:net';

const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.lan'];

export function sanitizeDomain(input) {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim().toLowerCase();
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

  return trimmed;
}
