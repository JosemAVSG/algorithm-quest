import { describe, expect, it } from 'vitest';

import { assembleContent } from '../../../src/domain/content/assemble';
import type { ContentIssue } from '../../../src/domain/content/errors';
import {
  broken,
  conceptsRegistry,
  reinforcementRegistry,
  validMission,
  workshopRegistry,
  worldsRegistry,
  type Draft,
} from '../../support/fixtures';

function codes(issues: readonly ContentIssue[]): string[] {
  return issues.map((issue) => issue.code);
}

function assemble(records: Draft[], worlds?: unknown) {
  return assembleContent({
    missionRecords: records.map((data, index) => ({ source: `m${index}.json`, data })),
    concepts: conceptsRegistry(),
    workshop: workshopRegistry(),
    worlds: worlds ?? worldsRegistry(records.map((record) => record.id)),
    reinforcement: reinforcementRegistry(),
  });
}

/** A second mission that continues the workshop from where M01 left it. */
function secondMission(): Draft {
  return broken(validMission(), (mission) => {
    mission.id = 'M02';
    mission.order = 2;
    mission.workshop = { systemId: 'sys.sensor', from: 'working', to: 'reliable' };
    mission.reward = {
      systemId: 'sys.sensor',
      effect: 'working → reliable',
      narrative: 'El sensor ahora es fiable.',
    };
    mission.mastery = { transferMissionId: 'M01', reinforcementVariants: [] };
  });
}

describe('referential validation — V8..V12', () => {
  it('accepts two missions that chain correctly', () => {
    const report = assemble([validMission(), secondMission()]);
    expect(report.issues).toEqual([]);
  });

  it('V8 rejects a prerequisite that does not exist', () => {
    const second = broken(secondMission(), (mission) => {
      mission.prerequisites.missions = ['M99'];
    });
    expect(codes(assemble([validMission(), second]).issues)).toContain('REF_PREREQ');
  });

  it('V8 rejects a mission that lists itself', () => {
    const second = broken(secondMission(), (mission) => {
      mission.prerequisites.missions = ['M02'];
    });
    expect(codes(assemble([validMission(), second]).issues)).toContain('REF_PREREQ');
  });

  it('V8 rejects a prerequisite that comes later in play order', () => {
    const first = broken(validMission(), (mission) => {
      mission.prerequisites.missions = ['M02'];
    });
    expect(codes(assemble([first, secondMission()]).issues)).toContain('REF_PREREQ');
  });

  it('V9 rejects a concept absent from the registry', () => {
    const mission = broken(validMission(), (draft) => {
      draft.concepts.secondary = ['C99'];
    });
    expect(codes(assemble([mission]).issues)).toContain('REF_CONCEPT');
  });

  it('V10 rejects a workshop system absent from the workshop', () => {
    const mission = broken(validMission(), (draft) => {
      draft.workshop.systemId = 'sys.nope';
      draft.reward.systemId = 'sys.nope';
    });
    expect(codes(assemble([mission]).issues)).toContain('REF_SYSTEM');
  });

  it('V11 reports a prerequisite cycle once, not once per edge', () => {
    const first = broken(validMission(), (draft) => {
      draft.prerequisites.missions = ['M02'];
    });
    const second = broken(secondMission(), (draft) => {
      draft.prerequisites.missions = ['M01'];
    });
    const cycleIssues = assemble([first, second]).issues.filter(
      (issue) => issue.code === 'REF_CYCLE',
    );
    expect(cycleIssues).toHaveLength(1);
    expect(cycleIssues[0]?.message).toContain('M01');
  });

  it('V12 rejects a reward for a different system than the one repaired', () => {
    const mission = broken(validMission(), (draft) => {
      draft.reward.systemId = 'sys.line';
    });
    expect(codes(assemble([mission]).issues)).toContain('REF_REWARD_MISMATCH');
  });

  it('rejects two files claiming the same mission id', () => {
    expect(codes(assemble([validMission(), validMission()]).issues)).toContain(
      'REF_DUP_MISSION',
    );
  });

  it('rejects a mission that no world lists', () => {
    const report = assemble([validMission(), secondMission()], worldsRegistry(['M01']));
    expect(codes(report.issues)).toContain('REF_WORLD');
  });

  it('rejects an order that disagrees with the world listing', () => {
    const report = assemble(
      [validMission(), secondMission()],
      worldsRegistry(['M02', 'M01']),
    );
    expect(codes(report.issues)).toContain('REF_WORLD_ORDER');
  });

  it('rejects a world marked complete whose missions have no files', () => {
    const report = assemble(
      [validMission()],
      worldsRegistry(['M01', 'M02'], 'complete'),
    );
    expect(codes(report.issues)).toContain('WORLD_INCOMPLETE');
  });
});
