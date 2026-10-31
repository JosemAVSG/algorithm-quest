import { describe, expect, it } from 'vitest';

import { assembleContent } from '../../../src/domain/content/assemble';
import type { ContentIssue } from '../../../src/domain/content/errors';
import { buildSequence, checkCoverage, checkWorlds } from '../../../src/domain/content/coverage';
import type { Concept, Mission, World } from '../../../src/domain/content/schema';
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

describe('coverage — the curriculum invariant', () => {
  it('stays silent while the world is in progress', () => {
    const report = assemble([validMission()]);
    expect(codes(report.issues)).not.toContain('COVERAGE_INSUFFICIENT');
  });

  it('passes a complete world where every concept is taught twice', () => {
    const report = assemble([validMission(), secondMission()], worldsRegistry(['M01', 'M02'], 'complete'));
    expect(codes(report.issues)).not.toContain('COVERAGE_INSUFFICIENT');
  });

  it('fails when a concept is retagged out of a mission', () => {
    const second = broken(secondMission(), (mission) => {
      mission.concepts.secondary = [];
    });
    const report = assemble([validMission(), second], worldsRegistry(['M01', 'M02'], 'complete'));
    expect(codes(report.issues)).toContain('COVERAGE_INSUFFICIENT');
  });

  it('reports which concept lost its second appearance', () => {
    const second = broken(secondMission(), (mission) => {
      mission.concepts.secondary = [];
    });
    const report = assemble([validMission(), second], worldsRegistry(['M01', 'M02'], 'complete'));
    const coverageIssue = report.issues.find((issue) => issue.code === 'COVERAGE_INSUFFICIENT');
    expect(coverageIssue?.message).toContain('C02');
  });
});

describe('checkWorlds / buildSequence', () => {
  it('builds a global sequence across worlds, not a per-world order', () => {
    const worlds = worldsRegistry(['M01', 'M02']).worlds as World[];
    worlds.push({ id: 'w2', name: 'World 2', status: 'planned', missionIds: ['M03'] });
    const sequence = buildSequence(worlds);
    expect(sequence.get('M01')).toBe(0);
    expect(sequence.get('M02')).toBe(1);
    expect(sequence.get('M03')).toBe(2);
  });

  it('rejects a mission listed twice', () => {
    const worlds = worldsRegistry(['M01', 'M01']).worlds as World[];
    const report = checkWorlds([], worlds);
    expect(codes(report)).toContain('REF_WORLD');
  });
});

describe('checkCoverage in isolation', () => {
  it('counts a concept once per mission even when both roles mention it', () => {
    const concepts: Concept[] = [
      { id: 'C01', label: 'Condición', world: 'w1', mvp: true },
    ];
    const mission = { concepts: { primary: 'C01', secondary: ['C01'] } } as unknown as Mission;
    const worlds: World[] = [
      { id: 'w1', name: 'World 1', status: 'complete', missionIds: ['M01'] },
    ];
    const issues = checkCoverage([mission], worlds, concepts);
    expect(codes(issues)).toContain('COVERAGE_INSUFFICIENT');
  });
});
