/**
 * three.js side of the world nodes. Only ever loaded through a dynamic
 * `import()` from WorldGem, so it lives in its own chunk and never weighs on the
 * first paint or on the mission/lab screens.
 *
 * One tiny canvas per world node. Static states render a single frame; only the
 * current world animates, and only while it is visible on screen and the tab is
 * in the foreground.
 */

import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
  type BufferGeometry,
} from 'three';

import type { WorldState } from '../../domain/progression/worlds';
import { worldShape, type ShapePart } from './worldShapes';

export interface GemHandle {
  dispose: () => void;
}

export interface GemOptions {
  worldId: string;
  state: WorldState;
  /** Skip the rotation loop and draw one frame (prefers-reduced-motion). */
  reducedMotion: boolean;
}

/** Mirrors the tokens in app/global.css; the computed style wins when present. */
const FALLBACK_COLORS = { working: '#3fb950', structure: '#58a6ff', muted: '#8b98a5' };

function token(canvas: HTMLCanvasElement, name: string, fallback: string): string {
  const value = getComputedStyle(canvas).getPropertyValue(name).trim();
  return value === '' ? fallback : value;
}

function geometryFor(part: ShapePart): BufferGeometry {
  const [a, b, c] = part.size;
  switch (part.geometry) {
    case 'cylinder':
      return new CylinderGeometry(a, a, b, c);
    case 'sphere':
      return new SphereGeometry(a, c, c);
    case 'torus':
      return new TorusGeometry(a, b, 6, 18);
    case 'box':
      return new BoxGeometry(a, b, c);
  }
}

function stateColor(canvas: HTMLCanvasElement, state: WorldState): Color {
  if (state === 'completed') return new Color(token(canvas, '--working', FALLBACK_COLORS.working));
  if (state === 'current') return new Color(token(canvas, '--structure', FALLBACK_COLORS.structure));
  // Locked: desaturated and dimmed.
  const color = new Color(token(canvas, '--text-muted', FALLBACK_COLORS.muted));
  return color.multiplyScalar(0.55);
}

/** Throws when WebGL is unavailable; the caller falls back to the 2D dot. */
export function mountGem(canvas: HTMLCanvasElement, options: GemOptions): GemHandle {
  const { worldId, state, reducedMotion } = options;
  const size = canvas.clientWidth || 64;
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(size, size, false);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0.4, 6.2);
  camera.lookAt(0, 0, 0);
  scene.add(new AmbientLight(0xffffff, state === 'locked' ? 0.7 : 0.9));
  const key = new DirectionalLight(0xffffff, state === 'locked' ? 1 : 2.2);
  key.position.set(2, 3, 4);
  scene.add(key);

  const material = new MeshStandardMaterial({
    color: stateColor(canvas, state),
    roughness: 0.55,
    metalness: 0.1,
    flatShading: true,
    emissive: state === 'completed' ? stateColor(canvas, state).multiplyScalar(0.25) : 0x000000,
  });
  const geometries: BufferGeometry[] = [];
  const group = new Group();
  for (const part of worldShape(worldId).parts) {
    const geometry = geometryFor(part);
    geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...part.position);
    mesh.rotation.z = part.rotationZ ?? 0;
    group.add(mesh);
  }
  group.rotation.set(0.35, -0.5, 0);
  scene.add(group);

  const render = () => renderer.render(scene, camera);
  render();

  let frame = 0;
  let onScreen = true;
  const animate = state === 'current' && !reducedMotion;

  const loop = () => {
    group.rotation.y += 0.008;
    render();
    frame = requestAnimationFrame(loop);
  };
  const sync = () => {
    const shouldRun = animate && onScreen && !document.hidden;
    if (shouldRun && frame === 0) frame = requestAnimationFrame(loop);
    if (!shouldRun && frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  let observer: IntersectionObserver | null = null;
  if (animate) {
    observer = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    observer.observe(canvas);
    document.addEventListener('visibilitychange', sync);
    sync();
  }

  return {
    dispose() {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      for (const geometry of geometries) geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
