/**
 * Procedural silhouettes for the world nodes (docs/06-ux-flows.md §3).
 *
 * Pure data on purpose: no three.js import, so the id -> shape mapping is
 * testable without WebGL and the heavy library stays in its own lazy chunk.
 * Units are arbitrary scene units; the renderer fits the whole group in view.
 */

export type ShapeKind =
  | 'cog'
  | 'drawers'
  | 'crates'
  | 'bars'
  | 'tower'
  | 'network'
  | 'archive'
  | 'forge'
  | 'cube';

export type PartGeometry = 'box' | 'cylinder' | 'sphere' | 'torus';

export interface ShapePart {
  geometry: PartGeometry;
  /** box: [w, h, d]; cylinder: [radius, height, segments]; sphere: [radius, 0, segments]; torus: [radius, tube, 0]. */
  size: [number, number, number];
  position: [number, number, number];
  /** Rotation in radians around Z (cog teeth, tilted books). */
  rotationZ?: number;
}

export interface WorldShape {
  kind: ShapeKind;
  parts: ShapePart[];
}

function cog(): ShapePart[] {
  const teeth = 8;
  const ring: ShapePart[] = Array.from({ length: teeth }, (_, index) => {
    const angle = (index / teeth) * Math.PI * 2;
    return {
      geometry: 'box',
      size: [0.3, 0.45, 0.4],
      position: [Math.cos(angle) * 0.85, Math.sin(angle) * 0.85, 0],
      rotationZ: angle,
    };
  });
  return [{ geometry: 'cylinder', size: [0.7, 0.4, 12], position: [0, 0, 0], rotationZ: Math.PI / 2 }, ...ring];
}

function stack(count: number, size: [number, number, number], gap: number): ShapePart[] {
  const offset = ((count - 1) * (size[1] + gap)) / 2;
  return Array.from({ length: count }, (_, index) => ({
    geometry: 'box' as const,
    size,
    position: [0, index * (size[1] + gap) - offset, 0] as [number, number, number],
  }));
}

const BUILDERS: Record<Exclude<ShapeKind, 'cube'>, () => ShapePart[]> = {
  cog,
  drawers: () => stack(3, [1.5, 0.5, 1.1], 0.12),
  crates: () => [
    { geometry: 'box', size: [0.9, 0.9, 0.9], position: [-0.5, -0.45, 0] },
    { geometry: 'box', size: [0.9, 0.9, 0.9], position: [0.5, -0.45, 0] },
    { geometry: 'box', size: [0.9, 0.9, 0.9], position: [0, 0.45, 0] },
  ],
  bars: () =>
    [0.5, 0.9, 1.3, 1.7].map((height, index) => ({
      geometry: 'box' as const,
      size: [0.4, height, 0.4] as [number, number, number],
      position: [(index - 1.5) * 0.55, height / 2 - 0.85, 0] as [number, number, number],
    })),
  tower: () => [
    { geometry: 'cylinder', size: [0.35, 1.8, 10], position: [0, 0, 0] },
    { geometry: 'cylinder', size: [0.6, 0.35, 10], position: [0, 1, 0] },
    { geometry: 'torus', size: [0.9, 0.06, 0], position: [0, 0.4, 0], rotationZ: 0 },
  ],
  network: () => [
    { geometry: 'sphere', size: [0.38, 0, 10], position: [0, 0.7, 0] },
    { geometry: 'sphere', size: [0.38, 0, 10], position: [-0.8, -0.5, 0] },
    { geometry: 'sphere', size: [0.38, 0, 10], position: [0.8, -0.5, 0] },
    { geometry: 'box', size: [0.08, 1.5, 0.08], position: [-0.4, 0.1, 0], rotationZ: 0.5 },
    { geometry: 'box', size: [0.08, 1.5, 0.08], position: [0.4, 0.1, 0], rotationZ: -0.5 },
    { geometry: 'box', size: [1.6, 0.08, 0.08], position: [0, -0.5, 0] },
  ],
  archive: () => [
    { geometry: 'cylinder', size: [0.8, 0.4, 12], position: [0, -0.6, 0] },
    { geometry: 'cylinder', size: [0.7, 0.4, 12], position: [0, -0.15, 0] },
    { geometry: 'cylinder', size: [0.8, 0.4, 12], position: [0, 0.3, 0] },
    { geometry: 'cylinder', size: [0.6, 0.4, 12], position: [0, 0.75, 0] },
  ],
  // An anvil: the classics are the tools every other algorithm is struck from.
  forge: () => [
    { geometry: 'box', size: [1.1, 0.35, 0.8], position: [0, -0.7, 0] },
    { geometry: 'box', size: [0.55, 0.5, 0.6], position: [0, -0.3, 0] },
    { geometry: 'box', size: [1.7, 0.45, 0.8], position: [0, 0.18, 0] },
    { geometry: 'cylinder', size: [0.22, 0.7, 8], position: [-1.05, 0.18, 0], rotationZ: Math.PI / 2 },
  ],
};

function isKnown(id: string): id is 'w1' | 'transition' | 'w2' | 'w3' | 'w4' | 'w5' | 'w6' | 'w7' {
  return id in KIND_BY_WORLD;
}

const KIND_BY_WORLD: Record<string, Exclude<ShapeKind, 'cube'>> = {
  w1: 'cog',
  transition: 'drawers',
  w2: 'crates',
  w3: 'bars',
  w4: 'tower',
  w5: 'network',
  w6: 'archive',
  w7: 'forge',
};

/** Shape descriptor for a world id; unknown ids get a generic cube. */
export function worldShape(worldId: string): WorldShape {
  if (!isKnown(worldId)) {
    return {
      kind: 'cube',
      parts: [{ geometry: 'box', size: [1.2, 1.2, 1.2], position: [0, 0, 0] }],
    };
  }
  const kind = KIND_BY_WORLD[worldId];
  return { kind, parts: BUILDERS[kind]() };
}
