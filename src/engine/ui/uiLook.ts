import type { CSSProperties } from "react";

/**
 * The interface's palette and its two prose styles.
 *
 * These were arrived at on the title screen and they are now the whole game's
 * text look, because the title screen turned out to be the most legible surface
 * in the project and the reason was not the colours — it was that there was
 * nothing else on it. No frame, no chamfer, no scanlines, no rivets: a word in
 * the pixel font, a two-pixel rule, and prose. Anything the player reads now
 * gets the same treatment.
 *
 * There are exactly two prose styles, and the reason is documented in anger:
 * three components once each derived their own size, tracking and opacity off
 * the same base — 10px/0.08em/0.38, 9px/0.06em/0.30 and 12px/0.06em/0.82 — for
 * what is in every case "a quiet line under something". Three ad-hoc styles for
 * one role is what makes a mix of pixel type and mono prose read as accidental.
 */

export const PARCHMENT = "#e3d9c2";
/** The one accent. Selection, and nothing else. */
export const SIGNAL = "#fcee0a";
export const DIM = "rgba(227,217,194,0.42)";
export const RULE = "rgba(227,217,194,0.16)";
/** The ground everything sits on, and the scrim that makes type readable. */
export const GROUND = "#06080d";

/**
 * The voice — see `--font-speech` in index.css for why it is not the mono.
 *
 * Set here rather than left to a Tailwind class so that every surface a
 * character speaks on picks it up from one place: the dialogue box, both
 * monologues, and anything added later.
 */
export const SPEECH_FONT = "var(--font-speech)";

/** Prose you are meant to read. */
export function prose(fontSize: number): CSSProperties {
  return {
    fontFamily: SPEECH_FONT,
    fontSize,
    /* a grotesque needs far less tracking than a mono did */
    letterSpacing: "0.015em",
    lineHeight: 1.5,
    color: "rgba(227,217,194,0.88)",
  };
}

/** Prose that is there when you look for it. */
export function proseQuiet(fontSize: number): CSSProperties {
  return {
    fontFamily: SPEECH_FONT,
    fontSize,
    letterSpacing: "0.02em",
    lineHeight: 1.45,
    color: "rgba(227,217,194,0.52)",
  };
}
