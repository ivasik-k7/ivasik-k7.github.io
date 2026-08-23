import { defineTree, playSfx } from "@/engine";
import { npcMemory } from "@/engine/systems/memory";
import type { Ctx } from "./types";

/** Pan Marek, keeper of the Octavia — and the registry's fallback neighbor. */
export const MAREK = defineTree<Ctx>(
  "marek",
  { npc: "marek" },
  {
    start: (ctx) => {
      const m = npcMemory(ctx, "marek");
      const node = m.met() ? "hello" : "start";
      m.visit();
      return node;
    },
    nodes: {
      start: {
        lines: [
          {
            speaker: "Pan Marek",
            text: "You wax it — it rains. You don't wax it — it also rains.",
          },
        ],
        next: "hub",
      },
      hello: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [
              {
                speaker: "Pan Marek",
                text: "O, German engineering. Mine's still Czech. Still here.",
              },
            ],
          },
          {
            lines: [
              { speaker: "Pan Marek", text: "Evening. The pipes are dripping in B minor today." },
            ],
          },
        ],
        next: "hub",
      },
      hub: {
        lines: [{ text: "The chamois moves in slow, liturgical circles." }],
        topics: true,
        choices: [
          {
            id: "mar-octavia",
            label: "How's the Octavia holding up?",
            next: "octavia",
            againNext: "octaviaAgain",
          },
          {
            id: "mar-quiet",
            label: "Quiet down here tonight.",
            next: "quiet",
            againNext: "quietAgain",
          },
          { label: "Take care, Panie Marku.", next: "bye" },
        ],
      },
      octavia: {
        lines: [
          {
            speaker: "Pan Marek",
            text: "Two hundred and forty thousand and she burns nothing. Well. Almost nothing.",
          },
          {
            speaker: "Pan Marek",
            text: "Your German is pretty. But pretty costs. Mine only costs wax.",
          },
        ],
        next: "hub",
      },
      octaviaAgain: {
        lines: [
          {
            speaker: "Pan Marek",
            text: "Same as an hour ago. Two hundred forty thousand. She doesn't age between conversations.",
          },
        ],
        next: "hub",
      },
      quiet: {
        lines: [
          {
            speaker: "Pan Marek",
            text: "Quiet, quiet. Only the pipes drip. In '09 someone kept a goat down here. Different times.",
          },
        ],
        next: "hub",
      },
      quietAgain: {
        lines: [{ speaker: "Pan Marek", text: "Still quiet. The goat has not returned." }],
        next: "hub",
      },
      bye: {
        lines: [
          {
            speaker: "Pan Marek",
            text: "Trzymaj się. And check your tyre pressures. Front left.",
          },
        ],
      },
    },
  },
);

/** The Golf, and its keys — an object dialogue; no memory games, just state. */
export function buildGolfTree(locked: boolean) {
  if (locked) {
    return defineTree<Ctx>(
      "golf",
      {},
      {
        start: "start",
        nodes: {
          start: {
            lines: [
              {
                text: "Your Golf sleeps under the dying tube. Snow White holds its color even in this light.",
              },
            ],
            choices: [
              {
                label: "Unlock it. (key fob)",
                effect: (ctx: Ctx) => {
                  playSfx("carunlock");
                  ctx.spawnFx("golf-blink", 0, 1400);
                  ctx.updateWorld({ golfLocked: false });
                },
                next: "unlocked",
              },
              { label: "Walk around it once.", next: "walk" },
              { label: "Leave it be." },
            ],
          },
          unlocked: {
            lines: [
              {
                text: "The indicators blink twice. The mirrors unfold like it's glad to see you.",
              },
            ],
          },
          walk: {
            lines: [
              {
                text: "You walk the length of it. 310 horses, asleep. A speck of dust loses its nerve under your sleeve.",
              },
            ],
          },
        },
      },
    );
  }
  return defineTree<Ctx>(
    "golf",
    {},
    {
      start: "start",
      nodes: {
        start: {
          lines: [
            {
              text: "The Golf sits unlocked, puddle light warm on the concrete.",
            },
          ],
          choices: [
            {
              label: "Sit inside for a minute.",
              effect: (ctx: Ctx) => {
                playSfx("cardoor");
                ctx.blackout(
                  1800,
                  "Leather, cold coffee, a faint ghost of tyre smoke. You hold the wheel at nine and three and go exactly nowhere.",
                );
              },
            },
            {
              label: "Take it out. The obwodnica is empty this late.",
              effect: (ctx: Ctx) => {
                playSfx("cardoor");
                ctx.openOverlay({ type: "driving" });
              },
            },
            {
              label: "Start it, just to hear it.",
              effect: (ctx: Ctx) => {
                playSfx("engine");
                ctx.spawnFx("golf-rev", 0, 2600);
                ctx.shakeCamera(2.5, 900);
              },
              next: "started",
            },
            {
              label: "Lock it up.",
              effect: (ctx: Ctx) => {
                playSfx("carlock");
                ctx.spawnFx("golf-blink", 0, 1400);
                ctx.updateWorld({ golfLocked: true });
              },
              next: "locked",
            },
            { label: "Leave it." },
          ],
        },
        started: {
          lines: [
            {
              text: "310 horses clear their throat once. The concrete approves in echo. You switch it off before the neighbors learn your schedule.",
            },
          ],
        },
        locked: {
          lines: [
            {
              text: "One low blink. The mirrors fold in. Alarm set, level −1 goes quiet again.",
            },
          ],
        },
      },
    },
  );
}

export const TREES = { marek: MAREK };
