import { defineTree } from "@/engine";
import { npcMemory } from "@/engine/systems/memory";
import type { Ctx } from "./types";

/** The trainer. Warmth here is earned in visits, like everything in a gym. */
export const TRENER = defineTree<Ctx>(
  "trener",
  { npc: "trener" },
  {
    start: (ctx) => {
      const m = npcMemory(ctx, "trener");
      const node = !m.met() ? "start" : m.visits() >= 5 ? "regular" : "hello";
      m.visit();
      return node;
    },
    nodes: {
      start: {
        lines: [
          { speaker: "Trener", text: "O, sambista. Biodra dzisiaj, czy znowu tylko ramiona?" },
        ],
        next: "hub",
      },
      hello: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [{ speaker: "Trener", text: "Jesteś. Dobrze. Rozgrzewka się sama nie zrobi." }],
          },
          {
            lines: [
              {
                speaker: "Trener",
                text: "Sambista. Kreda jest, ławka wolna. Czego chcesz ode mnie?",
              },
            ],
          },
        ],
        next: "hub",
      },
      regular: {
        lines: [
          { speaker: "Trener", text: "Nie pytam już, po co przyszedłeś. Wiesz, gdzie kreda." },
          {
            text: "He counts you among the fixtures now. In this cellar that is a rank.",
            voice: "inner",
          },
        ],
        next: "hub",
      },
      hub: {
        lines: [{ text: "Somewhere behind him a kettlebell lands like a verdict." }],
        topics: true,
        choices: [
          { id: "trn-hips", label: "Biodra, trenerze.", next: "hips", againNext: "hipsAgain" },
          {
            id: "trn-gira",
            label: "Co z tą girą przy oknie?",
            next: "gira",
            againNext: "giraAgain",
          },
          { label: "Do roboty.", next: "bye" },
        ],
      },
      hips: {
        lines: [
          { speaker: "Trener", text: "Dobrze. Rwanie zaczyna się od ziemi, nie od lustra." },
          {
            speaker: "Trener",
            text: "Lustro jest dla formy. Forma jest dla stawów. Stawy są na całe życie.",
          },
        ],
        next: "hub",
      },
      hipsAgain: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          {
            lines: [
              {
                speaker: "Trener",
                text: "To samo co zawsze: od ziemi. Ile razy mam powtarzać, tyle powtórzę.",
              },
            ],
          },
          {
            lines: [
              {
                speaker: "Trener",
                text: "Biodra. Ziemia. Idź już ćwiczyć, gadaniem nie zrobisz rwania.",
              },
            ],
          },
        ],
        next: "hub",
      },
      gira: {
        lines: [
          {
            speaker: "Trener",
            text: "Ta? Trzydzieści dwa kilo, rocznik osiemdziesiąty. Ze starej kotłowni.",
          },
          {
            speaker: "Trener",
            text: "Przeżyła trzy remonty i dwóch prezesów spółdzielni. Szanuj ją.",
          },
        ],
        next: "hub",
      },
      giraAgain: {
        lines: [
          { speaker: "Trener", text: "Dalej trzydzieści dwa. Giry nie chudną. My mamy chudnąć." },
        ],
        next: "hub",
      },
      bye: { lines: [{ speaker: "Trener", text: "Plecy proste. Nie każ mi tego powtarzać." }] },
    },
  },
);

export const TREES = { trener: TRENER };
