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
