import { getRecommendedSelection, normalizeSelection } from './scanCapabilities.js';

export const SCAN_PREFERENCES_KEY = 'wp-json-discovery.scan-preferences.v1';
const SCAN_PREFERENCES_VERSION = 1;

export function loadScanPreferences() {
  try {
    const stored = localStorage.getItem(SCAN_PREFERENCES_KEY);
    if (!stored) {
      return getRecommendedSelection();
    }

    const preferences = JSON.parse(stored);
    if (!preferences || preferences.version !== SCAN_PREFERENCES_VERSION) {
      return getRecommendedSelection();
    }

    return normalizeSelection(preferences);
  } catch {
    return getRecommendedSelection();
  }
}

export function saveScanPreferences(selection) {
  const normalizedSelection = normalizeSelection(selection);
  localStorage.setItem(SCAN_PREFERENCES_KEY, JSON.stringify({
    version: SCAN_PREFERENCES_VERSION,
    ...normalizedSelection
  }));
  return normalizedSelection;
}
