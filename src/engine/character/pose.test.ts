import { describe, expect, it } from "vitest";
import { bowHead, buildPose, dropBody, liftBody, overlay, type PoseRig, raiseChin } from "./pose";

// a tiny rig: 4-column figure, head 2 rows, torso 2 rows, legs 3 rows
const rig: PoseRig = {
  headRows: 2,
  legsRow: 4,
  parts: {
    head: [".hh.", ".ss."],
    torso: ["tttt", "tttt"],
    legs: ["p..p", "p..p", "b..b"],
    sit: ["....", "pppp", "b..b"],
  },
  patches: {
    arm: { r: 2, c: 0, rows: ["s", "s"] },
    cup: { r: 1, c: 3, rows: ["c"] },
  },
  posture: (m) => m.map((r) => r.replace("h", "k")),
};

describe("pose", () => {
  it("stacks, patches arms in body coordinates, then moves the body", () => {
    const m = buildPose(rig, { legs: "sit", near: ["arm"], drop: 1 });
    // dropped one row: the body comes down, the torso's last row goes into the
    // legs' blank top row, and the arm (patched before the drop) rides with it
    expect(m).toEqual(["....", ".hh.", ".ss.", "sttt", "sttt", "pppp", "b..b"]);
  });

  it("puts `over` patches on after the head has moved", () => {
    const chin = buildPose(rig, { legs: "legs", head: { chin: true }, over: ["cup"] });
    // head rows 0-1 → ".ss." then the neck row again (a raised chin keeps its
    // neck); the cup lands at its row regardless
    expect(chin[0]).toBe(".ss.");
    expect(chin[1]).toBe(".ssc");
    const before = buildPose(rig, { legs: "legs", head: { chin: true }, props: ["cup"] });
    // patched before the chin came up, the cup went with the face
    expect(before[0]).toBe(".ssc");
  });

  it("overlay: the upper's arm slots replace the lower's, props and over accumulate", () => {
    const drinking = { legs: "legs", head: { bow: 1 }, near: ["arm"], over: ["cup"] };
    const walking = { legs: "legs", far: ["arm"], near: ["cup"], props: ["cup"], posture: true };
    expect(overlay(drinking, walking)).toEqual({
      upper: undefined,
      legs: "legs",
      drop: undefined,
      lift: undefined,
      lean: undefined,
      rise: undefined,
      far: ["arm"],
      near: ["arm"],
      props: ["cup"],
      head: { bow: 1 },
      over: ["cup"],
      posture: true,
    });
  });

  it("overlay onto a dropped body moves the upper's arms after the drop", () => {
    const drinking = { legs: "legs", near: ["arm"], over: ["cup"] };
    const seated = { legs: "sit", drop: 1, near: ["arm"] };
    const combined = overlay(drinking, seated);
    expect(combined.near).toEqual(["arm"]); // the seat keeps its own arm underneath
    expect(combined.over).toEqual(["arm", "cup"]);
    const m = buildPose(rig, combined);
    expect(m.length).toBe(7);
    // the over-arm is shifted by the drop: patch row 2 → frame row 3
    expect(m[3][0]).toBe("s");
  });

  it("empty slots keep the lower's arms", () => {
    const upper = { legs: "legs", props: ["cup"] };
    const lower = { legs: "legs", far: ["arm"], near: ["arm"] };
    expect(overlay(upper, lower).far).toEqual(["arm"]);
    expect(overlay(upper, lower).near).toEqual(["arm"]);
  });

  it("lean shifts the body above the legs, not the legs", () => {
    const m = buildPose(rig, { legs: "legs", lean: 1 });
    expect(m[0]).toBe("..hh");
    expect(m[4]).toBe("p..p");
    const back = buildPose(rig, { legs: "legs", lean: -1 });
    expect(back[0]).toBe("hh..");
  });

  it("posture runs last and only when asked", () => {
    expect(buildPose(rig, { legs: "legs", posture: true })[0]).toBe(".kh.");
    expect(buildPose(rig, { legs: "legs" })[0]).toBe(".hh.");
  });

  it("helpers keep the row count", () => {
    const m = buildPose(rig, { legs: "legs" });
    for (const out of [bowHead(m, 1, 0, 2), raiseChin(m, 0, 2), dropBody(m, 1, 4)]) {
      expect(out.length).toBe(m.length);
    }
    expect(liftBody(["....", ...m], 2).length).toBe(m.length);
  });

  it("names the missing part or patch", () => {
    expect(() => buildPose(rig, { legs: "nope" })).toThrow(/unknown part "nope"/);
    expect(() => buildPose(rig, { legs: "legs", near: ["x"] })).toThrow(/unknown patch "x"/);
  });
});
