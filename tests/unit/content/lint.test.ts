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

function assemble(records: Draft[]) {
  return assembleContent({
    missionRecords: records.map((data, index) => ({ source: `m${index}.json`, data })),
    concepts: conceptsRegistry(),
    workshop: workshopRegistry(),
    worlds: worldsRegistry(records.map((record) => record.id)),
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

describe('lint L1 — the pattern name must not appear in the briefing', () => {
  it('catches a forbidden term', () => {
    const mission = broken(validMission(), (draft) => {
      draft.briefing.forbiddenVocabulary = ['Set'];
      draft.briefing.body = 'Guarda los ids en un Set y listo.';
    });
    expect(codes(assemble([mission]).issues)).toContain('L1_VOCABULARY_LEAK');
  });

  it('matches case- and accent-insensitively', () => {
    const mission = broken(validMission(), (draft) => {
      draft.briefing.forbiddenVocabulary = ['LÍMITE'];
      draft.briefing.body = 'El limite seguro son 90 grados.';
    });
    expect(codes(assemble([mission]).issues)).toContain('L1_VOCABULARY_LEAK');
  });

  it('does not fire when the term is absent', () => {
    const mission = broken(validMission(), (draft) => {
      draft.briefing.forbiddenVocabulary = ['Set', 'hash'];
    });
    expect(codes(assemble([mission]).issues)).not.toContain('L1_VOCABULARY_LEAK');
  });
});

describe('lint L2 — concept budget', () => {
  it('rejects two secondary concepts', () => {
    const mission = broken(validMission(), (draft) => {
      draft.concepts.secondary = ['C02', 'C01'];
    });
    expect(codes(assemble([mission]).issues)).toContain('L2_CONCEPT_BUDGET');
  });
});

describe('lint L3 — optimization before measurement', () => {
  it('rejects an enforced budget with no prior functional mission', () => {
    const mission = broken(validMission(), (draft) => {
      draft.constraints.efficiency = { budgetMs: 5, calibrated: true, enforced: true };
    });
    expect(codes(assemble([mission]).issues)).toContain('L3_OPTIMIZATION_ORDER');
  });

  it('accepts an enforced budget after the same pattern was taught without one', () => {
    const second = broken(secondMission(), (draft) => {
      draft.constraints.efficiency = { budgetMs: 5, calibrated: true, enforced: true };
    });
    expect(codes(assemble([validMission(), second]).issues)).not.toContain(
      'L3_OPTIMIZATION_ORDER',
    );
  });
});

describe('lint L4 — the reward must be a legal repair', () => {
  it('rejects an impossible transition', () => {
    const mission = broken(validMission(), (draft) => {
      draft.workshop.to = 'reliable';
      draft.reward.effect = 'broken → reliable';
    });
    expect(codes(assemble([mission]).issues)).toContain('L4_REWARD_TRANSITION');
  });

  it('rejects an effect string that disagrees with the structured fields', () => {
    const mission = broken(validMission(), (draft) => {
      draft.reward.effect = 'broken → reliable';
    });
    expect(codes(assemble([mission]).issues)).toContain('L4_REWARD_TRANSITION');
  });

  it('rejects a mission that starts from a state the workshop is not in', () => {
    const second = broken(secondMission(), (draft) => {
      draft.workshop = { systemId: 'sys.sensor', from: 'broken', to: 'working' };
      draft.reward = {
        systemId: 'sys.sensor',
        effect: 'broken → working',
        narrative: 'Reparado otra vez.',
      };
    });
    expect(codes(assemble([validMission(), second]).issues)).toContain(
      'L4_REWARD_TRANSITION',
    );
  });
});

describe('lint L5 — the last rung must not hand over the answer', () => {
  it('rejects a level-4 hint that names the entry point', () => {
    const mission = broken(validMission(), (draft) => {
      draft.hints[3].text =
        'Escribe isOverLimit y compara con >. Con 90 y 90 devuelve false, así que copia esa idea.';
    });
    expect(codes(assemble([mission]).issues)).toContain('L5_HINT_LADDER');
  });

  it('rejects a free level-4 hint', () => {
    const mission = broken(validMission(), (draft) => {
      delete draft.hints[3].unlock;
    });
    expect(codes(assemble([mission]).issues)).toContain('L5_HINT_LADDER');
  });
});

describe('lint L6 — hidden tests must be independent', () => {
  it('rejects a hidden test that repeats a visible input', () => {
    const mission = broken(validMission(), (draft) => {
      draft.tests.hidden[0].input = [95, 90];
    });
    expect(codes(assemble([mission]).issues)).toContain('L6_TEST_INDEPENDENCE');
  });

  it('rejects an edge test that repeats a visible input', () => {
    const mission = broken(validMission(), (draft) => {
      draft.tests.edge[0].input = [85, 90];
    });
    expect(codes(assemble([mission]).issues)).toContain('L6_TEST_INDEPENDENCE');
  });
});

describe('lint L7 — edge coverage must be declared', () => {
  it('rejects an edge test without a kind', () => {
    const mission = broken(validMission(), (draft) => {
      delete draft.tests.edge[1].edgeKind;
    });
    expect(codes(assemble([mission]).issues)).toContain('L7_EDGE_COVERAGE');
  });

  it('rejects two edge tests that test the same kind of thing', () => {
    const mission = broken(validMission(), (draft) => {
      draft.tests.edge[1].edgeKind = 'boundary-equal';
    });
    expect(codes(assemble([mission]).issues)).toContain('L7_EDGE_COVERAGE');
  });
});

describe('lint L8 — the debrief must teach', () => {
  it('rejects placeholder text', () => {
    const mission = broken(validMission(), (draft) => {
      draft.debrief.realWorld = 'TODO: escribir un ejemplo real de esto más adelante.';
    });
    expect(codes(assemble([mission]).issues)).toContain('L8_DEBRIEF_SUBSTANCE');
  });
});

describe('lint L9 — a structured explanation must be coherent', () => {
  const explain = () => ({
    prompt: 'Completa la explicación.',
    template: 'Comparo {a} y {b}.',
    blanks: [
      { id: 'a', options: ['uno', 'dos', 'tres'], correctIndex: 0 },
      { id: 'b', options: ['uno', 'dos', 'tres'], correctIndex: 1 },
    ],
    questions: [
      { id: 'q', question: '¿Por qué?', options: ['x', 'y', 'z'], correctIndex: 2, explanation: 'Porque z.' },
    ],
  });

  it('accepts a coherent explain block', () => {
    const mission = broken(validMission(), (draft) => {
      draft.debrief.explain = explain();
    });
    expect(codes(assemble([mission]).issues)).not.toContain('L9_EXPLAIN_SHAPE');
  });

  it('rejects a correctIndex outside the options', () => {
    const mission = broken(validMission(), (draft) => {
      const block = explain();
      block.questions[0]!.correctIndex = 7;
      draft.debrief.explain = block;
    });
    expect(codes(assemble([mission]).issues)).toContain('L9_EXPLAIN_SHAPE');
  });

  it('rejects a placeholder with no blank', () => {
    const mission = broken(validMission(), (draft) => {
      const block = explain();
      block.template = 'Comparo {a} y {zz}.';
      draft.debrief.explain = block;
    });
    expect(codes(assemble([mission]).issues)).toContain('L9_EXPLAIN_SHAPE');
  });
});
