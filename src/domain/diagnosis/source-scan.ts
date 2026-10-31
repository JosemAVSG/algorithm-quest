/**
 * Static checks over the player's source (docs/04-mentor.md §2, E13/E19/E20/E22).
 *
 * These are pedagogical, never security controls (docs/08 §7). They exist to
 * name a mechanical fault the test diff cannot show, and they are deliberately
 * conservative: a check that fires on a comment or inside a string would be a
 * confidently wrong diagnosis.
 *
 * The scanner strips comments and string/template literals before matching.
 * It is not a parser, and it says so: a regular-expression literal containing
 * `//` can confuse it. Banning a construct is a per-mission decision, so the
 * author is expected to name a construct whose false positive would be obvious.
 */

/** Replace comments and quoted literals with spaces, keeping line structure. */
export function stripLiterals(source: string): string {
  let out = '';
  let i = 0;

  while (i < source.length) {
    const char = source[i]!;
    const next = source[i + 1];

    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < source.length) {
        out += '  ';
        i += 2;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      out += ' ';
      i += 1;
      while (i < source.length) {
        if (source[i] === '\\') {
          out += '  ';
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          out += ' ';
          i += 1;
          break;
        }
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }

    out += char;
    i += 1;
  }

  return out;
}

/** True when the source uses a construct the mission explicitly bans (E19). */
export function usesConstruct(source: string, construct: string): boolean {
  const needle = construct.trim();
  if (needle === '') return false;
  return stripLiterals(source).includes(needle);
}

/**
 * True when the source contains a loop or an indexed access (E13's condition).
 *
 * `allowClosedForm` missions opt out at the call site: M09's answer really is
 * arithmetic, and a source with no loop is the intended solution there.
 */
export function hasIteration(source: string): boolean {
  const code = stripLiterals(source);
  if (/\b(for|while|do)\b/.test(code)) return true;
  if (/\.(map|filter|reduce|some|every|find|findIndex|forEach|includes|indexOf|charAt)\s*\(/.test(code)) {
    return true;
  }
  return /\[\s*[A-Za-z_$][\w$]*\s*\]/.test(code);
}

/** True when the source uses `==` or `!=` where the contract requires strict (E22). */
export function usesLooseEquality(source: string): boolean {
  const code = stripLiterals(source);
  return /(?<![=!<>])==(?!=)|(?<![=!])!=(?!=)/.test(code);
}

/**
 * The first integer literal written more than once (E20), or undefined.
 *
 * `0` and `1` are excluded: they are structural (`i = 0`, `i + 1`) far more
 * often than they are a domain constant, and a warning that fires on every loop
 * is noise. E20 is a warning by taxonomy and never part of mastery.
 */
export function duplicatedLiteral(source: string): string | undefined {
  const code = stripLiterals(source);
  const counts = new Map<string, number>();

  for (const match of code.matchAll(/\b\d+(?:\.\d+)?\b/g)) {
    const literal = match[0];
    if (literal === '0' || literal === '1') continue;
    counts.set(literal, (counts.get(literal) ?? 0) + 1);
  }

  for (const [literal, count] of counts) {
    if (count >= 2) return literal;
  }
  return undefined;
}
