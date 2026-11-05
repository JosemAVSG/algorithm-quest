/**
 * A bounded, JSON-safe picture of a value, for the trace.
 *
 * The trace shows the variables of a running function at every step, and those
 * values can be huge, cyclic, or not clonable at all (functions, Maps). The
 * preview keeps what is useful to read: the first items of an array, the first
 * keys of an object, the first entries of a Set or Map, and a count of what was
 * left out. It never throws and never walks more than a fixed budget.
 */

export type Preview =
  | null
  | boolean
  | number
  | string
  | { t: 'undefined' }
  | { t: 'number'; text: string }
  | { t: 'array'; items: Preview[]; more: number }
  | { t: 'object'; entries: [string, Preview][]; more: number }
  | { t: 'set'; items: Preview[]; more: number }
  | { t: 'map'; entries: [Preview, Preview][]; more: number }
  | { t: 'function'; name: string }
  | { t: 'other'; text: string }
  | { t: 'deep' };

export interface PreviewLimits {
  depth: number;
  items: number;
  keys: number;
  chars: number;
}

export const DEFAULT_PREVIEW_LIMITS: PreviewLimits = { depth: 4, items: 24, keys: 12, chars: 80 };

export function previewValue(
  value: unknown,
  limits: PreviewLimits = DEFAULT_PREVIEW_LIMITS,
): Preview {
  const seen = new WeakSet<object>();

  const walk = (current: unknown, depth: number): Preview => {
    if (current === null) return null;
    switch (typeof current) {
      case 'boolean':
        return current;
      case 'number':
        return Number.isFinite(current) ? current : { t: 'number', text: String(current) };
      case 'string':
        return current.length > limits.chars ? `${current.slice(0, limits.chars)}…` : current;
      case 'undefined':
        return { t: 'undefined' };
      case 'function':
        return { t: 'function', name: current.name === '' ? 'función' : current.name };
      case 'bigint':
        return { t: 'other', text: `${current}n` };
      case 'symbol':
        return { t: 'other', text: String(current.description ?? 'símbolo') };
      default:
    }

    const object = current as object;
    if (seen.has(object) || depth >= limits.depth) return { t: 'deep' };
    seen.add(object);
    try {
      if (Array.isArray(object)) {
        const items = object.slice(0, limits.items).map((item) => walk(item, depth + 1));
        return { t: 'array', items, more: Math.max(object.length - limits.items, 0) };
      }
      if (object instanceof Set) {
        const all = [...object];
        return {
          t: 'set',
          items: all.slice(0, limits.items).map((item) => walk(item, depth + 1)),
          more: Math.max(all.length - limits.items, 0),
        };
      }
      if (object instanceof Map) {
        const all = [...object];
        return {
          t: 'map',
          entries: all
            .slice(0, limits.keys)
            .map(([k, v]) => [walk(k, depth + 1), walk(v, depth + 1)] as [Preview, Preview]),
          more: Math.max(all.length - limits.keys, 0),
        };
      }
      const keys = Object.keys(object);
      return {
        t: 'object',
        entries: keys
          .slice(0, limits.keys)
          .map((key) => [key, walk((object as Record<string, unknown>)[key], depth + 1)] as [string, Preview]),
        more: Math.max(keys.length - limits.keys, 0),
      };
    } catch {
      return { t: 'other', text: '<valor no legible>' };
    } finally {
      seen.delete(object);
    }
  };

  return walk(value, 0);
}

/** A short, human rendering: `[1, 2, 3]`, `Set {1, 2}`, `{ a: 1 }`, `"hola"`. */
export function renderPreview(preview: Preview): string {
  if (preview === null) return 'null';
  if (typeof preview === 'string') return JSON.stringify(preview);
  if (typeof preview === 'number' || typeof preview === 'boolean') return String(preview);
  switch (preview.t) {
    case 'undefined':
      return 'undefined';
    case 'number':
      return preview.text;
    case 'array':
      return `[${[...preview.items.map(renderPreview), ...(preview.more > 0 ? [`… +${preview.more}`] : [])].join(', ')}]`;
    case 'set':
      return `Set {${[...preview.items.map(renderPreview), ...(preview.more > 0 ? [`… +${preview.more}`] : [])].join(', ')}}`;
    case 'map':
      return `Map {${[...preview.entries.map(([k, v]) => `${renderPreview(k)} → ${renderPreview(v)}`), ...(preview.more > 0 ? [`… +${preview.more}`] : [])].join(', ')}}`;
    case 'object': {
      if (preview.entries.length === 0 && preview.more === 0) return '{}';
      const body = [
        ...preview.entries.map(([k, v]) => `${k}: ${renderPreview(v)}`),
        ...(preview.more > 0 ? [`… +${preview.more}`] : []),
      ];
      return `{ ${body.join(', ')} }`;
    }
    case 'function':
      return `ƒ ${preview.name}`;
    case 'other':
      return preview.text;
    case 'deep':
      return '…';
  }
}
