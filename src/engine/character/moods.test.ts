import { describe, expect, it } from "vitest";
import type { PlayerConfig } from "../core/types";
import {
  addFaceLayer,
  addMoodLayer,
  blinkFrame,
  isDerivedFrame,
  MOODS,
  moodFrame,
  moodTwin,
} from "./compile";

// a 6×5 face: hair, brow row, eye row (nose to the right), mouth row, chin
const FACE = ["..hhh.", ".Hhhh.", ".sses.", ".ssss.", "..sss."];
const cfg = (): PlayerConfig => ({
  width: 12,
  height: 10,
  palette: {},
  frames: { stand: FACE, back: ["..hhh.", ".hhhh.", ".hhhh.", "......", "......"] },
  walkCycle: ["stand"],
  actions: {},
});

describe("moods", () => {
  it("every mood moves cells around the eye and only over skin", () => {
    for (const mood of MOODS) {
      const twin = moodTwin(FACE, mood);
      expect(twin, mood).not.toBeNull();
      expect(twin).not.toEqual(FACE);
      // the eye stays where it was (surprise adds a second below it)
      expect(twin?.[2].indexOf("e")).toBe(3);
    }
    // the corner behind the eye goes dark, the cheek in front of it lights
    expect(moodTwin(FACE, "smile")?.[3]).toBe(".syFs.");
    expect(moodTwin(FACE, "sad")?.[4]).toBe("..sFs.");
    expect(moodTwin(FACE, "surprise")?.[3][3]).toBe("e");
  });

  it("a face turned the other way gets its mood on the same side of the nose", () => {
    const mirrored = FACE.map((r) => [...r].reverse().join(""));
    const twin = moodTwin(mirrored, "smile");
    expect(twin?.[3]).toBe(".sFys.");
  });

  it("frames without an eye get no twin", () => {
    expect(moodTwin(["......", "..hh.."], "smile")).toBeNull();
  });

  it("the layer records twins in derived, and the blink layer gives each its own", () => {
    const out = addFaceLayer(addMoodLayer(cfg()));
    for (const mood of MOODS) {
      const t = moodFrame(out, "stand", mood);
      expect(t).toBe(`stand~${mood}`);
      expect(isDerivedFrame(out, t)).toBe(true);
      expect(blinkFrame(out, t)).toBe(`${t}~blink`);
    }
    expect(moodFrame(out, "back", "smile")).toBe("back");
    expect(moodFrame(out, "stand", null)).toBe("stand");
  });
});
