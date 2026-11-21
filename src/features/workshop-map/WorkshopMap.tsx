/**
 * S1 — Workshop map (docs/06-ux-flows.md §3).
 *
 * Two levels: a zigzag path of worlds, and inside a world a zigzag path of its
 * missions. World 1 also shows the workshop *systems* below its path, because the
 * workshop is what the player is repairing. Mission JSON points at a system and a
 * legal transition; this screen applies the completed ones. No scores, no stars,
 * no counters on nodes. The engine-chosen next mission stays the one primary
 * action on both levels.
 *
 * Red appears here and only here: it means "this system is broken", never "you
 * were wrong".
 */

import { useEffect, useState, type CSSProperties } from 'react';

import type { ContentCatalog } from '../../domain/content/catalog';
import {
  completedMissionIds,
  type PlayerProgress,
} from '../../domain/persistence/port';
import { missionStates, nextMission } from '../../domain/progression/unlock';
import {
  inPlayOrder,
  systemStates,
  worldSystems,
} from '../../domain/progression/workshop';
import {
  missionNodes,
  worldNodes,
  type MissionNodeState,
  type WorldState,
} from '../../domain/progression/worlds';
import { STATE_LABEL } from './stateLabels';
import { ConceptFinder } from './ConceptFinder';
import { LockIcon } from './LockIcon';
import { SettingsMenu } from './SettingsMenu';
import { newlyUnlocked, nextSeen, readSeen, writeSeen } from './unlockDiff';
import { WelcomeGuide } from './WelcomeGuide';
import { WorldGem } from './WorldGem';
import { worldAccent, worldAccentStyle } from './worldAccent';

const WORLD_LABEL: Record<WorldState, string> = {
  completed: 'completado',
  current: 'en curso',
  locked: 'bloqueado',
};

const MISSION_LABEL: Record<MissionNodeState, string> = {
  completed: 'completada',
  available: 'disponible',
  locked: 'bloqueada',
  soon: 'próximamente',
};

/** Zigzag column per position: centre, right, centre, left. */
const ZIGZAG = [0, 1, 0, -1];

/** Columns of a node and of the next one, so CSS can draw the connector between them. */
function pathStyle(index: number): CSSProperties {
  const col = ZIGZAG[index % ZIGZAG.length];
  const next = ZIGZAG[(index + 1) % ZIGZAG.length];
  return { '--col': col, '--dcol': next - col } as CSSProperties;
}

interface WorkshopMapProps {
  bundle: ContentCatalog;
  progress: PlayerProgress;
  /** The open world lives in the parent so it survives leaving a mission. */
  openWorldId: string | null;
  onOpenWorldChange: (worldId: string | null) => void;
  onOpenMission: (missionId: string) => void;
  onOpenProgress: () => void;
}

export function WorkshopMap({
  bundle,
  progress,
  openWorldId,
  onOpenWorldChange,
  onOpenMission,
  onOpenProgress,
}: WorkshopMapProps) {
  const completed = completedMissionIds(progress);
  const upcoming = nextMission(bundle.missions, completed);
  const totalMissions = bundle.worlds.flatMap(
    (world) => world.missionIds,
  ).length;

  const ordered = inPlayOrder(bundle.missions, bundle.worlds);
  const bySystem = systemStates(
    bundle.systems,
    bundle.missions,
    bundle.worlds,
    completed,
  );

  const replayable = ordered.filter((mission) => completed.has(mission.id));
  const worlds = worldNodes(bundle.worlds, completed);
  const openWorld =
    worlds.find((node) => node.world.id === openWorldId) ?? null;
  const systemsHere =
    openWorld === null
      ? []
      : worldSystems(
          openWorld.world.id,
          bundle.systems,
          bundle.missions,
          bundle.worlds,
        );

  // Unlock animation: ids the map had not shown before this visit. Display-only;
  // progression decides what is unlocked, this just remembers what was already seen.
  const mStates = missionStates(bundle.missions, completed);
  const unlockedMissionIds = [...mStates]
    .filter(([, state]) => state !== 'locked')
    .map(([id]) => id);
  const unlockedWorldIds = worlds
    .filter((node) => node.state !== 'locked')
    .map((node) => `world:${node.world.id}`);
  const everything = [...unlockedMissionIds, ...unlockedWorldIds];
  const visibleIds =
    openWorld === null
      ? unlockedWorldIds
      : unlockedMissionIds.filter((id) => openWorld.world.missionIds.includes(id));
  const [seenBefore] = useState(readSeen);
  const [levelAtMount] = useState(openWorldId);
  // Only the level the player lands on animates; reopening it later does not replay.
  const [settled, setSettled] = useState(false);
  if (!settled && openWorldId !== levelAtMount) setSettled(true);
  const fresh = new Set(settled ? [] : newlyUnlocked(seenBefore, visibleIds));
  const visibleKey = visibleIds.join(',');
  const everythingKey = everything.join(',');
  useEffect(() => {
    writeSeen(nextSeen(seenBefore, visibleIds, everything));
  }, [visibleKey, everythingKey, seenBefore]);

  const done = completed.size;
  const percentDone = totalMissions === 0 ? 0 : Math.round((done / totalMissions) * 100);
  const accent = openWorld === null ? null : openWorld.world.id;

  return (
    <main className="map">
      <header className="map__header">
        <nav className="map__nav" aria-label="Navegación del taller">
          {openWorld === null ? null : (
            <button
              type="button"
              className="btn btn--ghost map__back"
              onClick={() => onOpenWorldChange(null)}
            >
              ← Volver a los mundos
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onOpenProgress}>
            Ver progreso
          </button>
          <SettingsMenu />
        </nav>
        <p className="eyebrow">Taller de los datos</p>
        <h1>{openWorld === null ? 'La línea está rota' : openWorld.world.name}</h1>
        <p className="lede">
          {openWorld === null
            ? 'Cada sistema averiado es una función que falta. Repara el sensor para empezar.'
            : 'Las misiones de este mundo, en orden. Sigue el camino.'}
        </p>
        <div className="progress">
          <p className="progress__label" id="map-progress-label">
            {done} de {totalMissions} sistemas reparados
          </p>
          <div
            className="progress__track"
            role="progressbar"
            aria-labelledby="map-progress-label"
            aria-valuemin={0}
            aria-valuemax={totalMissions}
            aria-valuenow={done}
          >
            <span className="progress__fill" style={{ width: `${percentDone}%` }} />
          </div>
        </div>
      </header>

      <div className="map__layout">
        <div className="map__aside">
          {openWorld === null && completed.size === 0 ? <WelcomeGuide /> : null}

          {openWorld === null && progress.reinforcement.length > 0 ? (
            <section className="review-notice" aria-label="Repaso disponible">
              <p>
                {progress.reinforcement.length === 1
                  ? '1 concepto listo para repasar.'
                  : `${progress.reinforcement.length} conceptos listos para repasar.`}{' '}
                Es opcional y no afecta a tu avance.
              </p>
              <button type="button" className="btn btn--ghost" onClick={onOpenProgress}>
                Ver repaso
              </button>
            </section>
          ) : null}

          <section className="next" aria-label="Siguiente misión">
            {upcoming === null ? (
              <>
                <div className="next__body">
                  <p className="next__kicker">Taller reparado</p>
                  <h2>No queda nada jugable en este corte</h2>
                  <p className="next__note">
                    El resto del taller llega en el siguiente hito. Puedes repetir una misión ya
                    resuelta.
                  </p>
                </div>
                {replayable.length > 0 ? (
                  <div className="next__actions">
                    {replayable.map((mission) => (
                      <button
                        key={mission.id}
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => onOpenMission(mission.id)}
                      >
                        Repetir {mission.id}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="next__body">
                  <p className="next__kicker">
                    {upcoming.id} · {upcoming.subtitle}
                  </p>
                  <h2>{upcoming.title}</h2>
                  <p className="next__note">{upcoming.reward.narrative}</p>
                </div>
                <div className="next__actions">
                  <button
                    type="button"
                    className="btn btn--primary btn--large"
                    onClick={() => onOpenMission(upcoming.id)}
                  >
                    Continuar →
                  </button>
                  {replayable.length > 0 ? (
                    <button
                      type="button"
                      className="btn btn--link"
                      onClick={() => onOpenMission(replayable[replayable.length - 1].id)}
                    >
                      Repetir {replayable[replayable.length - 1].id}
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </section>

          {openWorld === null ? (
            <ConceptFinder bundle={bundle} completed={completed} onOpenMission={onOpenMission} />
          ) : null}
        </div>

        <div className="map__body">
          {openWorld === null ? (
            <ol className="path path--worlds" aria-label="Mundos">
              {worlds.map(({ world, state, blockedBy }, index) => {
                const locked = state === 'locked';
                const doneHere = world.missionIds.filter((id) => completed.has(id)).length;
                const percent =
                  world.missionIds.length === 0
                    ? 0
                    : Math.round((doneHere / world.missionIds.length) * 100);
                const nextLocked = worlds[index + 1]?.state === 'locked';
                const nextFresh = fresh.has(`world:${worlds[index + 1]?.world.id}`);
                const isFresh = fresh.has(`world:${world.id}`);
                const reason =
                  blockedBy === null
                    ? 'próximamente'
                    : `se abre al terminar ${blockedBy.split(' — ')[0]}`;
                return (
                  <li
                    key={world.id}
                    className={`path__item${state === 'completed' ? ' path__item--done' : ''}${nextLocked ? ' path__item--next-locked' : ''}${nextFresh ? ' path__item--lit' : ''}`}
                    style={{ ...pathStyle(index), ...worldAccentStyle(world.id) }}
                  >
                    <button
                      type="button"
                      className={`stop stop--${state}${isFresh ? ' stop--unlocking' : ''}`}
                      aria-disabled={locked}
                      aria-label={`${world.name}: ${WORLD_LABEL[state]}${locked ? `, ${reason}` : `, ${doneHere} de ${world.missionIds.length} misiones`}`}
                      title={locked ? reason : undefined}
                      onClick={locked ? undefined : () => onOpenWorldChange(world.id)}
                    >
                      <WorldGem
                        worldId={world.id}
                        state={state}
                        accent={worldAccent(world.id)}
                        glyph={locked ? null : state === 'completed' ? '✓' : index + 1}
                        badge={locked ? <LockIcon /> : undefined}
                      />
                      <span className="stop__text">
                        <span className="stop__name">{world.name}</span>
                        <span className="stop__state">{locked ? reason : WORLD_LABEL[state]}</span>
                        {locked ? null : (
                          <span
                            className="stop__bar"
                            aria-hidden="true"
                            style={{ '--percent': `${percent}%` } as CSSProperties}
                          />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <>
              <ol
                className="path path--world"
                aria-label="Misiones"
                data-world={accent}
                style={worldAccentStyle(openWorld.world.id)}
              >
                {missionNodes(openWorld.world, bundle.missions, completed).map(
                  ({ id, state, mission }, index, nodes) => {
                    const nextNode = nodes[index + 1];
                    const nextLocked = nextNode?.state === 'locked' || nextNode?.state === 'soon';
                    const nextFresh = nextNode !== undefined && fresh.has(nextNode.id);
                    const openable = state === 'completed' || state === 'available';
                    const title = mission?.title ?? id;
                    return (
                      <li
                        key={id}
                        className={`path__item${state === 'completed' ? ' path__item--done' : ''}${nextLocked ? ' path__item--next-locked' : ''}${nextFresh ? ' path__item--lit' : ''}`}
                        style={pathStyle(index)}
                      >
                        <button
                          type="button"
                          className={`stop stop--${state}${fresh.has(id) ? ' stop--unlocking' : ''}`}
                          aria-disabled={!openable}
                          aria-label={`${id} ${title}: ${MISSION_LABEL[state]}`}
                          onClick={openable ? () => onOpenMission(id) : undefined}
                        >
                          <span className="stop__dot" aria-hidden="true">
                            {state === 'completed' ? '✓' : openable ? '●' : <LockIcon />}
                          </span>
                          <span className="stop__text">
                            <span className="stop__name">
                              {id} · {title}
                            </span>
                            <span className="stop__state">{MISSION_LABEL[state]}</span>
                          </span>
                        </button>
                      </li>
                    );
                  },
                )}
              </ol>

              {systemsHere.length > 0 ? (
                <section className="systems" aria-labelledby="systems-title">
                  <h2 className="systems__title" id="systems-title">
                    Sistemas del taller
                  </h2>
                  <p className="systems__intro">
                    Son las máquinas que vas reparando. Cada una cambia de estado a medida que
                    completas misiones.
                  </p>
                  <div className="map__grid">
                    {systemsHere.map((system) => {
                      const state = bySystem.get(system.id) ?? system.initialState;
                      return (
                        <article
                          key={system.id}
                          className={`node node--${state}`}
                          aria-label={`${system.name}: ${STATE_LABEL[state]}`}
                        >
                          <span className="node__dot" aria-hidden="true" />
                          <span className="node__name">{system.name}</span>
                          <span className="node__state">{STATE_LABEL[state]}</span>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>

      <p className="map__footer">Sin puntos, sin rachas: solo el taller que vas reparando.</p>
    </main>
  );
}
