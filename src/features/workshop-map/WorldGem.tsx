/**
 * Dot of a world node. Shows the 2D glyph first and, when WebGL is usable,
 * replaces it with a tiny procedural 3D shape. The 3D code is lazy-loaded, so
 * every failure path (no WebGL, jsdom, import error) simply keeps the 2D dot.
 */

import { useEffect, useRef, useState } from 'react';

import type { WorldState } from '../../domain/progression/worlds';

interface WorldGemProps {
  worldId: string;
  state: WorldState;
  /** 2D glyph shown until (or instead of) the 3D layer. */
  glyph: string | number;
}

export function WorldGem({ worldId, state, glyph }: WorldGemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    let cancelled = false;
    let dispose: (() => void) | null = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    import('./worldGemRenderer')
      .then(({ mountGem }) => {
        if (cancelled) return;
        try {
          const handle = mountGem(canvas, { worldId, state, reducedMotion });
          dispose = handle.dispose;
          setReady(true);
        } catch {
          // WebGL unavailable or context creation failed: keep the 2D dot.
        }
      })
      .catch(() => {
        // Chunk failed to load: keep the 2D dot.
      });

    return () => {
      cancelled = true;
      dispose?.();
      setReady(false);
    };
  }, [worldId, state]);

  return (
    <span className={`stop__dot${ready ? ' stop__dot--gem' : ''}`} aria-hidden="true">
      <canvas key={`${worldId}-${state}`} ref={canvasRef} className="stop__gem" hidden={!ready} aria-hidden="true" />
      {ready ? null : glyph}
    </span>
  );
}
