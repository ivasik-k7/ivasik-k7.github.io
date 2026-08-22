import { describe, expect, it } from "vitest";
import { DEPTH_RANGE, FLOOR_Y } from "./constants";
import { detectObjects } from "./math";
import { buildKeymap, DEFAULT_KEYMAP } from "./runtime-perf";
import type { SceneObject } from "./types";

const obj = (id: string, x: number, extra: Partial<SceneObject> = {}): SceneObject => ({
  id,
  kind: "flavor",
  x,
  ...extra,
});

describe("detectObjects with depth", () => {
  it("is unchanged for 1D scenes when no y is passed", () => {
    const objects = [obj("near", 110), obj("far", 200)];
    const hits = detectObjects(objects, 100, 1, {});
    expect(hits.map((h) => h.obj.id)).toEqual(["near"]);
    expect(hits[0].dist).toBe(10);
  });

  it("skips objects out of depth reach", () => {
    const objects = [obj("back", 110, { y: FLOOR_Y })];
    // player deeper than the default tolerance below the object's line
    const none = detectObjects(objects, 100, 1, {}, FLOOR_Y + DEPTH_RANGE + 1);
    expect(none).toHaveLength(0);
    const some = detectObjects(objects, 100, 1, {}, FLOOR_Y + DEPTH_RANGE - 1);
    expect(some).toHaveLength(1);
  });

  it("honours a per-object yRange", () => {
    const objects = [obj("strict", 110, { yRange: 4 })];
    expect(detectObjects(objects, 100, 1, {}, FLOOR_Y + 6)).toHaveLength(0);
    expect(detectObjects(objects, 100, 1, {}, FLOOR_Y + 3)).toHaveLength(1);
  });

  it("prefers the object at the player's own depth", () => {
    const objects = [
      obj("backline", 108, { y: 150 }),
      obj("nearline", 110, { y: 166, yRange: 30 }),
    ];
    const hits = detectObjects(objects, 100, 1, {}, 166);
    expect(hits[0].obj.id).toBe("nearline");
  });
});

describe("keymap", () => {
  it("owns the vertical keys for movement and keeps cycling reachable", () => {
    const map = buildKeymap();
    expect(map.get("ArrowUp")).toBe("up");
    expect(map.get("KeyW")).toBe("up");
    expect(map.get("ArrowDown")).toBe("down");
    expect(map.get("KeyS")).toBe("down");
    expect(map.get("KeyQ")).toBe("targetNext");
    expect(map.get("KeyZ")).toBe("targetPrev");
    // untouched bindings
    expect(map.get("KeyA")).toBe("left");
    expect(map.get("KeyE")).toBe("interact");
  });

  it("lets a game rebind actions wholesale", () => {
    const map = buildKeymap({ up: ["KeyI"], down: ["KeyK"] });
    expect(map.get("KeyI")).toBe("up");
    expect(map.get("ArrowUp")).toBeUndefined();
    expect(DEFAULT_KEYMAP.up).toEqual(["ArrowUp", "KeyW"]);
  });
});

describe("resolveActiveTarget", () => {
  const det = (id: string, score: number) => ({ obj: obj(id, 0), dist: 0, score });

  it("keeps a locked target while it stays detected, releases it when it leaves", async () => {
    const { resolveActiveTarget } = await import("./math");
    const list = [det("a", 0), det("b", 5)];
    const locked = resolveActiveTarget(list, null, "b");
    expect(locked.active?.id).toBe("b");
    expect(locked.lockId).toBe("b");
    const gone = resolveActiveTarget([det("a", 0)], "b", "b");
    expect(gone.lockId).toBeNull();
    expect(gone.active?.id).toBe("a");
  });

  it("holds the previous target inside the sticky margin, yields beyond it", async () => {
    const { resolveActiveTarget } = await import("./math");
    // prev "b" scores 5 vs best 0: within the margin (7) it keeps focus
    expect(resolveActiveTarget([det("a", 0), det("b", 5)], "b", null).active?.id).toBe("b");
    // beyond the margin the better candidate wins
    expect(resolveActiveTarget([det("a", 0), det("b", 9)], "b", null).active?.id).toBe("a");
  });

  it("returns nothing (and drops the lock) with no candidates", async () => {
    const { resolveActiveTarget } = await import("./math");
    expect(resolveActiveTarget([], "a", "a")).toEqual({ active: null, lockId: null });
  });
});
