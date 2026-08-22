import {
  DEFAULT_RANGE,
  DEPTH_RANGE,
  FACING_AHEAD_MULT,
  FACING_BEHIND_MULT,
  FLOOR_Y,
  MAX_SCALE,
  MIN_SCALE,
  PRIORITY_GP,
  SCENE_HEIGHT,
  STICKY_MARGIN,
} from "./constants";
import type { AnyWorld, SceneObject } from "./types";

/** Integer pixel scale for a viewport height — keeps sprites crisp. */
export function viewportScale(viewH: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.floor(viewH / SCENE_HEIGHT)));
}

/**
 * Camera: center small scenes; follow the player through wide ones,
 * clamped so the view never leaves the artwork.
 * Returns the scene container's translate offsets in device px.
 */
export function cameraTransform(
  playerX: number,
  sceneWidth: number,
  scale: number,
  viewW: number,
  viewH: number,
): { x: number; y: number; camLogical: number } {
  const scenePx = sceneWidth * scale;
  const y = Math.max(0, (viewH - SCENE_HEIGHT * scale) / 2);
  if (scenePx <= viewW) {
    return { x: (viewW - scenePx) / 2, y, camLogical: 0 };
  }
  const cam = Math.max(0, Math.min(playerX * scale - viewW / 2, scenePx - viewW));
  return { x: -cam, y, camLogical: cam / scale };
}

/** One targeting candidate: raw distance plus the shaped score it competes on. */
export interface DetectedObject {
  obj: SceneObject;
  dist: number;
  /** Lower is better — distance shaped by facing direction and priority. */
  score: number;
}

/**
 * Every interactable in range, best first. The score is the distance bent by
 * intent: objects the player faces feel closer, objects behind feel farther,
 * and `priority` lets an NPC out-rank the bin it's standing next to.
 * Objects with a false `when(world)` don't exist for targeting at all.
 *
 * In ground-band scenes the player also has a feet-y; an object out of depth
 * reach (|dy| beyond its `yRange`) is skipped, and depth distance is added to
 * the score so the thing at your own depth wins a tie. In single-line scenes
 * every dy is 0 and the scoring is bit-identical to the 1D version.
 */
export function detectObjects(
  objects: SceneObject[],
  x: number,
  facing: 1 | -1,
  world: AnyWorld,
  y: number = FLOOR_Y,
): DetectedObject[] {
  const found: DetectedObject[] = [];
  for (const obj of objects) {
    if (obj.when && !obj.when(world)) continue;
    const dist = Math.abs(obj.x - x);
    if (dist > (obj.range ?? DEFAULT_RANGE)) continue;
    const dy = Math.abs((obj.y ?? FLOOR_Y) - y);
    if (dy > (obj.yRange ?? DEPTH_RANGE)) continue;
    const ahead = dist < 2 || Math.sign(obj.x - x) === facing;
    const score =
      dist * (ahead ? FACING_AHEAD_MULT : FACING_BEHIND_MULT) +
      dy -
      (obj.priority ?? 0) * PRIORITY_GP;
    found.push({ obj, dist, score });
  }
  found.sort((a, b) => a.score - b.score);
  return found;
}

/**
 * Which candidate holds focus. Three rules, in order: a manual lock keeps the
 * target while it stays in range (and is released the moment it leaves);
 * otherwise the current target keeps focus unless something beats it by more
 * than the sticky margin — hysteresis, so the prompt never flickers between
 * two neighbours; otherwise the best-scored candidate wins.
 */
export function resolveActiveTarget(
  detected: DetectedObject[],
  prevId: string | null,
  lockId: string | null,
  stickyMargin: number = STICKY_MARGIN,
): { active: SceneObject | null; lockId: string | null } {
  if (detected.length === 0) return { active: null, lockId: null };
  const locked = lockId ? detected.find((d) => d.obj.id === lockId) : undefined;
  if (locked) return { active: locked.obj, lockId };
  const prev = prevId ? detected.find((d) => d.obj.id === prevId) : undefined;
  const active =
    prev && prev.score <= detected[0].score + stickyMargin ? prev.obj : detected[0].obj;
  return { active, lockId: null };
}

/** Nearest object within its interaction range, or null. */
export function nearestObject(objects: SceneObject[], x: number): SceneObject | null {
  let best: SceneObject | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const obj of objects) {
    const dist = Math.abs(obj.x - x);
    if (dist <= (obj.range ?? DEFAULT_RANGE) && dist < bestDist) {
      best = obj;
      bestDist = dist;
    }
  }
  return best;
}
