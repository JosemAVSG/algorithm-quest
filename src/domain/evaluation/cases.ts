/**
 * Turning a mission into the cases the execution port runs.
 *
 * All three groups run on every attempt. Visible tests are shown to the player;
 * hidden and edge tests are not, because that is the entire difference between
 * reading a specification and reverse-engineering a table of answers
 * (docs/missions/M01.md §5).
 */

import type { Mission } from '../content/schema';
import type { ExecutionCase } from '../execution/port';

export function executionCases(mission: Mission): ExecutionCase[] {
  return [
    ...mission.tests.visible,
    ...mission.tests.hidden,
    ...mission.tests.edge,
  ].map((testCase) => ({ testId: testCase.id, input: testCase.input, expected: testCase.expected }));
}

/**
 * Behavioural probes for a mission. Rotation is on unless the mission declares
 * `constraints.rotationInvariant: false` (e.g. a full-tie "earlier index wins"
 * rule, where rotating the input legitimately changes the answer).
 */
export function probeSettings(mission: Mission): {
  mutation: boolean;
  determinism: boolean;
  rotation: boolean;
} {
  return {
    mutation: mission.constraints.mustNotMutate,
    determinism: true,
    rotation: mission.constraints.rotationInvariant !== false,
  };
}
