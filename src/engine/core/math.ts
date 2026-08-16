import { DEFAULT_RANGE, MAX_SCALE, MIN_SCALE, SCENE_HEIGHT } from "./constants";
import type { SceneObject } from "./types";

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
