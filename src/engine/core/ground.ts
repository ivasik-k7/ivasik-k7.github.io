import { FLOOR_Y } from "./constants";
import type { GroundBand, GroundBlocker, GroundProfilePoint } from "./runtime-types";

/**
 * ground.ts — the walkable depth band, as pure functions.
 *
 * The engine's floor used to be one line (FLOOR_Y). A scene may now declare
 * `ground: {top, bottom, blockers?, profile?, zones?}` and the player walks
 * up and down inside that band. Everything here is allocation-light and
 * DOM-free so the sim can call it every fixed step and tests can call it
 * without a browser.
 *
 * Conventions:
 *  - y is the FEET line in scene space; larger y = nearer the camera.
 *  - a scene without `ground` gets the degenerate band {FLOOR_Y, FLOOR_Y},
 *    which makes every function below collapse to the old single-line math.
 *  - collision is the feet POINT vs axis-aligned blocker rects, resolved one
 *    axis at a time so walking into a bench slides you along it.
 *  - `profile` bends the band's edges along x (steps, ramps, a platform
 *    narrowing toward its end); `zones` name what the ground is made of.
 */

/** The band every legacy scene stands on: the single floor line. */
export const SINGLE_LINE: GroundBand = Object.freeze({ top: FLOOR_Y, bottom: FLOOR_Y });

/** A scene's band, defaulted. */
export function groundOf(def: { ground?: GroundBand } | undefined): GroundBand {
  return def?.ground ?? SINGLE_LINE;
}

/** True when the band has any depth to walk — false for legacy scenes. */
export function hasDepth(band: GroundBand): boolean {
  return band.bottom > band.top;
}

const clampN = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/* ------------------------------------------------------------- edges ----- */

/** Piecewise-linear interpolation over the profile points that define `key`. */
function edgeAt(
  points: readonly GroundProfilePoint[] | undefined,
  x: number,
  key: "top" | "bottom",
  fallback: number,
): number {
  if (!points) return fallback;
  let prev: GroundProfilePoint | undefined;
  let next: GroundProfilePoint | undefined;
  for (const p of points) {
    if (p[key] === undefined) continue;
    if (p.x <= x && (!prev || p.x > prev.x)) prev = p;
    if (p.x >= x && (!next || p.x < next.x)) next = p;
  }
  if (!prev && !next) return fallback;
  if (!prev) return (next as GroundProfilePoint)[key] as number;
  if (!next || next.x === prev.x) return prev[key] as number;
  const t = (x - prev.x) / (next.x - prev.x);
  return (prev[key] as number) + t * ((next[key] as number) - (prev[key] as number));
}

/**
 * The walkable edges at a given x. Without a profile they are the band's
 * constants; with one they follow the architecture — the parapet stepping
 * back, the ramp descending, the platform tapering to its nose.
 */
export function edgesAt(band: GroundBand, x: number): { top: number; bottom: number } {
  const top = edgeAt(band.profile, x, "top", band.top);
  const bottom = edgeAt(band.profile, x, "bottom", band.bottom);
  // a malformed profile must never invert the band
  return top <= bottom ? { top, bottom } : { top: bottom, bottom: top };
}

/** Clamp a feet-y into the band's constant edges (profile-free scenes). */
export function clampY(band: GroundBand, y: number): number {
  return clampN(y, band.top, band.bottom);
}

/** Clamp a feet-y into the band at a specific x — the profile-aware clamp. */
export function clampYAt(band: GroundBand, x: number, y: number): number {
  const e = edgesAt(band, x);
  return clampN(y, e.top, e.bottom);
}

/* ------------------------------------------------------------ blockers --- */

/** True when the feet point sits inside any blocker. */
export function insideBlocker(
  blockers: readonly GroundBlocker[] | undefined,
  x: number,
  y: number,
): boolean {
  if (!blockers) return false;
  for (const b of blockers) {
    if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return true;
  }
  return false;
}

/**
 * One movement step on the band. Applies dx then dy, each axis kept only if
 * it doesn't land inside a blocker — so a diagonal into a wall becomes a
 * slide along it. A player already standing inside a blocker (spawned there,
 * or the scene data changed under a save) is never trapped: blockers are
 * ignored until the feet are free again.
 *
 * x is clamped to [minX, maxX] (the scene's EDGE_MARGIN bounds), y to the
 * band's edges at the RESOLVED x — so walking along a ramp carries the feet
 * up it without the player steering. Returns the resolved feet position.
 */
export function stepOnGround(
  band: GroundBand,
  x: number,
  y: number,
  dx: number,
  dy: number,
  minX: number,
  maxX: number,
): { x: number; y: number } {
  const blockers = band.blockers;
  const stuck = insideBlocker(blockers, x, clampYAt(band, x, y));
  let nx = clampN(x + dx, minX, maxX);
  let ny = clampYAt(band, nx, y);
  if (!stuck && insideBlocker(blockers, nx, ny)) {
    nx = x;
    ny = clampYAt(band, nx, y);
  }
  const wantY = clampYAt(band, nx, ny + dy);
  if (stuck || !insideBlocker(blockers, nx, wantY)) ny = wantY;
  return { x: nx, y: ny };
}

/* ------------------------------------------------------------ surfaces --- */

/**
 * What the ground is made of at a point — the first matching zone wins, so
 * authors layer specific patches over broad ones by declaring them first.
 * Null between zones: plain ground.
 */
export function surfaceAt(band: GroundBand, x: number, y: number): string | null {
  if (!band.zones) return null;
  for (const z of band.zones) {
    if (x >= z.x0 && x <= z.x1 && y >= (z.y0 ?? band.top) && y <= (z.y1 ?? band.bottom)) {
      return z.kind;
    }
  }
  return null;
}

/** Walk-speed multiplier at a point — mud slows, ice may hurry. Default 1. */
export function speedAt(band: GroundBand, x: number, y: number): number {
  if (!band.zones) return 1;
  for (const z of band.zones) {
    if (
      z.speed !== undefined &&
      x >= z.x0 &&
      x <= z.x1 &&
      y >= (z.y0 ?? band.top) &&
      y <= (z.y1 ?? band.bottom)
    ) {
      return z.speed;
    }
  }
  return 1;
}

/* ----------------------------------------------------------- targeting --- */

/**
 * The nearest standable point to a requested one: inside the band's edges
 * and outside every blocker. Tap a bench and the walk aims beside it instead
 * of stalling against it.
 */
export function nearestWalkable(
  band: GroundBand,
  x: number,
  y: number,
  minX: number,
  maxX: number,
): { x: number; y: number } {
  let nx = clampN(x, minX, maxX);
  let ny = clampYAt(band, nx, y);
  const blockers = band.blockers;
  if (!blockers) return { x: nx, y: ny };
  for (let guard = 0; guard < 4; guard++) {
    const hit = blockers.find((b) => nx >= b.x0 && nx <= b.x1 && ny >= b.y0 && ny <= b.y1);
    if (!hit) break;
    // push out through the nearest face that actually clears once clamped —
    // a face flush with the band's edge would only bounce the point back in
    const pad = 2;
    const outs = [
      { x: hit.x0 - pad, y: ny, d: nx - hit.x0 },
      { x: hit.x1 + pad, y: ny, d: hit.x1 - nx },
      { x: nx, y: hit.y0 - pad, d: ny - hit.y0 },
      { x: nx, y: hit.y1 + pad, d: hit.y1 - ny },
    ].sort((a, b) => a.d - b.d);
    let escaped = false;
    for (const out of outs) {
      const cx = clampN(out.x, minX, maxX);
      const cy = clampYAt(band, cx, out.y);
      if (!(cx >= hit.x0 && cx <= hit.x1 && cy >= hit.y0 && cy <= hit.y1)) {
        nx = cx;
        ny = cy;
        escaped = true;
        break;
      }
    }
    if (!escaped) break; // enclosed on every side — stall detection's problem
  }
  return { x: nx, y: ny };
}

/* -------------------------------------------------------------- routing -- */

/** Segment/AABB intersection (slab method), with the rect padded a little. */
function segmentHits(b: GroundBlocker, x0: number, y0: number, x1: number, y1: number): boolean {
  const pad = 0.5;
  const lo = { x: b.x0 - pad, y: b.y0 - pad };
  const hi = { x: b.x1 + pad, y: b.y1 + pad };
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tMin = 0;
  let tMax = 1;
  for (const [p, d, mn, mx] of [
    [x0, dx, lo.x, hi.x],
    [y0, dy, lo.y, hi.y],
  ] as const) {
    if (Math.abs(d) < 1e-9) {
      if (p < mn || p > mx) return false;
    } else {
      let t1 = (mn - p) / d;
      let t2 = (mx - p) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

function firstHit(
  blockers: readonly GroundBlocker[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): GroundBlocker | null {
  for (const b of blockers) if (segmentHits(b, x0, y0, x1, y1)) return b;
  return null;
}

/**
 * A short walkable route from (sx,sy) to (tx,ty): the target itself when the
 * straight line is clear, otherwise a detour around the blocking rect via
 * whichever of its padded corners gives the shortest clear path — recursing a
 * couple of levels so two pieces of furniture in file are still walked
 * around. Not a navmesh and not trying to be one: scenes here hold a handful
 * of rectangles, and a greedy corner detour reads exactly like a person
 * stepping around a bench. Returns waypoints EXCLUDING the start, ending on
 * the (snapped) target; a route it cannot find degrades to the straight line
 * and the walk's stall detector has the final word.
 */
export function planRoute(
  band: GroundBand,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  minX: number,
  maxX: number,
  depth = 3,
): { x: number; y: number }[] {
  const target = nearestWalkable(band, tx, ty, minX, maxX);
  const blockers = band.blockers;
  if (!blockers || blockers.length === 0) return [target];
  const route = plan(sx, sy, target.x, target.y, depth);
  return route ?? [target];

  function plan(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    left: number,
  ): { x: number; y: number }[] | null {
    const hit = firstHit(blockers as readonly GroundBlocker[], x0, y0, x1, y1);
    if (!hit) return [{ x: x1, y: y1 }];
    if (left <= 0) return null;
    const pad = 3;
    const corners = [
      { x: hit.x0 - pad, y: hit.y0 - pad },
      { x: hit.x1 + pad, y: hit.y0 - pad },
      { x: hit.x0 - pad, y: hit.y1 + pad },
      { x: hit.x1 + pad, y: hit.y1 + pad },
    ]
      .map((c) => {
        const cx = clampN(c.x, minX, maxX);
        return { x: cx, y: clampYAt(band, cx, c.y) };
      })
      .filter((c) => !insideBlocker(blockers, c.x, c.y));
    let best: { via: { x: number; y: number }[]; len: number } | null = null;
    for (const c of corners) {
      const toCorner = plan(x0, y0, c.x, c.y, left - 1);
      if (!toCorner) continue;
      const onward = plan(c.x, c.y, x1, y1, left - 1);
      if (!onward) continue;
      const via = [...toCorner, ...onward];
      let len = 0;
      let px = x0;
      let py = y0;
      for (const w of via) {
        len += Math.hypot(w.x - px, w.y - py);
        px = w.x;
        py = w.y;
      }
      if (!best || len < best.len) best = { via, len };
    }
    return best?.via ?? null;
  }
}
