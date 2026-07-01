// Shared draft factories and text parsing helpers for admin editors.
export function createEmptyPluginDraft() {
  return {
    id: '',
    label: '',
    description: '',
    pluginUrl: '',
    namespaces: '',
    assetHints: ''
  };
}

export function createEmptyThemeDraft() {
  return {
    id: '',
    label: '',
    description: '',
    themeUrl: '',
    namespaceHints: '',
    pathSignals: ''
  };
}

export function parseDelimitedList(value) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function slugToLabel(slug) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function namespaceToSlug(namespace) {
  if (typeof namespace !== 'string') {
    return '';
  }

  const trimmed = namespace.trim();
  if (!trimmed) {
    return '';
  }

  const firstSegment = trimmed.split('/').filter(Boolean)[0] ?? '';
  return firstSegment.trim().toLowerCase();
}

export function buildPluginDraftFromSignal({ kind, slug, namespace }) {
  const normalizedSlug = String(slug ?? '').trim().toLowerCase();
  if (!normalizedSlug) {
    return createEmptyPluginDraft();
  }

  if (kind === 'namespace') {
    const normalizedNamespace = typeof namespace === 'string' ? namespace.trim() : '';
    return {
      id: normalizedSlug,
      label: slugToLabel(normalizedSlug),
      description: 'Detected from unresolved namespace signal.',
      pluginUrl: `https://wordpress.org/plugins/${normalizedSlug}/`,
      namespaces: normalizedNamespace,
      assetHints: ''
    };
  }

  return {
    id: normalizedSlug,
    label: slugToLabel(normalizedSlug),
    description: 'Detected from homepage asset path signal.',
    pluginUrl: `https://wordpress.org/plugins/${normalizedSlug}/`,
    namespaces: '',
    assetHints: normalizedSlug
  };
}
