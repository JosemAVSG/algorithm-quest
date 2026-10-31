/**
 * Composition and routing.
 *
 * No router dependency: the app has three views (workshop, mission, progress)
 * and one linear flow. Search params would add URLs the MVP never shares, and a
 * router would be another concept to learn for a screen graph this small
 * (docs/07-architecture.md §8).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { loadBrowserCatalog } from '../adapters/content/browser';
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
import { MissionGate } from '../features/mission/MissionGate';
import { ProgressDashboard } from '../features/progress/ProgressDashboard';
import { WorkshopMap } from '../features/workshop-map/WorkshopMap';
import { createComposition } from './composition';

type View = 'map' | 'progress';

export function App() {
  const report = useMemo(() => loadBrowserCatalog(), []);
  const app = useMemo(() => createComposition(), []);

  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [view, setView] = useState<View>('map');
  const [openWorldId, setOpenWorldId] = useState<string | null>(null);

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

  const { catalog: bundle, issues } = report;
  const { errors } = countBySeverity(issues);

  if (bundle === null || errors > 0) {
    return (
      <main className="shell">
        <p className="eyebrow">Algorithm Quest</p>
        <h1>El contenido no carga</h1>
        <p className="lede">
          El taller se niega a arrancar con contenido inválido. Estas son las
          reglas que fallan:
        </p>
        <ul className="issue-list">
          {issues.slice(0, 20).map((issue, index) => (
            <li
              key={`${issue.code}-${index}`}
              className={`issue issue--${issue.severity}`}
            >
              <code>{issue.code}</code> {issue.message}
              {issue.source === undefined ? null : (
                <span className="issue__source"> — {issue.source}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="note">
          Ejecuta <code>npm run validate:content</code> para ver el detalle
          completo.
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

  if (activeMissionId !== null) {
    return (
      <div className="app">
        <MissionGate
          loader={app.missions}
          missionId={activeMissionId}
          onExit={() => setActiveMissionId(null)}
        >
          {(mission) => {
            const stored = app.sessions.load(mission.id);
            const snapshot: SessionSnapshot | null =
              stored !== null && stored.phase !== 'complete' ? stored : null;
            return (
              <MissionFlow
                mission={mission}
                initialSnapshot={snapshot}
                execution={app.execution}
                sessions={app.sessions}
                onCompleted={handleCompleted}
                onExit={() => setActiveMissionId(null)}
              />
            );
          }}
        </MissionGate>
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
          openWorldId={openWorldId}
          onOpenWorldChange={setOpenWorldId}
          onOpenMission={(missionId) => {
            // Leaving the mission lands back in the world it belongs to.
            const mission = bundle.missions.find(
              (candidate) => candidate.id === missionId,
            );
            if (mission !== undefined) setOpenWorldId(mission.world);
            setActiveMissionId(missionId);
          }}
          onOpenProgress={() => setView('progress')}
        />
      )}
    </div>
  );
}
