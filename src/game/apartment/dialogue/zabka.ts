import { defineTree, playSfx } from "@/engine";
import { npcMemory } from "@/engine/systems/memory";
import { metTimes } from "@/lib/body";
import type { WorldState } from "@/lib/worldState";
import { buy, canAfford } from "./commerce";
import type { Ctx } from "./types";

/**
 * The Żabka cashier — the flagship regular. The arc, played out over real
 * visits: dzień dobry → dobry wieczór, znowu pan → dobry → "The usual."
 * Nothing announces the promotion; your own head notices it once.
 *
 * Still a builder (the money line reads the world at open); defineTree keeps
 * the persistence identity stable across builds.
 */
export function buildCashierTree(world: WorldState) {
  const buys = [
    {
      label: "A pack of reds. (12 zł)",
      next: canAfford(12),
      effect: (ctx: Ctx) => {
        buy(ctx, "cigarettes", 12);
        npcMemory(ctx, "cashier").learn("smokes");
      },
    },
    {
      label: "A lighter. (5 zł)",
      next: canAfford(5),
      effect: (ctx: Ctx) => buy(ctx, "lighter", 5),
    },
    { label: "That's all, thanks.", next: "bye" },
  ];
  return defineTree<Ctx>(
    "cashier",
    { npc: "cashier" },
    {
      start: (ctx) => {
        const m = npcMemory(ctx, "cashier");
        const visits = m.visits();
        m.visit();
        if (!m.met() || visits === 0) return "first";
        if (m.minutesSince() < 4) return "again";
        return visits >= 4 ? "usual" : "known";
      },
      nodes: {
        first: {
          lines: [
            { text: `You have ${world.money} zł in your pocket.` },
            metTimes(world, "cashier").times >= 3
              ? { speaker: "Cashier", text: "O, sąsiad. Dzień dobry. The usual?", mood: "warm" }
              : { speaker: "Cashier", text: "Dzień dobry. What'll it be?" },
          ],
          choices: buys,
        },
        known: {
          lines: [{ text: "fallback" }],
          variantMode: "exhaust",
          variants: [
            {
              lines: [
                { text: `You have ${world.money} zł in your pocket.` },
                { speaker: "Cashier", text: "Dobry wieczór. Znowu pan. What'll it be?" },
              ],
            },
            {
              lines: [
                { text: `You have ${world.money} zł in your pocket.` },
                { speaker: "Cashier", text: "Dobry. The shelf hasn't moved." },
              ],
            },
          ],
          choices: buys,
        },
        usual: {
          lines: [
            { text: `You have ${world.money} zł in your pocket.` },
            { speaker: "Cashier", text: "Dobry." },
          ],
          interjections: [
            {
              id: "int-cashier-dzien",
              text: "He dropped the 'dzień'. You have been promoted.",
              once: true,
            },
          ],
          choices: [
            {
              id: "zb-usual",
              label: "The usual.",
              when: (ctx) => npcMemory(ctx, "cashier").knows("smokes") && ctx.world.money >= 12,
              next: "usualSold",
              effect: (ctx) => buy(ctx, "cigarettes", 12),
            },
            ...buys,
          ],
        },
        usualSold: {
          lines: [
            { speaker: "Cashier", text: "Mhm." },
            { text: "The pack is on the counter before you finish the sentence." },
          ],
          next: "more",
        },
        "sold-12": {
          lines: [
            {
              speaker: "Cashier",
              text: "Twelve even. The matches are a gift, they don't scan.",
            },
          ],
          next: "more",
        },
        "sold-5": {
          lines: [{ speaker: "Cashier", text: "Five. Don't lose this one too." }],
          next: "more",
        },
        short: {
          lines: [
            {
              speaker: "Cashier",
              text: "You're short. Happens to everyone. Shelf's not going anywhere.",
            },
          ],
          next: "more",
        },
        more: {
          lines: [{ speaker: "Cashier", text: "Anything else?" }],
          choices: buys,
        },
        again: {
          lines: [{ speaker: "Cashier", text: "Forgot something? The step's still there too." }],
          choices: buys,
        },
        bye: {
          lines: [{ speaker: "Cashier", text: "Trzymaj się. Mind the step." }],
        },
      },
    },
  );
}

/** Used by the cashier handler; playSfx re-exported for parity with handlers. */
export { playSfx };
