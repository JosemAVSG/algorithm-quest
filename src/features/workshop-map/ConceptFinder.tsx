/**
 * "Where do I practise this?": pick a concept, get the missions that teach it.
 * Locked missions are listed but cannot be opened, so the list never promises
 * what the map would refuse.
 */

import { useState } from 'react';

import type { ContentCatalog } from '../../domain/content/catalog';
import { missionStates } from '../../domain/progression/unlock';

interface ConceptFinderProps {
  bundle: ContentCatalog;
  completed: ReadonlySet<string>;
  onOpenMission: (missionId: string) => void;
}

export function ConceptFinder({ bundle, completed, onOpenMission }: ConceptFinderProps) {
  const [conceptId, setConceptId] = useState('');
  const states = missionStates(bundle.missions, completed);
  const withMissions = bundle.concepts.filter((concept) =>
    bundle.missions.some(
      (mission) =>
        mission.concepts.primary === concept.id || mission.concepts.secondary.includes(concept.id),
    ),
  );
  const matches = bundle.missions.filter(
    (mission) =>
      conceptId !== '' &&
      (mission.concepts.primary === conceptId || mission.concepts.secondary.includes(conceptId)),
  );

  return (
    <section className="finder" aria-label="Buscar por concepto">
      <label className="finder__label" htmlFor="finder-concept">
        Buscar misiones por concepto
      </label>
      <select
        id="finder-concept"
        className="finder__select"
        value={conceptId}
        onChange={(event) => setConceptId(event.target.value)}
      >
        <option value="">Elige un concepto…</option>
        {withMissions.map((concept) => (
          <option key={concept.id} value={concept.id}>
            {concept.label}
          </option>
        ))}
      </select>
      {matches.length === 0 ? null : (
        <ul className="finder__list">
          {matches.map((mission) => {
            const state = states.get(mission.id);
            const openable = state === 'completed' || state === 'available';
            return (
              <li key={mission.id}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  aria-disabled={!openable}
                  onClick={openable ? () => onOpenMission(mission.id) : undefined}
                >
                  {mission.id} · {mission.title}
                  {completed.has(mission.id) ? ' (completada)' : openable ? '' : ' (bloqueada)'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
