/**
 * S7 — Mastery dashboard, plus the S8 data controls (docs/06-ux-flows.md §8–9).
 *
 * No aggregate score. The header counts concepts with evidence, not a
 * percentage: a single number would become the thing players optimize, and the
 * whole model exists to say that levels are not a progress bar.
 *
 * Export/import/reset live here rather than on a separate settings route. The
 * app has no router, and one more screen for three buttons would cost more than
 * it explains.
 */

import { useMemo, useState } from 'react';

import type { ContentCatalog } from '../../domain/content/catalog';
import {
  buildMasteryDashboard,
  type ConceptMasteryView,
} from '../../domain/mastery/dashboard';
import type { ConceptLevel, Dimensions } from '../../domain/mastery/score';
import type { PlayerProgress } from '../../domain/persistence/port';

const LEVEL_LABEL: Record<ConceptLevel, string> = {
  locked: 'sin evidencia',
  introduced: 'introducido',
  practicing: 'practicando',
  proficient: 'competente',
  transferable: 'transferible',
};

const LEVEL_ORDER: readonly ConceptLevel[] = [
  'locked',
  'introduced',
  'practicing',
  'proficient',
  'transferable',
];

const DIMENSIONS: ReadonlyArray<readonly [keyof Dimensions, string]> = [
  ['correctness', 'corrección'],
  ['robustness', 'robustez'],
  ['reasoning', 'razonamiento'],
  ['efficiency', 'eficiencia'],
];

interface ProgressDashboardProps {
  bundle: ContentCatalog;
  progress: PlayerProgress;
  onBack: () => void;
  onDeclineReinforcement: (conceptId: string) => void;
  onExport: () => Promise<string>;
  onImport: (blob: string) => Promise<boolean>;
  onReset: () => Promise<void>;
}

function ConceptCard({ view }: { view: ConceptMasteryView }) {
  const index = LEVEL_ORDER.indexOf(view.level);
  const dots = `${'●'.repeat(index)}${'○'.repeat(4 - index)}`;

  return (
    <article
      className={`concept concept--${view.level}`}
      aria-label={`${view.label}: ${LEVEL_LABEL[view.level]}`}
    >
      <header className="concept__head">
        <div>
          <code className="concept__id">{view.conceptId}</code>
          <h2>{view.label}</h2>
        </div>
        <span className="concept__level">
          <span className="concept__dots" aria-hidden="true">
            {dots}
          </span>
          {LEVEL_LABEL[view.level]}
        </span>
      </header>

      {view.dimensions === null ? null : (
        <>
          <p className="concept__mastery">{view.mastery?.toFixed(2)}</p>
          <ul className="bars" aria-label="Dimensiones">
            {DIMENSIONS.map(([key, label]) => {
              const value = view.dimensions?.[key] ?? 0;
              return (
                <li key={key} className="bar-row">
                  <span className="bar-row__label">{label}</span>
                  <span className="bar-row__track" aria-hidden="true">
                    <span
                      className="bar-row__fill"
                      style={{ width: `${Math.round(value * 100)}%` }}
                    />
                  </span>
                  <code className="bar-row__value">{value.toFixed(2)}</code>
                </li>
              );
            })}
          </ul>
          <p className="concept__evidence">
            Evidencia: {view.evidenceMissions}{' '}
            {view.evidenceMissions === 1 ? 'misión' : 'misiones'} · {view.independentCount} sin
            ayuda
          </p>
        </>
      )}

      <p className="concept__note">{view.note}</p>
    </article>
  );
}

export function ProgressDashboard({
  bundle,
  progress,
  onBack,
  onDeclineReinforcement,
  onExport,
  onImport,
  onReset,
}: ProgressDashboardProps) {
  const dashboard = useMemo(
    () =>
      buildMasteryDashboard({
        concepts: bundle.concepts,
        events: progress.events,
        pendingReinforcement: progress.reinforcement,
      }),
    [bundle.concepts, progress.events, progress.reinforcement],
  );

  const [exported, setExported] = useState('');
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const withEvidence = dashboard.concepts.filter(
    (concept) => concept.totalEvidence > 0,
  ).length;

  async function handleExport() {
    const blob = await onExport();
    setExported(blob);
    setMessage('Progreso exportado. Cópialo antes de borrar los datos.');
  }

  async function handleImport() {
    if (importText.trim() === '') return;
    const ok = await onImport(importText);
    setMessage(ok ? 'Progreso importado.' : 'No se pudo importar: el texto no es un progreso válido.');
    if (ok) {
      setExported('');
      setImportText('');
    }
  }

  async function handleReset() {
    if (!window.confirm('¿Borrar todo el progreso guardado? Esta acción no se puede deshacer.')) {
      return;
    }
    await onReset();
    setExported('');
    setImportText('');
    setMessage('Progreso borrado. Empiezas de cero.');
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <button type="button" className="btn btn--link" onClick={onBack}>
          ← Volver al taller
        </button>
        <p className="eyebrow">Progreso</p>
        <h1>Lo que sabes hacer</h1>
        <p className="lede">
          Cada nivel sale de tus últimas cinco evidencias, no del tiempo ni de los puntos. Los
          límites están explicados en cada concepto.
        </p>
        <p className="dashboard__count">
          {bundle.concepts.filter((concept) => concept.mvp).length} conceptos · {withEvidence} con
          evidencia
        </p>
      </header>

      {dashboard.pendingReinforcement.length === 0 ? null : (
        <section className="reinforcement" aria-label="Refuerzo pendiente">
          <p className="reinforcement__kicker">Refuerzo pendiente</p>
          <p className="reinforcement__note">
            Las variantes cortas de refuerzo todavía no están disponibles. Puedes seguir jugando;
            esto no bloquea nada.
          </p>
          <ul className="reinforcement__list">
            {dashboard.pendingReinforcement.map((item) => {
              const concept = bundle.concepts.find(
                (candidate) => candidate.id === item.conceptId,
              );
              return (
                <li key={item.conceptId} className="reinforcement__row">
                  <span>
                    <strong>{concept?.label ?? item.conceptId}</strong> · {item.missionId} ·{' '}
                    {item.reason === 'revealed' ? 'solución revelada' : 'con ayuda'}
                  </span>
                  <button
                    type="button"
                    className="btn btn--link"
                    onClick={() => onDeclineReinforcement(item.conceptId)}
                  >
                    Ahora no
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="concept-list" aria-label="Conceptos">
        {dashboard.concepts.map((concept) => (
          <ConceptCard key={concept.conceptId} view={concept} />
        ))}
      </section>

      <section className="data" aria-label="Tus datos">
        <h2>Tus datos</h2>
        <p className="note">
          El progreso vive solo en este navegador. Exporta un JSON si quieres guardarlo o moverlo
          a otro equipo; importar reemplaza lo que haya ahora.
        </p>

        <div className="actions">
          <button type="button" className="btn" onClick={() => void handleExport()}>
            Exportar progreso
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => void handleReset()}>
            Borrar progreso
          </button>
        </div>

        {exported === '' ? null : (
          <div className="field">
            <label className="field__label" htmlFor="exported-progress">
              Progreso exportado
            </label>
            <textarea
              id="exported-progress"
              className="field__area dashboard__textarea"
              readOnly
              rows={8}
              value={exported}
            />
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="import-progress">
            Importar progreso
          </label>
          <textarea
            id="import-progress"
            className="field__area dashboard__textarea"
            rows={6}
            placeholder="Pega aquí el JSON exportado"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
          />
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={importText.trim() === ''}
            onClick={() => void handleImport()}
          >
            Importar
          </button>
        </div>

        {message === null ? null : (
          <p className="note" role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
