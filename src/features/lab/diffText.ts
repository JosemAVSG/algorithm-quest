/**
 * Where two rendered values first differ, so the lab can point at it instead of
 * leaving the player to compare two long lists by eye.
 */

export interface DiffParts {
  same: string;
  /** The rest of the text from the first difference on (empty when identical). */
  rest: string;
}

/** Split `text` into the part it shares with `other` and the rest. */
export function splitAtFirstDifference(text: string, other: string): DiffParts {
  let i = 0;
  const limit = Math.min(text.length, other.length);
  while (i < limit && text[i] === other[i]) i += 1;
  // Back up to the start of the token, so `12` vs `13` marks the whole number.
  while (i > 0 && i < text.length && /[\w.-]/.test(text[i - 1]!) && /[\w.-]/.test(text[i]!)) i -= 1;
  return { same: text.slice(0, i), rest: text.slice(i) };
}
