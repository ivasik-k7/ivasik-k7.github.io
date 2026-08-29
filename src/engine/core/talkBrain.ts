import { jitter } from "./idleBrain";

/**
 * talkBrain.ts — what the character does with his hands and head while a
 * conversation is on screen.
 *
 * For as long as the game has had dialogue, the player stood through all of
 * it breathing. The other person had a mood and a face; he had a chest going
 * up and down. This is the missing half: while the other side talks he
 * listens — still, with the odd nod — and while the choices are his, or the
 * line is his own, his hand comes up the way a hand does when somebody is
 * explaining something and goes down again between phrases.
 *
 * It runs on the wall clock, not the game clock, because a dialogue pauses
 * the game: the world stops and the two people in it do not. Same shape as
 * idleBrain — deterministic jitter, caller-owned state, no DOM.
 */

export type TalkState = {
  /** when the current beat began (0 = not started) */
  beatAt: number;
  /** what this beat is: a gesture, the hand down, a nod, listening still */
  beat: "up" | "down" | "nod" | "still";
  /** how long this beat lasts */
  beatMs: number;
  /** alternates the two gesture frames so he does not wave the same hand shape */
  gesture: number;
};

export const newTalkState = (): TalkState => ({ beatAt: 0, beat: "still", beatMs: 0, gesture: 0 });

export function resetTalk(t: TalkState): void {
  t.beatAt = 0;
}

/**
 * The frame for this tick. `speaking` is true while the words on screen are
 * his — a choice list, or a line with no other speaker attached.
 */
export function stepTalk(t: TalkState, now: number, speaking: boolean): string {
  if (t.beatAt === 0 || now - t.beatAt >= t.beatMs) {
    // pick the next beat from where we are
    const seed = Math.floor(now / 50);
    if (speaking) {
      if (t.beat === "up") {
        t.beat = "down";
        t.beatMs = 450 + jitter(seed, 500);
      } else {
        t.beat = "up";
        t.beatMs = 650 + jitter(seed, 600);
        t.gesture = (t.gesture + 1 + (jitter(seed + 3, 3) === 0 ? 1 : 0)) % 2;
      }
    } else if (t.beat === "nod") {
      t.beat = "still";
      t.beatMs = 2200 + jitter(seed, 2600);
    } else {
      // a nod, unless the last beat was a gesture that has to come down first
      t.beat = t.beat === "up" ? "still" : "nod";
      t.beatMs = t.beat === "nod" ? 320 : 900 + jitter(seed, 900);
    }
    t.beatAt = now;
  }
  switch (t.beat) {
    case "up":
      return t.gesture === 0 ? "talkA" : "talkB";
    case "nod":
      return "nod";
    default: {
      // listening, or between phrases: the breath, on the same clock idleBrain uses
      const cycle = 1500 + jitter(Math.floor(now / 3400), 500);
      return now % cycle < cycle * 0.52 ? "stand" : "idleB";
    }
  }
}
