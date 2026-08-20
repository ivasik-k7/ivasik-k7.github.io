import type { CSSProperties } from "react";
import type { MenuScale } from "./menuScale";

/**
 * The menu's palette and its two prose styles.
 *
 * The palette was duplicated at the top of four files, which is survivable. The
 * prose was not: three components each derived their own size, tracking and
 * opacity off the same base — 10px/0.08em/0.38, 9px/0.06em/0.30 and
 * 12px/0.06em/0.82 — for what is, in every case, "a quiet line of explanation
 * under something". Three ad-hoc styles for one role is exactly why the mix of
 * pixel type and mono prose read as accidental rather than chosen.
 *
 * So there are two, and only two. `PROSE.base` is prose you are meant to read.
 * `PROSE.quiet` is prose that is there when you look for it. The 9px-at-30%
 * setting that needed magnifying to read is gone.
 */

export const PARCHMENT = "#e3d9c2";
export const SIGNAL = "#fcee0a";
export const DIM = "rgba(227,217,194,0.42)";
export const RULE = "rgba(227,217,194,0.16)";

export const PROSE = {
  base: (s: MenuScale): CSSProperties => ({
    fontSize: s.note + 1,
    letterSpacing: "0.05em",
    lineHeight: 1.45,
    color: "rgba(227,217,194,0.72)",
  }),
  quiet: (s: MenuScale): CSSProperties => ({
    fontSize: s.note,
    letterSpacing: "0.05em",
    lineHeight: 1.4,
    color: "rgba(227,217,194,0.5)",
  }),
};
