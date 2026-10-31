/**
 * What the player's `console.*` calls turn into (docs/08-code-execution.md §6).
 *
 * Everything here is pure and realm-agnostic: the worker installs the stub, the
 * page re-validates the report, and the tests run both under Node.
 *
 * The rule that matters most is pedagogical and a security one at once: output
 * produced while running a **hidden or edge** case is never recorded. A
 * `console.log(input)` there would print exactly the inputs the mission hides
 * (docs/missions/M01.md §5). Probe re-runs are dropped too: they repeat visible
 * cases and would double every line. Only a boolean survives, so the player
 * learns that something was printed, never what.
 */

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

const LEVELS: readonly ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

export interface ConsoleEntry {
  level: ConsoleLevel;
  /** The visible test that was running; `null` for top-level code at load time. */
  testId: string | null;
  text: string;
}

export interface ConsoleReport {
  entries: ConsoleEntry[];
  /** Some entries or characters were dropped because a cap was reached. */
  truncated: boolean;
  /** A hidden or edge case printed something. Content is never kept. */
  hiddenOutput: boolean;
}

export interface ConsoleLimits {
  maxEntries: number;
  maxEntryChars: number;
  maxTotalChars: number;
}

export const CONSOLE_LIMITS: ConsoleLimits = {
  maxEntries: 200,
  maxEntryChars: 500,
  maxTotalChars: 20_000,
};

const MAX_DEPTH = 3;
const MAX_ITEMS = 10;
const MAX_NESTED_STRING = 100;
const MAX_TEST_ID_CHARS = 64;
const UNREADABLE = '[Unreadable]';

function quote(text: string): string {
  const clipped = text.length > MAX_NESTED_STRING ? `${text.slice(0, MAX_NESTED_STRING)}…` : text;
  return JSON.stringify(clipped);
}

function functionLabel(fn: (...args: never[]) => unknown): string {
  let name = '';
  try {
    name = typeof fn.name === 'string' ? fn.name : '';
  } catch {
    name = '';
  }
  return `[Function ${name === '' ? '(anonymous)' : name}]`;
}

function formatNested(value: unknown, depth: number, ancestors: Set<object>): string {
  switch (typeof value) {
    case 'string':
      return quote(value);
    case 'number':
      return Object.is(value, -0) ? '-0' : String(value);
    case 'bigint':
      return `${String(value)}n`;
    case 'symbol':
      return value.toString();
    case 'function':
      return functionLabel(value as (...args: never[]) => unknown);
    case 'object':
      break;
    default:
      return String(value);
  }
  if (value === null) return 'null';
  const object = value as object;

  if (ancestors.has(object)) return '[Circular]';
  if (depth >= MAX_DEPTH) return Array.isArray(object) ? '[Array]' : '[Object]';

  ancestors.add(object);
  try {
    return formatContainer(object, depth, ancestors);
  } finally {
    ancestors.delete(object);
  }
}

function safely(read: () => string): string {
  try {
    return read();
  } catch {
    return UNREADABLE;
  }
}

function more(count: number): string {
  return `... ${count} more`;
}

function formatContainer(object: object, depth: number, ancestors: Set<object>): string {
  if (object instanceof Error) return `${object.name}: ${object.message}`;
  if (object instanceof Date) {
    return Number.isNaN(object.getTime()) ? 'Invalid Date' : object.toISOString();
  }

  if (Array.isArray(object)) {
    if (object.length === 0) return '[]';
    const parts: string[] = [];
    for (let index = 0; index < Math.min(object.length, MAX_ITEMS); index += 1) {
      parts.push(safely(() => formatNested(object[index], depth + 1, ancestors)));
    }
    if (object.length > MAX_ITEMS) parts.push(more(object.length - MAX_ITEMS));
    return `[ ${parts.join(', ')} ]`;
  }

  if (object instanceof Map) {
    const parts: string[] = [];
    let seen = 0;
    for (const [key, item] of object) {
      if (seen >= MAX_ITEMS) break;
      parts.push(
        `${formatNested(key, depth + 1, ancestors)} => ${formatNested(item, depth + 1, ancestors)}`,
      );
      seen += 1;
    }
    if (object.size > MAX_ITEMS) parts.push(more(object.size - MAX_ITEMS));
    return `Map(${object.size}) { ${parts.join(', ')} }`;
  }

  if (object instanceof Set) {
    const parts: string[] = [];
    let seen = 0;
    for (const item of object) {
      if (seen >= MAX_ITEMS) break;
      parts.push(formatNested(item, depth + 1, ancestors));
      seen += 1;
    }
    if (object.size > MAX_ITEMS) parts.push(more(object.size - MAX_ITEMS));
    return `Set(${object.size}) { ${parts.join(', ')} }`;
  }

  const record = object as Record<string, unknown>;
  const keys = Object.keys(record);
  const prefix = constructorPrefix(object);
  if (keys.length === 0) return `${prefix}{}`;
  const parts = keys.slice(0, MAX_ITEMS).map((key) => {
    const rendered = safely(() => formatNested(record[key], depth + 1, ancestors));
    return `${key}: ${rendered}`;
  });
  if (keys.length > MAX_ITEMS) parts.push(more(keys.length - MAX_ITEMS));
  return `${prefix}{ ${parts.join(', ')} }`;
}

function constructorPrefix(object: object): string {
  const proto = Object.getPrototypeOf(object) as { constructor?: { name?: unknown } } | null;
  const name = proto?.constructor?.name;
  return typeof name === 'string' && name !== '' && name !== 'Object' ? `${name} ` : '';
}

/**
 * Render `console.log`-style arguments as one line of text. Never throws:
 * a hostile value (a Proxy, a throwing getter) must not turn the player's
 * `console.log` into a harness failure that would be blamed on the player.
 */
export function formatConsoleArgs(args: readonly unknown[]): string {
  return args
    .map((arg) =>
      typeof arg === 'string' ? arg : safely(() => formatNested(arg, 0, new Set<object>())),
    )
    .join(' ');
}

export interface ConsoleCollector {
  /** Top-level player code is running (compile time). The initial phase. */
  enterLoad(): void;
  /** A test case is running. `visible` is false for hidden and edge cases. */
  enterCase(testId: string, visible: boolean): void;
  /** Probes and everything after the cases: output is dropped silently. */
  leave(): void;
  record(level: ConsoleLevel, args: readonly unknown[]): void;
  report(): ConsoleReport;
}

type Phase = { kind: 'load' } | { kind: 'case'; testId: string; visible: boolean } | { kind: 'off' };

export function createConsoleCollector(limits: ConsoleLimits = CONSOLE_LIMITS): ConsoleCollector {
  const entries: ConsoleEntry[] = [];
  let phase: Phase = { kind: 'load' };
  let total = 0;
  let truncated = false;
  let hiddenOutput = false;

  return {
    enterLoad() {
      phase = { kind: 'load' };
    },
    enterCase(testId, visible) {
      phase = { kind: 'case', testId, visible };
    },
    leave() {
      phase = { kind: 'off' };
    },
    record(level, args) {
      if (phase.kind === 'off') return;
      if (phase.kind === 'case' && !phase.visible) {
        hiddenOutput = true;
        return;
      }
      // Check the caps before formatting: a hot loop must not pay for output
      // that will be thrown away.
      if (entries.length >= limits.maxEntries || total >= limits.maxTotalChars) {
        truncated = true;
        return;
      }
      const room = Math.min(limits.maxEntryChars, limits.maxTotalChars - total);
      let text = formatConsoleArgs(args);
      if (text.length > room) {
        text = `${text.slice(0, Math.max(room - 1, 0))}…`.slice(0, room);
        truncated = true;
      }
      total += text.length;
      entries.push({ level, testId: phase.kind === 'case' ? phase.testId : null, text });
    },
    report() {
      return { entries: entries.map((entry) => ({ ...entry })), truncated, hiddenOutput };
    },
  };
}

type StubMethod = (...args: unknown[]) => void;

const IGNORED_METHODS = [
  'table',
  'trace',
  'group',
  'groupCollapsed',
  'groupEnd',
  'time',
  'timeEnd',
  'timeLog',
  'count',
  'countReset',
  'dir',
  'dirxml',
  'assert',
  'clear',
] as const;

/**
 * The `console` the player sees. Five levels are recorded; every other method
 * exists and does nothing, so `console.table(x)` is not a TypeError that the
 * player would read as their own bug. No method can throw.
 */
export function createConsoleStub(collector: ConsoleCollector): Record<string, StubMethod> {
  const stub: Record<string, StubMethod> = {};
  for (const level of LEVELS) {
    stub[level] = (...args) => {
      try {
        collector.record(level, args);
      } catch {
        // Recording is best effort; the player's code keeps running.
      }
    };
  }
  for (const name of IGNORED_METHODS) stub[name] = () => undefined;
  return stub;
}

function isLevel(value: unknown): value is ConsoleLevel {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}

/**
 * Validate a report that crossed a boundary and re-apply the caps. The page
 * does not trust the worker's arithmetic: the channel is the player's neighbour.
 */
export function parseConsoleReport(
  raw: unknown,
  limits: ConsoleLimits = CONSOLE_LIMITS,
): ConsoleReport | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  if (!Array.isArray(candidate['entries'])) return null;
  if (typeof candidate['truncated'] !== 'boolean' || typeof candidate['hiddenOutput'] !== 'boolean') {
    return null;
  }

  const entries: ConsoleEntry[] = [];
  let truncated = candidate['truncated'];
  let total = 0;

  for (const item of candidate['entries'] as unknown[]) {
    if (typeof item !== 'object' || item === null) return null;
    const entry = item as Record<string, unknown>;
    const testId = entry['testId'];
    const text = entry['text'];
    if (!isLevel(entry['level']) || typeof text !== 'string') return null;
    if (testId !== null && (typeof testId !== 'string' || testId.length > MAX_TEST_ID_CHARS)) {
      return null;
    }
    if (entries.length >= limits.maxEntries || total >= limits.maxTotalChars) {
      truncated = true;
      continue;
    }
    const room = Math.min(limits.maxEntryChars, limits.maxTotalChars - total);
    const clipped = text.length > room ? text.slice(0, room) : text;
    if (clipped.length < text.length) truncated = true;
    total += clipped.length;
    entries.push({ level: entry['level'], testId, text: clipped });
  }

  return { entries, truncated, hiddenOutput: candidate['hiddenOutput'] };
}

/** Defence in depth: keep only lines labelled with a known visible test (or none). */
export function onlyVisibleOutput(
  report: ConsoleReport,
  visibleIds: ReadonlySet<string>,
): ConsoleReport {
  const entries = report.entries.filter(
    (entry) => entry.testId === null || visibleIds.has(entry.testId),
  );
  return {
    entries,
    truncated: report.truncated,
    hiddenOutput: report.hiddenOutput || entries.length < report.entries.length,
  };
}
