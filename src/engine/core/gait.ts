import { jitter } from "./idleBrain";
import type { PlayerConfig, WalkVariant } from "./types";

/**
 * gait.ts — which walk frame, and the small things a walk does around it.
 *
 * The walk cycle is driven by distance, not time: one frame per `walkStride`
 * logical px, so a foot drawn on the floor stays on the floor whatever the
 * frame rate or the surface speed. That much used to be one line in the
 * runtime with a 16 hard-coded into it. What lives here besides:
 *
 *  – a walk starts from standing on the push-off frame (`walkStart`), not on
 *    whatever frame the last walk happened to stop on — feet together, then
 *    a leg reaches, then a heel lands; turning round mid-walk restarts the
 *    same way, because a turn is a plant and a new push;
 *  – a walk ends through the pass of the step it was in, so the legs come
 *    together before he stands rather than snapping from a stride to
 *    attention; the settle is one frame's worth of time;
 *  – the cycle count picks, deterministically, the occasional variant the
 *    character config offers — a toe that catches, a glance over the
 *    shoulder — so that a long walk is not the same eight pictures for ever,
 *    and the same walk replays the same way.
 *
 * Pure apart from the caller-owned state, like idleBrain and faceBrain.
 */

export const SETTLE_MS = 90;

export type GaitState = {
  moving: boolean;
  facing: 1 | -1;
  settleFrame: string | null;
  settleUntil: number;
};

export const newGaitState = (): GaitState => ({
  moving: false,
  facing: 1,
  settleFrame: null,
  settleUntil: 0,
});

export const walkStride = (cfg: PlayerConfig): number => cfg.walkStride ?? 16;

/** The distance the cycle wraps at — bounded, and a whole number of cycles. */
export function walkSpan(cfg: PlayerConfig): number {
  return walkStride(cfg) * Math.max(1, cfg.walkCycle.length) * 512;
}

/** The base cycle frame at a distance, before variants. */
export function cycleIndex(cfg: PlayerConfig, walkDist: number): number {
  const n = Math.max(1, cfg.walkCycle.length);
  return Math.floor(walkDist / walkStride(cfg)) % n;
}

/** The walk frame at a distance, variants included. */
export function walkFrame(cfg: PlayerConfig, walkDist: number): string {
  const n = Math.max(1, cfg.walkCycle.length);
  const idx = cycleIndex(cfg, walkDist);
  const cycleNo = Math.floor(walkDist / (walkStride(cfg) * n));
  // the first cycle out of a stand is always the plain one: a scuff on the
  // very first step reads as a stumble, and a glance back as a reaction to
  // something the player did not see
  if (cycleNo > 0 && cfg.walkVariants) {
    for (let i = 0; i < cfg.walkVariants.length; i++) {
      const v: WalkVariant = cfg.walkVariants[i];
      if (v.every <= 0) continue;
      if (jitter(cycleNo * 31 + i * 7 + 1, v.every) !== 0) continue;
      const f = v.frames[idx];
      if (f && cfg.frames[f]) return f;
    }
  }
  return cfg.walkCycle[idx];
}

/** The pass of the step the cycle is in — the frame closest to feet-together. */
function passOfStep(cfg: PlayerConfig, idx: number): string {
  const n = cfg.walkCycle.length;
  if (n < 2) return cfg.walkCycle[0];
  const half = Math.floor(n / 2);
  const step = Math.floor(idx / half);
  return cfg.walkCycle[Math.min(n - 1, step * half + Math.floor(half / 2))];
}

export type GaitStep = {
  /** the walking (or settling) body frame; null while he is simply standing */
  frame: string | null;
  /** the distance to carry on from — reset on a start or a turn */
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
): GaitStep {
  let dist = walkDist;
  if (moving) {
    const started = !g.moving;
    const turned = facing !== g.facing;
    if (started || turned) {
      dist = (cfg.walkStart ?? 0) * walkStride(cfg);
    }
    g.moving = true;
    g.facing = facing;
    g.settleFrame = null;
    return { frame: walkFrame(cfg, dist), walkDist: dist };
  }
  if (g.moving) {
    // just stopped: come through the pass unless already on it
    g.moving = false;
    const idx = cycleIndex(cfg, dist);
    const pass = passOfStep(cfg, idx);
    if (cfg.walkCycle[idx] !== pass && cfg.frames[pass]) {
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
