/**
 * A bounded estimate of how much a returned value would serialise to.
 *
 * The cap exists because a worker has no heap limit (docs/08 §2): a player who
 * returns a 5 MB string, or a 10 GB array, must be stopped *before* the value is
 * cloned a second time and sent to the page.
 *
 * That is why this is a hand-written traversal and not `JSON.stringify`:
 * stringifying an unbounded structure to measure it allocates the very thing
 * the cap is supposed to prevent. The walk keeps a running budget, aborts as
 * soon as the limit is crossed, and never copies the value. A huge string is
 * rejected by length alone; only strings that already fit are scanned for the
 * exact JSON escape overhead.
 */

export const MAX_CASE_OUTPUT_BYTES = 1024 * 1024;

export interface SizeEstimate {
  /** Running estimate, stopped just after it crossed `limit`. */
  bytes: number;
  exceeded: boolean;
}

interface Budget {
  bytes: number;
  limit: number;
  exceeded: boolean;
  /** Ancestors only, so cycles terminate but shared references are still counted twice. */
  ancestors: WeakSet<object>;
}

/** Deeper values are not worth estimating: the transfer sanitiser flattens them anyway. */
const MAX_DEPTH = 32;

/** Placeholder size for a cycle or an over-deep branch. */
const PLACEHOLDER_BYTES = 20;

function add(budget: Budget, amount: number): void {
  if (budget.exceeded) return;
  budget.bytes += amount;
  if (budget.bytes > budget.limit) budget.exceeded = true;
}

/**
 * Exact size of a JSON string literal, computed without allocating a copy.
 * Only called for strings shorter than the remaining budget.
 */
function jsonStringBytes(value: string): number {
  let extra = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 0x22 || code === 0x5c) {
      extra += 1; // quote and backslash
    } else if (code < 0x20) {
      // \b \t \n \f \r are two characters; the rest are \u00XX (six).
      extra +=
        code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d
          ? 1
          : 5;
    }
  }
  return value.length + extra + 2;
}

function walk(value: unknown, depth: number, budget: Budget): void {
  if (budget.exceeded) return;

  if (value === null) {
    add(budget, 4);
    return;
  }

  switch (typeof value) {
    case 'boolean':
      add(budget, value ? 4 : 5);
      return;
    case 'number':
      add(budget, Number.isFinite(value) ? String(value).length : 4);
      return;
    case 'string': {
      const text = value;
      // Minimum possible size is length + quotes. Rejecting here avoids scanning
      // a multi-megabyte string just to learn it is too large.
      if (text.length + 2 > budget.limit - budget.bytes) {
        add(budget, text.length + 2);
        return;
      }
      add(budget, jsonStringBytes(text));
      return;
    }
    case 'undefined':
    case 'function':
    case 'symbol':
      // These are replaced by a placeholder during transfer.
      add(budget, PLACEHOLDER_BYTES);
      return;
    default:
      break;
  }

  const object = value as object;

  if (depth >= MAX_DEPTH) {
    add(budget, PLACEHOLDER_BYTES);
    return;
  }
  if (budget.ancestors.has(object)) {
    add(budget, PLACEHOLDER_BYTES);
    return;
  }

  budget.ancestors.add(object);
  try {
    if (Array.isArray(object)) {
      add(budget, 2); // [ ]
      for (let index = 0; index < object.length && !budget.exceeded; index += 1) {
        if (index > 0) add(budget, 1);
        walk(object[index], depth + 1, budget);
      }
      add(budget, 1);
      return;
    }

    const record = object as Record<string, unknown>;
    const keys = Object.keys(record);
    add(budget, 2); // { }
    for (let index = 0; index < keys.length && !budget.exceeded; index += 1) {
      if (index > 0) add(budget, 1);
      const key = keys[index]!;
      add(budget, jsonStringBytes(key) + 1); // key + colon
      walk(record[key], depth + 1, budget);
    }
    add(budget, 1);
  } finally {
    budget.ancestors.delete(object);
  }
}

export function estimateSerializedBytes(
  value: unknown,
  limit: number = MAX_CASE_OUTPUT_BYTES,
): SizeEstimate {
  const budget: Budget = {
    bytes: 0,
    limit,
    exceeded: false,
    ancestors: new WeakSet<object>(),
  };
  walk(value, 0, budget);
  return { bytes: budget.bytes, exceeded: budget.exceeded };
}
