import { describe, expect, it } from 'vitest';

import { probeSettings } from '../../../src/domain/evaluation/cases';
import { validateMissionShape } from '../../../src/domain/content/validate';
import { broken, validMission } from '../../support/fixtures';

function load(rotationInvariant?: unknown) {
  const draft = broken(validMission(), (mission) => {
    if (rotationInvariant !== undefined) mission.constraints.rotationInvariant = rotationInvariant;
  });
  return validateMissionShape(draft, 'fixture.json');
}

describe('constraints.rotationInvariant', () => {
  it('defaults to probing rotation', () => {
    const { mission, issues } = load();
    expect(issues).toEqual([]);
    expect(probeSettings(mission!).rotation).toBe(true);
  });

  it('accepts false and switches the rotation probe off', () => {
    const { mission, issues } = load(false);
    expect(issues).toEqual([]);
    expect(probeSettings(mission!)).toEqual({
      mutation: false,
      determinism: true,
      rotation: false,
    });
  });

  it('rejects a non-boolean value', () => {
    expect(load('no').mission).toBeNull();
  });
});
