/**
 * Loads a mission's full content on demand (docs/07-architecture.md §7).
 *
 * Cached missions render synchronously. A cold load shows "Cargando misión…"
 * only after a short delay, so a fast chunk never flashes a spinner. A failed
 * chunk shows an error with a retry instead of a blank screen.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';

import type { Mission } from '../../domain/content/schema';
import type { MissionLoader } from '../../domain/content/mission-loader';

const LOADING_DELAY_MS = 150;

type GateState =
  | { status: 'loading'; showSpinner: boolean }
  | { status: 'ready'; mission: Mission }
  | { status: 'error' };

interface MissionGateProps {
  loader: MissionLoader;
  missionId: string;
  onExit: () => void;
  children: (mission: Mission) => ReactNode;
}

export function MissionGate({ loader, missionId, onExit, children }: MissionGateProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<GateState>(() => {
    const cached = loader.peek(missionId);
    return cached === null
      ? { status: 'loading', showSpinner: false }
      : { status: 'ready', mission: cached };
  });

  useEffect(() => {
    const cached = loader.peek(missionId);
    if (cached !== null) {
      setState({ status: 'ready', mission: cached });
      return undefined;
    }
    let alive = true;
    setState({ status: 'loading', showSpinner: false });
    const timer = setTimeout(() => {
      if (alive) {
        setState((current) =>
          current.status === 'loading' ? { status: 'loading', showSpinner: true } : current,
        );
      }
    }, LOADING_DELAY_MS);
    loader.load(missionId).then(
      (mission) => {
        if (alive) setState({ status: 'ready', mission });
      },
      () => {
        if (alive) setState({ status: 'error' });
      },
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [loader, missionId, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  if (state.status === 'ready') return <>{children(state.mission)}</>;

  if (state.status === 'error') {
    return (
      <main className="shell" role="alert">
        <p className="eyebrow">Algorithm Quest</p>
        <h1>No se pudo cargar la misión</h1>
        <p className="lede">
          Revisa tu conexión e inténtalo de nuevo. Tu progreso no se ha perdido.
        </p>
        <p>
          <button type="button" className="btn btn--primary" onClick={retry}>
            Reintentar
          </button>{' '}
          <button type="button" className="btn btn--ghost" onClick={onExit}>
            Volver al taller
          </button>
        </p>
      </main>
    );
  }

  return (
    <main className="shell" aria-busy="true">
      <p className="eyebrow">Algorithm Quest</p>
      {state.showSpinner ? (
        <p className="status" role="status">
          Cargando misión…
        </p>
      ) : null}
    </main>
  );
}
