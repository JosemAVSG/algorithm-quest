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

import type { CSSProperties } from 'react';

import type { ContentCatalog } from '../../domain/content/catalog';
import {
  completedMissionIds,
  type PlayerProgress,
} from '../../domain/persistence/port';
import { nextMission } from '../../domain/progression/unlock';
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
import { WorldGem } from './WorldGem';

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

  return (
    <main className="map">
      <header className="map__header">
        <p className="eyebrow">Taller de los datos</p>
        <h1>
          {openWorld === null ? 'La línea está rota' : openWorld.world.name}
        </h1>
        <p className="lede">
          {openWorld === null
            ? 'Cada sistema averiado es una función que falta. Repara el sensor para empezar.'
            : 'Las misiones de este mundo, en orden. Sigue el camino.'}
        </p>
        <div className="map__actions">
          {openWorld === null ? null : (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onOpenWorldChange(null)}
            >
              ← Volver a los mundos
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onOpenProgress}
          >
            Ver progreso
          </button>
        </div>
      </header>

      <section className="next" aria-label="Siguiente misión">
        {upcoming === null ? (
          <>
            <div className="next__body">
              <p className="next__kicker">Taller reparado</p>
              <h2>No queda nada jugable en este corte</h2>
              <p className="next__note">
                El resto del taller llega en el siguiente hito. Puedes repetir
                una misión ya resuelta.
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
                className="btn btn--primary"
                onClick={() => onOpenMission(upcoming.id)}
              >
                Continuar →
              </button>
              {replayable.length > 0 ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() =>
                    onOpenMission(replayable[replayable.length - 1].id)
                  }
                >
                  Repetir {replayable[replayable.length - 1].id}
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>

      {openWorld === null ? (
        <ol className="path path--worlds" aria-label="Mundos">
          {worlds.map(({ world, state, blockedBy }, index) => {
            const locked = state === 'locked';
            const nextLocked = worlds[index + 1]?.state === 'locked';
            const reason =
              blockedBy === null
                ? 'próximamente'
                : `se abre al terminar ${blockedBy.split(' — ')[0]}`;
            return (
              <li
                key={world.id}
                className={`path__item${state === 'completed' ? ' path__item--done' : ''}${nextLocked ? ' path__item--next-locked' : ''}`}
                style={pathStyle(index)}
              >
                <button
                  type="button"
                  className={`stop stop--${state}`}
                  aria-disabled={locked}
                  aria-label={`${world.name}: ${WORLD_LABEL[state]}${locked ? `, ${reason}` : ''}`}
                  onClick={
                    locked ? undefined : () => onOpenWorldChange(world.id)
                  }
                >
                  <WorldGem
                    worldId={world.id}
                    state={state}
                    glyph={
                      locked ? '▣' : state === 'completed' ? '✓' : index + 1
                    }
                  />
                  <span className="stop__text">
                    <span className="stop__name">{world.name}</span>
                    <span className="stop__state">
                      {locked ? reason : WORLD_LABEL[state]}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <>
          <ol className="path" aria-label="Misiones">
            {missionNodes(openWorld.world, bundle.missions, completed).map(
              ({ id, state, mission }, index, nodes) => {
                const nextState = nodes[index + 1]?.state;
                const nextLocked =
                  nextState === 'locked' || nextState === 'soon';
                const openable = state === 'completed' || state === 'available';
                const title = mission?.title ?? id;
                return (
                  <li
                    key={id}
                    className={`path__item${state === 'completed' ? ' path__item--done' : ''}${nextLocked ? ' path__item--next-locked' : ''}`}
                    style={pathStyle(index)}
                  >
                    <button
                      type="button"
                      className={`stop stop--${state}`}
                      aria-disabled={!openable}
                      aria-label={`${id} ${title}: ${MISSION_LABEL[state]}`}
                      onClick={openable ? () => onOpenMission(id) : undefined}
                    >
                      <span className="stop__dot" aria-hidden="true">
                        {state === 'completed' ? '✓' : openable ? '●' : '▣'}
                      </span>
                      <span className="stop__text">
                        <span className="stop__name">
                          {id} · {title}
                        </span>
                        <span className="stop__state">
                          {MISSION_LABEL[state]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              },
            )}
          </ol>

          {systemsHere.length > 0 ? (
            <section className="map__grid" aria-label="Sistemas del taller">
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
            </section>
          ) : null}
        </>
      )}

      {openWorld === null ? (
        <p className="map__footer">
          {completed.size} de {totalMissions} sistemas del recorrido completo ·
          sin puntos, sin rachas
        </p>
      ) : null}
    </main>
  );
}
