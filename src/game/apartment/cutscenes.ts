import { t } from "i18next";
import { dwellMs, type SeqStep } from "@/engine";
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
 * Lines spoken *over* a blocking beat (a walk, a cigarette). `say` blocks, so
 * these are queued ahead of the beat instead, each one starting when the last
 * has been on screen for as long as it needs at the player's text speed —
 * which is why the delays are computed when the beat runs, not written down.
 * The `until` that follows the blocking beat holds the scene until the last
 * line has been read, so a slow reader is never cut off by the next thing.
 */
function spoken(lines: string[]): {
  queue: SeqStep<WorldState>;
  settle: SeqStep<WorldState>;
  talking: () => boolean;
} {
  let endsAt = 0;
  const talking = () => performance.now() < endsAt;
  return {
    queue: {
      do: (c) => {
        let t = 500;
        for (const line of lines) {
          c.queueToast(line, t);
          t += dwellMs(line) + 250;
        }
        endsAt = performance.now() + t;
      },
    },
    settle: { until: () => !talking(), timeoutMs: 180_000 },
    talking,
  };
}

/**
 * The opening. He is by Gross's bed. He says hello to the dog, walks — not
 * quickly — to the kitchen window, opens it, lights one, and talks to you
 * while he smokes: this is the flat, he does not know what today is either,
 * here is how the keys work, and nobody is keeping score. Escape skips it;
 * `openingEnd` is the world it leaves behind either way, so a skipped intro
 * is not a different flat.
 */
export function openingCutscene(): SeqStep<WorldState>[] {
  const onTheWay = spoken([t("cut.walk1"), t("cut.walk2")]);
  const overTheCigarette = spoken([
    t("cut.walk3"),
    t("cut.smoke1"),
    t("cut.smoke2"),
    t("cut.smoke3"),
  ]);
  return [
    { wait: 900 },
    { face: 1 },
    { say: t("cut.gross1") },
    { action: "pet" },
    { say: t("cut.gross2") },
    onTheWay.queue,
    { walkTo: WINDOW_STAND_X, speed: MORNING_PACE, timeoutMs: 20000 },
    // he has arrived; he finishes the thought looking at the window
    { face: -1 },
    onTheWay.settle,
    { hold: "reachHalf", forMs: 320 },
    { hold: "reach", forMs: 520 },
    { sound: "creak" },
    { world: openWindow },
    { say: t("cut.window") },
    { sound: "match" },
    overTheCigarette.queue,
    // the cigarette lasts as long as he has something to say over it
    { action: "smoke", repeat: overTheCigarette.talking },
    { world: smokedAtWindow },
    { say: t("cut.end") },
    { wait: 300 },
  ];
}

/** The state the opening leaves — applied on skip so the window is open either way. */
export const openingEnd = smokedAtWindow;
