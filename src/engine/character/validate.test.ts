import { describe, expect, it } from "vitest";
import type { PlayerConfig } from "../core/types";
import { addFaceLayer } from "./compile";
import { validateCharacter } from "./validate";

/** A 4×4 stick figure: head with an eye, body, feet on the last row. */
const OK = ["..h.", ".se.", ".tt.", ".bb."];
const base = (over: Partial<PlayerConfig> = {}): PlayerConfig => ({
  width: 8,
  height: 8,
  cell: 2,
  palette: { h: "#1", s: "#2", e: "#3", t: "#4", b: "#5", c: "#6" },
  frames: {
    stand: OK,
    walkA: ["..h.", ".se.", ".tt.", "bb.."],
    walkB: [".sh.", ".se.", ".tt.", ".bb."],
  },
  walkCycle: ["walkA", "walkB"],
  actions: { wave: { frames: ["stand"], frameMs: 100, loops: 1 } },
  ...over,
});

const rules = (cfg: PlayerConfig, opts = {}) => validateCharacter(cfg, opts).map((i) => i.rule);

describe("validateCharacter — every rule fires on its own bad fixture", () => {
  it("passes a sound figure", () => {
    expect(validateCharacter(base())).toEqual([]);
  });
  it("box", () => {
    expect(rules(base({ frames: { ...base().frames, stand: ["..h."] } }))).toContain("box");
  });
  it("palette", () => {
    expect(
      rules(base({ frames: { ...base().frames, stand: ["..h.", ".se.", ".tt.", ".zb."] } })),
    ).toContain("palette");
  });
  it("floor", () => {
    expect(
      rules(base({ frames: { ...base().frames, stand: ["..h.", ".se.", ".tt.", "...."] } })),
    ).toContain("floor");
  });
  it("connected — and the loose opt-out", () => {
    const torn = { ...base().frames, stand: ["h..c", "s...", "t...", "b..c"] };
    expect(rules(base({ frames: torn }))).toContain("connected");
    expect(rules(base({ frames: torn }), { loose: new Set(["stand"]) })).not.toContain("connected");
  });
  it("faceless — and the airborne opt-out", () => {
    const noSkin = { ...base().frames, stand: ["..h.", ".tt.", ".tt.", ".bb."] };
    expect(rules(base({ frames: noSkin }))).toContain("faceless");
    expect(rules(base({ frames: noSkin }), { airborne: new Set(["stand"]) })).not.toContain(
      "faceless",
    );
  });
  it("duplicate — but not for derived twins", () => {
    expect(rules(base({ frames: { ...base().frames, twin: OK } }))).toContain("duplicate");
    const withFace = addFaceLayer(base());
    expect(rules(withFace).filter((r) => r === "duplicate")).toEqual([]);
  });
  it("walk-frames", () => {
    expect(rules(base({ walkCycle: ["walkA", "ghost"] }))).toContain("walk-frames");
    expect(rules(base({ walkCycle: [] }))).toContain("walk-frames");
    expect(rules(base({ walkStart: 5 }))).toContain("walk-frames");
  });
  it("walk-variants", () => {
    expect(rules(base({ walkVariants: [{ every: 3, frames: ["walkA", "ghost"] }] }))).toContain(
      "walk-variants",
    );
    expect(rules(base({ walkVariants: [{ every: 3, frames: ["walkA"] }] }))).toContain(
      "walk-variants",
    );
  });
  it("action-frames and action-empty", () => {
    expect(rules(base({ actions: { x: { frames: ["nope"], frameMs: 1, loops: 1 } } }))).toContain(
      "action-frames",
    );
    expect(rules(base({ actions: { x: { frames: [], frameMs: 1, loops: 1 } } }))).toContain(
      "action-empty",
    );
    expect(
      rules(
        base({
          actions: { x: { frames: ["stand"], frameMs: 1, loops: 1, events: [{ frame: 3 }] } },
        }),
      ),
    ).toContain("action-frames");
  });
});

describe("addFaceLayer", () => {
  it("records twins in `derived` and reuses an authored closed-eye frame", () => {
    const closed = ["..h.", ".ss.", ".tt.", ".bb."];
    const cfg = addFaceLayer(base({ frames: { ...base().frames, blink: closed } }));
    expect(cfg.derived?.stand?.blink).toBe("blink");
    expect(cfg.derived?.walkB?.blink).toBe("walkB~blink");
    expect(cfg.frames["walkB~blink"]).toEqual([".sh.", ".ss.", ".tt.", ".bb."]);
    expect(cfg.frames["stand~blink"]).toBeUndefined();
  });
});
