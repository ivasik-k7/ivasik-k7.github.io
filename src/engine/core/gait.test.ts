import { describe, expect, it } from "vitest";
import {
  activeGait,
  cycleIndex,
  newGaitState,
  resolveGait,
  SETTLE_MS,
  setGaitOverride,
  stepGait,
  walkFrame,
  walkSpan,
} from "./gait";
import type { PlayerConfig } from "./types";

const CYCLE = ["cA", "rA", "pA", "lA", "cB", "rB", "pB", "lB"];
const cfg = (over: Partial<PlayerConfig> = {}): PlayerConfig => ({
  width: 48,
  height: 76,
  palette: {},
  frames: Object.fromEntries([...CYCLE, "scuffA", "lookB", "stand"].map((f) => [f, ["."]])),
  walkCycle: CYCLE,
  actions: {},
  walkStride: 8,
  walkStart: 3,
  ...over,
});

describe("gait", () => {
  it("advances one frame per stride, and the span is whole cycles", () => {
    const c = cfg();
    expect(cycleIndex(c, 0)).toBe(0);
    expect(cycleIndex(c, 7.9)).toBe(0);
    expect(cycleIndex(c, 8)).toBe(1);
    expect(cycleIndex(c, 8 * 8)).toBe(0);
    expect(walkSpan(c) % (8 * 8)).toBe(0);
    // the legacy default: 16 px, no start offset
    const legacy = cfg({ walkStride: undefined, walkStart: undefined });
    expect(cycleIndex(legacy, 16)).toBe(1);
  });

  it("starts a walk on the push-off frame, whatever distance the last one stopped at", () => {
    const g = newGaitState();
    const c = cfg();
    const step = stepGait(g, c, 123, true, 1, 1000);
    expect(step.walkDist).toBe(3 * 8);
    expect(step.frame).toBe("lA");
    // and carries on from there
    expect(stepGait(g, c, step.walkDist + 8, true, 1, 1016).frame).toBe("cB");
  });

  it("restarts on a turn — a plant and a new push", () => {
    const g = newGaitState();
    const c = cfg();
    stepGait(g, c, 0, true, 1, 0);
    const turned = stepGait(g, c, 50, true, -1, 16);
    expect(turned.walkDist).toBe(24);
    expect(turned.frame).toBe("lA");
  });

  it("settles through the pass of the current step, then hands the body to idle", () => {
    const g = newGaitState();
    const c = cfg();
    stepGait(g, c, 0, true, 1, 0);
    // stopped on the second step's contact → its pass, for one frame's time
    const stop = stepGait(g, c, 4 * 8, false, 1, 1000);
    expect(stop.frame).toBe("pB");
    expect(stepGait(g, c, 4 * 8, false, 1, 1000 + SETTLE_MS - 1).frame).toBe("pB");
    expect(stepGait(g, c, 4 * 8, false, 1, 1000 + SETTLE_MS).frame).toBeNull();
  });

  it("does not settle when it stopped on a pass already", () => {
    const g = newGaitState();
    const c = cfg();
    stepGait(g, c, 0, true, 1, 0);
    expect(stepGait(g, c, 2 * 8, false, 1, 1000).frame).toBeNull();
  });

  it("plays a variant on the cycles the hash picks, never on the first", () => {
    const c = cfg({
      walkVariants: [{ every: 1, frames: [null, null, null, "scuffA", null, null, null, null] }],
    });
    const cycle = 8 * 8;
    expect(walkFrame(c, 3 * 8)).toBe("lA"); // cycle 0
    expect(walkFrame(c, cycle + 3 * 8)).toBe("scuffA"); // every=1 → every later cycle
    expect(walkFrame(c, cycle + 2 * 8)).toBe("pA"); // only the slot it overrides
    // a variant naming a frame the config lacks falls back to the base frame
    const broken = cfg({ walkVariants: [{ every: 1, frames: ["nope", ...CYCLE.slice(1)] }] });
    expect(walkFrame(broken, cycle)).toBe("cA");
  });

  it("variants are deterministic and roughly as rare as asked", () => {
    const c = cfg({ walkVariants: [{ every: 5, frames: CYCLE.map(() => "lookB") }] });
    let hits = 0;
    for (let n = 1; n <= 500; n++) if (walkFrame(c, n * 64) === "lookB") hits++;
    expect(hits).toBeGreaterThan(60);
    expect(hits).toBeLessThan(140);
    expect(walkFrame(c, 7 * 64)).toBe(walkFrame(c, 7 * 64));
  });

  describe("gaits", () => {
    const withRun = () =>
      cfg({
        frames: Object.fromEntries(
          [...CYCLE, "rA", "rB", "rC", "rD", "rE", "rF", "stand"].map((f) => [f, ["."]]),
        ),
        gaits: {
          run: { cycle: ["rA", "rB", "rC", "rD", "rE", "rF"], stride: 12, start: 1, speed: 1.8 },
          drunk: { cycle: CYCLE, stride: 6 },
        },
      });

    it("resolves the walk from the walk fields and others from the table", () => {
      const c = withRun();
      expect(resolveGait(c).stride).toBe(8);
      expect(resolveGait(c, "run").speed).toBe(1.8);
      expect(resolveGait(c, "nope").cycle).toEqual(CYCLE);
    });

    it("the run key selects the run when the config has one; an override wins over it", () => {
      const g = newGaitState();
      const c = withRun();
      expect(activeGait(g, c, 0, true)).toBe("run");
      expect(activeGait(g, cfg(), 0, true)).toBe("walk");
      setGaitOverride(g, "drunk", 0, 1000);
      expect(activeGait(g, c, 500, true)).toBe("drunk");
      expect(activeGait(g, c, 1000, false)).toBe("walk");
      expect(g.override).toBeNull();
      setGaitOverride(g, "drunk", 0);
      expect(activeGait(g, c, 1e9, false)).toBe("drunk");
      setGaitOverride(g, null, 0);
      expect(activeGait(g, c, 0, false)).toBe("walk");
    });

    it("a change of gait mid-stride restarts on the new gait's push-off", () => {
      const g = newGaitState();
      const c = withRun();
      stepGait(g, c, 0, true, 1, 0);
      const run = stepGait(g, c, 100, true, 1, 16, "run");
      expect(run.walkDist).toBe(12);
      expect(run.frame).toBe("rB");
      expect(cycleIndex(c, run.walkDist + 12, "run")).toBe(2);
      expect(walkSpan(c, "run") % (12 * 6)).toBe(0);
    });
  });
});
