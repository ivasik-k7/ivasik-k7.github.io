import { describe, expect, it } from "vitest";
import { newCamRig, stepCamRig } from "./cameraRig";
import { FLOOR_Y, SCENE_HEIGHT } from "./constants";
import { cameraTransform } from "./math";

/** A common frame: 3× scale, 1280×720 view; 400gp scene → 1200px, fits the view. */
const base = {
  frameMs: 16.7,
  now: 1000,
  reduced: false,
  moving: false,
  playerX: 300,
  facing: 1 as const,
  sceneW: 400,
  scale: 3,
  viewW: 1280,
  viewH: 720,
};

describe("camera rig", () => {
  it("snaps to the ideal pan on the first frame instead of easing across the scene", () => {
    const rig = newCamRig();
    const v = stepCamRig(rig, base);
    const ideal = cameraTransform(300, 400, 3, 1280, 720).x;
    expect(rig.x).toBeCloseTo(ideal, 5);
    // small scene in a wide view: not scrollable, pan centres the artwork
    expect(v.scrollable).toBe(false);
    expect(v.panX).toBeCloseTo(ideal, 5);
    expect(v.zoom).toBe(1);
  });

  it("eases toward a new target and reduced motion snaps instead", () => {
    const wide = { ...base, sceneW: 1760, playerX: 200 };
    const rig = newCamRig();
    stepCamRig(rig, wide);
    const from = rig.x;
    const target = cameraTransform(900, 1760, 3, 1280, 720).x;
    stepCamRig(rig, { ...wide, playerX: 900 });
    expect(rig.x).not.toBeCloseTo(target, 1); // one eased step, not there yet
    expect(Math.abs(rig.x - target)).toBeLessThan(Math.abs(from - target));
    const snap = newCamRig();
    stepCamRig(snap, { ...wide, reduced: true });
    stepCamRig(snap, { ...wide, playerX: 900, reduced: true });
    expect(snap.x).toBeCloseTo(target, 5);
  });

  it("leans into the walk only when scrolling and unfocused", () => {
    const wide = { ...base, sceneW: 1760, playerX: 900, moving: true };
    const rig = newCamRig();
    stepCamRig(rig, wide);
    for (let i = 0; i < 60; i++) stepCamRig(rig, { ...wide, now: 1000 + i * 16.7 });
    expect(rig.look).toBeLessThan(-30); // facing right leans the camera ahead (negative pan)
    const still = newCamRig();
    stepCamRig(still, base); // not scrollable
    expect(still.look).toBe(0);
  });

  it("pins a cinematic focus and scales about it", () => {
    const wide = { ...base, sceneW: 1760 };
    const rig = newCamRig();
    rig.focusX = 400;
    const v = stepCamRig(rig, wide);
    expect(v.originX).toBe(400 * 3);
    expect(v.originY).toBe(FLOOR_Y * 3);
    expect(v.panX).toBeCloseTo(1280 / 2 - 400 * 3, 5);
  });

  it("keeps both scene edges outside the viewport under zoom", () => {
    const wide = { ...base, sceneW: 1760, playerX: 100 };
    const rig = newCamRig();
    rig.zoomTarget = 2;
    let v = stepCamRig(rig, wide);
    for (let i = 0; i < 200; i++) v = stepCamRig(rig, { ...wide, now: 1000 + i * 16.7 });
    expect(v.zoom).toBe(2);
    const worldW = 1760 * 3;
    const maxPan = v.originX * (v.zoom - 1);
    const minPan = 1280 - v.originX - (worldW - v.originX) * v.zoom;
    expect(v.panX).toBeLessThanOrEqual(maxPan + 0.001);
    expect(v.panX).toBeGreaterThanOrEqual(minPan - 0.001);
  });

  it("bobs while walking, breathes while standing, holds still under reduced motion", () => {
    const wide = { ...base, sceneW: 1760 };
    const rig = newCamRig();
    stepCamRig(rig, wide);
    const flatY = cameraTransform(300, 1760, 3, 1280, 720);
    void flatY;
    const still = stepCamRig(rig, { ...wide, reduced: true });
    const restY = Math.max(0, (720 - SCENE_HEIGHT * 3) / 2);
    expect(still.panY).toBeCloseTo(restY, 5); // no bob, no sway
    stepCamRig(rig, { ...wide, moving: true, now: 1030 });
    expect(rig.bobT).toBeGreaterThan(0);
    stepCamRig(rig, { ...wide, moving: false, now: 1060 });
    expect(rig.bobT).toBe(0);
    expect(rig.swayT).toBeGreaterThan(0);
  });

  it("decays a shake and clears the magnitude after it", () => {
    const rig = newCamRig();
    rig.shakeMag = 6;
    rig.shakeUntil = base.now + 100;
    stepCamRig(rig, base);
    expect(rig.shakeMag).toBe(6); // still live
    stepCamRig(rig, { ...base, now: base.now + 200 });
    expect(rig.shakeMag).toBe(0); // expired and cleared
  });
});
