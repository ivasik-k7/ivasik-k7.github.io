import { describe, expect, it } from "vitest";
import { validateCharacter } from "@/engine";
import golden from "./__golden__/player-v1.json";
import { buildPlayer, DEFAULT_PLAYER_SPEC, playerFor } from "./player";

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
  const IMPROVED: Record<string, string> = {
    pressRack: "bar now runs into the plates (was a column short each side)",
    pressDip: "bar now runs into the plates",
    pressUp: "bar now runs into the plates",
    pressLift: "bar now runs into the plates",
  };

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

  it("improved frames differ from the golden only where the reason says", () => {
    const g = golden.frames as Record<string, string[]>;
    for (const name of Object.keys(IMPROVED)) {
      const before = g[name];
      const after = built.frames[name];
      const changedRows = before.filter((row, i) => row !== after[i]).length;
      // one bar row per frame, nothing else
      expect(changedRows, name).toBe(1);
    }
  });

  /** Actions deliberately changed since the snapshot, with the reason. */
  const IMPROVED_ACTIONS: Record<string, string> = {
    run: "plays the eight-frame walk cycle instead of the old four-frame one",
    coffee: "a paper cup with steam, blown on and sipped, instead of the tea mug",
    hotdog: "a bun that is bitten and gets shorter, instead of the tea mug",
    sit: "held on the bench with the lean, the lap and the glance; stood up by walking away",
    lay: "interruptible, held while the sleep panel is up",
  };

  it("has the same action table", () => {
    const g = golden.actions as Record<string, unknown>;
    for (const id of Object.keys(g)) {
      if (id in IMPROVED_ACTIONS) continue;
      expect(built.actions[id], id).toEqual(g[id]);
    }
    // new since the snapshot: bought over a counter
    const NEW_ACTIONS = new Set(["beer", "water", "sitSofa", "sitTrain", "lean", "sitBeer"]);
    for (const id of Object.keys(built.actions)) {
      if (!NEW_ACTIONS.has(id)) expect(g[id], id).toBeDefined();
    }
  });

  it("passes the validator with no errors", () => {
    const issues = validateCharacter(built, {
      airborne: new Set(["bedLie", "bedLieB", "bedSide", "bedSitUp"]),
    });
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });
});

describe("playerFor", () => {
  it("adds an eyes-closed twin for every frame with an eye, and only those", () => {
    const cfg = playerFor(DEFAULT_PLAYER_SPEC);
    for (const [name, map] of Object.entries(cfg.frames)) {
      if (name.endsWith("~blink")) continue;
      const hasEye = map.some((r) => r.includes("e"));
      expect(Boolean(cfg.frames[`${name}~blink`])).toBe(hasEye);
    }
    expect(cfg.frames["stand~blink"]).toEqual(cfg.frames.blink);
  });

  it("returns the same object for the same spec", () => {
    expect(playerFor(DEFAULT_PLAYER_SPEC)).toBe(playerFor({ ...DEFAULT_PLAYER_SPEC }));
  });
});
