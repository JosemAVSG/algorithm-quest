/**
 * The reasoning rubric (docs/04-mentor.md §6): 0–3, deterministic, free.
 *
 * It is crude and it says so. The alternative — an LLM grading free text — is
 * unavailable in the MVP (D4) and would be unverifiable in a test, which for a
 * product whose only defence is testability is not a trade worth making.
 *
 * The score never blocks correctness. It feeds one of four dimensions in the
 * mastery formula and the debrief's own feedback.
 */

import type { Mission } from '../content/schema';
import type { Diagnosis } from '../diagnosis/taxonomy';

export type ReasoningScore = 0 | 1 | 2 | 3;

/** docs/05 §7 / docs/10 §3.1 — tests alone never complete a mission. */
export const REASONING_MIN_SCORE: ReasoningScore = 2;

export interface ReasoningAssessment {
  score: ReasoningScore;
  /** What the player did include, for the debrief's feedback line. */
  matchedMechanism: boolean;
  matchedObjective: boolean;
  matchedCost: boolean;
  /** True when the answer was too short to judge at all. */
  tooShort: boolean;
  /** True when the answer is a restatement of "it works". */
  restatesResult: boolean;
}

/**
 * Refusals only. `no sé` is deliberately absent: the normalised text also
 * contains "no se dispara" and "no se cumple", which are correct explanations,
 * not give-ups. A bare refusal is caught by the length check below.
 */
const GIVE_UP_PATTERNS = [
  'porque funciona',
  'porque pasa los tests',
  'porque pasa las pruebas',
  'no lo se',
];

const COST_MARKERS = ['o(', 'complejidad', 'recorrer dos veces', 'podria', 'en cambio', 'coste'];

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function mentions(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(fold(term)));
}

export function assessReasoning(mission: Mission, answer: string): ReasoningAssessment {
  const text = fold(answer.trim());

  const tooShort = text.length < 20;
  const restatesResult = GIVE_UP_PATTERNS.some((pattern) => text.includes(pattern));

  const matchedMechanism = mentions(text, mission.debrief.reasoningLexicon);
  const matchedObjective = mentions(text, mission.debrief.objectiveNouns);
  const matchedCost = mentions(text, COST_MARKERS);

  const base = { matchedMechanism, matchedObjective, matchedCost, tooShort, restatesResult };

  if (tooShort || restatesResult) return { ...base, score: 0 };

  if (matchedMechanism && matchedObjective && text.length >= 40) {
    return { ...base, score: matchedCost ? 3 : 2 };
  }

  if (matchedMechanism) return { ...base, score: 1 };

  return { ...base, score: 0 };
}

/**
 * E17: the tests pass but the explanation does not reach the rubric (docs/04
 * §3 step 9). It is a diagnosis about the *debrief*, not about the code, which
 * is why it is not produced by the classifier: the classifier never sees the
 * reasoning text.
 */
export function reasoningDiagnosis(
  mission: Mission,
  answer: string,
): { assessment: ReasoningAssessment; diagnosis: Diagnosis | null } {
  const assessment = assessReasoning(mission, answer);
  if (assessment.score >= REASONING_MIN_SCORE) return { assessment, diagnosis: null };

  return {
    assessment,
    diagnosis: {
      code: 'E17',
      confidence: 'certain',
      evidence: {
        failingTestIds: [],
        message:
          'Las pruebas pasan, pero la explicación todavía no justifica por qué el mecanismo cumple el objetivo. Nombra qué recorres, qué comparas y qué pasa en el caso límite.',
      },
      modifiers: [],
    },
  };
}
