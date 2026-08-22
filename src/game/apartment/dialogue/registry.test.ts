import { describe, expect, it } from "vitest";
import { type DialogueTree, validateTree } from "@/engine";
import { initialWorld, type WorldState } from "@/lib/worldState";
import { DIALOGUE } from "./index";

/**
 * The sweep the validator can't do from the browser: load EVERY conversation
 * in the game and hold it to the authoring rules — no dead edges, no
 * duplicate choice ids sharing one memory, no unreachable nodes, and a
 * unique persistence id per tree (variant rotation collides without one).
 * A tree nobody has opened in dev still fails CI here.
 */
describe("dialogue registry", () => {
  it("every registered conversation loads and validates clean", async () => {
    const ids = Object.keys(DIALOGUE);
    expect(ids.length).toBeGreaterThan(25);
    const seenTreeIds = new Map<string, string>();
    for (const objId of ids) {
      const source = await DIALOGUE[objId]();
      const tree = (
        typeof source === "function"
          ? (source as (w: WorldState) => DialogueTree<never>)(initialWorld)
          : source
      ) as DialogueTree<never>;
      const problems = validateTree(tree);
      expect(
        problems,
        `${objId}: ${problems.map((p) => `${p.kind}@${p.node}`).join(", ")}`,
      ).toEqual([]);
      expect(tree.id, `${objId} is missing a defineTree id`).toBeTruthy();
      const holder = seenTreeIds.get(tree.id as string);
      // shared trees (the station reuses the street cast) must share the SAME
      // tree id on purpose; two DIFFERENT trees with one id would collide
      if (holder && holder !== objId) {
        const a = await DIALOGUE[holder]();
        const b = source;
        expect(a, `tree id "${tree.id}" reused by ${holder} and ${objId}`).toBe(b);
      }
      seenTreeIds.set(tree.id as string, objId);
    }
  });
});
