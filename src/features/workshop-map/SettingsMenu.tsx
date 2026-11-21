/**
 * Gear button + disclosure popover for reading preferences. Plain disclosure
 * pattern (not a dialog): the button owns aria-expanded, Escape closes and
 * returns focus to the button, and a click outside closes it.
 */

import { useEffect, useId, useRef, useState } from 'react';

import { ReadingOptions } from './ReadingOptions';

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div className="settings" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn--ghost settings__button"
        aria-label="Ajustes de lectura"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5a7.7 7.7 0 0 0 0-3l1.9-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.3-.9-2 3.4 1.9 1.5a7.7 7.7 0 0 0 0 3l-1.9 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4z"
          />
        </svg>
      </button>
      <div className="settings__panel" id={panelId} hidden={!open}>
        <p className="settings__title">Lectura</p>
        <ReadingOptions />
      </div>
    </div>
  );
}
