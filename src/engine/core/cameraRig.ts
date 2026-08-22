import { FLOOR_Y } from "./constants";
import { cameraTransform } from "./math";

/**
 * cameraRig.ts — a rig, not a bolt: eased follow, look-ahead into the walk,
 * step bob, an idle breath, decaying shake, plus a cinematic focus and an
 * eased zoom. Extracted from the loop so the follow curves are testable and
 * the runtime only owns the DOM writes the rig's numbers turn into.
 *
 * Everything here is per-frame math on a caller-owned mutable rig. The rig's
 * fields double as the imperative control surface: `focusCamera` writes
 * `focusX`, `zoomTo` writes `zoomTarget`/`zoomRate`, `shakeCamera` writes
 * `shakeMag`/`shakeUntil`, and travel resets `x` to NaN so the next frame
 * snaps instead of easing across the whole scene.
 */

export type CamRig = {
  /** Eased pan; NaN = snap to target on the first frame / after travel. */
  x: number;
  look: number;
  bobT: number;
  swayT: number;
  shakeMag: number;
  shakeUntil: number;
  focusX: number | null;
  zoom: number;
  zoomTarget: number;
  zoomRate: number;
};

export const newCamRig = (): CamRig => ({
  x: Number.NaN,
  look: 0,
  bobT: 0,
  swayT: 0,
  shakeMag: 0,
  shakeUntil: 0,
  focusX: null,
  zoom: 1,
  zoomTarget: 1,
  zoomRate: 3.5,
});

/** The composed view for one frame, in device px. */
export type CamView = {
  panX: number;
  panY: number;
  zoom: number;
  originX: number;
  originY: number;
  scrollable: boolean;
};

const clampN = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function stepCamRig(
  rig: CamRig,
  a: {
    frameMs: number;
    now: number;
    reduced: boolean;
    moving: boolean;
    playerX: number;
    facing: 1 | -1;
    sceneW: number;
    scale: number;
    viewW: number;
    viewH: number;
  },
): CamView {
  const { frameMs, now, reduced, moving, playerX, facing, sceneW, scale, viewW, viewH } = a;
  const scrollable = sceneW * scale > viewW;
  const focused = rig.focusX;
  const cam = cameraTransform(playerX, sceneW, scale, viewW, viewH);
  const idealPan = focused === null ? cam.x : viewW / 2 - focused * scale;

  if (Number.isNaN(rig.x)) {
    rig.x = idealPan;
    rig.look = 0;
    rig.zoom = rig.zoomTarget;
  }
  // exponential ease toward the ideal position — frame-rate independent
  const follow = reduced ? 1 : 1 - Math.exp(-(frameMs / 1000) * 6.5);
  rig.x += (idealPan - rig.x) * follow;
  rig.zoom += (rig.zoomTarget - rig.zoom) * (1 - Math.exp(-(frameMs / 1000) * rig.zoomRate));
  if (Math.abs(rig.zoom - rig.zoomTarget) < 0.002) rig.zoom = rig.zoomTarget;
  // look-ahead: lean into the walk, settle back when standing
  const lookTarget =
    scrollable && moving && focused === null && !reduced ? -facing * 22 * scale : 0;
  rig.look += (lookTarget - rig.look) * (1 - Math.exp(-(frameMs / 1000) * 2.2));
  // step bob while walking, a slow breath while standing
  let bobY = 0;
  if (reduced) {
    rig.bobT = 0;
  } else if (moving) {
    rig.bobT += frameMs / 1000;
    bobY = Math.sin(rig.bobT * 13) * 0.3 * scale;
  } else {
    rig.bobT = 0;
    rig.swayT += frameMs / 1000;
    bobY = Math.sin(rig.swayT * 0.9) * 0.12 * scale;
  }
  // shake: random decaying offset
  let shakeX = 0;
  let shakeY = 0;
  if (now < rig.shakeUntil) {
    const left = (rig.shakeUntil - now) / 300;
    const mag = rig.shakeMag * Math.min(1, left);
    shakeX = (Math.random() * 2 - 1) * mag;
    shakeY = (Math.random() * 2 - 1) * mag;
  } else {
    rig.shakeMag = 0;
  }

  // scale about the focus point, so pan math stays zoom-independent
  const originX = (focused === null ? playerX : focused) * scale;
  const originY = FLOOR_Y * scale;
  const zoom = rig.zoom;
  let panX = rig.x + rig.look + shakeX;
  if (scrollable || zoom !== 1) {
    // keep both scene edges outside the viewport under the composed transform
    const worldW = sceneW * scale;
    const maxPan = originX * (zoom - 1);
    const minPan = viewW - originX - (worldW - originX) * zoom;
    panX = minPan > maxPan ? (minPan + maxPan) / 2 : clampN(panX, minPan, maxPan);
  }
  const panY = cam.y + bobY + shakeY;
  return { panX, panY, zoom, originX, originY, scrollable };
}
