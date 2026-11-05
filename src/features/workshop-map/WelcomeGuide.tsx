/**
 * First-visit guide: three steps, dismissible, remembered per browser.
 *
 * It only explains how the game works. It never scores or nags: once dismissed
 * it does not come back, and nothing depends on having read it.
 */

import { useState } from 'react';

const STORAGE_KEY = 'aq.welcome.dismissed';

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Private window or blocked storage: the guide simply shows again next time.
  }
}

const STEPS = [
  {
    title: 'Elige un mundo',
    text: 'Cada mundo es una zona del taller con sistemas averiados. Empieza por el Mundo 1.',
  },
  {
    title: 'Lee la misión y escribe la función',
    text: 'Cada misión pide una función de JavaScript. Pruébala en el laboratorio: las pistas llegan poco a poco.',
  },
  {
    title: 'Repara y explica',
    text: 'Al pasar las pruebas explicas por qué funciona, y el sistema del taller se repara.',
  },
];

export function WelcomeGuide() {
  const [open, setOpen] = useState(() => !wasDismissed());
  if (!open) return null;
  return (
    <section className="welcome" aria-label="Cómo se juega">
      <h2 className="welcome__title">Cómo se juega</h2>
      <ol className="welcome__steps">
        {STEPS.map((step) => (
          <li key={step.title} className="welcome__step">
            <span className="welcome__step-title">{step.title}</span>
            <span className="welcome__step-text">{step.text}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => {
          remember();
          setOpen(false);
        }}
      >
        Entendido
      </button>
    </section>
  );
}
