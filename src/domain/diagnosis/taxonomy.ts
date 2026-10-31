/**
 * The error taxonomy (docs/04-mentor.md §2) and the shapes the mentor passes
 * around (§9).
 *
 * The full taxonomy is declared here because other documents and missions refer
 * to these codes by name. Milestone 3 produces every code the engine can
 * observe from an attempt: E01–E15 and E17–E22. E16 (inefficiency) is the one
 * exception, and it stays declared rather than faked: it needs a calibrated
 * operation budget, which is still an open decision (`08` §6, D12/D13).
 * Adding a code means adding a rule and a test, never just widening this union.
 */

export const ERROR_CODES = [
  'E01',
  'E02',
  'E03',
  'E04',
  'E05',
  'E06',
  'E07',
  'E08',
  'E09',
  'E10',
  'E11',
  'E12',
  'E13',
  'E14',
  'E15',
  'E16',
  'E17',
  'E18',
  'E19',
  'E20',
  'E21',
  'E22',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Not an error: the code is correct and nothing is wrong with it. */
export type DiagnosisCode = ErrorCode | 'E_UNKNOWN' | 'CLEAR';

export const MODIFIERS = [
  'NO_PROGRESS',
  'REPEAT',
  'LOW_ATTEMPT',
  'STRUGGLING',
  'POST_HINT',
] as const;

export type Modifier = (typeof MODIFIERS)[number];

export interface DiagnosisEvidence {
  failingTestIds: string[];
  actual?: unknown;
  expected?: unknown;
  /** The input of the first failing case, for the smaller-input modality. */
  input?: unknown[];
  line?: number;
  message?: string;
}

export interface Diagnosis {
  code: DiagnosisCode;
  confidence: 'certain' | 'likely';
  evidence: DiagnosisEvidence;
  modifiers: Modifier[];
}

export type HintLevel = 1 | 2 | 3 | 4;

/**
 * The representation the intervention uses (docs/04 §5).
 *
 * `trace` is deliberately absent. A trace table needs `condition` and
 * `accumulator` per iteration, and the one-message worker protocol plus a read
 * `Proxy` only yields `(index, value)` (the same gap M2 documented). Rather
 * than render a table with two empty columns, M3 switches to a smaller input:
 * it is a genuine change of representation, and every value it shows is real.
 */
export type Modality = 'prose' | 'smaller_input' | 'worked_variant';

export interface Intervention {
  diagnosis: Diagnosis;
  /** One neutral sentence. Never accusatory, never congratulatory. */
  headline: string;
  /** The authored hint text for this level, or the mechanical fault for E01/E02. */
  body: string;
  nextAction: 'edit' | 'trace' | 'answer_reasoning' | 'retry';
  revealSolutionOffered: boolean;
  level: HintLevel;
}

/** Codes whose explanation is immediate and complete, bypassing the ladder. */
export const IMMEDIATE_CODES: readonly DiagnosisCode[] = ['E01', 'E02'];

/**
 * Codes the engine produces from an attempt (M3). E16 is the single declared
 * gap; see the file header. Authored diagnostics can additionally produce the
 * refinement codes (E05, E06, E09, E21) from a named failing-test signature.
 */
export const PRODUCED_CODES: readonly ErrorCode[] = [
  'E01',
  'E02',
  'E03',
  'E04',
  'E05',
  'E06',
  'E07',
  'E08',
  'E09',
  'E10',
  'E11',
  'E12',
  'E13',
  'E14',
  'E15',
  'E17',
  'E18',
  'E19',
  'E20',
  'E21',
  'E22',
];
