import { beforeAll, describe, expect, it } from "vitest";
import { edgesAt, insideBlocker, nearestWalkable } from "@/engine/core/ground";
import type { GroundBand, RuntimeObject, RuntimeSceneDef } from "@/engine/core/runtime-types";
import type { WorldState } from "@/lib/worldState";
import { OUTSIDE_SCENES } from "./outsideScenes";
import { APARTMENT_SCENES } from "./scenes";

/**
 * Every scene has a floor, and everything on it can be reached.
 *
 * The engine's floor was one line and most scenes still stood on it; they all
 * declare a `ground` band now. Two things can silently go wrong when a scene
 * gains depth, and neither shows up in a type check:
 *
 *  - an object's approach point ends up inside a blocker, so the auto-walk
 *    stalls against the thing it was sent to and the object becomes
 *    unreachable by tap. This is the one that actually happened, twice, on the
 *    platform — and it is invisible until somebody taps that exact bin.
 *  - an approach point ends up outside the band at its own x, so the walk is
 *    clamped somewhere else and the prompt never lights.
 *
 * So this walks every object in every scene and asks the terrain about it. It
 * is the cheapest possible version of the drive scripts and it runs in
 * milliseconds, which means it can guard all fifteen scenes at once.
 */

const EDGE_MARGIN = 8;

const ALL = { ...APARTMENT_SCENES, ...OUTSIDE_SCENES } as Record<
  string,
  () => Promise<RuntimeSceneDef<WorldState>>
>;

/** Where the runtime would send the player to use this object. */
function approachOf(obj: RuntimeObject, band: GroundBand) {
  const x = (obj as { approachX?: number }).approachX ?? obj.x;
  const y = (obj as { approachY?: number }).approachY ?? (obj as { y?: number }).y ?? band.top;
  return { x, y };
}

const scenes = Object.entries(ALL);

describe("scene ground", () => {
  /**
   * Every scene is a code-split chunk, and the flat is the heaviest of them:
   * cold, its first import can take longer than vitest's 5 s default, which
   * made the first test that touched it fail on a slow run. Warm them all up
   * front, on their own generous budget, so the tests measure the terrain and
   * not the module loader.
   */
  beforeAll(async () => {
    await Promise.all(scenes.map(([, load]) => load()));
  }, 60_000);

  for (const [id, load] of scenes) {
    describe(id, () => {
      it("declares a walkable band", async () => {
        const def = await load();
        expect(def.ground, `${id} has no ground band`).toBeDefined();
        const band = def.ground as GroundBand;
        expect(band.bottom, `${id} band has no depth`).toBeGreaterThan(band.top);
      });

      it("can reach every object it declares", async () => {
        const def = await load();
        const band = def.ground as GroundBand;
        const bad: string[] = [];
        for (const obj of def.objects as RuntimeObject[]) {
          const want = approachOf(obj, band);
          const got = nearestWalkable(band, want.x, want.y, EDGE_MARGIN, def.width - EDGE_MARGIN);
          /* the terrain must not have pushed the approach point out of range */
          const range = (obj as { range?: number }).range ?? 12;
          if (Math.abs(got.x - obj.x) > range) {
            bad.push(`${obj.id}: approach lands at x=${got.x.toFixed(0)}, ${obj.x} ± ${range}`);
          }
          if (insideBlocker(band.blockers, got.x, got.y)) {
            bad.push(
              `${obj.id}: approach (${got.x.toFixed(0)},${got.y.toFixed(0)}) is inside a blocker`,
            );
          }
        }
        expect(bad, `${id}:\n  ${bad.join("\n  ")}`).toEqual([]);
      });

      it("keeps its blockers and zones inside the band", async () => {
        const def = await load();
        const band = def.ground as GroundBand;
        const bad: string[] = [];
        for (const b of band.blockers ?? []) {
          if (b.x1 <= b.x0 || b.y1 <= b.y0) bad.push(`inverted blocker ${JSON.stringify(b)}`);
          const e = edgesAt(band, (b.x0 + b.x1) / 2);
          if (b.y1 < e.top || b.y0 > e.bottom) {
            bad.push(`blocker outside the band at its own x: ${JSON.stringify(b)}`);
          }
        }
        for (const z of band.zones ?? []) {
          if (z.x1 <= z.x0) bad.push(`inverted zone ${JSON.stringify(z)}`);
        }
        expect(bad, `${id}:\n  ${bad.join("\n  ")}`).toEqual([]);
      });
    });
  }
});
