/**
 * Composition and routing.
 *
 * No router dependency: the app has three views (workshop, mission, progress)
 * and one linear flow. Search params would add URLs the MVP never shares, and a
 * router would be another concept to learn for a screen graph this small
 * (docs/07-architecture.md §8).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { loadBrowserContent } from '../adapters/content/browser';
import { countBySeverity } from '../domain/content/errors';
import {
  declineReinforcement,
  emptyProgress,
  recordCompletion,
  type CompletedMissionRecord,
  type PlayerProgress,
} from '../domain/persistence/port';
import type { SessionSnapshot } from '../domain/session/mission-session';
import { MissionFlow } from '../features/mission/MissionFlow';
import { ProgressDashboard } from '../features/progress/ProgressDashboard';
import { WorkshopMap } from '../features/workshop-map/WorkshopMap';
import { createComposition } from './composition';

type View = 'map' | 'progress';

export function App() {
  const report = useMemo(() => loadBrowserContent(), []);
  const app = useMemo(() => createComposition(), []);

  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [view, setView] = useState<View>('map');

  useEffect(() => {
    let alive = true;
    void app.progress.load().then((loaded) => {
      if (!alive) return;
      setProgress(loaded.progress);
      setStorageWarning(loaded.warning);
    });
    return () => {
      alive = false;
    };
  }, [app.progress]);

  const handleCompleted = useCallback(
    (record: CompletedMissionRecord) => {
      setProgress((previous) => {
        const next = recordCompletion(previous ?? emptyProgress(), record);
        void app.progress.save(next);
        return next;
      });
    },
    [app.progress],
  );

  const handleDeclineReinforcement = useCallback(
    (conceptId: string) => {
      setProgress((previous) => {
        if (previous === null) return previous;
        const next = declineReinforcement(previous, conceptId);
        void app.progress.save(next);
        return next;
      });
    },
    [app.progress],
  );

  const handleExport = useCallback(() => app.progress.export(), [app.progress]);

  const handleImport = useCallback(
    async (blob: string) => {
      const result = await app.progress.import(blob);
      if (result.warning !== null) {
        setStorageWarning(result.warning);
        return false;
      }
      setProgress(result.progress);
      setStorageWarning(null);
      return true;
    },
    [app.progress],
  );

  const handleReset = useCallback(async () => {
    await app.progress.reset();
    setProgress(emptyProgress());
    setStorageWarning(null);
  }, [app.progress]);

  const { bundle, issues } = report;
  const { errors } = countBySeverity(issues);

  if (bundle === null || errors > 0) {
    return (
      <main className="shell">
        <p className="eyebrow">Algorithm Quest</p>
        <h1>El contenido no carga</h1>
        <p className="lede">
          El taller se niega a arrancar con contenido inválido. Estas son las reglas que fallan:
        </p>
        <ul className="issue-list">
          {issues.slice(0, 20).map((issue, index) => (
            <li key={`${issue.code}-${index}`} className={`issue issue--${issue.severity}`}>
              <code>{issue.code}</code> {issue.message}
              {issue.source === undefined ? null : (
                <span className="issue__source"> — {issue.source}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="note">
          Ejecuta <code>npm run validate:content</code> para ver el detalle completo.
        </p>
      </main>
    );
  }

  if (progress === null) {
    return (
      <main className="shell">
        <p className="eyebrow">Algorithm Quest</p>
        <p className="status">Abriendo el taller…</p>
      </main>
    );
  }

  const activeMission =
    activeMissionId === null
      ? null
      : (bundle.missions.find((mission) => mission.id === activeMissionId) ?? null);

  if (activeMission !== null) {
    const stored = app.sessions.load(activeMission.id);
    const snapshot: SessionSnapshot | null =
      stored !== null && stored.phase !== 'complete' ? stored : null;

    return (
      <div className="app">
        <MissionFlow
          mission={activeMission}
          initialSnapshot={snapshot}
          execution={app.execution}
          sessions={app.sessions}
          onCompleted={handleCompleted}
          onExit={() => setActiveMissionId(null)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {app.persistent ? null : (
        <p className="banner" role="status">
          Tu progreso no se guardará en este navegador.
        </p>
      )}
      {storageWarning === null ? null : (
        <p className="banner" role="status">
          {storageWarning}
        </p>
      )}

      {view === 'progress' ? (
        <ProgressDashboard
          bundle={bundle}
          progress={progress}
          onBack={() => setView('map')}
          onDeclineReinforcement={handleDeclineReinforcement}
          onExport={handleExport}
          onImport={handleImport}
          onReset={handleReset}
        />
      ) : (
        <WorkshopMap
          bundle={bundle}
          progress={progress}
          onOpenMission={(missionId) => setActiveMissionId(missionId)}
          onOpenProgress={() => setView('progress')}
        />
      )}
    </div>
  );
}
