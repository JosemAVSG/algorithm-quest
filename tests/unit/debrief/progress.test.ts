import { describe, expect, it } from 'vitest';

import {
  debriefProgress,
  missingLabel,
  type ProgressInput,
} from '../../../src/features/debrief/progress';

const spec = {
  blanks: ['a', 'b'],
  questions: ['q'],
};

function input(overrides: Partial<ProgressInput> = {}): ProgressInput {
  return {
    structured: { blanks: spec.blanks, questions: spec.questions },
    complexityAnswered: false,
    reasoning: '',
    explainAnswers: { blanks: {}, questions: {} },
    ...overrides,
  };
}

describe('debriefProgress (structured)', () => {
  it('counts complexity plus every blank and question as required', () => {
    const progress = debriefProgress(input());
    expect(progress.total).toBe(4);
    expect(progress.answered).toBe(0);
    expect(progress.complete).toBe(false);
    expect(progress.firstMissing).toBe('complexity');
  });

  it('tracks answered items per section and the first unanswered one', () => {
    const progress = debriefProgress(
      input({
        complexityAnswered: true,
        explainAnswers: { blanks: { a: 0 }, questions: {} },
      }),
    );
    expect(progress.answered).toBe(2);
    expect(progress.cost).toEqual({ answered: 1, total: 1 });
    expect(progress.explain).toEqual({ answered: 1, total: 3 });
    expect(progress.firstMissing).toBe('blank:b');
  });

  it('treats index 0 as answered and is complete when everything is set', () => {
    const progress = debriefProgress(
      input({
        complexityAnswered: true,
        explainAnswers: { blanks: { a: 0, b: 0 }, questions: { q: 0 } },
      }),
    );
    expect(progress.complete).toBe(true);
    expect(progress.firstMissing).toBeNull();
  });
});

describe('debriefProgress (free text)', () => {
  it('requires non-blank reasoning instead of explain items', () => {
    const base = input({ structured: null, complexityAnswered: true });
    expect(debriefProgress({ ...base, reasoning: '   ' }).firstMissing).toBe('reasoning');
    const done = debriefProgress({ ...base, reasoning: 'comparo y devuelvo' });
    expect(done.complete).toBe(true);
    expect(done.total).toBe(2);
  });
});

describe('missingLabel', () => {
  it('pluralises in Spanish', () => {
    expect(missingLabel(1)).toBe('Te falta 1 respuesta');
    expect(missingLabel(3)).toBe('Te faltan 3 respuestas');
  });
});
