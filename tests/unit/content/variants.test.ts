import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { lintVariants } from '../../../src/domain/content/variants';
import {
  ReinforcementRegistrySchema,
  type Concept,
  type Mission,
  type ReinforcementVariant,
} from '../../../src/domain/content/schema';
import { executionCases } from '../../../src/domain/evaluation/cases';
import { buildTestReport } from '../../../src/domain/evaluation/test-engine';
import { runCases } from '../../../src/domain/execution/run-cases';
import {
  buildVariantEvidence,
  pickVariant,
  variantTests,
} from '../../../src/domain/mastery/variants';
import { conceptMastery } from '../../../src/domain/mastery/score';
import { emptyProgress, recordReinforcement } from '../../../src/domain/persistence/port';
import solutions from '../../support/variant-solutions.json';

const root = process.cwd();
const registry = ReinforcementRegistrySchema.parse(
  JSON.parse(readFileSync(path.join(root, 'content/reinforcement.json'), 'utf8')),
);
const concepts = (
  JSON.parse(readFileSync(path.join(root, 'content/concepts.json'), 'utf8')) as {
    concepts: Concept[];
  }
).concepts;
const variants = registry.variants;

function runVariant(variant: ReinforcementVariant, code: string) {
  const tests = variantTests(variant);
  const cases = runCases(code, variant.contract.entryPoint, executionCases({ tests }));
  return buildTestReport({ tests }, { kind: 'completed', durationMs: 1, cases });
}

describe('shipped reinforcement variants', () => {
  it('cover every concept', () => {
    const covered = new Set(variants.map((variant) => variant.conceptId));
    expect(concepts.filter((concept) => !covered.has(concept.id)).map((c) => c.id)).toEqual([]);
  });

  for (const variant of variants) {
    describe(variant.id, () => {
      const known = (solutions as Record<string, { entry: string; source: string }>)[variant.id];

      it('has a reference solution that passes every test', () => {
        expect(known).toBeDefined();
        const code = `const __ref = (${known!.source});\nfunction ${known!.entry}(...args) { return __ref(...args); }`;
        const report = runVariant(variant, code);
        expect(report.failingIds).toEqual([]);
        expect(report.allPassed).toBe(true);
      });

      it('is not already solved by its starter code', () => {
        expect(runVariant(variant, variant.starterCode).allPassed).toBe(false);
      });
    });
  }
});

describe('lintVariants', () => {
  const base = variants[0]!;
  const lint = (list: ReinforcementVariant[], missions: Mission[] = []) =>
    lintVariants(list, concepts, missions).filter((issue) => issue.severity === 'error');

  it('accepts the shipped variants', () => {
    expect(lint(variants)).toEqual([]);
  });

  it('rejects a duplicate id and an unknown concept', () => {
    const messages = lint([base, base, { ...base, id: 'R-C99-1', conceptId: 'C99' }]).map((i) => i.message);
    expect(messages.some((m) => m.includes('declared twice'))).toBe(true);
    expect(messages.some((m) => m.includes('unknown concept'))).toBe(true);
  });

  it('rejects hidden tests that repeat a visible input', () => {
    const repeated = {
      ...base,
      tests: { ...base.tests, hidden: [{ ...base.tests.visible[0]!, id: 'hx' }, base.tests.hidden[0]!] },
    };
    expect(lint([repeated]).some((i) => i.message.includes('repeats the input'))).toBe(true);
  });

  it('rejects an entry point the starter code does not declare', () => {
    expect(lint([{ ...base, starterCode: 'function other() {}' }]).some((i) => i.message.includes('entry point'))).toBe(true);
  });

  it('rejects a mission that lists a variant of a concept it does not teach', () => {
    const mission = {
      id: 'M99',
      concepts: { primary: 'C01', secondary: [] },
      mastery: { reinforcementVariants: ['R-C20-1'] },
    } as unknown as Mission;
    expect(lint(variants, [mission]).some((i) => i.message.includes('does not teach'))).toBe(true);
  });
});

describe('practising a variant', () => {
  const variant = variants.find((candidate) => candidate.conceptId === 'C04')!;
  const solved = (() => {
    const known = (solutions as Record<string, { entry: string; source: string }>)[variant.id]!;
    return runVariant(variant, `const __ref = (${known.source});\nfunction ${known.entry}(...a) { return __ref(...a); }`);
  })();

  it('picks the variant practised least, rotating through them', () => {
    const second = { ...variant, id: 'R-C04-2' };
    const events = [buildVariantEvidence(variant, solved, { at: 1, attempts: 1, hintsUsed: 0 })];
    expect(pickVariant([variant, second], 'C04', [])!.id).toBe('R-C04-1');
    expect(pickVariant([variant, second], 'C04', events)!.id).toBe('R-C04-2');
    expect(pickVariant([variant], 'C20', [])).toBeNull();
  });

  it('records one reinforced event for the concept and takes it off the queue', () => {
    const event = buildVariantEvidence(variant, solved, { at: 5, attempts: 2, hintsUsed: 1 });
    expect(event).toMatchObject({ role: 'reinforced', conceptId: 'C04', missionId: variant.id, hintsUsed: 1 });

    const progress = {
      ...emptyProgress(),
      reinforcement: [
        { conceptId: 'C04', missionId: 'M02', mastery: 0.2, reason: 'assisted' as const, queuedAt: 1 },
        { conceptId: 'C05', missionId: 'M03', mastery: 0.3, reason: 'assisted' as const, queuedAt: 1 },
      ],
    };
    const next = recordReinforcement(progress, [event], 'C04');
    expect(next.events).toHaveLength(1);
    expect(next.reinforcement.map((item) => item.conceptId)).toEqual(['C05']);
    expect(next.declinedReinforcement).toEqual([]); // practising is not declining
    expect(next.completed).toEqual([]); // and it is not a mission completion
    // recording the same event twice does not double-count it
    expect(recordReinforcement(next, [event], 'C04').events).toHaveLength(1);
  });

  it('weighs less than a full mission and raises a weak concept', () => {
    const event = buildVariantEvidence(variant, solved, { at: 5, attempts: 1, hintsUsed: 0 });
    const mastery = conceptMastery([event], 'C04')!;
    expect(mastery).toBeGreaterThan(0.4);
    expect(mastery).toBeLessThanOrEqual(0.5); // the reinforced role caps at 0.5
  });
});
