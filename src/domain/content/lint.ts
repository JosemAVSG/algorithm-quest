/**
 * Pedagogical lints L1–L8 (docs/10-testing-and-security.md §4).
 *
 * These are the rules that stop the curriculum from degrading into a list of
 * exercises. Each one is a real failure mode that already happened during
 * design, not a hypothetical.
 */

import { type ContentIssue, error, warning } from './errors';
import type { Mission, WorkshopSystem } from './schema';
import { containsIdentifier } from './validate';
import { deepEqual } from '../../shared/lib/deep-equal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Case- and accent-insensitive, because authors write "límite" and "limite". */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const PLACEHOLDER_PATTERN =
  /\b(todo|tbd|fixme|lorem ipsum|placeholder|pendiente|por escribir|xxx+)\b/i;

// ---------------------------------------------------------------------------
// Per-mission lints
// ---------------------------------------------------------------------------

export interface LintContext {
  missions: readonly Mission[];
  systems: ReadonlyMap<string, WorkshopSystem>;
  sequenceById: ReadonlyMap<string, number>;
}

export function lintMission(
  mission: Mission,
  context: LintContext,
  source?: string,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const base = { missionId: mission.id, source };

  // L1 — the pattern's name must not appear in the briefing.
  // This is the machine-checkable half of principle 1: the problem appears
  // before the algorithm's name, so the name must not be in the problem text.
  const briefingText = `${mission.briefing.headline}\n${mission.briefing.body}`;
  const foldedBriefing = fold(briefingText);
  for (const term of mission.briefing.forbiddenVocabulary) {
    if (foldedBriefing.includes(fold(term))) {
      issues.push(
        error(
          'L1_VOCABULARY_LEAK',
          `forbidden term "${term}" appears in the briefing; the player must meet the problem before the name`,
          { ...base, path: 'briefing.forbiddenVocabulary' },
        ),
      );
    }
  }

  // L2 — one primary concept, at most one secondary. Two secondaries means the
  // mission is teaching two things and will be diagnosed as neither.
  if (mission.concepts.secondary.length > 1) {
    issues.push(
      error(
        'L2_CONCEPT_BUDGET',
        `mission declares ${mission.concepts.secondary.length} secondary concepts (${mission.concepts.secondary.join(', ')}); at most one is allowed`,
        { ...base, path: 'concepts.secondary' },
      ),
    );
  }

  // L3 — an enforced efficiency budget must come after a mission that already
  // taught the same pattern without one. Otherwise the player is punished for a
  // concept they were never allowed to practise.
  if (mission.constraints.efficiency?.enforced === true) {
    const ownSequence = context.sequenceById.get(mission.id) ?? Number.MAX_SAFE_INTEGER;
    const hasPriorFunctional = context.missions.some((candidate) => {
      if (candidate.id === mission.id) return false;
      if (candidate.concepts.primary !== mission.concepts.primary) return false;
      if (candidate.constraints.efficiency?.enforced === true) return false;
      const candidateSequence =
        context.sequenceById.get(candidate.id) ?? Number.MAX_SAFE_INTEGER;
      return candidateSequence < ownSequence;
    });
    if (!hasPriorFunctional) {
      issues.push(
        error(
          'L3_OPTIMIZATION_ORDER',
          `efficiency is enforced but no earlier mission teaches "${mission.concepts.primary}" without a budget; the player is being timed on something untaught`,
          { ...base, path: 'constraints.efficiency.enforced' },
        ),
      );
    }
  }

  // L4 — the reward must be a transition the system actually supports.
  const system = context.systems.get(mission.workshop.systemId);
  if (system !== undefined) {
    const { from, to } = mission.workshop;
    if (!system.states.includes(from)) {
      issues.push(
        error(
          'L4_REWARD_TRANSITION',
          `${system.id} has no state "${from}" (states: ${system.states.join(', ')})`,
          { ...base, path: 'workshop.from' },
        ),
      );
    }
    if (!system.states.includes(to)) {
      issues.push(
        error(
          'L4_REWARD_TRANSITION',
          `${system.id} has no state "${to}" (states: ${system.states.join(', ')})`,
          { ...base, path: 'workshop.to' },
        ),
      );
    }
    const legal = system.transitions.some(
      (transition) => transition.from === from && transition.to === to,
    );
    if (!legal) {
      issues.push(
        error(
          'L4_REWARD_TRANSITION',
          `${system.id} cannot go ${from} → ${to}; legal transitions are ${system.transitions
            .map((transition) => `${transition.from} → ${transition.to}`)
            .join(', ')}`,
          { ...base, path: 'workshop' },
        ),
      );
    }
    // The effect string is rendered verbatim on the map. If it disagrees with
    // the structured fields, the map lies.
    const expectedEffect = `${from} → ${to}`;
    if (mission.reward.effect.trim() !== expectedEffect) {
      issues.push(
        error(
          'L4_REWARD_TRANSITION',
          `reward.effect is "${mission.reward.effect}" but workshop is ${expectedEffect}`,
          { ...base, path: 'reward.effect' },
        ),
      );
    }
  }

  // L5 — the last rung must not hand over the answer.
  //
  // Specificity ordering is a human review concern: every mechanical proxy we
  // tried flagged valid Spanish hints (level 1 "dos cosas" has no digits, level
  // 3 explains an operator with no numbers). Claiming to check it would be
  // false rigour, so we check what is decidable.
  const lastHint = mission.hints[3];
  if (containsIdentifier(lastHint.text, mission.contract.entryPoint)) {
    issues.push(
      error(
        'L5_HINT_LADDER',
        `level-4 hint names "${mission.contract.entryPoint}", which turns the last rung into a copy task`,
        { ...base, path: 'hints[3].text' },
      ),
    );
  }
  if (lastHint.unlock === undefined) {
    issues.push(
      error(
        'L5_HINT_LADDER',
        'level-4 hint must declare `unlock`; the most expensive rung is not free',
        { ...base, path: 'hints[3].unlock' },
      ),
    );
  }
  mission.hints.forEach((hint, index) => {
    if (hint.text.trim().length < 20) {
      issues.push(
        warning(
          'L5_HINT_LADDER',
          `level-${hint.level} hint is ${hint.text.trim().length} characters; a rung that short is usually a placeholder`,
          { ...base, path: `hints[${index}].text` },
        ),
      );
    }
  });

  // L6 — hidden and edge tests must not duplicate a visible input. Otherwise the
  // player can pass by pattern-matching what they can already see, and the
  // robustness signal is fake.
  for (const group of ['hidden', 'edge'] as const) {
    mission.tests[group].forEach((candidate, index) => {
      const duplicate = mission.tests.visible.find((visibleTest) =>
        deepEqual(visibleTest.input, candidate.input),
      );
      if (duplicate !== undefined) {
        issues.push(
          error(
            'L6_TEST_INDEPENDENCE',
            `${group} test "${candidate.id}" repeats the input of visible test "${duplicate.id}"`,
            { ...base, path: `tests.${group}[${index}].input` },
          ),
        );
      }
    });
  }

  // L7 — at least two distinct, declared edge kinds. Two tests labelled the same
  // way are one insight, not two.
  const declaredKinds = new Set<string>();
  mission.tests.edge.forEach((testCase, index) => {
    if (testCase.edgeKind === undefined) {
      issues.push(
        error(
          'L7_EDGE_COVERAGE',
          `edge test "${testCase.id}" must declare edgeKind`,
          { ...base, path: `tests.edge[${index}].edgeKind` },
        ),
      );
      return;
    }
    declaredKinds.add(testCase.edgeKind);
  });
  if (mission.tests.edge.length >= 2 && declaredKinds.size < 2) {
    issues.push(
      error(
        'L7_EDGE_COVERAGE',
        `edge tests cover ${declaredKinds.size} distinct kind(s); at least 2 are required`,
        { ...base, path: 'tests.edge' },
      ),
    );
  }

  // L8 — the debrief is where the pattern becomes transferable. Placeholders
  // here are invisible to the player and poison the reasoning heuristic.
  const debriefFields: Array<[string, string]> = [
    ['debrief.whyItWorks', mission.debrief.whyItWorks],
    ['debrief.edgeCaseNote', mission.debrief.edgeCaseNote],
    ['debrief.realWorld', mission.debrief.realWorld],
    ['debrief.reasoningPrompt', mission.debrief.reasoningPrompt],
    ['debrief.complexity.explanation', mission.debrief.complexity.explanation],
  ];
  for (const [path, value] of debriefFields) {
    if (PLACEHOLDER_PATTERN.test(value)) {
      issues.push(
        error('L8_DEBRIEF_SUBSTANCE', `${path} contains placeholder text`, {
          ...base,
          path,
        }),
      );
    }
    if (value.trim().length < 20) {
      issues.push(
        warning('L8_DEBRIEF_SUBSTANCE', `${path} is too short to teach anything`, {
          ...base,
          path,
        }),
      );
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Cross-mission lint
// ---------------------------------------------------------------------------

/**
 * L4, global half: replay the workshop forward in play order and assert every
 * mission starts from the state the previous mission left behind.
 *
 * Without this, two missions can both claim to repair the same system from the
 * same broken state, and the map shows a workshop that never actually changed.
 */
export function lintWorkshopTimeline(
  missions: readonly Mission[],
  systems: ReadonlyMap<string, WorkshopSystem>,
  sequenceById: ReadonlyMap<string, number>,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const ordered = [...missions].sort(
    (a, b) =>
      (sequenceById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (sequenceById.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );

  const state = new Map<string, string>();
  for (const [id, system] of systems) state.set(id, system.initialState);

  for (const mission of ordered) {
    const current = state.get(mission.workshop.systemId);
    if (current === undefined) continue; // REF_SYSTEM already reported it.

    if (current !== mission.workshop.from) {
      issues.push(
        error(
          'L4_REWARD_TRANSITION',
          `${mission.workshop.systemId} is "${current}" at this point in play order, but the mission starts from "${mission.workshop.from}"`,
          { missionId: mission.id, path: 'workshop.from' },
        ),
      );
    }
    state.set(mission.workshop.systemId, mission.workshop.to);
  }

  return issues;
}
