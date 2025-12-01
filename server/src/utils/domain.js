export function sanitizeDomain(input) {
  const trimmed = input.trim().toLowerCase();

  // Basic allowlist: alphanumerics, dots, dashes. No protocol or path.
  if (!/^[a-z0-9.-]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}
