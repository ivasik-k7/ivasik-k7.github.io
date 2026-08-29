import { describe, expect, it } from "vitest";
import {
  cobbles,
  courses,
  flight,
  groundLayers,
  herringbone,
  manhole,
  paintLine,
  planksToward,
  plates,
  puddle,
  scatter,
  tactile,
  wearLane,
} from "./groundKit";
import { castShadow, fixture, neon, sunFor, underShade, windowSpill } from "./lightKit";
import {
  boundsOf,
  boxPaths,
  clipRects,
  cylinderPaths,
  glyphRects,
  hash,
  matFrom,
  mirrorX,
  mixHex,
  noise2,
  outline,
  pxPath,
  type Rect,
  steppedArch,
  steppedLine,
  steppedRing,
} from "./pixelKit";

/**
 * The kits are pure geometry, which is the best kind of thing to test: the
 * same inputs must give the same rects, every rect must be a whole pixel,
 * nothing may escape its box, and a shape's parts must agree with each other.
 * These tests are cheap and they are what lets a scene trust a helper it did
 * not write.
 */

/** Parse a pxPath back into rects, so the geometry can be checked after packing. */
function rectsOf(d: string): Rect[] {
  const out: Rect[] = [];
  const re =
    /M(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)h(-?\d+(?:\.\d+)?)v(-?\d+(?:\.\d+)?)h-?\d+(?:\.\d+)?z/g;
  for (const m of d.matchAll(re)) out.push([+m[1], +m[2], +m[3], +m[4]]);
  return out;
}
const allWhole = (rs: readonly Rect[]) => rs.every((r) => r.every((v) => Number.isInteger(v)));
const allInside = (rs: readonly Rect[], [bx, by, bw, bh]: Rect) =>
  rs.every(([x, y, w, h]) => x >= bx && y >= by && x + w <= bx + bw && y + h <= by + bh);

describe("pixelKit geometry", () => {
  it("noise is deterministic and in range", () => {
    expect(hash(42)).toBe(hash(42));
    expect(noise2(3, 7, 1)).toBe(noise2(3, 7, 1));
    for (let i = 0; i < 200; i++) {
      const v = hash(i * 1.37);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("steppedLine reaches both endpoints on whole pixels", () => {
    const rs = steppedLine(10, 10, 40, 22);
    expect(allWhole(rs)).toBe(true);
    const b = boundsOf(rs);
    expect(b?.[0]).toBe(10);
    expect(b && b[0] + b[2]).toBe(41);
    expect(b?.[1]).toBe(10);
    expect(b && b[1] + b[3]).toBe(23);
    /* a shallow line is a few runs, not a pixel each */
    expect(rs.length).toBeLessThan(20);
  });

  it("steppedRing is hollow", () => {
    const ring = steppedRing(20, 20, 8, 8, 2, 1);
    const inner = rectsOf(pxPath(ring)).filter(([x, y, w]) => y === 20 && x <= 20 && x + w > 20);
    expect(inner).toHaveLength(0);
  });

  it("steppedArch spans exactly the opening and rises to the given height", () => {
    const arch = steppedArch(100, 50, 20, 10);
    const b = boundsOf(arch);
    expect(b?.[0]).toBe(100);
    expect(b && b[0] + b[2]).toBe(120);
    expect(b && b[1] + b[3]).toBe(50);
    expect(b?.[3]).toBe(10);
  });

  it("outline encloses the box and nothing inside it", () => {
    const o = outline(0, 0, 10, 6, 1);
    expect(allInside(o, [0, 0, 10, 6])).toBe(true);
    expect(o.some(([x, y, w, h]) => x <= 5 && x + w > 5 && y <= 3 && y + h > 3)).toBe(false);
  });

  it("glyphRects run-length encodes a row", () => {
    expect(glyphRects(["##.##", ".....", "#####"])).toEqual([
      [0, 0, 2, 1],
      [3, 0, 2, 1],
      [0, 2, 5, 1],
    ]);
  });

  it("mirrorX is its own inverse", () => {
    const rs: Rect[] = [
      [10, 0, 4, 2],
      [30, 5, 1, 1],
    ];
    expect(mirrorX(mirrorX(rs, 50), 50)).toEqual(rs);
  });

  it("clipRects drops what is outside and trims what straddles", () => {
    expect(clipRects([[-5, 0, 10, 2]], [0, 0, 20, 20])).toEqual([[0, 0, 5, 2]]);
    expect(clipRects([[30, 0, 10, 2]], [0, 0, 20, 20])).toEqual([]);
  });

  it("boxPaths puts the top above and the side to the right", () => {
    const set = boxPaths([[10, 20, 30, 10]], 3);
    const top = boundsOf(rectsOf(set.top));
    const side = boundsOf(rectsOf(set.side));
    expect(top && top[1] + top[3]).toBe(20);
    expect(side?.[0]).toBe(40);
  });

  it("cylinderPaths covers the whole width with its four bands", () => {
    const set = cylinderPaths([[0, 0, 20, 10]]);
    const all = [set.base, set.hi, set.lo, set.deep].flatMap(rectsOf);
    const b = boundsOf(all);
    expect(b).toEqual([0, 0, 20, 10]);
  });
});

describe("pixelKit materials", () => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11;
  };
  it("matFrom orders its tones light to dark", () => {
    const m = matFrom("#6b675f");
    expect(lum(m.hi)).toBeGreaterThan(lum(m.base));
    expect(lum(m.base)).toBeGreaterThan(lum(m.mid));
    expect(lum(m.mid)).toBeGreaterThan(lum(m.lo));
    expect(lum(m.lo)).toBeGreaterThan(lum(m.deep));
  });
  it("mixHex is the endpoints at 0 and 1", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("groundKit", () => {
  const box: Rect = [0, 150, 400, 20];

  it("courses fill the band, stay inside it, and foreshorten", () => {
    const c = courses(0, 400, 150, 170, { far: 5, near: 9, unit: 26, stagger: true });
    const face = rectsOf(c.face);
    expect(allWhole(face)).toBe(true);
    expect(allInside(face, box)).toBe(true);
    expect(c.rows[0]).toBe(150);
    const pitches = c.rows.slice(1).map((y, i) => y - c.rows[i]);
    expect(pitches[pitches.length - 1]).toBeGreaterThanOrEqual(pitches[0]);
  });

  it("plates picks a minority of slabs, deterministically", () => {
    const a = plates(0, 400, 150, 170, { far: 5, near: 9, unit: 26, seed: 3 });
    const b = plates(0, 400, 150, 170, { far: 5, near: 9, unit: 26, seed: 3 });
    expect(a).toEqual(b);
    const total = rectsOf(courses(0, 400, 150, 170, { far: 5, near: 9, unit: 26 }).face).length;
    expect(rectsOf(a.dark).length).toBeLessThan(total * 0.3);
  });

  it("wearLane, scatter, tactile and paint stay inside their box", () => {
    expect(allInside(rectsOf(wearLane(0, 400, 158, 3)), [0, 150, 400, 20])).toBe(true);
    expect(allInside(rectsOf(scatter(0, 400, 152, 168, 40, 5, 1, 1)), box)).toBe(true);
    const t = tactile(10, 152, 40, 8);
    expect(allInside(rectsOf(t.studs), [10, 152, 40, 8])).toBe(true);
    const p = paintLine(0, 400, 160, 2, { dash: 20, gap: 10 });
    expect(allInside(rectsOf(p.paint), [0, 160, 400, 2])).toBe(true);
  });

  it("puddle has a rim above the water and a fringe wider than it", () => {
    const p = puddle(100, 160, 20, 4);
    const water = boundsOf(rectsOf(p.water));
    const fringe = boundsOf(rectsOf(p.fringe));
    const rim = boundsOf(rectsOf(p.rim));
    expect(fringe && water && fringe[2]).toBeGreaterThan(water?.[2] ?? 0);
    expect(rim?.[1]).toBeLessThanOrEqual(water?.[1] ?? 0);
  });

  it("a flight down has one tread per step, each lower than the last", () => {
    const f = flight({ x: 100, y: 156, w: 60, steps: 5, dir: "down", going: 4 });
    expect(f.steps).toHaveLength(5);
    for (let i = 1; i < 5; i++) {
      expect(f.steps[i][1]).toBeGreaterThan(f.steps[i - 1][1]);
      expect(f.steps[i][2]).toBeLessThan(f.steps[i - 1][2]);
    }
  });

  it("a flight up climbs toward its side and lands at the top", () => {
    const r = flight({ x: 100, y: 150, w: 20, steps: 6, dir: "right", rise: 7, going: 7 });
    expect(r.landing[1]).toBe(150 - 6 * 7 - 2);
    expect(r.landing[0]).toBe(100 + 6 * 7);
    const l = flight({ x: 100, y: 150, w: 20, steps: 6, dir: "left", rise: 7, going: 7 });
    expect(l.landing[0] + l.landing[2]).toBe(100 - 6 * 7);
    expect(allWhole(l.steps)).toBe(true);
  });

  it("planks, herringbone and cobbles stay in the band", () => {
    const p = planksToward(0, 400, 150, 170, { unit: 12 });
    expect(allInside(rectsOf(p.joints), box)).toBe(true);
    const h = herringbone(0, 400, 150, 170, 12);
    expect(allInside([...rectsOf(h.a), ...rectsOf(h.b)], box)).toBe(true);
    const c = cobbles(0, 400, 150, 170, { size: 7 });
    expect(allInside(rectsOf(c.faces), box)).toBe(true);
    expect(rectsOf(c.faces).length).toBeGreaterThan(100);
  });

  it("manhole ring sits on the disc", () => {
    const m = manhole(100, 160);
    const disc = boundsOf(rectsOf(m.disc));
    const ring = boundsOf(rectsOf(m.ring));
    expect(disc && ring && allInside(rectsOf(m.ring), disc)).toBe(true);
  });

  it("groundLayers composes a paintable floor for every kind", () => {
    const mat = matFrom("#8f8a80");
    for (const kind of [
      "slabs",
      "tiles",
      "boards",
      "planks",
      "cobbles",
      "concrete",
      "asphalt",
    ] as const) {
      const L = groundLayers({
        x0: 0,
        x1: 400,
        top: 150,
        bottom: 170,
        mat,
        kind,
        worn: [[40, 300]],
        litter: 10,
      });
      expect(L.length).toBeGreaterThan(4);
      for (const l of L) {
        expect(typeof l.d).toBe("string");
        expect(l.fill.length).toBeGreaterThan(0);
        expect(allInside(rectsOf(l.d), [-10, 140, 420, 40])).toBe(true);
      }
    }
  });
});

describe("lightKit", () => {
  it("a fixture's cone reaches the floor and its pool sits on it", () => {
    const f = fixture(200, 40, 150);
    const cone = boundsOf(rectsOf(f.cone[0].d));
    expect(cone && cone[1] + cone[3]).toBe(150);
    const pool = boundsOf(rectsOf(f.pool[0].d));
    expect(pool?.[1]).toBeGreaterThanOrEqual(140);
    /* brighter tiers are inside dimmer ones */
    const outer = boundsOf(rectsOf(f.pool[0].d));
    const inner = boundsOf(rectsOf(f.pool[3].d));
    expect(outer && inner && allInside(rectsOf(f.pool[3].d), outer)).toBe(true);
  });

  it("windowSpill starts at the opening's width and widens", () => {
    const s = windowSpill([100, 60, 40, 50], 150, { reach: 24, spread: 10 });
    const rs = rectsOf(s[0].d);
    const top = rs.filter((r) => r[1] === 150)[0];
    const bot = rs[rs.length - 1];
    expect(top[2]).toBeLessThanOrEqual(bot[2]);
  });

  it("castShadow runs in the sun's direction and is empty at night", () => {
    expect(castShadow([100, 100, 8, 50], sunFor("night"))).toBe("");
    const dawn = boundsOf(rectsOf(castShadow([100, 100, 8, 50], sunFor("dawn"))));
    const dusk = boundsOf(rectsOf(castShadow([100, 100, 8, 50], sunFor("dusk"))));
    expect(dawn && dawn[0] + dawn[2]).toBeGreaterThan(108);
    expect(dusk?.[0]).toBeLessThan(100);
  });

  it("neon's halos grow outward and its wash covers the tube", () => {
    const n = neon([[50, 50, 30, 6]]);
    const h0 = boundsOf(rectsOf(n.halo[0]));
    const h2 = boundsOf(rectsOf(n.halo[2]));
    expect(h2 && h0 && h2[2]).toBeGreaterThan(h0?.[2] ?? 0);
    expect(allInside(rectsOf(n.tube), boundsOf(rectsOf(n.wash)) as Rect)).toBe(true);
  });

  it("underShade hangs below its rects", () => {
    const [a] = underShade([[10, 10, 20, 5]]);
    expect(rectsOf(a)[0][1]).toBe(15);
  });
});

import {
  bench as benchProp,
  bicycle,
  bikeRack,
  bollards,
  busShelter,
  kiosk,
  litter,
  litterBin,
  noticeBoard,
  planter,
  railing,
} from "./propKit";

describe("propKit", () => {
  const G = 150;
  const standsOn = (d: string, groundY: number) => {
    const b = boundsOf(rectsOf(d));
    return b !== null && b[1] + b[3] <= groundY + 0.001;
  };

  it("everything stands on the ground line and nothing hangs below it", () => {
    expect(standsOn(bikeRack(20, G, 3).hoops, G)).toBe(true);
    expect(standsOn(bicycle(40, G).tyres, G)).toBe(true);
    expect(standsOn(litterBin(40, G, "box").body.base, G)).toBe(true);
    expect(standsOn(litterBin(40, G, "hoop").post, G)).toBe(true);
    expect(standsOn(benchProp(10, G, 68).legs, G)).toBe(true);
    expect(standsOn(planter(10, G).box.face.base, G)).toBe(true);
    expect(standsOn(bollards(10, 200, G).posts.base, G)).toBe(true);
    expect(standsOn(busShelter(10, G).posts.base, G)).toBe(true);
    expect(standsOn(kiosk(10, G).body.face.base, G)).toBe(true);
    expect(standsOn(railing(0, 300, G).posts, G)).toBe(true);
  });

  it("a bicycle's wheels are rings with hubs at their centres", () => {
    const b = bicycle(100, G);
    const hubs = rectsOf(b.hubs);
    expect(hubs).toHaveLength(2);
    const tyres = boundsOf(rectsOf(b.tyres));
    expect(tyres?.[3]).toBe(24);
  });

  it("the rack reports one stand per hoop", () => {
    expect(bikeRack(20, G, 4).stands).toHaveLength(4);
  });

  it("a bench's shine sits on the seat line", () => {
    const b = benchProp(10, G, 68);
    const seat = boundsOf(rectsOf(b.seat.base));
    const shine = rectsOf(b.shine);
    expect(shine.every((r) => r[1] === seat?.[1])).toBe(true);
  });

  it("a notice board keeps its papers inside the frame", () => {
    const n = noticeBoard(20, 30, 44, 48);
    expect(allInside(rectsOf(n.papers), [20, 30, 44, 48])).toBe(true);
  });

  it("litter stays in its box and scales with density", () => {
    const a = litter(0, 300, 152, 168, 1);
    const b = litter(0, 300, 152, 168, 3);
    expect(allInside(rectsOf(a.stubs), [0, 152, 300, 16])).toBe(true);
    expect(rectsOf(b.stubs).length).toBeGreaterThan(rectsOf(a.stubs).length);
  });
});
