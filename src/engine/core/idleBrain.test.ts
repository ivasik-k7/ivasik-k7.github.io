import { describe, expect, it } from "vitest";
import { jitter, newIdleState, resetIdle, stepIdle } from "./idleBrain";

/** The frame the breath alone would give at `now` — mirrors the brain's clock. */
const breathAt = (now: number): string => {
  const cycle = 1500 + jitter(Math.floor(now / 3400), 500);
  return now % cycle < cycle * 0.52 ? "stand" : "idleB";
};

describe("idle brain", () => {
  it("jitter is deterministic and bounded", () => {
    expect(jitter(42, 100)).toBe(jitter(42, 100));
    for (const seed of [0, 1, 999, 123456]) {
      const j = jitter(seed, 50);
      expect(j).toBeGreaterThanOrEqual(0);
      expect(j).toBeLessThan(50);
    }
    expect(jitter(7, 0)).toBe(0); // span floor of 1
  });

  it("arms its clocks on the first standing tick", () => {
    const idle = newIdleState();
    stepIdle(idle, 1000, false, false);
    expect(idle.since).toBe(1000);
    expect(idle.nextFlourish).toBeGreaterThanOrEqual(1000 + 7000);
  });

  it("breathes on the shared clock", () => {
    const idle = newIdleState();
    idle.since = 1; // pre-armed, far-future flourish
    idle.nextFlourish = 1e9;
    for (const now of [500, 900, 1400, 2100, 3000]) {
      expect(stepIdle(idle, now, false, false)).toBe(breathAt(now));
    }
  });

  it("stretches when the flourish comes due, and re-arms after it", () => {
    const idle = newIdleState();
    idle.since = 1;
    idle.flourish = 0;
    idle.nextFlourish = 1000;
    expect(stepIdle(idle, 1100, false, false)).toBe("stretchA");
    expect(stepIdle(idle, 1800, false, false)).toBe("stretchB");
    // past the 2400ms budget the flourish retires and the next one is armed
    stepIdle(idle, 3500, false, false);
    expect(idle.nextFlourish).toBeGreaterThan(3500 + 7000 - 1);
  });

  it("leans instead when the scene asks for it, and never flourishes while paused", () => {
    const idle = newIdleState();
    idle.since = 1;
    idle.nextFlourish = 1000;
    expect(stepIdle(idle, 1100, false, true)).toBe("leanIdle");
    idle.nextFlourish = 1000;
    expect(stepIdle(idle, 1100, true, false)).toBe(breathAt(1100));
  });

  it("resets to re-arm on the next standing tick", () => {
    const idle = newIdleState();
    stepIdle(idle, 1000, false, false);
    resetIdle(idle);
    expect(idle.since).toBe(0);
    stepIdle(idle, 9000, false, false);
    expect(idle.since).toBe(9000);
  });
});
