import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { Mission } from '../../../src/domain/content/schema';

import { executionCases } from '../../../src/domain/evaluation/cases';
import { evaluateRun } from '../../../src/domain/evaluation/evaluate-run';
import { createMeter, installBuiltinMeter } from '../../../src/domain/execution/meter';
import { compileEntryPoint, runCasesWith } from '../../../src/domain/execution/run-cases';
import { opLimitFor } from '../../../src/adapters/execution/worker/runner';
import { CALIBRATION } from '../../support/calibration-solutions';

let undo: (() => void) | null = null;
afterEach(() => {
  undo?.();
  undo = null;
});

/**
 * Straight from the JSON: whole-corpus validation is another test's job, and
 * running it for each of sixty cases here would take minutes.
 */
function loadMission(id: string): Mission {
  const file = path.resolve(process.cwd(), 'content/missions', `${id.toLowerCase()}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as Mission;
}

function run(mission: Mission, code: string) {
  const budget = mission.constraints.efficiency?.operationBudget;
  const meter = createMeter();
  undo = installBuiltinMeter(meter);
  const fn = compileEntryPoint(code, mission.contract.entryPoint, { meter });
  const outcome = {
    kind: 'completed' as const,
    durationMs: 1,
    cases: runCasesWith(fn, executionCases(mission), {
      meter,
      opLimit: opLimitFor(budget === undefined ? {} : { operationBudget: budget }),
    }),
  };
  return evaluateRun({ mission, outcome, source: code, attempt: 1, codeChanged: true });
}

describe('operation budgets are calibrated against real solutions (D13)', () => {
  for (const [id, pair] of Object.entries(CALIBRATION)) {
    describe(id, () => {
      it('declares a budget', () => {
        const mission = loadMission(id);
        expect(mission.constraints.efficiency?.operationBudget).toBeGreaterThan(0);
      }, 60_000);

      it('the reference solution passes within the budget', () => {
        const mission = loadMission(id);
        const evaluation = run(mission, pair.ref);
        expect(evaluation.report.allPassed).toBe(true);
        expect(evaluation.cost!.over).toBe(false);
        expect(evaluation.diagnosis!.code).toBe('CLEAR');
        // A budget far above the reference would stop teaching anything.
        expect(evaluation.cost!.budget! / evaluation.cost!.maxOps).toBeLessThan(40);
      }, 60_000);

      if (pair.slow !== undefined) {
        it('the naive solution exceeds the budget or is stopped', () => {
          const mission = loadMission(id);
          const evaluation = run(mission, pair.slow!);
          expect(evaluation.cost!.over).toBe(true);
          // A naive solution that also orders differently is judged on order first.
          if (pair.slowMayDiffer !== true) expect(evaluation.diagnosis!.code).toBe('E16');
        }, 60_000);
      }
    });
  }
});
