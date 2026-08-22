import { afterEach, describe, expect, it } from "vitest";
import { _setMemoryClock, knows, learn, npcMemory } from "./memory";

/** The runtime's persisted stores, in miniature. */
function stores() {
  const flags: Record<string, boolean> = {};
  const counters: Record<string, number> = {};
  return {
    flags,
    counters,
    ctx: {
      flag: (k: string) => flags[k] === true,
      setFlag: (k: string, on = true) => {
        flags[k] = on;
      },
      counter: (k: string) => counters[k] ?? 0,
      bump: (k: string, by = 1) => {
        counters[k] = (counters[k] ?? 0) + by;
        return counters[k];
      },
    },
  };
}

afterEach(() => _setMemoryClock(null));

describe("npc memory", () => {
  it("remembers meeting, visits and facts under collision-proof keys", () => {
    const { ctx, flags } = stores();
    const pani = npcMemory(ctx, "cashier");
    const trener = npcMemory(ctx, "trener");
    expect(pani.met()).toBe(false);
    pani.visit();
    pani.learn("name");
    expect(pani.met()).toBe(true);
    expect(pani.visits()).toBe(1);
    expect(pani.knows("name")).toBe(true);
    // the other regular is untouched
    expect(trener.met()).toBe(false);
    expect(trener.knows("name")).toBe(false);
    expect(flags["npc:cashier.k:name"]).toBe(true);
  });

  it("tracks recency on the real clock — 'back already' vs 'long time'", () => {
    const { ctx } = stores();
    let t = 10_000;
    _setMemoryClock(() => t);
    const pani = npcMemory(ctx, "cashier");
    expect(pani.minutesSince()).toBe(Number.POSITIVE_INFINITY); // never met
    pani.visit();
    t += 7;
    expect(pani.minutesSince()).toBe(7); // back already
    t += 3 * 1440;
    expect(pani.daysSince()).toBe(3); // long time
    pani.visit();
    expect(pani.minutesSince()).toBe(0);
    expect(pani.visits()).toBe(2);
  });

  it("drifts warmth both ways and reads asked() from dialogue's seen-marks", () => {
    const { ctx } = stores();
    const pani = npcMemory(ctx, "cashier");
    pani.warm();
    pani.warm(2);
    pani.warm(-4);
    expect(pani.warmth()).toBe(-1);
    ctx.setFlag("dlg.seen:zb-hotdogs");
    expect(pani.asked("zb-hotdogs")).toBe(true);
  });

  it("cross-light: what a look teaches, a conversation elsewhere knows", () => {
    const { ctx } = stores();
    expect(knows(ctx, "cranes.minia")).toBe(false);
    learn(ctx, "cranes.minia");
    expect(knows(ctx, "cranes.minia")).toBe(true);
  });

  it("degrades to cold defaults on a ctx without stores", () => {
    const ghost = npcMemory({}, "cashier");
    expect(ghost.met()).toBe(false);
    expect(ghost.visits()).toBe(0);
    expect(ghost.minutesSince()).toBe(Number.POSITIVE_INFINITY);
    expect(() => {
      ghost.visit();
      ghost.warm();
      ghost.learn("x");
    }).not.toThrow();
  });
});
