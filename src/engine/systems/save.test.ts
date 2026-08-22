import { beforeEach, describe, expect, it } from "vitest";
import type { SavePayload } from "../core/runtime-types";
import { clearSave, loadGame, saveGame } from "./save";

type World = { tea: number };

const KEY = "engine-save-test";

const payload: SavePayload<World> = {
  version: 3,
  world: { tea: 2 },
  scene: "street",
  x: 240,
  y: 161,
  savedAt: "2026-08-22T00:00:00.000Z",
  facing: -1,
  flags: { met: true },
  counters: { pets: 5 },
  sceneX: { street: 240 },
  sceneY: { street: 161 },
};

describe("save system", () => {
  beforeEach(() => clearSave(KEY));

  it("round-trips the ground-band position", () => {
    saveGame(KEY, payload);
    const loaded = loadGame<World>(KEY, 3) as SavePayload<World> | null;
    expect(loaded).not.toBeNull();
    expect(loaded?.x).toBe(240);
    expect(loaded?.y).toBe(161);
    expect(loaded?.sceneY).toEqual({ street: 161 });
    expect(loaded?.facing).toBe(-1);
  });

  it("still loads an old save without y (restored as undefined, engine defaults it)", () => {
    const legacy = { ...payload } as Record<string, unknown>;
    delete legacy.y;
    delete legacy.sceneY;
    localStorage.setItem(KEY, JSON.stringify(legacy));
    const loaded = loadGame<World>(KEY, 3) as SavePayload<World> | null;
    expect(loaded).not.toBeNull();
    expect(loaded?.y).toBeUndefined();
    expect(loaded?.x).toBe(240);
  });

  it("discards a version mismatch", () => {
    saveGame(KEY, payload);
    expect(loadGame<World>(KEY, 4)).toBeNull();
  });
});

describe("save migration (loadSlot)", () => {
  beforeEach(() => clearSave(KEY));

  it("hands an old-version slot to migrate with its REAL version", async () => {
    const { loadSlot } = await import("./save");
    localStorage.setItem(KEY, JSON.stringify({ ...payload, version: 2 }));
    let sawFrom = -1;
    const loaded = loadSlot<World>(KEY, 3, (saved, from) => {
      sawFrom = from;
      return { ...(saved as object), version: 3 };
    });
    expect(sawFrom).toBe(2);
    expect(loaded?.version).toBe(3);
    expect((loaded as SavePayload<World>).x).toBe(240);
  });

  it("discards an old slot when no migrate is given, and same-version loads untouched", async () => {
    const { loadSlot } = await import("./save");
    localStorage.setItem(KEY, JSON.stringify({ ...payload, version: 2 }));
    expect(loadSlot<World>(KEY, 3)).toBeNull();
    localStorage.setItem(KEY, JSON.stringify(payload)); // version 3
    expect(loadSlot<World>(KEY, 3)?.x).toBe(240);
  });

  it("discards a migrate that returns null or the wrong version", async () => {
    const { loadSlot } = await import("./save");
    localStorage.setItem(KEY, JSON.stringify({ ...payload, version: 1 }));
    expect(loadSlot<World>(KEY, 3, () => null)).toBeNull();
    expect(loadSlot<World>(KEY, 3, (s) => s)).toBeNull(); // still version 1
  });
});
