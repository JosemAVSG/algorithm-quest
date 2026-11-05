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
import { markReopen } from '../../app/reopen';

const LOADING_DELAY_MS = 150;

type GateState =
  | { status: 'loading'; showSpinner: boolean }
  | { status: 'ready'; mission: Mission }
  | { status: 'error' };

interface MissionGateProps {
  loader: MissionLoader;
  missionId: string;
  onExit: () => void;
  /**
   * Reload the page. Injected so tests do not navigate; the default really
   * reloads, after marking this mission to be reopened.
   */
  onReload?: () => void;
  children: (mission: Mission) => ReactNode;
}

export function MissionGate({ loader, missionId, onExit, onReload, children }: MissionGateProps) {
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
  }, [loader, missionId]);

  // Not `setAttempt`: the browser caches a failed module import for the life of
  // the page, so asking the loader again returns the same failure without a
  // request. A reload is the only retry that can work (see `app/reopen.ts`).
  const reloadAndRetry = useCallback(() => {
    markReopen(missionId);
    (onReload ?? (() => window.location.reload()))();
  }, [missionId, onReload]);

  if (state.status === 'ready') return <>{children(state.mission)}</>;

  if (state.status === 'error') {
    return (
      <main className="shell" role="alert">
        <p className="eyebrow">Algorithm Quest</p>
        <h1>No se pudo cargar la misión</h1>
        <p className="lede">
          Puede ser la conexión, o que haya una versión nueva del juego mientras tenías esta
          pestaña abierta. Recargar la página lo arregla en los dos casos y vuelve a abrir esta
          misión. Tu progreso no se ha perdido.
        </p>
        <p>
          <button type="button" className="btn btn--primary" onClick={reloadAndRetry}>
            Recargar y reintentar
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
