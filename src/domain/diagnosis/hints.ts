/**
 * What the player sees after a failed run.
 *
 * Two separate artifacts, on purpose:
 *
 * - the **diagnosis card** appears automatically and carries the evidence and
 *   exactly one next action. It never contains a hint.
 * - the **hint** is requested, one level at a time, from the mission's authored
 *   ladder. Clicking is the consent that makes escalation honest.
 *
 * Splitting them is what lets the card be specific without being a spoiler, and
 * what keeps `hintsUsed` a real measurement instead of a guess.
 */

import type { Mission } from '../content/schema';
import type { Diagnosis, DiagnosisCode, HintLevel, Modality } from './taxonomy';
import { IMMEDIATE_CODES } from './taxonomy';

/** The ladder is four rungs; level 4 is gated, not hidden (M3). */
export const MAX_HINT_LEVEL: HintLevel = 4;

export interface DiagnosisCard {
  code: DiagnosisCode;
  headline: string;
  /** Mechanical fault for E01/E02/E03; empty for logic errors, where the test diff is the evidence. */
  detail: string;
  nextAction: 'edit';
  /** False when the card already says everything useful. */
  canRequestHint: boolean;
}

const HEADLINES: Record<DiagnosisCode, string> = {
  E01: 'El código no se pudo interpretar.',
  E02: 'El código se detuvo con un error.',
  E03: 'La ejecución no terminó a tiempo.',
  E04: 'Falla cuando la entrada está vacía.',
  E05: 'La comparación falla justo en el límite.',
  E06: 'El recorrido se sale por un extremo.',
  E07: 'La función se detiene antes de tiempo.',
  E08: 'Tu función no devuelve nada en algún caso.',
  E09: 'El acumulador no conserva lo que llevaba.',
  E10: 'El acumulador empieza con un valor que no sirve.',
  E11: 'La función modifica la entrada que recibe.',
  E12: 'El valor devuelto no tiene la forma esperada.',
  E13: 'Pasa las pruebas visibles, pero no las ocultas.',
  E14: 'El código no cambió desde el intento anterior.',
  E15: 'Vuelve a fallar lo mismo que la vez anterior.',
  E16: 'El resultado es correcto, pero el coste se pasa.',
  E17: 'Pasa las pruebas, pero la explicación se queda corta.',
  E18: 'La misma entrada da resultados distintos.',
  E19: 'El código usa algo que esta misión no permite.',
  E20: 'Hay una constante repetida en dos sitios.',
  E21: 'Falta un criterio de desempate.',
  E22: 'Se usa igualdad débil donde el contrato pide estricta.',
  E_UNKNOWN: 'Algo no cuadra, y el mentor no puede afirmar qué es.',
  CLEAR: 'Todo pasa.',
};

/**
 * The authored message for a code, preferring the unconditional rule.
 *
 * Mission authors write two kinds of diagnostic: one tied to a specific failing
 * test (very concrete) and one general fallback. When we only know the code, the
 * general one is the honest choice — reusing the `ed1` message for a different
 * failure would be confidently wrong.
 */
export function messageForCode(mission: Mission, code: DiagnosisCode): string | undefined {
  const unconditional = mission.diagnostics.find(
    (rule) => rule.code === code && rule.when?.failingTestIds === undefined,
  );
  if (unconditional !== undefined) return unconditional.message;
  return mission.diagnostics.find((rule) => rule.code === code)?.message;
}

/**
 * Codes whose evidence message is the explanation.
 *
 * E01/E02/E03 carry the engine's own words, E12 carries the author's (or the
 * cap's) sentence, and the probes carry the only sentence that makes them
 * actionable. Hiding those behind "look at the diff" would be silly: when every
 * test passes, there is no diff to look at.
 */
const EXPLAINED_CODES: readonly DiagnosisCode[] = [
  'E07',
  'E10',
  'E11',
  'E12',
  'E13',
  'E14',
  'E15',
  'E18',
  'E19',
  'E20',
  'E22',
];

export function describeDiagnosis(diagnosis: Diagnosis): DiagnosisCard {
  const immediate = IMMEDIATE_CODES.includes(diagnosis.code) || diagnosis.code === 'E03';

  const detail =
    immediate || EXPLAINED_CODES.includes(diagnosis.code)
      ? (diagnosis.evidence.message ?? '')
      : '';

  return {
    code: diagnosis.code,
    headline: HEADLINES[diagnosis.code],
    detail,
    nextAction: 'edit',
    canRequestHint:
      !immediate && diagnosis.code !== 'CLEAR' && diagnosis.code !== 'E_UNKNOWN',
  };
}

export interface SelectedHint {
  level: HintLevel;
  text: string;
  modality: Modality;
}

export interface HintContext {
  /** Level already shown for the current diagnosis; the ladder's position. */
  hintLevel: number;
  /** Total hints revealed in the session; the level-4 guard's own measure. */
  hintsUsed: number;
  /** Attempts made in this session; drives LOW_ATTEMPT and level-4 eligibility. */
  attempts: number;
}

/**
 * The level the next intervention would use (docs/04 §3–§4, M3).
 *
 * - E01/E02 are immediate and complete: level 2, no ladder (M3).
 * - E03 explains termination at level 1.
 * - E14 (`NO_PROGRESS`) forces level 3, per §3. It is a *floor*, not a ceiling:
 *   a further click can still reach the worked variant.
 * - Everything else climbs one rung per intervention. Attempt 1 is capped at
 *   level 1 (`LOW_ATTEMPT`), which is also what M4 requires: level 2+ needs a
 *   prior level-1 hint.
 */
export function interventionLevel(
  diagnosis: Diagnosis,
  context: HintContext,
): HintLevel | 0 {
  if (diagnosis.code === 'E01' || diagnosis.code === 'E02') return 2;
  if (diagnosis.code === 'E03') return 1;
  if (diagnosis.code === 'CLEAR' || diagnosis.code === 'E_UNKNOWN') return 0;

  const next = Math.min(MAX_HINT_LEVEL, context.hintLevel + 1) as HintLevel;

  if (diagnosis.code === 'E14' || diagnosis.modifiers.includes('NO_PROGRESS')) {
    return Math.max(3, next) as HintLevel;
  }

  // LOW_ATTEMPT caps the *first* intervention at level 1; once the player has
  // seen a level-1 hint, M4 is satisfied and the ladder may climb.
  if (context.attempts === 1 && context.hintLevel === 0) return 1;
  return next;
}

/**
 * Level 4 is reachable only after four attempts and three hints (or whatever
 * the mission declares in `hints[3].unlock`). The guard is the milestone's
 * acceptance criterion: it must hold even when the player clicks again.
 */
function level4Unlocked(mission: Mission, context: HintContext): boolean {
  const unlock = mission.hints[3].unlock;
  const attempts = unlock?.attempts ?? 4;
  const hintsUsed = unlock?.hintsUsed ?? 3;
  return context.attempts >= attempts && context.hintsUsed >= hintsUsed;
}

/**
 * The representation change required when prose has failed (docs/04 §5, M5).
 *
 * `trace` is not in the sequence, and that is deliberate: the current protocol
 * cannot produce `condition`/`accumulator` columns honestly, so a repeated
 * error switches to a smaller input instead of a half-empty table. The
 * deviation is recorded in `docs/14-m3-mentor.md`.
 */
function modalityFor(
  diagnosis: Diagnosis,
  level: HintLevel,
  hintLevel: number,
): Modality {
  if (level === 4) return 'worked_variant';
  const repeated =
    diagnosis.code === 'E14' ||
    diagnosis.code === 'E15' ||
    diagnosis.modifiers.includes('NO_PROGRESS') ||
    diagnosis.modifiers.includes('REPEAT');
  if (repeated) return hintLevel >= 2 ? 'worked_variant' : 'smaller_input';
  return 'prose';
}

/**
 * The next rung of the ladder, or `null` when nothing honest can be offered.
 *
 * The first click yields level 1, each further click moves one step, and the
 * fourth rung is refused until the guard allows it. Escalation is therefore
 * bounded by construction, not by a rule someone has to remember to apply.
 */
export function selectHint(
  mission: Mission,
  diagnosis: Diagnosis,
  context: HintContext,
): SelectedHint | null {
  if (IMMEDIATE_CODES.includes(diagnosis.code)) return null;
  if (diagnosis.code === 'CLEAR' || diagnosis.code === 'E_UNKNOWN') return null;

  const level = interventionLevel(diagnosis, context);
  if (level === 0) return null;
  if (level === 4 && !level4Unlocked(mission, context)) return null;

  const modality = modalityFor(diagnosis, level, context.hintLevel);

  if (level === 2) {
    // Prefer the message the mission authored for *this* failure. Falling back
    // to the code's general message can describe a different bug entirely: an
    // E05 for `>=` and an E05 for a truthiness check are not the same sentence.
    const precise = diagnosis.evidence.message;
    if (precise !== undefined) return { level, text: precise, modality };

    const authored = messageForCode(mission, diagnosis.code);
    if (authored !== undefined) return { level, text: authored, modality };
  }

  return { level, text: mission.hints[level - 1].text, modality };
}

/** Whether the panel should show a hint button at all. */
export function hintAvailable(
  mission: Mission,
  diagnosis: Diagnosis,
  context: HintContext,
): boolean {
  return selectHint(mission, diagnosis, context) !== null;
}
