import { jitter } from "./idleBrain";
import type { GaitDef, PlayerConfig, WalkVariant } from "./types";

/**
 * gait.ts — which walk frame, and the small things a walk does around it.
 *
 * The walk cycle is driven by distance, not time: one frame per `stride`
 * logical px, so a foot drawn on the floor stays on the floor whatever the
 * frame rate or the surface speed. That much used to be one line in the
 * runtime with a 16 hard-coded into it. What lives here besides:
 *
 *  – a walk starts from standing on the push-off frame (`start`), not on
 *    whatever frame the last walk happened to stop on — feet together, then
 *    a leg reaches, then a heel lands; turning round mid-walk restarts the
 *    same way, because a turn is a plant and a new push;
 *  – a walk ends through the pass of the step it was in, so the legs come
 *    together before he stands rather than snapping from a stride to
 *    attention; the settle is one frame's worth of time;
 *  – the cycle count picks, deterministically, the occasional variant the
 *    character config offers — a toe that catches, a glance over the
 *    shoulder — so that a long walk is not the same eight pictures for ever,
 *    and the same walk replays the same way;
 *  – there is more than one way to move. The walk is the default gait; the
 *    config may add others (`gaits`: a run on the run key, a drunk walk the
 *    game imposes for a while). Each has its own cycle, stride and speed, and
 *    a change of gait mid-stride restarts on the new gait's push-off.
 *
 * Pure apart from the caller-owned state, like idleBrain and faceBrain.
 */

export const SETTLE_MS = 90;
export const WALK = "walk";

export type GaitState = {
  moving: boolean;
  facing: 1 | -1;
  settleFrame: string | null;
  settleUntil: number;
  /** the gait the distance is currently counted in */
  gait: string;
  /** a gait the game imposed (drunk), until a wall time (0 = until cleared) */
  override: { id: string; until: number } | null;
};

export const newGaitState = (): GaitState => ({
  moving: false,
  facing: 1,
  settleFrame: null,
  settleUntil: 0,
  gait: WALK,
  override: null,
});

/** The gait definition for an id — the walk itself when the id is the walk or unknown. */
export function resolveGait(cfg: PlayerConfig, id: string = WALK): GaitDef {
  const own = id !== WALK ? cfg.gaits?.[id] : undefined;
  if (own) return own;
  return {
    cycle: cfg.walkCycle,
    stride: cfg.walkStride ?? 16,
    start: cfg.walkStart ?? 0,
    variants: cfg.walkVariants,
    speed: 1,
  };
}

/** Impose a gait for `ms` (0 = until cleared with null). */
export function setGaitOverride(g: GaitState, id: string | null, now: number, ms = 0): void {
  g.override = id ? { id, until: ms > 0 ? now + ms : 0 } : null;
}

/** Which gait applies this tick: the override while it lasts, else the run key, else the walk. */
export function activeGait(g: GaitState, cfg: PlayerConfig, now: number, wantRun: boolean): string {
  if (g.override && (g.override.until === 0 || now < g.override.until)) return g.override.id;
  g.override = null;
  return wantRun && cfg.gaits?.run ? "run" : WALK;
}

export const walkStride = (cfg: PlayerConfig, gait: string = WALK): number =>
  resolveGait(cfg, gait).stride;

/** The distance the cycle wraps at — bounded, and a whole number of cycles. */
export function walkSpan(cfg: PlayerConfig, gait: string = WALK): number {
  const def = resolveGait(cfg, gait);
  return def.stride * Math.max(1, def.cycle.length) * 512;
}

/** The base cycle frame at a distance, before variants. */
export function cycleIndex(cfg: PlayerConfig, walkDist: number, gait: string = WALK): number {
  const def = resolveGait(cfg, gait);
  const n = Math.max(1, def.cycle.length);
  return Math.floor(walkDist / def.stride) % n;
}

/** The walk frame at a distance, variants included. */
export function walkFrame(cfg: PlayerConfig, walkDist: number, gait: string = WALK): string {
  const def = resolveGait(cfg, gait);
  const n = Math.max(1, def.cycle.length);
  const idx = cycleIndex(cfg, walkDist, gait);
  const cycleNo = Math.floor(walkDist / (def.stride * n));
  // the first cycle out of a stand is always the plain one: a scuff on the
  // very first step reads as a stumble, and a glance back as a reaction to
  // something the player did not see
  if (cycleNo > 0 && def.variants) {
    for (let i = 0; i < def.variants.length; i++) {
      const v: WalkVariant = def.variants[i];
      if (v.every <= 0) continue;
      if (jitter(cycleNo * 31 + i * 7 + 1, v.every) !== 0) continue;
      const f = v.frames[idx];
      if (f && cfg.frames[f]) return f;
    }
  }
  return def.cycle[idx];
}

/** The pass of the step the cycle is in — the frame closest to feet-together. */
function passOfStep(cfg: PlayerConfig, idx: number, gait: string): string {
  const cycle = resolveGait(cfg, gait).cycle;
  const n = cycle.length;
  if (n < 2) return cycle[0];
  const half = Math.floor(n / 2);
  const step = Math.floor(idx / half);
  return cycle[Math.min(n - 1, step * half + Math.floor(half / 2))];
}

export type GaitStep = {
  /** the walking (or settling) body frame; null while he is simply standing */
  frame: string | null;
  /** the distance to carry on from — reset on a start, a turn or a change of gait */
  walkDist: number;
};

/**
 * One tick of the legs. Call with the distance already advanced this tick.
 * While standing it returns null and the idle brain has the body.
 */
export function stepGait(
  g: GaitState,
  cfg: PlayerConfig,
  walkDist: number,
  moving: boolean,
  facing: 1 | -1,
  now: number,
  gait: string = WALK,
): GaitStep {
  let dist = walkDist;
  if (moving) {
    const started = !g.moving;
    const turned = facing !== g.facing;
    const changed = gait !== g.gait;
    if (started || turned || changed) {
      const def = resolveGait(cfg, gait);
      dist = (def.start ?? 0) * def.stride;
    }
    g.moving = true;
    g.facing = facing;
    g.gait = gait;
    g.settleFrame = null;
    return { frame: walkFrame(cfg, dist, gait), walkDist: dist };
  }
  if (g.moving) {
    // just stopped: come through the pass unless already on it
    g.moving = false;
    const idx = cycleIndex(cfg, dist, g.gait);
    const pass = passOfStep(cfg, idx, g.gait);
    if (resolveGait(cfg, g.gait).cycle[idx] !== pass && cfg.frames[pass]) {
      g.settleFrame = pass;
      g.settleUntil = now + SETTLE_MS;
    }
  }
  if (g.settleFrame && now < g.settleUntil) {
    return { frame: g.settleFrame, walkDist: dist };
  }
  g.settleFrame = null;
  return { frame: null, walkDist: dist };
}
