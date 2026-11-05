/**
 * The test engine: the only thing in this product allowed to say whether the
 * player's code is correct (docs/04-mentor.md, principle 3).
 *
 * It is a pure function over an execution outcome and a mission. It does not
 * run code, does not call the mentor, and has no opinion about hints. If a
 * future feature needs a different verdict, it needs a different engine —
 * not a second opinion layered on top of this one.
 */

import { deepEqual } from '../../shared/lib/deep-equal';
import type { EdgeKind, Mission, TestCase } from '../content/schema';
import { isUnserializable } from '../execution/run-cases';
import type { ExecutionOutcome } from '../execution/port';

export type TestGroup = 'visible' | 'hidden' | 'edge';
export type TestStatus = 'pass' | 'fail' | 'error' | 'not_run';

export interface TestResult {
  testId: string;
  group: TestGroup;
  /** Author-written description. Never "Test 2". */
  label: string;
  input: unknown[];
  expected: unknown;
  /**
   * The authored edge kind, when the case declares one. The classifier needs it
   * to tell "only the empty input fails" (E04) from any other failing edge case
   * without guessing from the input's shape.
   */
  edgeKind?: EdgeKind;
  status: TestStatus;
  actual?: unknown;
  message?: string;
  line?: number;
  /** Steps the case took, when the run measured them (D13). */
  ops?: number;
  /** True when the case was stopped for crossing the step limit. */
  costExceeded?: boolean;
}

export interface GroupCount {
  passed: number;
  total: number;
}

export interface TestReport {
  results: TestResult[];
  counts: Record<TestGroup, GroupCount>;
  /** True only when every test in every group passed. */
  allPassed: boolean;
  failingIds: string[];
  /** False when the code never ran (syntax, timeout, missing entry point). */
  ranAtAll: boolean;
  /** Set when the whole run failed before producing per-test evidence. */
  blockedBy?: ExecutionOutcome['kind'];
}

interface IndexedCase {
  group: TestGroup;
  testCase: TestCase;
}

function indexCases(mission: Pick<Mission, 'tests'>): IndexedCase[] {
  const out: IndexedCase[] = [];
  for (const testCase of mission.tests.visible) out.push({ group: 'visible', testCase });
  for (const testCase of mission.tests.hidden) out.push({ group: 'hidden', testCase });
  for (const testCase of mission.tests.edge) out.push({ group: 'edge', testCase });
  return out;
}

function emptyCounts(): Record<TestGroup, GroupCount> {
  return {
    visible: { passed: 0, total: 0 },
    hidden: { passed: 0, total: 0 },
    edge: { passed: 0, total: 0 },
  };
}

/** The fields every result carries, so a new status cannot forget `edgeKind`. */
function baseResult(group: TestGroup, testCase: TestCase) {
  return {
    testId: testCase.id,
    group,
    label: testCase.note ?? testCase.id,
    input: testCase.input,
    expected: testCase.expected,
    ...(testCase.edgeKind === undefined ? {} : { edgeKind: testCase.edgeKind }),
  };
}

function blockedReport(mission: Pick<Mission, 'tests'>, blockedBy: ExecutionOutcome['kind']): TestReport {
  const results: TestResult[] = indexCases(mission).map(({ group, testCase }) => ({
    ...baseResult(group, testCase),
    status: 'not_run',
  }));

  const counts = emptyCounts();
  for (const { group } of indexCases(mission)) counts[group].total += 1;

  return { results, counts, allPassed: false, failingIds: [], ranAtAll: false, blockedBy };
}

function describeUnserializable(value: { __unserializable: string }): string {
  switch (value.__unserializable) {
    case 'function':
      return 'la función devolvió una función, y el motor de pruebas solo puede comparar datos';
    case 'symbol':
      return 'la función devolvió un símbolo, que no es un valor de datos comparable';
    default:
      return 'la función devolvió una estructura demasiado anidada o circular para compararla';
  }
}

export function buildTestReport(
  mission: Pick<Mission, 'tests'>,
  outcome: ExecutionOutcome,
): TestReport {
  if (outcome.kind !== 'completed') return blockedReport(mission, outcome.kind);

  const byId = new Map(outcome.cases.map((entry) => [entry.testId, entry]));
  const counts = emptyCounts();
  const results: TestResult[] = [];
  const failingIds: string[] = [];

  for (const { group, testCase } of indexCases(mission)) {
    counts[group].total += 1;
    const entry = byId.get(testCase.id);

    if (entry === undefined) {
      // The adapter must return a result for every case it was given. If it did
      // not, that is an engine fault, and pretending the test passed would be
      // the worst possible failure mode for a product that claims a single
      // source of truth.
      results.push({
        ...baseResult(group, testCase),
        status: 'error',
        message: 'el motor de ejecución no devolvió resultado para este caso',
      });
      failingIds.push(testCase.id);
      continue;
    }

    if (entry.status === 'threw') {
      results.push({
        ...baseResult(group, testCase),
        status: 'error',
        message: entry.message,
        ...(entry.line === undefined ? {} : { line: entry.line }),
        ...(entry.ops === undefined ? {} : { ops: entry.ops }),
        ...(entry.costExceeded === true ? { costExceeded: true } : {}),
      });
      failingIds.push(testCase.id);
      continue;
    }

    const actual = entry.value;
    if (isUnserializable(actual)) {
      results.push({
        ...baseResult(group, testCase),
        status: 'fail',
        actual,
        message: describeUnserializable(actual),
      });
      failingIds.push(testCase.id);
      continue;
    }

    const passed = deepEqual(actual, testCase.expected);
    if (passed) counts[group].passed += 1;
    else failingIds.push(testCase.id);

    results.push({
      ...baseResult(group, testCase),
      status: passed ? 'pass' : 'fail',
      actual,
      ...(entry.ops === undefined ? {} : { ops: entry.ops }),
    });
  }

  return {
    results,
    counts,
    allPassed: failingIds.length === 0,
    failingIds,
    ranAtAll: true,
  };
}

/** Human-readable rendering of a value, for diffs in the test panel. */
export function renderValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
  if (isUnserializable(value)) return `<${value.__unserializable}>`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '<valor no representable>';
  }
}
