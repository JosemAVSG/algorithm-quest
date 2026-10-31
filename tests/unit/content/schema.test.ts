import { describe, expect, it } from 'vitest';

import type { ContentIssue } from '../../../src/domain/content/errors';
import { validateMissionShape } from '../../../src/domain/content/validate';
import { broken, validMission, type Draft } from '../../support/fixtures';

function codes(issues: readonly ContentIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

function validate(draft: Draft) {
  return validateMissionShape(draft, 'fixture.json');
}

describe('validateMissionShape — V1..V7', () => {
  it('accepts a complete mission with no issues', () => {
    const result = validate(validMission());
    expect(result.issues).toEqual([]);
    expect(result.mission).not.toBeNull();
  });

  it('V1 rejects unknown keys instead of ignoring them', () => {
    const draft = broken(validMission(), (mission) => {
      mission.xpReward = 50;
    });
    const result = validate(draft);
    expect(result.mission).toBeNull();
    expect(codes(result.issues)).toContain('SCHEMA_UNKNOWN_KEY');
  });

  it('V1 rejects unknown keys nested inside a section', () => {
    const draft = broken(validMission(), (mission) => {
      mission.contract.timeLimitMs = 500;
    });
    expect(codes(validate(draft).issues)).toContain('SCHEMA_UNKNOWN_KEY');
  });

  it('accepts a known briefing.visual id and treats it as optional', () => {
    const withVisual = broken(validMission(), (mission) => {
      mission.briefing.visual = 'early-exit-scan';
    });
    expect(validate(withVisual).issues).toEqual([]);
    expect(validate(validMission()).issues).toEqual([]);
  });

  it('rejects an unknown briefing.visual id', () => {
    const draft = broken(validMission(), (mission) => {
      mission.briefing.visual = 'hologram';
    });
    const result = validate(draft);
    expect(result.mission).toBeNull();
    expect(codes(result.issues)).toContain('SCHEMA_INVALID');
  });

  it('V2 rejects an id that is not M##', () => {
    const draft = broken(validMission(), (mission) => {
      mission.id = 'mission-1';
    });
    expect(codes(validate(draft).issues)).toContain('SCHEMA_BAD_ID');
  });

  it('V3 rejects a starterCode that never declares the entry point', () => {
    const draft = broken(validMission(), (mission) => {
      mission.contract.entryPoint = 'shouldAlarm';
    });
    expect(codes(validate(draft).issues)).toContain('SCHEMA_NO_ENTRY');
  });

  it('V3 allows an empty starterCode — choosing the structure is the task', () => {
    const draft = broken(validMission(), (mission) => {
      mission.starterCode = '';
    });
    expect(validate(draft).issues).toEqual([]);
  });

  it('V4 rejects a test id reused across groups', () => {
    const draft = broken(validMission(), (mission) => {
      mission.tests.hidden[0].id = 'v1';
    });
    expect(codes(validate(draft).issues)).toContain('SCHEMA_DUP_TEST_ID');
  });

  it('V5 rejects three hints — the ladder was never designed', () => {
    const draft = broken(validMission(), (mission) => {
      mission.hints.pop();
    });
    expect(codes(validate(draft).issues)).toContain('SCHEMA_HINTS');
  });

  it('V5 rejects a ladder whose levels are out of order', () => {
    const draft = broken(validMission(), (mission) => {
      mission.hints[1].level = 3;
    });
    expect(codes(validate(draft).issues)).toContain('SCHEMA_HINTS');
  });

  it('V6 rejects a correctIndex outside the options', () => {
    const draft = broken(validMission(), (mission) => {
      mission.debrief.complexity.correctIndex = 2;
    });
    expect(codes(validate(draft).issues)).toContain('SCHEMA_BAD_INDEX');
  });

  it('V7 rejects an expected value that contradicts outputShape', () => {
    const draft = broken(validMission(), (mission) => {
      mission.tests.visible[0].expected = 'true';
    });
    expect(codes(validate(draft).issues)).toContain('SCHEMA_OUTPUT_SHAPE');
  });

  it('V7 rejects a non-finite number, which is not JSON', () => {
    const draft = broken(validMission(), (mission) => {
      mission.tests.visible[0].expected = Number.POSITIVE_INFINITY;
    });
    expect(codes(validate(draft).issues)).toContain('SCHEMA_OUTPUT_SHAPE');
  });

  it('V7 warns instead of guessing when outputShape is prose', () => {
    const draft = broken(validMission(), (mission) => {
      mission.contract.outputShape = 'number pair, or null';
    });
    const issues = validate(draft).issues;
    const shapeIssue = issues.find((issue) => issue.code === 'SCHEMA_OUTPUT_SHAPE');
    expect(shapeIssue?.severity).toBe('warning');
  });

  it('requires edge tests to be flagged, or the robustness signal is lost', () => {
    const draft = broken(validMission(), (mission) => {
      delete mission.tests.edge[0].edge;
    });
    expect(codes(validate(draft).issues)).toContain('SCHEMA_INVALID');
  });

  it('rejects a diagnostic that targets a test id that does not exist', () => {
    const draft = broken(validMission(), (mission) => {
      mission.diagnostics[0].when.failingTestIds = ['v9'];
    });
    expect(codes(validate(draft).issues)).toContain('SCHEMA_INVALID');
  });
});
