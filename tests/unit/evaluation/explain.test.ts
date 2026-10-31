import { describe, expect, it } from 'vitest';

import type { ExplainSpec } from '../../../src/domain/content/schema';
import {
  assessExplain,
  explainScore,
  parseTemplate,
  validateExplainSpec,
} from '../../../src/domain/evaluation/explain';

const SPEC: ExplainSpec = {
  prompt: 'Completa la explicación.',
  template: 'Recorro {b1} y, si {b2}, devuelvo {b3}.',
  blanks: [
    { id: 'b1', options: ['la lista', 'un solo sensor', 'el límite'], correctIndex: 0 },
    { id: 'b2', options: ['hay fallo', 'no hay fallo', 'termina'], correctIndex: 0 },
    { id: 'b3', options: ['false', 'true', 'nada'], correctIndex: 1 },
  ],
  questions: [
    {
      id: 'q1',
      question: '¿Por qué?',
      options: ['A', 'B', 'C'],
      correctIndex: 2,
      whyWrong: ['Razón A', '', 'no aplica'],
      explanation: 'Porque C.',
    },
  ],
};

const RIGHT = { blanks: { b1: 0, b2: 0, b3: 1 }, questions: { q1: 2 } };

describe('parseTemplate', () => {
  it('splits text and blank placeholders in order', () => {
    expect(parseTemplate('a {x} b {y}.')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'blank', id: 'x' },
      { kind: 'text', text: ' b ' },
      { kind: 'blank', id: 'y' },
      { kind: 'text', text: '.' },
    ]);
  });
});

describe('assessExplain', () => {
  it('passes when everything is correct', () => {
    const result = assessExplain(SPEC, RIGHT);
    expect(result).toMatchObject({ passed: true, wrong: {}, missing: [] });
  });

  it('reports unanswered items as missing, not wrong', () => {
    const result = assessExplain(SPEC, { blanks: { b1: 0 }, questions: {} });
    expect(result.passed).toBe(false);
    expect(result.missing).toEqual(['b2', 'b3', 'q1']);
    expect(result.wrong).toEqual({});
  });

  it('flags wrong items with the submitted index, without exposing the answer', () => {
    const result = assessExplain(SPEC, {
      blanks: { b1: 1, b2: 0, b3: 1 },
      questions: { q1: 0 },
    });
    expect(result.passed).toBe(false);
    expect(result.wrong).toEqual({ b1: 1, q1: 0 });
    expect(JSON.stringify(result)).not.toContain('correctIndex');
  });
});

describe('explainScore', () => {
  it('is 3 on the first submission and 2 after retries, never below the gate', () => {
    expect(explainScore(0)).toBe(3);
    expect(explainScore(1)).toBe(2);
    expect(explainScore(9)).toBe(2);
  });
});

describe('validateExplainSpec', () => {
  it('accepts a coherent spec', () => {
    expect(validateExplainSpec(SPEC)).toEqual([]);
  });

  it('rejects a placeholder without a blank and a blank without a placeholder', () => {
    const spec = { ...SPEC, template: 'Recorro {b1} y {zz}, devuelvo {b3}.' };
    const problems = validateExplainSpec(spec).join('\n');
    expect(problems).toContain('zz');
    expect(problems).toContain('b2');
  });

  it('rejects out-of-range correctIndex and duplicated options', () => {
    const spec: ExplainSpec = {
      ...SPEC,
      blanks: [
        { id: 'b1', options: ['x', 'y', 'z'], correctIndex: 3 },
        { id: 'b2', options: ['x', 'X', 'z'], correctIndex: 0 },
        SPEC.blanks[2]!,
      ],
    };
    const problems = validateExplainSpec(spec).join('\n');
    expect(problems).toContain('b1');
    expect(problems).toContain('b2');
  });

  it('rejects duplicate ids and a whyWrong that does not match options', () => {
    const spec: ExplainSpec = {
      ...SPEC,
      questions: [{ ...SPEC.questions[0]!, id: 'b1', whyWrong: ['solo una'] }],
    };
    const problems = validateExplainSpec(spec).join('\n');
    expect(problems).toContain('duplicate');
    expect(problems).toContain('whyWrong');
  });
});
