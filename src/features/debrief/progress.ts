/**
 * How far along the debrief is: which required answers are still empty.
 *
 * Pure on purpose. It only reads what the player has already entered; it never
 * grades anything, and the reasoning score is still computed by the reducer.
 */

export interface ProgressInput {
  /** Item ids of the structured explanation, or null for a free-text mission. */
  structured: { blanks: readonly string[]; questions: readonly string[] } | null;
  complexityAnswered: boolean;
  reasoning: string;
  explainAnswers: {
    blanks: Readonly<Record<string, number>>;
    questions: Readonly<Record<string, number>>;
  };
}

/** Identifies one answerable item: `complexity`, `blank:<id>`, `question:<id>` or `reasoning`. */
export type AnswerKey = string;

export interface SectionProgress {
  answered: number;
  total: number;
}

export interface DebriefProgress {
  answered: number;
  total: number;
  complete: boolean;
  cost: SectionProgress;
  explain: SectionProgress;
  firstMissing: AnswerKey | null;
}

export function debriefProgress(input: ProgressInput): DebriefProgress {
  const items: { key: AnswerKey; done: boolean; section: 'cost' | 'explain' }[] = [
    { key: 'complexity', done: input.complexityAnswered, section: 'cost' },
  ];

  if (input.structured !== null) {
    for (const id of input.structured.blanks) {
      items.push({
        key: `blank:${id}`,
        done: input.explainAnswers.blanks[id] !== undefined,
        section: 'explain',
      });
    }
    for (const id of input.structured.questions) {
      items.push({
        key: `question:${id}`,
        done: input.explainAnswers.questions[id] !== undefined,
        section: 'explain',
      });
    }
  } else {
    items.push({ key: 'reasoning', done: input.reasoning.trim().length > 0, section: 'explain' });
  }

  const count = (section: 'cost' | 'explain'): SectionProgress => {
    const own = items.filter((item) => item.section === section);
    return { answered: own.filter((item) => item.done).length, total: own.length };
  };

  const answered = items.filter((item) => item.done).length;
  return {
    answered,
    total: items.length,
    complete: answered === items.length,
    cost: count('cost'),
    explain: count('explain'),
    firstMissing: items.find((item) => !item.done)?.key ?? null,
  };
}

export function missingLabel(missing: number): string {
  return missing === 1 ? 'Te falta 1 respuesta' : `Te faltan ${missing} respuestas`;
}
