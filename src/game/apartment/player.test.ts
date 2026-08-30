import { describe, expect, it } from "vitest";
import {
  BOTTOM_GARMENTS,
  BUILDS,
  FOOTWEAR,
  HEADWEAR,
  HEIGHTS,
  NECKS,
  POSTURES,
  TORSO_GARMENTS,
  validateCharacter,
} from "@/engine";
import goldenV1 from "./__golden__/player-v1.json";
import golden from "./__golden__/player-v2.json";
import {
  buildPlayer,
  DEFAULT_PLAYER_SPEC,
  PATCH_TABLES,
  PLAYER_VALIDATION,
  playerFor,
} from "./player";

/**
 * The player is the ruler. Every proportion in the game — NPC shoulders, bench
 * heights, door frames — was measured against the man as drawn, so the
 * parametric rig has to reproduce him exactly before it is allowed to vary
 * him. `player-v1.json` is a snapshot of the hand-built PLAYER taken the day
 * before the rig became a function; if this test fails, the default body has
 * drifted and something measured against it is now wrong too.
 */
describe("buildPlayer(default) is the drawn player, pixel for pixel", () => {
  const built = buildPlayer(DEFAULT_PLAYER_SPEC);

  it("has the same box and cycle", () => {
    expect(built.width).toBe(golden.width);
    expect(built.height).toBe(golden.height);
    // The cycle grew from four frames to eight (contact, recoil, pass, late
    // stance per step) — see the walk section of player.ts. The golden's four
    // frames are all still in the rig, pixel for pixel, checked below.
    expect(built.walkCycle).toEqual([
      "contactA",
      "recoilA",
      "passHiA",
      "lateA",
      "contactB",
      "recoilB",
      "passHiB",
      "lateB",
    ]);
    for (const f of golden.walkCycle) expect(built.frames[f]).toBeDefined();
    expect(built.walkStride).toBe(8);
  });

  /**
   * Frames deliberately changed since the snapshot, with the reason. A frame
   * may only appear here with a reason a reviewer can check against the
   * strip; anything else that differs is a regression.
   */
  /**
   * `player-v2.json` was taken on 2026-08-30 after the texture pass
   * (engine/character/texture.ts): every frame changed in tone — a highlight
   * down the front of the near leg, a crease behind a bend, a heel and toe on
   * the shoes, a light on the near shoulder — and none changed in shape. The
   * silhouette test below holds the v1 outline for every v1 frame, so a
   * proportion drift still fails even though the pixels were re-baselined.
   */
  const IMPROVED: Record<string, { why: string; rows: number | "body" }> = {};

  it("has every golden frame, identical", () => {
    const g = golden.frames as Record<string, string[]>;
    const missing = Object.keys(g).filter((k) => !built.frames[k]);
    expect(missing).toEqual([]);
    const diffs: string[] = [];
    for (const [name, rows] of Object.entries(g)) {
      if (name in IMPROVED) continue;
      if (built.frames[name].join("\n") !== rows.join("\n")) diffs.push(name);
    }
    expect(diffs).toEqual([]);
  });

  it("improved frames differ from the golden only as much as the reason says", () => {
    const g = golden.frames as Record<string, string[]>;
    for (const [name, { rows }] of Object.entries(IMPROVED)) {
      const before = g[name];
      const after = built.frames[name];
      const changedRows = before.filter((row, i) => row !== after[i]).length;
      if (rows === "body") {
        // a re-seat of the whole upper body: same ink, moved — never a hole
        expect(changedRows, name).toBeGreaterThan(1);
        const inkRows = after.map((row) => /[^.]/.test(row));
        const first = inkRows.indexOf(true);
        const last = inkRows.lastIndexOf(true);
        const blankInside = inkRows.slice(first, last + 1).some((ink) => !ink);
        expect(blankInside, `${name} has a blank row through the figure`).toBe(false);
      } else {
        expect(changedRows, name).toBe(rows);
      }
    }
  });

  /** Actions deliberately changed since the snapshot, with the reason. */
  const IMPROVED_ACTIONS: Record<string, string> = {
    run: "plays the six-frame run cycle (land, drive, flight) instead of walk frames",
    coffee: "a paper cup with steam, blown on and sipped, instead of the tea mug",
    hotdog: "a bun that is bitten and gets shorter, instead of the tea mug",
    sit: "held on the bench with the lean, the lap and the glance; stood up by walking away",
    lay: "interruptible, held while the sleep panel is up",
    pet: "from behind, on the knees: offer, strokes, scratch, both-hand ruffle, pats, a look",
    pull: "hangs from the bar (drawn 16 px up) and pulls to eye level, instead of reaching on the floor",
    cycle: "seated on the saddle (drawn 28 px up) with the legs going round, instead of crouching",
    deadlift: "a barbell on the boards, to the knee, to the hip — instead of a bodyweight squat",
  };

  it("keeps the v1 silhouette of every v1 frame — textures changed tones, not shape", () => {
    const v1 = goldenV1.frames as Record<string, string[]>;
    const mask = (rows: readonly string[]) =>
      rows.map((r) => [...r].map((c) => (c === "." ? "." : "#")).join(""));
    const drifted: string[] = [];
    for (const [name, rows] of Object.entries(v1)) {
      const now = built.frames[name];
      if (!now) continue;
      if (mask(now).join("\n") !== mask(rows).join("\n")) drifted.push(name);
    }
    // frames whose shape was deliberately changed since v1, with the reason
    const RESHAPED = new Set([
      "swingMid", // body dropped onto the bent legs (was torn by a blank row)
      // the bar runs into the plates (was a column short each side)
      "pressRack",
      "pressDip",
      "pressUp",
      "pressLift",
      // raiseChin keeps the neck row instead of leaving a blank one under the chin
      "drinkD",
      "peeUp",
      "gtrRing",
      "smokeF",
      "smokeF2",
      "rinse",
    ]);
    expect(drifted.filter((n) => !RESHAPED.has(n))).toEqual([]);
  });

  it("has the same action table", () => {
    const g = golden.actions as Record<string, unknown>;
    for (const id of Object.keys(g)) {
      if (id in IMPROVED_ACTIONS) continue;
      expect(built.actions[id], id).toEqual(g[id]);
    }
    // new since the snapshot: bought over a counter
    const NEW_ACTIONS = new Set([
      "beer",
      "water",
      "sitSofa",
      "sitTrain",
      "lean",
      "sitBeer",
      "open",
      "pressButton",
    ]);
    for (const id of Object.keys(built.actions)) {
      if (!NEW_ACTIONS.has(id)) expect(g[id], id).toBeDefined();
    }
  });

  it("passes the validator with no errors", () => {
    expect(validateCharacter(built, PLAYER_VALIDATION)).toEqual([]);
  });
});

describe("playerFor", () => {
  it("records an eyes-closed twin for every frame with an eye, and only those", () => {
    const cfg = playerFor(DEFAULT_PLAYER_SPEC);
    for (const [name, map] of Object.entries(cfg.frames)) {
      if (name.endsWith("~blink")) continue;
      const hasEye = map.some((r) => r.includes("e"));
      expect(Boolean(cfg.derived?.[name]?.blink), name).toBe(hasEye);
    }
    // the artist drew `blink` and `blinkLow`; the compiler reuses them
    expect(cfg.derived?.stand?.blink).toBe("blink");
    expect(cfg.derived?.idleB?.blink).toBe("blinkLow");
  });

  it("returns the same object for the same spec", () => {
    expect(playerFor(DEFAULT_PLAYER_SPEC)).toBe(playerFor({ ...DEFAULT_PLAYER_SPEC }));
  });
});

/**
 * The catalogue sweep: every body and every garment pairing the wardrobe can
 * produce compiles and passes the validator. Not every full cross product —
 * that is 92,000 builds — but every single-axis variation and every
 * torso×head and bottom×feet pair, which is where the passes interact.
 */
describe("every wardrobe combination builds clean", () => {
  const clean = (spec: typeof DEFAULT_PLAYER_SPEC) =>
    validateCharacter(buildPlayer(spec), PLAYER_VALIDATION).filter((i) => i.severity === "error");
  it("build × height", { timeout: 60_000 }, () => {
    for (const build of BUILDS)
      for (const height of HEIGHTS) {
        const spec = {
          ...DEFAULT_PLAYER_SPEC,
          body: { ...DEFAULT_PLAYER_SPEC.body, build, height },
        };
        expect(clean(spec), `${build}/${height}`).toEqual([]);
      }
  });
  it("neck × posture", { timeout: 60_000 }, () => {
    for (const neck of NECKS)
      for (const posture of POSTURES) {
        const spec = {
          ...DEFAULT_PLAYER_SPEC,
          body: { ...DEFAULT_PLAYER_SPEC.body, neck, posture },
        };
        expect(clean(spec), `${neck}/${posture}`).toEqual([]);
      }
  });
  it("torso × head, on the widest and narrowest body", { timeout: 60_000 }, () => {
    for (const build of ["slight", "powerlifter"] as const)
      for (const torso of Object.keys(TORSO_GARMENTS) as (keyof typeof TORSO_GARMENTS)[])
        for (const head of Object.keys(HEADWEAR) as (keyof typeof HEADWEAR)[]) {
          const spec = {
            body: { ...DEFAULT_PLAYER_SPEC.body, build },
            garments: { ...DEFAULT_PLAYER_SPEC.garments, torso, head },
          };
          expect(clean(spec), `${build}/${torso}/${head}`).toEqual([]);
        }
  });
  it("bottom × feet, short and towering", { timeout: 60_000 }, () => {
    for (const height of ["short", "towering"] as const)
      for (const bottom of Object.keys(BOTTOM_GARMENTS) as (keyof typeof BOTTOM_GARMENTS)[])
        for (const feet of Object.keys(FOOTWEAR) as (keyof typeof FOOTWEAR)[]) {
          const spec = {
            body: { ...DEFAULT_PLAYER_SPEC.body, height },
            garments: { ...DEFAULT_PLAYER_SPEC.garments, bottom, feet },
          };
          expect(clean(spec), `${height}/${bottom}/${feet}`).toEqual([]);
        }
  });
});

/**
 * The arm bookkeeping is by hand: a patch with cloth *and* skin is an arm and
 * must be sleeve-dressed, or a long sleeve leaves it bare. This catches the
 * next arm someone draws and forgets to list.
 */
describe("every arm patch is on the sleeve list", () => {
  it("cloth-and-skin patches are arms", () => {
    const missing: string[] = [];
    for (const [name, p] of Object.entries(PATCH_TABLES.patches)) {
      const ink = p.rows.join("");
      const hasCloth = /[tT]/.test(ink);
      const hasSkin = /[sSy]/.test(ink);
      if (
        hasCloth &&
        hasSkin &&
        !PATCH_TABLES.arms.has(name as keyof typeof PATCH_TABLES.patches)
      ) {
        missing.push(name);
      }
    }
    // the shower's bare arm over a clothed back, and the water/pile props, are the known exceptions
    expect(missing.filter((n) => !["clothesPile"].includes(n))).toEqual([]);
  });
});
