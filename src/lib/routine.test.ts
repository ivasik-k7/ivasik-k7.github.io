import { describe, expect, it } from "vitest";
import { applyEvent, freshBody } from "./body";
import { earnedBuild, morningAfter } from "./routine";
import { initialWorld, type WorldState } from "./worldState";

describe("the routine", () => {
  it("the chores come back every morning", () => {
    const w: WorldState = {
      ...initialWorld,
      studio: { ...initialWorld.studio!, dishesDone: true, binEmptied: true, bowlsFilled: true },
    };
    const m = morningAfter(w);
    expect(m.studio).toMatchObject({ dishesDone: false, binEmptied: false, bowlsFilled: false });
  });

  it("training earns a build, and never takes one away", () => {
    expect(earnedBuild(0, "slight")).toBe("slight");
    expect(earnedBuild(8, "slight")).toBe("lean");
    expect(earnedBuild(25, "slight")).toBe("athletic");
    expect(earnedBuild(8, "athletic")).toBe("athletic");
    expect(earnedBuild(70, "lean")).toBe("powerlifter");
    let w: WorldState = {
      ...initialWorld,
      appearance: { ...initialWorld.appearance, build: "slight" },
      ...freshBody(9),
    };
    for (let i = 0; i < 20; i++) w = applyEvent(w, { kind: "train" });
    expect(morningAfter(w).appearance.build).toBe("athletic");
  });
});
