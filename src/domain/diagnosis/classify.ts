/**
 * The classifier: one attempt in, one diagnosis out.
 *
 * This is the fixed evaluation order of docs/04-mentor.md §3, with the
 * extensions that order needs to remain truthful. The order is the contract, and
 * every deliberate deviation is documented at its call site, because silently
 * reordering a rule engine is how a mentor starts lying:
 *
 * 1. E08 (`undefined`) is checked before E12 (shape) — a missing `return` is not
 *    a type error.
 * 2. E19 (constraint) is checked before the all-passing branch: a mission that
 *    bans `.some` is not solved by using `.some`, even when every test passes.
 * 3. E07 is checked before CLEAR rather than at 8a, because a rotation probe can
 *    invalidate a run in which every authored test passed.
 * 4. E22 is only diagnosed when a failing case actually mixes types. A stray
 *    `==` in a helper is not evidence about an unrelated boundary bug.
 * 5. E20 is a last-resort warning before `E_UNKNOWN`, never an override of a
 *    more specific diagnosis.
 *
 * Harness faults never reach this function: `evaluateRun` returns no diagnosis
 * for them (docs/04 §8).
 *
 * Everything here is a pure function of one attempt. History-dependent
 * modifiers are applied separately, so a single attempt can always be replayed
 * and produce the same diagnosis.
 */

import type { Mission } from '../content/schema';
import type { ExecutionOutcome } from '../execution/port';
import type { TestReport, TestResult } from '../evaluation/test-engine';
import {
  duplicatedLiteral,
  hasIteration,
  usesConstruct,
  usesLooseEquality,
} from './source-scan';
import {
  IMMEDIATE_CODES,
  type Diagnosis,
  type DiagnosisCode,
  type ErrorCode,
  type Modifier,
} from './taxonomy';

export interface ClassifyInput {
  mission: Mission;
  outcome: ExecutionOutcome;
  report: TestReport;
  /** The player's source, for the static checks (E13/E19/E20/E22). */
  source: string;
}

function sameShape(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) return Array.isArray(actual);
  if (Array.isArray(actual)) return false;
  if (expected === null) return actual === null;
  if (actual === null) return false;
  return typeof actual === typeof expected;
}

/**
 * True when a returned value is NaN, or holds a NaN / `undefined` field at any
 * depth. A bare top-level `undefined` is E08 and handled before this check.
 */
function hasBrokenNumber(value: unknown, nested = false): boolean {
  if (typeof value === 'number') return Number.isNaN(value);
  if (value === undefined) return nested;
  if (Array.isArray(value)) return value.some((item) => hasBrokenNumber(item, true));
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some((item) => hasBrokenNumber(item, true));
  }
  return false;
}

/**
 * The authored sentence for a code, preferring the unconditional rule. A rule
 * tied to one failing test is evidence about that test, not a general statement
 * about the code.
 */
function authoredMessage(mission: Mission, code: ErrorCode): string | undefined {
  const unconditional = mission.diagnostics.find(
    (rule) => rule.code === code && rule.when?.failingTestIds === undefined,
  );
  return (
    unconditional?.message ?? mission.diagnostics.find((rule) => rule.code === code)?.message
  );
}

/**
 * The authored diagnostic whose `when.failingTestIds` is satisfied by the
 * current failures. Most specific rule wins: a rule naming two failing cases
 * beats a rule naming one.
 *
 * Two conditions, and the second one matters:
 *
 * 1. every named test is failing, and
 * 2. no *unnamed visible* test is failing.
 *
 * Without (2), a mission rule that names the boundary case would match a
 * solution that returns the wrong type and fails every visible test, and the
 * player would be told they have an off-by-one when they actually returned a
 * string. A conditional rule is evidence about a refinement, not a catch-all.
 * The unconditional rule is the catch-all, and it is consulted after the
 * deterministic shape check.
 */
function matchConditionalAuthored(
  mission: Mission,
  report: TestReport,
): { code: string; message: string } | undefined {
  const failing = new Set(report.failingIds);

  const conditional = mission.diagnostics
    // E01/E02/E03 are engine facts, not authored refinements. Their rules exist
    // so the mentor card has the author's words, but treating them as a
    // catch-all would label any unexplained failure "syntax error" whenever a
    // mission happens to list them first.
    .filter((rule) => !IMMEDIATE_CODES.includes(rule.code as DiagnosisCode) && rule.code !== 'E03')
    .filter((rule) => rule.when?.failingTestIds !== undefined)
    .filter((rule) => rule.when!.failingTestIds!.every((id) => failing.has(id)))
    .filter(
      (rule) =>
        !report.results.some(
          (result) =>
            result.group === 'visible' &&
            result.status !== 'pass' &&
            result.status !== 'not_run' &&
            !rule.when!.failingTestIds!.includes(result.testId),
        ),
    )
    .sort((a, b) => b.when!.failingTestIds!.length - a.when!.failingTestIds!.length);

  const best = conditional[0];
  return best === undefined ? undefined : { code: best.code, message: best.message };
}

function matchUnconditionalAuthored(
  mission: Mission,
): { code: string; message: string } | undefined {
  const unconditional = mission.diagnostics.find(
    (rule) =>
      rule.when?.failingTestIds === undefined &&
      !IMMEDIATE_CODES.includes(rule.code as DiagnosisCode) &&
      rule.code !== 'E03',
  );
  return unconditional === undefined
    ? undefined
    : { code: unconditional.code, message: unconditional.message };
}

const COST_FALLBACK =
  'Tu solución hace más trabajo del necesario para este tamaño de entrada. Piensa qué se repite en cada vuelta y si puedes recordarlo en lugar de volver a calcularlo.';

function evidenceFor(report: TestReport, extra: Partial<Diagnosis['evidence']> = {}) {
  const firstFailing = report.results.find(
    (result) => result.status !== 'pass' && result.status !== 'not_run',
  );
  return {
    failingTestIds: report.failingIds,
    ...(firstFailing === undefined
      ? {}
      : {
          actual: firstFailing.actual,
          expected: firstFailing.expected,
          input: firstFailing.input,
          ...(firstFailing.line === undefined ? {} : { line: firstFailing.line }),
        }),
    ...extra,
  };
}

/** True when a case contains at least two of string/number/boolean values. */
function mixesPrimitiveTypes(input: unknown[]): boolean {
  const kinds = new Set<string>();

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      kinds.add(typeof value);
    }
  };

  walk(input);
  return kinds.size >= 2;
}

export function classify(input: ClassifyInput): Diagnosis {
  const { mission, outcome, report, source } = input;

  // 1. parse failed → E01
  if (outcome.kind === 'syntax_error') {
    return {
      code: 'E01',
      confidence: 'certain',
      evidence: { failingTestIds: [], message: outcome.message },
      modifiers: [],
    };
  }

  // 2. execution timed out → E03
  if (outcome.kind === 'timeout') {
    return {
      code: 'E03',
      confidence: 'certain',
      evidence: { failingTestIds: [], message: `la ejecución superó ${outcome.durationMs} ms` },
      modifiers: [],
    };
  }

  // 3. the payload was rejected before it could be compared → E12
  if (outcome.kind === 'output_too_large') {
    return {
      code: 'E12',
      confidence: 'certain',
      evidence: {
        failingTestIds: [outcome.testId],
        message: `tu función devolvió demasiada información: ${Math.round(outcome.bytes / 1024)} KB para un solo caso. El motor de pruebas solo puede comparar valores pequeños.`,
      },
      modifiers: [],
    };
  }

  // 4. execution threw → E02
  if (outcome.kind === 'missing_entry_point') {
    return {
      code: 'E02',
      confidence: 'certain',
      evidence: {
        failingTestIds: [],
        message: `no encontré una función llamada \`${outcome.entryPoint}\``,
      },
      modifiers: [],
    };
  }

  // 4b. a case was stopped for crossing the step limit → E16. This is not an
  //     error the player threw: the solution does so much work that the case
  //     never finished. It sits above E02 for that reason, and it is the
  //     deterministic counterpart of the wall-clock timeout (D13).
  const stopped = report.results.find((result) => result.costExceeded === true);
  if (stopped !== undefined) {
    return {
      code: 'E16',
      confidence: 'certain',
      evidence: evidenceFor(report, {
        message: `${authoredMessage(mission, 'E16') ?? COST_FALLBACK} ${stopped.message ?? ''}`.trim(),
      }),
      modifiers: [],
    };
  }

  const threw = report.results.find((result) => result.status === 'error');
  if (threw !== undefined) {
    return {
      code: 'E02',
      confidence: 'certain',
      evidence: evidenceFor(report, { message: threw.message }),
      modifiers: [],
    };
  }

  // 5. behavioural probes. They sit here, above the all-passing branch, because
  //    a run can satisfy every authored test and still not be a solution:
  //    a function that mutates its input, uses `Math.random()`, or only reads
  //    `xs[0]` produces the right answers for the wrong reasons (docs/04 §2).
  //
  //    Deviation from §3, deliberate: §3 lists E07 at 8a, which is only
  //    reachable when a visible test fails. A rotation probe can invalidate an
  //    all-passing run, so E07 is checked here, after E18. Same class of
  //    correction as the E08-before-E12 note above: the fixed order describes
  //    what the evidence can support, and an all-passing report is evidence.
  if (outcome.kind === 'completed' && outcome.mutatedInput === true) {
    return {
      code: 'E11',
      confidence: 'certain',
      evidence: {
        failingTestIds: [],
        message:
          'tu función modificó la lista que recibió. El taller vuelve a usar esos datos después de llamarla, y ahora están cambiados.',
      },
      modifiers: [],
    };
  }

  if (outcome.kind === 'completed' && outcome.deterministic === false) {
    return {
      code: 'E18',
      confidence: 'certain',
      evidence: {
        failingTestIds: [],
        message:
          'la misma entrada devolvió resultados distintos en ejecuciones seguidas. Revisa si algo cambia entre llamadas: azar, fecha, o estado guardado fuera de la función.',
      },
      modifiers: [],
    };
  }

  if (outcome.kind === 'completed' && outcome.rotationUnstable === true) {
    return {
      code: 'E07',
      confidence: 'certain',
      evidence: {
        failingTestIds: [],
        message:
          'el resultado cambia cuando el mismo conjunto de datos empieza en otra posición. La respuesta no debería depender de dónde empieza la lista.',
      },
      modifiers: [],
    };
  }

  // 6. constraint violation → E19.
  //
  //    §3 does not place E19. It has to sit above the all-passing branch: a
  //    mission whose whole point is "implement the loop yourself, `.some` is
  //    banned" is not solved by calling `.some`, however green the tests are.
  //    `evaluateRun` treats E19 as uncompletable for the same reason; the test
  //    report still says the tests passed, and the mentor says so separately.
  const banned = mission.constraints.bannedConstructs.find((construct) =>
    usesConstruct(source, construct),
  );
  if (banned !== undefined) {
    return {
      code: 'E19',
      confidence: 'certain',
      evidence: {
        failingTestIds: report.failingIds,
        message:
          authoredMessage(mission, 'E19') ??
          `Esta misión no permite usar \`${banned}\`. El ejercicio consiste en hacerlo sin esa ayuda.`,
      },
      modifiers: [],
    };
  }

  // everything passed, but the work done exceeds the mission's step budget → E16.
  //
  //    The tests are green and the solution is correct, so this never blocks by
  //    itself: `evaluateRun` only treats it as uncompletable when the mission
  //    declares the budget `enforced`. Otherwise the mentor reports it as advice.
  const budget = mission.constraints.efficiency?.operationBudget;
  if (report.allPassed && budget !== undefined) {
    const worst = report.results.reduce((max, result) => Math.max(max, result.ops ?? 0), 0);
    if (worst > budget) {
      return {
        code: 'E16',
        confidence: 'certain',
        evidence: evidenceFor(report, {
          message: `${authoredMessage(mission, 'E16') ?? COST_FALLBACK} Tu solución usó ${worst.toLocaleString('es')} pasos en el caso más grande; lo esperable es hasta ${budget.toLocaleString('es')}.`,
        }),
        modifiers: [],
      };
    }
  }

  // everything passed → CLEAR
  if (report.allPassed) {
    return { code: 'CLEAR', confidence: 'certain', evidence: { failingTestIds: [] }, modifiers: [] };
  }

  const failing = report.results.filter((result) => result.status === 'fail');

  /**
   * Deviation from §3, deliberate: `undefined` is checked before output shape.
   * §3 puts "output shape wrong" (E12) at step 5 and "result is undefined"
   * (E08) at step 8b, which would label a missing `return` as a type error. The
   * taxonomy's own definition of E08 is precisely "returns undefined on the
   * no-match case", and E12 says "values may be right" — which is false when
   * there is no value at all. E08 wins.
   */
  const missingReturn = failing.find(
    (result: TestResult) => result.actual === undefined && result.expected !== undefined,
  );
  if (missingReturn !== undefined) {
    return {
      code: 'E08',
      confidence: 'certain',
      evidence: evidenceFor(report),
      modifiers: [],
    };
  }

  // 8c. NaN (or an undefined field) in the result, at any depth → E10. `expected` cannot be NaN (schema V7), so an
  //     accumulator that was never initialised can only show up here.
  const notANumber = failing.find((result) => hasBrokenNumber(result.actual));
  if (notANumber !== undefined) {
    return {
      code: 'E10',
      confidence: 'certain',
      evidence: evidenceFor(report, {
        message:
          authoredMessage(mission, 'E10') ??
          'El resultado es NaN. El acumulador empezó vacío o con un valor que no era un número, y la primera suma ya no tuvo sentido.',
      }),
      modifiers: [],
    };
  }

  // 8d. loose equality → E22, but only when the failing case actually mixes
  //     types. `==` in unrelated code is not evidence about this failure.
  if (usesLooseEquality(source) && failing.some((result) => mixesPrimitiveTypes(result.input))) {
    return {
      code: 'E22',
      confidence: 'certain',
      evidence: evidenceFor(report, {
        message:
          authoredMessage(mission, 'E22') ??
          'Usas `==` o `!=`, que convierten los tipos antes de comparar. El contrato pide `===` o `!==`: `1` y `"1"` no son el mismo valor.',
      }),
      modifiers: [],
    };
  }

  // 8e. only the empty input fails → E04. The edge kind is authored, so this
  //     is a fact about the mission's own cases, not a guess from `[].length`.
  if (failing.length > 0 && failing.every((result) => result.edgeKind === 'empty')) {
    return {
      code: 'E04',
      confidence: 'certain',
      evidence: evidenceFor(report, {
        message:
          authoredMessage(mission, 'E04') ??
          'Falla solo cuando la entrada está vacía. Antes de recorrer nada, comprueba qué debe devolver una lista sin elementos.',
      }),
      modifiers: [],
    };
  }

  // 7a. all visible pass, hidden fail, and the source never iterates → E13.
  //     `allowClosedForm` downgrades the inference: M09's answer is arithmetic,
  //     and a source with no loop is exactly right there (docs/04 §2).
  const visibleAllPassed =
    report.counts.visible.total > 0 &&
    report.counts.visible.passed === report.counts.visible.total;
  const hiddenFailing = report.results.some(
    (result) => result.group === 'hidden' && result.status === 'fail',
  );

  if (
    visibleAllPassed &&
    hiddenFailing &&
    !mission.constraints.allowClosedForm &&
    !hasIteration(source)
  ) {
    return {
      code: 'E13',
      confidence: 'likely',
      evidence: evidenceFor(report, {
        message:
          authoredMessage(mission, 'E13') ??
          'Esta solución no recorre la colección. ¿Funcionaría igual con una lista de 10.000 elementos que no has visto?',
      }),
      modifiers: [],
    };
  }

  // 8f. otherwise → by failing-test identity, which is what the mission authors.
  //     Conditional rules first (they name evidence), then a deterministic shape
  //     check, then the unconditional catch-all. Reversing the last two would
  //     let "return a number" be reported as a boundary bug.
  const conditional = matchConditionalAuthored(mission, report);
  if (conditional !== undefined) {
    return {
      code: conditional.code as ErrorCode,
      confidence: 'certain',
      evidence: evidenceFor(report, { message: conditional.message }),
      modifiers: [],
    };
  }

  const shapeMismatch = failing.find((result) => !sameShape(result.actual, result.expected));
  if (shapeMismatch !== undefined) {
    return {
      code: 'E12',
      confidence: 'certain',
      evidence: evidenceFor(report),
      modifiers: [],
    };
  }

  const authored = matchUnconditionalAuthored(mission);
  if (authored !== undefined) {
    return {
      code: authored.code as ErrorCode,
      confidence: 'certain',
      evidence: evidenceFor(report, { message: authored.message }),
      modifiers: [],
    };
  }

  // Last resort before E_UNKNOWN: a duplicated literal is a real, checkable
  // observation, and naming it is better than "algo no cuadra". It is a
  // warning by taxonomy (level 1) and never part of mastery.
  const duplicated = duplicatedLiteral(source);
  if (duplicated !== undefined) {
    return {
      code: 'E20',
      confidence: 'certain',
      evidence: evidenceFor(report, {
        message: `El valor ${duplicated} está escrito en más de un sitio. Si mañana cambia, hay que recordar todos.`,
      }),
      modifiers: [],
    };
  }

  return {
    code: 'E_UNKNOWN',
    confidence: 'likely',
    evidence: evidenceFor(report),
    modifiers: [],
  };
}

export interface ModifierInput {
  attempt: number;
  /**
   * The *primary* code of the immediately preceding attempt (before modifiers).
   * Passing the final code would make an E15 unable to notice the third
   * repetition, because E15 never equals the underlying code.
   */
  previousCode?: DiagnosisCode;
  /** False when the source is byte-identical to the previous attempt. */
  codeChanged: boolean;
  /** True when the previous attempt had a hint on screen (POST_HINT). */
  previousHadHint?: boolean;
}

/**
 * History-dependent modifiers (docs/04 §3, "Post-classification modifiers"),
 * applied in the documented order.
 *
 * Two of them change the code, and that is the honest reading of §3: an
 * unchanged source is `E14` "no progress", and a repeated fault is `E15`
 * "repeated error". The underlying evidence message is preserved so the player
 * still sees the specific observation, not a generic accusation.
 *
 * `NO_PROGRESS` wins over `REPEAT` because it is the stronger fact: the player
 * did not change anything at all.
 */
export function applyModifiers(diagnosis: Diagnosis, input: ModifierInput): Diagnosis {
  const modifiers: Modifier[] = [];

  if (input.attempt === 1) modifiers.push('LOW_ATTEMPT');
  if (input.previousCode !== undefined && input.previousCode === diagnosis.code) {
    modifiers.push('REPEAT');
  }
  if (input.attempt > 1 && !input.codeChanged) modifiers.push('NO_PROGRESS');
  if (input.attempt >= 4) modifiers.push('STRUGGLING');

  // POST_HINT is the one modifier that removes another: a hit-and-a-change is
  // an attempt to apply the hint, not a repetition to punish (docs/04 §3).
  if (input.previousHadHint === true && input.codeChanged) {
    const repeated = modifiers.indexOf('REPEAT');
    if (repeated >= 0) modifiers.splice(repeated, 1);
    modifiers.push('POST_HINT');
  }

  let code = diagnosis.code;
  // E19 is a constraint fact, not a learning failure: "no progress" must not
  // hide the ban the mission is asking the player to respect.
  if (diagnosis.code !== 'CLEAR' && diagnosis.code !== 'E19' && modifiers.includes('NO_PROGRESS')) {
    code = 'E14';
  } else if (
    diagnosis.code !== 'CLEAR' &&
    diagnosis.code !== 'E19' &&
    modifiers.includes('REPEAT')
  ) {
    code = 'E15';
  }

  if (code === 'E14' && diagnosis.evidence.message === undefined) {
    return {
      ...diagnosis,
      code,
      modifiers,
      evidence: {
        ...diagnosis.evidence,
        message:
          'El código es idéntico al del intento anterior, así que el resultado no puede cambiar. Cambia una cosa y vuelve a ejecutar.',
      },
    };
  }

  if (code === 'E15' && diagnosis.evidence.message === undefined) {
    return {
      ...diagnosis,
      code,
      modifiers,
      evidence: {
        ...diagnosis.evidence,
        message: 'Vuelve a aparecer el mismo fallo que en el intento anterior.',
      },
    };
  }

  return { ...diagnosis, code, modifiers };
}
