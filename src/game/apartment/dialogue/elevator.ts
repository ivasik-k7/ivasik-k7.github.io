import { defineTree, playSfx } from "@/engine";
import type { Ctx } from "./types";

function pressFloor(scene: string, spawnX: number) {
  return (ctx: Ctx) => {
    playSfx("click");
    ctx.travel(scene, spawnX);
  };
}

/** The lift button panel — an object dialogue that is really a travel menu. */
export const LIFT_PANEL = defineTree<Ctx>(
  "lift-panel",
  {},
  {
    start: "start",
    nodes: {
      start: {
        lines: [{ text: "Worn buttons. The 4 shines from decades of thumbs." }],
        choices: [
          { label: "4 — your floor", effect: pressFloor("corridor", 454) },
          { label: "1 — ground, the yard", effect: pressFloor("outside", 110) },
          { label: "P — parking, level −1", effect: pressFloor("parking", 90) },
          { label: "Ride nowhere." },
        ],
      },
    },
  },
);
