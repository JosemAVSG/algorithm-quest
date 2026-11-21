/**
 * "Where do I practise this?": type a concept (or open the list), pick one, get
 * the missions that teach it. Combobox pattern with a listbox popup. Locked
 * missions are listed but cannot be opened, so the list never promises what the
 * map would refuse.
 */

import { useId, useState, type KeyboardEvent } from 'react';

import type { ContentCatalog } from '../../domain/content/catalog';
import { missionStates } from '../../domain/progression/unlock';

interface ConceptFinderProps {
  bundle: ContentCatalog;
  completed: ReadonlySet<string>;
  onOpenMission: (missionId: string) => void;
}

/** Lower-case and strip accents so "condicion" finds "Condición". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function ConceptFinder({ bundle, completed, onOpenMission }: ConceptFinderProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [conceptId, setConceptId] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const states = missionStates(bundle.missions, completed);
  const withMissions = bundle.concepts.filter((concept) =>
    bundle.missions.some(
      (mission) =>
        mission.concepts.primary === concept.id || mission.concepts.secondary.includes(concept.id),
    ),
  );
  const needle = fold(query.trim());
  const options = withMissions.filter((concept) => needle === '' || fold(concept.label).includes(needle));
  const matches = bundle.missions.filter(
    (mission) =>
      conceptId !== '' &&
      (mission.concepts.primary === conceptId || mission.concepts.secondary.includes(conceptId)),
  );

  const choose = (id: string) => {
    const concept = withMissions.find((candidate) => candidate.id === id);
    if (concept === undefined) return;
    setConceptId(concept.id);
    setQuery(concept.label);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((value) => Math.min(value + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((value) => Math.max(value - 1, 0));
    } else if (event.key === 'Enter' && open && options[active] !== undefined) {
      event.preventDefault();
      choose(options[active].id);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <section className="finder" aria-labelledby={`${uid}-title`}>
      <h2 className="finder__title" id={`${uid}-title`}>
        Explorar por concepto
      </h2>
      <label className="finder__label" htmlFor={`${uid}-input`}>
        Buscar misiones por concepto
      </label>
      <div className="finder__combo">
        <input
          id={`${uid}-input`}
          className="finder__input"
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] !== undefined ? `${uid}-opt-${options[active].id}` : undefined}
          placeholder="Escribe o elige un concepto…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setConceptId('');
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <ul className="finder__options" id={listId} role="listbox" aria-label="Conceptos" hidden={!open}>
          {options.length === 0 ? (
            <li className="finder__empty" role="presentation">
              Ningún concepto coincide.
            </li>
          ) : (
            options.map((concept, index) => (
              <li
                key={concept.id}
                id={`${uid}-opt-${concept.id}`}
                role="option"
                aria-selected={index === active}
                className={`finder__option${index === active ? ' finder__option--active' : ''}`}
                // mousedown fires before the input's blur closes the list.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(concept.id);
                }}
              >
                {concept.label}
              </li>
            ))
          )}
        </ul>
      </div>
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
