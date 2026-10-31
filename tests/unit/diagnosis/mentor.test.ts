import { beforeAll, describe, expect, it } from 'vitest';

import type { Mission, WorkshopSystem } from '../../../src/domain/content/schema';
import { lintMission } from '../../../src/domain/content/lint';
import { describeDiagnosis, interventionLevel, selectHint } from '../../../src/domain/diagnosis/hints';
import type { Diagnosis, DiagnosisCode } from '../../../src/domain/diagnosis/taxonomy';
import { executionCases } from '../../../src/domain/evaluation/cases';
import { evaluateRun, type RunEvaluation } from '../../../src/domain/evaluation/evaluate-run';
import type { ExecutionOutcome } from '../../../src/domain/execution/port';
import { runCases } from '../../../src/domain/execution/run-cases';
import { combineReasoningScore, parseAiReasoning } from '../../../src/domain/mastery/ai-reasoning';
import { assessReasoning, reasoningDiagnosis } from '../../../src/domain/mastery/reasoning';
import { loadMission } from '../../support/content';

/**
 * D1–D12 (docs/10-testing-and-security.md §3) plus one fixture per code the
 * classifier produces. A code without a test is a claim; this file is the
 * evidence.
 */

let mission: Mission;

const BUGGY = 'function isOverLimit(temperature, limit) {\n  return temperature >= limit;\n}';

/** Same fault, different bytes: proves REPEAT does not depend on a hash. */
const BUGGY_ALT =
  'function isOverLimit(temperature, limit) {\n  const over = temperature >= limit;\n  return over;\n}';

function clone(): Mission {
  return structuredClone(mission);
}

function completed(
  missionToRun: Mission,
  code: string,
): Extract<ExecutionOutcome, { kind: 'completed' }> {
  return {
    kind: 'completed',
    durationMs: 1,
    cases: runCases(code, missionToRun.contract.entryPoint, executionCases(missionToRun)),
  };
}

interface RunOptions {
  attempt?: number;
  previousCode?: DiagnosisCode;
  codeChanged?: boolean;
  previousHadHint?: boolean;
  patch?: Partial<Extract<ExecutionOutcome, { kind: 'completed' }>>;
}

function run(
  missionToRun: Mission,
  code: string,
  options: RunOptions = {},
): RunEvaluation {
  const outcome = { ...completed(missionToRun, code), ...(options.patch ?? {}) };
  return evaluateRun({
    mission: missionToRun,
    outcome,
    source: code,
    attempt: options.attempt ?? 1,
    codeChanged: options.codeChanged ?? true,
    ...(options.previousCode === undefined ? {} : { previousCode: options.previousCode }),
    ...(options.previousHadHint === undefined
      ? {}
      : { previousHadHint: options.previousHadHint }),
  });
}

function diagnosis(evaluation: RunEvaluation): Diagnosis {
  if (evaluation.diagnosis === null) throw new Error('expected a player diagnosis');
  return evaluation.diagnosis;
}

beforeAll(async () => {
  mission = await loadMission('M01');
});

describe('D1 — the classifier is a pure function', () => {
  it('produces an identical evaluation across 100 runs of the same attempt', () => {
    const first = run(mission, BUGGY);
    for (let index = 0; index < 100; index += 1) {
      expect(run(mission, BUGGY)).toEqual(first);
    }
  });
});

describe('D2 — priority order', () => {
  it('classifies a mutated input as E11 even when an authored E05 also applies', () => {
    const evaluation = run(mission, BUGGY, { patch: { mutatedInput: true } });
    expect(diagnosis(evaluation).code).toBe('E11');
  });
});

describe('D3 — LOW_ATTEMPT caps the first intervention', () => {
  it('offers level 1 on attempt 1, not the code default', () => {
    const e05 = diagnosis(run(mission, BUGGY));
    expect(e05.code).toBe('E05');
    expect(
      selectHint(mission, e05, { hintLevel: 0, hintsUsed: 0, attempts: 1 }),
    ).toMatchObject({ level: 1 });
  });
});

describe('D4 — E01/E02 bypass the ladder', () => {
  const syntax: Diagnosis = {
    code: 'E01',
    confidence: 'certain',
    evidence: { failingTestIds: [], message: 'Unexpected token ;' },
    modifiers: ['LOW_ATTEMPT'],
  };

  it('returns a level-2, specific explanation on attempt 1', () => {
    expect(interventionLevel(syntax, { hintLevel: 0, hintsUsed: 0, attempts: 1 })).toBe(2);
    const card = describeDiagnosis(syntax);
    expect(card.detail).toContain('Unexpected token');
    expect(card.canRequestHint).toBe(false);
  });
});

describe('D5 — REPEAT escalates one level and switches modality', () => {
  it('labels a repeated E05 as E15, keeps the evidence, and changes representation', () => {
    const repeated = run(mission, BUGGY_ALT, { attempt: 2, previousCode: 'E05' });

    expect(repeated.primaryCode).toBe('E05');
    expect(diagnosis(repeated).code).toBe('E15');
    expect(diagnosis(repeated).modifiers).toContain('REPEAT');
    expect(repeated.passed).toBe(false);

    const hint = selectHint(mission, diagnosis(repeated), {
      hintLevel: 1,
      hintsUsed: 1,
      attempts: 2,
    });
    expect(hint).toMatchObject({ level: 2, modality: 'smaller_input' });
    // The specific E05 observation is preserved, not replaced by "same error".
    expect(hint?.text).toContain('90 y límite 90');
  });

  it('POST_HINT clears REPEAT when the source changed after a hint', () => {
    const attempt = run(mission, BUGGY_ALT, {
      attempt: 2,
      previousCode: 'E05',
      previousHadHint: true,
    });

    expect(diagnosis(attempt).modifiers).toContain('POST_HINT');
    expect(diagnosis(attempt).modifiers).not.toContain('REPEAT');
    expect(diagnosis(attempt).code).toBe('E05');
  });
});

describe('D6 — NO_PROGRESS becomes E14 at level 3', () => {
  it('replaces the code when the source is byte-identical', () => {
    const unchanged = run(mission, BUGGY, {
      attempt: 2,
      previousCode: 'E05',
      codeChanged: false,
    });

    expect(diagnosis(unchanged).code).toBe('E14');
    expect(diagnosis(unchanged).modifiers).toContain('NO_PROGRESS');

    const hint = selectHint(mission, diagnosis(unchanged), {
      hintLevel: 0,
      hintsUsed: 0,
      attempts: 2,
    });
    expect(hint).toMatchObject({ level: 3, modality: 'smaller_input' });
  });
});

describe('D7 — the level-4 guard holds', () => {
  it('is unreachable at 3 attempts / 3 hints and reachable at 4 / 3', () => {
    const e05 = diagnosis(run(mission, BUGGY));

    expect(
      selectHint(mission, e05, { hintLevel: 3, hintsUsed: 3, attempts: 3 }),
    ).toBeNull();

    expect(
      selectHint(mission, e05, { hintLevel: 3, hintsUsed: 3, attempts: 4 }),
    ).toMatchObject({ level: 4, modality: 'worked_variant' });
  });
});

describe('D8 — the level-4 hint never contains the solution', () => {
  it('rejects a final rung that names the entry point', () => {
    const draft = clone();
    draft.hints[3].text = `Copia esto: function ${draft.contract.entryPoint}() { return true; }`;

    const issues = lintMission(draft, {
      missions: [draft],
      systems: new Map<string, WorkshopSystem>(),
      sequenceById: new Map<string, number>(),
    });

    expect(issues.map((issue) => issue.code)).toContain('L5_HINT_LADDER');
  });
});

describe('D9 — unknown code fallback', () => {
  it('returns E_UNKNOWN with no guess when nothing matches', () => {
    const bare = clone();
    bare.diagnostics = [
      { code: 'E01', message: 'syntax' },
      { code: 'E02', message: 'runtime' },
    ];

    const evaluation = run(bare, 'function isOverLimit() {\n  return false;\n}');
    expect(diagnosis(evaluation).code).toBe('E_UNKNOWN');
    expect(diagnosis(evaluation).confidence).toBe('likely');
  });
});

describe('D10 — the reasoning heuristic', () => {
  const answers: Array<[string, 0 | 1 | 2 | 3]> = [
    ['', 0],
    ['porque funciona', 0],
    ['no sé', 0],
    ['es correcto', 0],
    ['devuelvo true cuando el valor es mayor', 1],
    ['comparo el valor con el límite', 1],
    ['comparo la temperatura con el límite y devuelvo true solo cuando la supera', 2],
    ['recorro los sensores y comparo cada lectura con el límite de peligro', 2],
    ['comparo cada sensor con el límite; la complejidad es constante', 3],
    ['comparo el sensor con el límite; en cambio, dos recorridos serían más lentos', 3],
    ['el límite se compara una vez y la alarma no depende del sensor', 0],
    ['comparo el sensor y el límite, porque funciona', 0],
  ];

  it.each(answers)('scores %j as %i', (answer, expected) => {
    expect(assessReasoning(mission, answer).score).toBe(expected);
  });
});

describe('D11 — the AI can reward nuance, never manufacture it', () => {
  it('caps an AI 3 at deterministic + 1', () => {
    const ai = parseAiReasoning({ score: 3, missing: [], followUp: 'más detalle' });
    expect(combineReasoningScore(1, ai)).toBe(2);
    expect(combineReasoningScore(2, ai)).toBe(3);
    expect(combineReasoningScore(0, ai)).toBe(1);
  });
});

describe('D12 — invalid AI output falls back silently', () => {
  it('returns null for an out-of-range score, a bad shape, or non-JSON', () => {
    expect(parseAiReasoning({ score: 4, missing: [], followUp: '' })).toBeNull();
    expect(parseAiReasoning({ score: 2, missing: [1], followUp: '' })).toBeNull();
    expect(parseAiReasoning('score: 2')).toBeNull();
    expect(combineReasoningScore(1, null)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// One fixture per produced code (docs/10 §7, "every E01–E22 has a fixture").
// E16 is the single exception and it is documented, not faked: it needs a
// calibrated operation budget (D12/D13), which does not exist yet.
// ---------------------------------------------------------------------------

describe('M3 code fixtures', () => {
  it('E04 — only the empty input fails', () => {
    const draft = clone();
    draft.tests = {
      visible: [
        { id: 'v1', input: [95, 90], expected: true },
        { id: 'v2', input: [85, 90], expected: true },
      ],
      hidden: [
        { id: 'h1', input: [91, 90], expected: true },
        { id: 'h2', input: [0, 90], expected: true },
        { id: 'h3', input: [200, 90], expected: true },
      ],
      edge: [
        { id: 'e1', input: [], expected: true, edgeKind: 'empty' },
        { id: 'e2', input: [-5, -10], expected: true },
      ],
    };

    const evaluation = run(
      draft,
      'function isOverLimit(temperature) {\n  return temperature === undefined ? false : true;\n}',
    );
    expect(diagnosis(evaluation).code).toBe('E04');
  });

  it('E10 — a NaN result is an accumulator initialisation fault', () => {
    const evaluation = run(
      mission,
      'function isOverLimit(temperature, limit) {\n  return temperature - limit + undefined;\n}',
    );
    expect(diagnosis(evaluation).code).toBe('E10');
  });

  it('E13 — visible pass, hidden fail, no iteration, closed form not allowed', () => {
    const draft = clone();
    draft.constraints.allowClosedForm = false;
    draft.tests = {
      visible: [
        { id: 'v1', input: [95, 90], expected: true },
        { id: 'v2', input: [85, 90], expected: true },
      ],
      hidden: [
        { id: 'h1', input: [85, 90], expected: false },
        { id: 'h2', input: [0, 90], expected: false },
        { id: 'h3', input: [1, 0], expected: true },
      ],
      edge: [
        { id: 'e1', input: [90, 90], expected: true },
        { id: 'e2', input: [0, 0], expected: true },
      ],
    };

    const evaluation = run(draft, 'function isOverLimit() {\n  return true;\n}');
    expect(diagnosis(evaluation).code).toBe('E13');
    expect(diagnosis(evaluation).confidence).toBe('likely');
  });

  it('E19 — a banned construct blocks completion even when every test passes', () => {
    const draft = clone();
    draft.constraints.bannedConstructs = ['.some'];

    const evaluation = run(
      draft,
      'function isOverLimit(temperature, limit) {\n  return [temperature].some((value) => value > limit);\n}',
    );

    expect(evaluation.report.allPassed).toBe(true);
    expect(diagnosis(evaluation).code).toBe('E19');
    expect(evaluation.passed).toBe(false);
  });

  it('E20 — a literal repeated in two paths is the last-resort warning', () => {
    const draft = clone();
    draft.diagnostics = [{ code: 'E01', message: 'syntax' }];

    const evaluation = run(
      draft,
      'function isOverLimit(temperature) {\n  return temperature > 99 || 99 < 0;\n}',
    );
    expect(diagnosis(evaluation).code).toBe('E20');
    expect(diagnosis(evaluation).evidence.message).toContain('99');
  });

  it('E22 — loose equality is diagnosed only when a failing case mixes types', () => {
    const draft = clone();
    draft.diagnostics = [{ code: 'E01', message: 'syntax' }];
    draft.tests = {
      visible: [{ id: 'v1', input: ['1', 1], expected: false }],
      hidden: [
        { id: 'h1', input: [2, 2], expected: true },
        { id: 'h2', input: [3, 3], expected: true },
        { id: 'h3', input: [4, 4], expected: true },
      ],
      edge: [
        { id: 'e1', input: [0, 0], expected: true },
        { id: 'e2', input: [-1, -1], expected: true },
      ],
    };

    const evaluation = run(
      draft,
      'function isOverLimit(first, second) {\n  return first == second;\n}',
    );
    expect(diagnosis(evaluation).code).toBe('E22');
  });

  it.each(['E05', 'E06', 'E09', 'E21'] as const)(
    '%s — the authored refinement rule wins once its signature matches',
    (code) => {
      const draft = clone();
      draft.diagnostics = [{ code, message: `authored ${code}` }];

      expect(diagnosis(run(draft, BUGGY)).code).toBe(code);
    },
  );

  it('E17 — tests pass but the explanation does not reach the rubric', () => {
    const result = reasoningDiagnosis(mission, 'porque funciona');
    expect(result.diagnosis?.code).toBe('E17');

    const good = reasoningDiagnosis(
      mission,
      'comparo la temperatura con el límite y devuelvo true solo cuando la supera',
    );
    expect(good.diagnosis).toBeNull();
    expect(good.assessment.score).toBe(2);
  });
});
