import { describe, expect, it } from "vitest";
import { bootsPass, extendRows, shiftSides, shortsPass, sleevePatch, widenRuns } from "./morph";

const STAND = [
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  ".......qppp..pppq.......",
  ".......qpp....ppq.......",
  ".......spp....pps.......",
  ".......bbb....bbb.......",
  "......bbbb....bbbb......",
  "......BBBB....BBBB......",
];

describe("widenRuns", () => {
  it("is the identity at zero", () => {
    expect(widenRuns(STAND, 0, 7, 0)).toEqual(STAND);
  });
  it("grows the hips at both ends and the legs outward, keeping the edge letter", () => {
    const out = widenRuns(STAND, 0, 1, 1);
    expect(out[0]).toBe(".....qppppppppppppq.....");
    expect(out[1]).toBe(".....qppppp..pppppq.....");
  });
  it("narrows without eating the edge", () => {
    const out = widenRuns(STAND, 1, 1, -1);
    expect(out[1]).toBe(".......qppp..pppq.......");
  });
});

describe("extendRows", () => {
  it("duplicates a shin row", () => {
    const out = extendRows(STAND, 3, 2);
    expect(out.length).toBe(10);
    expect(out[3]).toBe(out[4]);
    expect(out[4]).toBe(out[5]);
    expect(out[6]).toBe(STAND[4]);
  });
  it("removes rows above and including the anchor", () => {
    const out = extendRows(STAND, 3, -1);
    expect(out.length).toBe(7);
    expect(out[3]).toBe(STAND[4]);
  });
});

describe("shiftSides", () => {
  it("moves a near arm right and a far arm left", () => {
    expect(shiftSides({ r: 8, c: 19, rows: ["ttt", ".ss"] }, 1)).toEqual({
      r: 8,
      c: 20,
      rows: ["ttt", ".ss"],
    });
    expect(shiftSides({ r: 8, c: 2, rows: ["Tt", "SS"] }, 1)).toEqual({
      r: 8,
      c: 1,
      rows: ["Tt", "SS"],
    });
  });
  it("opens a two-armed patch from the middle", () => {
    const out = shiftSides({ r: 2, c: 4, rows: ["s...............s"] }, 1);
    expect(out.c).toBe(3);
    expect(out.rows[0]).toBe("s.................s");
  });
});

describe("sleevePatch", () => {
  const armDown = {
    r: 8,
    c: 19,
    rows: [
      "ttt",
      "ttt",
      "tss",
      "sys",
      "sys",
      "sss",
      ".ss",
      ".ss",
      "sss",
      "sss",
      ".ss",
      ".ss",
      ".sS",
      ".SS",
    ],
  };
  it("leaves a short sleeve alone", () => {
    expect(sleevePatch(armDown, "short", [[20, 8]])).toBe(armDown);
  });
  it("carries cloth to the wrist and keeps the hand", () => {
    const out = sleevePatch(armDown, "long", [[20, 8]]);
    // the last two rows are the hand
    expect(out.rows.slice(-2)).toEqual([".sS", ".SS"]);
    // nothing above them is skin
    for (const row of out.rows.slice(0, -2)) expect(row).not.toMatch(/[syS]/);
  });
  it("bares the arm for a tank", () => {
    const out = sleevePatch(armDown, "none", [[20, 8]]);
    for (const row of out.rows) expect(row).not.toMatch(/[tT]/);
  });
});

describe("hems and boots", () => {
  it("shorts bare the shin and keep the shoe", () => {
    const out = shortsPass(STAND, 2, 4);
    expect(out[2]).toBe(".......Ssss..sssS.......");
    expect(out[4]).toBe(STAND[4]);
  });
  it("boots climb the shin", () => {
    const out = bootsPass(STAND, 4, 1);
    expect(out[3]).toBe(".......Bbb....bbB.......");
    expect(out[4]).toBe(".......Bbb....bbB.......");
    expect(out[5]).toBe(STAND[5]);
  });
});
