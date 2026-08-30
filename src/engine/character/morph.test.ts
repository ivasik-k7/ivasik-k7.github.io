import { describe, expect, it } from "vitest";
import {
  barefootPass,
  beaniePass,
  beltPass,
  bootsPass,
  collarPass,
  cuffPass,
  extendRows,
  hoodUpPass,
  openFrontPass,
  ribbedPass,
  sandalsPass,
  shiftRows,
  shiftSides,
  shortsPass,
  sleevePatch,
  stripePass,
  tankPass,
  widenRuns,
} from "./morph";

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

describe("the passes nobody tested", () => {
  const TORSO = [
    "......TmmmtttttttT......",
    "...TmmttttttttttttttT...",
    "......TttttttttttT......",
    "......qppppppppppq......",
  ];
  it("collar darkens the trapezius row only", () => {
    const out = collarPass(TORSO);
    expect(out[0]).toBe("......TmmmTTTTTTTT......");
    expect(out[1]).toBe(TORSO[1]);
  });
  it("belt and ribbed hem repaint across hood cells", () => {
    const hip = ["......TttttmmttttT......", "......qppppppppppq......"];
    expect(beltPass(hip, 1)[0]).toBe("......TccccccccccT......");
    expect(ribbedPass(hip, 1)[0]).toBe("......TTTTTTTTTTTT......");
  });
  it("open front puts a zip on the near side and lapels at the top", () => {
    const out = openFrontPass(TORSO, 3);
    // lapels on the top rows, the zip (c) below them, both three in from the near edge
    expect(out[1]).toBe("...TmmttttttttttTTTtT...");
    // the belt row (hipRow - 1) is left for the belt
    expect(out[2]).toBe(TORSO[2]);
    // with a deeper torso the top three rows carry lapels, the zip runs below them
    expect(openFrontPass(TORSO, 4)[2]).toBe("......TttttttTTTtT......");
  });
  it("tank bares the shoulders", () => {
    const out = tankPass(TORSO, [1]);
    expect(out[1]).toBe("...SsmtttttttttttttsS...");
  });
  it("hood up and beanie recolour hair rows, keeping the face", () => {
    const head = [
      "..........kkkkkkK.......",
      ".........KhhhhhhK.......",
      ".........mHsysses.......",
    ];
    expect(hoodUpPass(head, [0, 1])[0]).toBe("..........TTTTTTT.......");
    expect(hoodUpPass(head, [0, 1])[1]).toBe(".........TttttttT.......");
    expect(hoodUpPass(head, [0, 1])[2]).toBe(head[2]);
    expect(beaniePass(head, [1])[1]).toBe(".........KkkkkkkK.......");
  });
  it("stripe marks the outer seam, cuff darkens the last shin row, sandals open the upper, barefoot strips the shoe", () => {
    const legs = [
      ".......qppp..pppq.......",
      ".......spp....pps.......",
      ".......bbb....bbb.......",
      "......BBBB....BBBB......",
    ];
    expect(stripePass(legs, 0, 0)[0]).toBe(".......appp..pppa.......");
    expect(cuffPass(legs, 1)[0]).toBe(".......qqqq..qqqq.......");
    expect(sandalsPass(legs, 1)[2]).toBe(".......sss....sss.......");
    expect(barefootPass(legs)[3]).toBe("......SSSS....SSSS......");
  });
  it("shiftRows drops rows off the bottom, never the top's content", () => {
    expect(shiftRows(["a", "b", "c"], 1)).toEqual([".", "a", "b"]);
    expect(shiftRows(["a", "b", "c"], -1)).toEqual(["b", "c", "."]);
  });
  it("extendRows clamps a bad anchor instead of producing holes", () => {
    expect(extendRows(["a", "b"], 5, 2)).toEqual(["a", "b", "b", "b"]);
    expect(extendRows(["a", "b"], 0, -3)).toEqual(["a", "b"]);
  });
  it("shiftSides refuses to tear a patch that crosses the centre", () => {
    const bar = { r: 1, c: 10, rows: ["ssss"] };
    expect(shiftSides(bar, 1)).toBe(bar);
  });
  it("widenRuns works on a narrower grid", () => {
    expect(widenRuns(["...qppq...."], 0, 0, 1)).toEqual(["..qppppq..."]);
  });
  it("bootsPass keeps drawn shoes and puts the edge on the outside", () => {
    expect(bootsPass([".......spp....pps......."], 0, 0)).toEqual([".......Bbb....bbB......."]);
    expect(bootsPass(["......BBBBppps.........."], 0, 0)).toEqual(["......BBBBbbbB.........."]);
  });
});
