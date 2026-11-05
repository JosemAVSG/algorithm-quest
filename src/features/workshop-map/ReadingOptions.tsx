import { useState } from 'react';

import { loadPreferences, savePreferences, type Preferences } from '../../app/preferences';

export function ReadingOptions() {
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences());
  const update = (next: Preferences) => {
    setPreferences(next);
    savePreferences(next);
  };
  return (
    <div className="reading" role="group" aria-label="Lectura">
      <button
        type="button"
        className="btn btn--ghost"
        aria-pressed={preferences.largeText}
        onClick={() => update({ ...preferences, largeText: !preferences.largeText })}
      >
        Texto grande
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        aria-pressed={preferences.highContrast}
        onClick={() => update({ ...preferences, highContrast: !preferences.highContrast })}
      >
        Alto contraste
      </button>
    </div>
  );
}
