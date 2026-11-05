/**
 * Reading preferences: larger text and higher contrast.
 *
 * Stored per browser and applied as attributes on <html>, so every screen
 * follows them without each component knowing. Storage can be missing or
 * blocked; then the defaults apply and nothing breaks.
 */

export interface Preferences {
  largeText: boolean;
  highContrast: boolean;
}

const KEY = 'aq.preferences';

export function loadPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return { largeText: false, highContrast: false };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return { largeText: parsed.largeText === true, highContrast: parsed.highContrast === true };
  } catch {
    return { largeText: false, highContrast: false };
  }
}

export function applyPreferences(preferences: Preferences): void {
  const root = document.documentElement;
  if (preferences.largeText) root.dataset.text = 'large';
  else delete root.dataset.text;
  if (preferences.highContrast) root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
}

export function savePreferences(preferences: Preferences): void {
  applyPreferences(preferences);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // Applied for this visit, just not remembered.
  }
}

export function applyStoredPreferences(): void {
  applyPreferences(loadPreferences());
}
