/**
 * A reinforcement variant (docs/05-mastery.md §8): a short exercise on a concept
 * that is still weak. It is offered, never forced, and leaving costs nothing.
 *
 * It is deliberately smaller than a mission: no briefing, no strategy step, no
 * debrief, no mentor ladder. The player reads a few lines, writes a function and
 * runs it against the same test engine. One hint is available; using it is
 * recorded, like any assistance, in the evidence.
 */

import { useCallback, useState } from 'react';

import { executionCases } from '../../domain/evaluation/cases';
import { buildTestReport, type TestReport } from '../../domain/evaluation/test-engine';
import { usesConstruct } from '../../domain/diagnosis/source-scan';
import type { ReinforcementVariant } from '../../domain/content/schema';
import type { ExecutionOutcome, ExecutionPort } from '../../domain/execution/port';
import type { EvidenceEvent } from '../../domain/mastery/evidence';
import { buildVariantEvidence, variantTests } from '../../domain/mastery/variants';
import { Editor } from '../lab/Editor';
import { TestPanel } from '../lab/TestPanel';

interface ReinforcementPracticeProps {
  variant: ReinforcementVariant;
  conceptLabel: string;
  execution: ExecutionPort;
  onDone: (evidence: EvidenceEvent[]) => void;
  onExit: () => void;
}

interface Result {
  report: TestReport;
  /** Why a run that passed its tests still does not count, when it does not. */
  blocker: string | null;
  note: string | null;
}

function describeBlocker(outcome: ExecutionOutcome, source: string, variant: ReinforcementVariant): Result['note'] {
  switch (outcome.kind) {
    case 'syntax_error':
      return `El código no se pudo interpretar: ${outcome.message}`;
    case 'missing_entry_point':
      return `No encuentro una función llamada «${outcome.entryPoint}».`;
    case 'timeout':
      return 'La ejecución no terminó a tiempo. Revisa que el bucle llega a terminar.';
    case 'output_too_large':
      return 'Tu función devolvió demasiada información para un solo caso.';
    case 'internal_error':
      return 'El taller falló al ejecutar tu código. No es tu culpa: vuelve a ejecutar.';
    case 'completed': {
      const banned = variant.constraints.bannedConstructs.find((construct) =>
        usesConstruct(source, construct),
      );
      if (banned !== undefined) return `Este ejercicio no permite usar \`${banned}\`.`;
      if (outcome.mutatedInput === true) return 'Tu función modificó los datos que recibió.';
      if (outcome.deterministic === false) return 'La misma entrada dio resultados distintos.';
      return null;
    }
  }
}

export function ReinforcementPractice({
  variant,
  conceptLabel,
  execution,
  onDone,
  onExit,
}: ReinforcementPracticeProps) {
  const [source, setSource] = useState(variant.starterCode);
  const [running, setRunning] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    const tests = variantTests(variant);
    const outcome = await execution.execute({
      code: source,
      entryPoint: variant.contract.entryPoint,
      cases: executionCases({ tests }),
      timeoutMs: 2_000,
      probes: { mutation: variant.constraints.mustNotMutate, determinism: true, rotation: false },
    });
    const report = buildTestReport({ tests }, outcome);
    const note = describeBlocker(outcome, source, variant);
    setResult({ report, blocker: report.allPassed ? note : null, note });
    setAttempts((count) => count + 1);
    setRunning(false);
  }, [execution, running, source, variant]);

  const solved = result !== null && result.report.allPassed && result.blocker === null;

  return (
    <div className="mission reinforce">
      <div className="lab">
        <header className="lab__bar">
          <div>
            <p className="eyebrow">Refuerzo · {conceptLabel}</p>
            <h1>{variant.title}</h1>
          </div>
          <div className="lab__meta">
            <button type="button" className="btn btn--ghost" onClick={onExit}>
              ← Volver
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                void run();
              }}
              disabled={running}
            >
              {running ? 'Ejecutando…' : 'Ejecutar'}
            </button>
          </div>
        </header>

        <p className="lab__contract">
          <code>{variant.contract.signature}</code>
        </p>

        <div className="lab__grid">
          <div className="lab__left">
            <section className="reinforce__prompt" aria-label="Enunciado">
              <p>{variant.prompt}</p>
              <ul>
                {variant.contract.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>
            <section className="lab__code" aria-label="Editor de código">
              <div className="code__head">
                <span>{variant.contract.entryPoint}</span>
                <span className="code__hint">Cmd/Ctrl + Enter</span>
              </div>
              <Editor
                value={source}
                onChange={setSource}
                onRun={() => {
                  void run();
                }}
                disabled={running}
              />
            </section>
          </div>

          <aside className="lab__panel" aria-live="polite">
            <TestPanel report={result?.report ?? null} running={running} />

            <section className="mentor" aria-label="Ayuda">
              <h2>Ayuda</h2>
              {result?.note ? <p className="mentor__detail">{result.note}</p> : null}
              {solved ? (
                <>
                  <p className="mentor__headline">Resuelto.</p>
                  <p className="mentor__detail">
                    Esto cuenta como refuerzo de {conceptLabel}. No cambia el mapa ni bloquea nada.
                  </p>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() =>
                      onDone([
                        buildVariantEvidence(variant, result.report, {
                          at: Date.now(),
                          attempts,
                          hintsUsed: hintShown ? 1 : 0,
                        }),
                      ])
                    }
                  >
                    Guardar y volver →
                  </button>
                </>
              ) : (
                <>
                  {result === null ? (
                    <p className="mentor__idle">Ejecuta para ver las pruebas.</p>
                  ) : null}
                  {hintShown ? (
                    <div className="hint">
                      <p className="hint__level">Pista</p>
                      <p className="hint__text">{variant.hint}</p>
                    </div>
                  ) : (
                    <button type="button" className="btn btn--ghost" onClick={() => setHintShown(true)}>
                      Ver pista
                    </button>
                  )}
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
