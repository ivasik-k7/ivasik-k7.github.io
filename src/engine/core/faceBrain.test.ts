import { describe, expect, it } from "vitest";
import { BLINK_MS, newFaceState, stepFace } from "./faceBrain";

describe("faceBrain", () => {
  it("blinks for BLINK_MS and never two ticks apart", () => {
    const face = newFaceState();
    let closed = 0;
    let longest = 0;
    let run = 0;
    let gaps = 0;
    let lastOpen = -1;
    for (let now = 0; now < 120_000; now += 16) {
      const shut = stepFace(face, now);
      if (shut) {
        closed += 1;
        run += 16;
        longest = Math.max(longest, run);
      } else {
        if (run > 0) {
          if (lastOpen >= 0) gaps += 1;
          lastOpen = now;
        }
        run = 0;
      }
    }
    expect(closed).toBeGreaterThan(0);
    expect(longest).toBeLessThanOrEqual(BLINK_MS + 16);
    // 2 minutes at 2–6 s per blink: somewhere between 15 and 60
    expect(gaps).toBeGreaterThan(14);
    expect(gaps).toBeLessThan(61);
  });

  it("is deterministic for the same clock", () => {
    const a = newFaceState();
    const b = newFaceState();
    const seq = (f: typeof a) => {
      const out: boolean[] = [];
      for (let now = 0; now < 30_000; now += 33) out.push(stepFace(f, now));
      return out;
    };
    expect(seq(a)).toEqual(seq(b));
  });
});
