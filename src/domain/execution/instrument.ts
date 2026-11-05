/**
 * Instrumentation of the player's source (docs/08-code-execution.md §6, D13).
 *
 * The cost of a solution is measured in **steps**, not milliseconds: a step is
 * one loop iteration or one function call, plus the work the built-in array
 * methods do internally (see `meter.ts`). Steps are deterministic and do not
 * depend on the machine, which is the whole point of D13: wall-clock time on a
 * throttled laptop fails a correct solution; a step count cannot.
 *
 * The instrumenter parses the source with acorn and *splices* text into it. It
 * never regenerates code, and it inserts no newline, so every line number the
 * player sees in an error message stays true.
 *
 * Two kinds of probes can be inserted, both optional:
 *
 * - `__t()` at the start of every loop body and every function body. It only
 *   counts, and it is what an enforced or advised budget is measured with.
 * - `__s(line, snapshot)` at the same places when `snapshots` is on. `snapshot`
 *   is a closure that reads the variables of the enclosing functions, each read
 *   guarded so a variable that is not in scope yet (or at all) is skipped. This
 *   is what the step-by-step trace is built from.
 *
 * If the source does not parse, `instrumentSource` returns `null` and the run
 * proceeds uninstrumented: the real syntax error is reported by the engine,
 * and a cost of "unknown" is never turned into a verdict.
 */

import { parse } from 'acorn';

export interface InstrumentOptions {
  /** Also insert variable snapshots, for the trace. Off for ordinary runs. */
  snapshots?: boolean;
}

interface Edit {
  pos: number;
  text: string;
  /** Insert order for edits at the same position: smaller goes first. */
  order: number;
}

// acorn's node type is structural; the walker only needs these fields.
interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

const isNode = (value: unknown): value is AstNode =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string' &&
  typeof (value as { start?: unknown }).start === 'number';

function children(node: AstNode): AstNode[] {
  const out: AstNode[] = [];
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) out.push(item);
    } else if (isNode(value)) {
      out.push(value);
    }
  }
  return out;
}

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const LOOPS = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);

/** Names bound by a pattern (identifier, destructuring, rest, defaults). */
function patternNames(node: AstNode | null | undefined, into: Set<string>): void {
  if (!node) return;
  switch (node.type) {
    case 'Identifier':
      into.add(node.name as string);
      return;
    case 'ObjectPattern':
      for (const property of node.properties as AstNode[]) {
        patternNames(property.type === 'RestElement' ? property : (property.value as AstNode), into);
      }
      return;
    case 'ArrayPattern':
      for (const element of node.elements as (AstNode | null)[]) patternNames(element, into);
      return;
    case 'RestElement':
      patternNames(node.argument as AstNode, into);
      return;
    case 'AssignmentPattern':
      patternNames(node.left as AstNode, into);
      return;
    default:
  }
}

/** Every name declared inside a function, without crossing into nested functions. */
function declaredNames(fn: AstNode): Set<string> {
  const names = new Set<string>();
  for (const param of fn.params as AstNode[]) patternNames(param, names);
  if (fn.type === 'FunctionDeclaration' || fn.type === 'FunctionExpression') {
    const id = fn.id as AstNode | null;
    if (id && fn.type === 'FunctionExpression') names.add(id.name as string);
  }
  const visit = (node: AstNode) => {
    if (node.type === 'VariableDeclaration') {
      for (const declarator of node.declarations as AstNode[]) {
        patternNames(declarator.id as AstNode, names);
      }
    } else if (node.type === 'FunctionDeclaration') {
      const id = node.id as AstNode | null;
      if (id) names.add(id.name as string);
      return; // do not look inside
    } else if (node.type === 'ClassDeclaration') {
      const id = node.id as AstNode | null;
      if (id) names.add(id.name as string);
    } else if (node.type === 'CatchClause') {
      patternNames(node.param as AstNode | null, names);
    }
    if (FUNCTIONS.has(node.type)) return;
    for (const child of children(node)) visit(child);
  };
  const body = fn.body as AstNode;
  if (body.type === 'BlockStatement') for (const child of children(body)) visit(child);
  else visit(body);
  return names;
}

function lineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) if (source[i] === '\n') starts.push(i + 1);
  return starts;
}

function lineAt(starts: readonly number[], pos: number): number {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid]! <= pos) low = mid;
    else high = mid - 1;
  }
  return low + 1;
}

/** `__s(line, () => [[name, value], ...])`, each read guarded. */
function snapshotCall(line: number, names: readonly string[]): string {
  const reads = names
    .map((name) => `["${name}",(()=>{try{return ${name}}catch(e){return undefined}})()]`)
    .join(',');
  return `__s(${line},()=>[${reads}])`;
}

/**
 * Returns the instrumented source, or `null` when it cannot be parsed.
 * The result is meant for `new Function("__t", "__s", ...)`.
 */
export function instrumentSource(source: string, options: InstrumentOptions = {}): string | null {
  let ast: AstNode;
  try {
    ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' }) as unknown as AstNode;
  } catch {
    return null;
  }

  const edits: Edit[] = [];
  const starts = options.snapshots === true ? lineStarts(source) : [];
  let order = 0;
  const add = (pos: number, text: string) => edits.push({ pos, text, order: order++ });

  // The probes of one site, as separate expressions: joined with `;` inside a
  // block and with `,` inside an expression-bodied arrow.
  const probes = (pos: number, scope: readonly string[]): string[] => [
    '__t()',
    ...(options.snapshots === true ? [snapshotCall(lineAt(starts, pos), scope)] : []),
  ];
  const asStatements = (parts: string[]) => `${parts.join(';')};`;
  const asExpression = (parts: string[]) => `(${parts.join(',')},`;

  const walk = (node: AstNode, scope: readonly string[]) => {
    let innerScope = scope;

    if (FUNCTIONS.has(node.type)) {
      innerScope = [...new Set([...scope, ...declaredNames(node)])];
      const body = node.body as AstNode;
      if (body.type === 'BlockStatement') {
        // Land after any directive prologue, or "use strict" stops being one.
        let at = body.start + 1;
        for (const statement of body.body as AstNode[]) {
          if (statement.type === 'ExpressionStatement' && typeof statement.directive === 'string') {
            at = statement.end;
          } else break;
        }
        add(at, asStatements(probes(body.start, innerScope)));
      } else {
        // Expression-bodied arrow: (__t(), expr)
        add(body.start, asExpression(probes(body.start, innerScope)));
        add(body.end, ')');
      }
    }

    if (LOOPS.has(node.type)) {
      const body = node.body as AstNode;
      if (body.type === 'BlockStatement') {
        add(body.start + 1, asStatements(probes(body.start, scope)));
      } else {
        add(body.start, `{ ${asStatements(probes(body.start, scope))} `);
        add(body.end, ' }');
      }
    }

    for (const child of children(node)) walk(child, innerScope);
  };

  // The top level has no function scope: only functions below it get one.
  walk(ast, []);

  // Splice from the end so earlier positions stay valid.
  edits.sort((a, b) => b.pos - a.pos || b.order - a.order);
  let out = source;
  for (const edit of edits) out = out.slice(0, edit.pos) + edit.text + out.slice(edit.pos);
  return out;
}
