import { describe, expect, it } from "vitest";
import { FLOOR_Y } from "./constants";
import { clampY, groundOf, hasDepth, insideBlocker, SINGLE_LINE, stepOnGround } from "./ground";
import type { GroundBand } from "./runtime-types";

const BAND: GroundBand = { top: 150, bottom: 168 };

describe("ground band", () => {
  it("defaults to the single floor line", () => {
    expect(groundOf(undefined)).toEqual({ top: FLOOR_Y, bottom: FLOOR_Y });
    expect(groundOf({})).toBe(SINGLE_LINE);
    expect(hasDepth(SINGLE_LINE)).toBe(false);
    expect(hasDepth(BAND)).toBe(true);
  });

  it("clamps feet-y into the band", () => {
    expect(clampY(BAND, 100)).toBe(150);
    expect(clampY(BAND, 200)).toBe(168);
    expect(clampY(BAND, 160)).toBe(160);
    expect(clampY(SINGLE_LINE, 999)).toBe(FLOOR_Y);
  });

  it("moves freely inside the band and stops at the edges", () => {
    const step = stepOnGround(BAND, 100, 160, 5, 5, 20, 400);
    expect(step).toEqual({ x: 105, y: 165 });
    // y pinned at the bottom, x still free
    expect(stepOnGround(BAND, 100, 168, 3, 10, 20, 400)).toEqual({ x: 103, y: 168 });
    // x pinned at the margin, y still free
    expect(stepOnGround(BAND, 20, 160, -10, -4, 20, 400)).toEqual({ x: 20, y: 156 });
  });

  it("behaves exactly like the 1D floor on a degenerate band", () => {
    const step = stepOnGround(SINGLE_LINE, 100, FLOOR_Y, 7, -5, 20, 400);
    expect(step).toEqual({ x: 107, y: FLOOR_Y });
  });

  const WALLED: GroundBand = { ...BAND, blockers: [{ x0: 110, y0: 150, x1: 130, y1: 160 }] };

  it("detects blocker hits by the feet point", () => {
    expect(insideBlocker(WALLED.blockers, 120, 155)).toBe(true);
    expect(insideBlocker(WALLED.blockers, 120, 165)).toBe(false);
    expect(insideBlocker(undefined, 120, 155)).toBe(false);
  });

  it("slides along a blocker instead of sticking to it", () => {
    // walking right into the box: x rejected, y keeps moving
    const slide = stepOnGround(WALLED, 108, 155, 4, 2, 20, 400);
    expect(slide.x).toBe(108);
    expect(slide.y).toBe(157);
    // walking under the box: free
    const under = stepOnGround(WALLED, 108, 165, 4, 0, 20, 400);
    expect(under.x).toBe(112);
  });

  it("never traps feet that start inside a blocker", () => {
    const freed = stepOnGround(WALLED, 120, 155, 4, 0, 20, 400);
    expect(freed.x).toBe(124);
  });
});
