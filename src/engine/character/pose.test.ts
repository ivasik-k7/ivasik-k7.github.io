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
    const m = buildPose(rig, { legs: "sit", arms: ["arm"], drop: 1 });
    // dropped one row: the body comes down, the torso's last row goes into the
    // legs' blank top row, and the arm (patched before the drop) rides with it
    expect(m).toEqual(["....", ".hh.", ".ss.", "sttt", "sttt", "pppp", "b..b"]);
  });

  it("puts `over` patches on after the head has moved", () => {
    const chin = buildPose(rig, { legs: "legs", head: { chin: true }, over: ["cup"] });
    // head rows 0-1 → ".ss." then blank; the cup lands at its row regardless
    expect(chin[0]).toBe(".ss.");
    expect(chin[1]).toBe("...c");
    const before = buildPose(rig, { legs: "legs", head: { chin: true }, arms: ["cup"] });
    // patched before the chin came up, the cup went with the face
    expect(before[0]).toBe(".ssc");
  });

  it("overlay: another pose's arms and head on this pose's legs", () => {
    const drinking = { legs: "legs", head: { bow: 1 }, arms: ["arm"], over: ["cup"] };
    const seated = { legs: "sit", drop: 1 };
    const combined = overlay(drinking, seated);
    expect(combined).toEqual({
      legs: "sit",
      drop: 1,
      lift: undefined,
      arms: ["arm"],
      head: { bow: 1 },
      over: ["cup"],
      posture: undefined,
    });
    const m = buildPose(rig, combined);
    expect(m.length).toBe(7);
    // the cup is shifted by the drop: row 1 + 1
    expect(m[2]).toContain("c");
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
    expect(() => buildPose(rig, { legs: "legs", arms: ["x"] })).toThrow(/unknown patch "x"/);
  });
});
