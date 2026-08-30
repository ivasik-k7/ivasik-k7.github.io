import type { LayerDef, PlayerConfig } from "./types";

/**
 * layerBrain.ts — the thing in his hand, over whatever the body is doing.
 *
 * An action owns the whole body for its length. A layer owns one arm and
 * the head for as long as it is on: a cigarette that stays lit while he
 * walks to the other end of the street, a paper cup carried out of Żabka, a
 * parcel under the arm until it is delivered. The body picks its frame as
 * before — gait, idle, talk — and the layer replaces it with the baked
 * combination `body+upper` when the recipe made one (see `PlayerConfig.
 * layered`). Where it made none — an action, a back view — the body shows
 * alone and the layer waits; it does not end.
 *
 * Deterministic on the clock like the other brains; caller-owned state.
 */

export type LayerRun = {
  id: string;
  start: number;
  /** wall time the layer drops on its own (0 = until stopped) */
  until: number;
};

export type LayerState = {
  run: LayerRun | null;
};

export const newLayerState = (): LayerState => ({ run: null });

export function startLayer(st: LayerState, id: string, now: number, ms = 0): void {
  if (st.run?.id === id) {
    // re-arm the same thing: extend, don't restart the clip
    st.run.until = ms > 0 ? now + ms : 0;
    return;
  }
  st.run = { id, start: now, until: ms > 0 ? now + ms : 0 };
}

export function stopLayer(st: LayerState, id?: string): void {
  if (!st.run) return;
  if (id && st.run.id !== id) return;
  st.run = null;
}

/** The upper pose the layer shows this tick, or null when no layer is on. */
export function layerUpper(st: LayerState, cfg: PlayerConfig, now: number): string | null {
  const run = st.run;
  if (!run) return null;
  if (run.until && now >= run.until) {
    st.run = null;
    return null;
  }
  const def: LayerDef | undefined = cfg.layers?.[run.id];
  if (!def || def.frames.length === 0) return null;
  const t = Math.max(0, now - run.start);
  return def.frames[Math.floor(t / def.frameMs) % def.frames.length];
}

/**
 * The frame to draw: the baked `body+upper` when there is one, else the body.
 * `aliases` lets a body frame with no combination of its own (a glance back
 * mid-stride) borrow its base frame's.
 */
export function layeredFrame(cfg: PlayerConfig, body: string, upper: string | null): string {
  if (!upper) return body;
  const table = cfg.layered;
  if (!table) return body;
  const own = table[body]?.[upper];
  if (own) return own;
  return body;
}
