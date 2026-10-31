/**
 * The optional AI reasoning layer (docs/04-mentor.md §6).
 *
 * The MVP does not call a model (D4). These two functions exist anyway because
 * the contract around the model is the part that must be deterministic: the
 * score cap and the invalid-JSON fallback are testable today, with no provider,
 * no network and no key.
 *
 * The rule that matters is the cap. Without it an agreeable model becomes a way
 * to skip the only step that distinguishes this product from a judge.
 */

import type { ReasoningScore } from './reasoning';

export interface AiReasoning {
  score: ReasoningScore;
  missing: string[];
  followUp: string;
}

/**
 * Parse an AI response, or return null when it is not exactly the documented
 * shape. Null means "use the deterministic path", never "retry" and never an
 * error the player can see (docs/04 §6, constraint 1; §8).
 */
export function parseAiReasoning(raw: unknown): AiReasoning | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const record = raw as Record<string, unknown>;
  const score = record.score;
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 3) {
    return null;
  }

  const missing = record.missing;
  if (missing !== undefined && !Array.isArray(missing)) return null;
  if (Array.isArray(missing) && !missing.every((entry) => typeof entry === 'string')) {
    return null;
  }

  if (typeof record.followUp !== 'string') return null;

  return {
    score: score as ReasoningScore,
    missing: (missing as string[] | undefined) ?? [],
    followUp: record.followUp,
  };
}

/**
 * Combine the deterministic score with an advisory AI score.
 *
 * The AI may reward nuance (+1) and may never lower the deterministic verdict,
 * because the heuristic is the floor this product can defend in a test.
 */
export function combineReasoningScore(
  deterministic: ReasoningScore,
  ai: AiReasoning | null,
): ReasoningScore {
  if (ai === null) return deterministic;
  const capped = Math.min(ai.score, deterministic + 1, 3);
  return Math.max(deterministic, capped) as ReasoningScore;
}
