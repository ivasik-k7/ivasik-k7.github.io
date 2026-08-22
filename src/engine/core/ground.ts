import { FLOOR_Y } from "./constants";
import type { GroundBand, GroundBlocker } from "./runtime-types";

/**
 * ground.ts — the walkable depth band, as pure functions.
 *
 * The engine's floor used to be one line (FLOOR_Y). A scene may now declare
 * `ground: {top, bottom, blockers?}` and the player walks up and down inside
 * that band. Everything here is allocation-light and DOM-free so the sim can
 * call it every fixed step and tests can call it without a browser.
 *
 * Conventions:
 *  - y is the FEET line in scene space; larger y = nearer the camera.
 *  - a scene without `ground` gets the degenerate band {FLOOR_Y, FLOOR_Y},
 *    which makes every function below collapse to the old single-line math.
 *  - collision is the feet POINT vs axis-aligned blocker rects, resolved one
 *    axis at a time so walking into a bench slides you along it.
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

/** Clamp a feet-y into the band. */
export function clampY(band: GroundBand, y: number): number {
  return clampN(y, band.top, band.bottom);
}

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
 * band. Returns the resolved feet position.
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
  const stuck = insideBlocker(blockers, x, clampY(band, y));
  let nx = clampN(x + dx, minX, maxX);
  let ny = clampY(band, y);
  if (!stuck && insideBlocker(blockers, nx, ny)) nx = x;
  const wantY = clampY(band, ny + dy);
  if (stuck || !insideBlocker(blockers, nx, wantY)) ny = wantY;
  return { x: nx, y: ny };
}
