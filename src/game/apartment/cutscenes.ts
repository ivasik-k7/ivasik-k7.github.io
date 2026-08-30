import { t } from "i18next";
import type { SeqStep } from "@/engine";
import type { WorldState } from "@/lib/worldState";

/**
 * cutscenes.ts — the beats the game plays without you.
 *
 * The engine's sequencer (`core/sequencer.ts`) runs a list of beats; this is
 * where the game says which. Kept as data-returning functions so each one is
 * readable top to bottom the way it plays, and so a test can count its beats
 * without a browser.
 */

/** Where he wakes up on a new game: by the dog, not by the door. */
export const OPENING_START = { scene: "studio", x: 630, y: 158 } as const;

/** The kitchen window, and where he stands to open it — a step to its right, facing it. */
const WINDOW_ID = "window-kitchen";
const WINDOW_STAND_X = 262;

/** A morning at less than full pace: the walk from the dog to the window. */
const MORNING_PACE = 0.5;

const openWindow = (w: WorldState): WorldState => ({
  ...w,
  windows: { ...w.windows, [WINDOW_ID]: { open: true, smoked: false } },
});
const smokedAtWindow = (w: WorldState): WorldState => ({
  ...w,
  windows: { ...w.windows, [WINDOW_ID]: { open: true, smoked: true } },
});

/**
 * The opening. He is by Gross's bed. He says hello to the dog, walks — not
 * quickly — to the kitchen window, opens it, lights one, and talks to you
 * while he smokes: this is the flat, he does not know what today is either,
 * here is how the keys work, and nobody is keeping score. Escape skips it;
 * `openingEnd` is the world it leaves behind either way, so a skipped intro
 * is not a different flat.
 */
export function openingCutscene(): SeqStep<WorldState>[] {
  return [
    { wait: 900 },
    { face: 1 },
    { say: t("cut.gross1") },
    { action: "pet" },
    { say: t("cut.gross2") },
    // the walk blocks, so what he says on the way is narrated over it — on
    // the game clock, each line held for as long as it takes to read
    { narrate: [t("cut.walk1"), t("cut.walk2")] },
    { walkTo: WINDOW_STAND_X, speed: MORNING_PACE, timeoutMs: 20000 },
    // he has arrived; he finishes the thought looking at the window
    { face: -1 },
    { awaitNarration: true },
    { hold: "reachHalf", forMs: 320 },
    { hold: "reach", forMs: 520 },
    { sound: "creak" },
    { world: openWindow },
    { say: t("cut.window") },
    { sound: "match" },
    { narrate: [t("cut.walk3"), t("cut.smoke1"), t("cut.smoke2"), t("cut.smoke3")] },
    // the cigarette lasts as long as he has something to say over it
    { action: "smoke", repeat: "narration" },
    { world: smokedAtWindow },
    { say: t("cut.end") },
    { wait: 300 },
  ];
}

/** The state the opening leaves — applied on skip so the window is open either way. */
export const openingEnd = smokedAtWindow;
