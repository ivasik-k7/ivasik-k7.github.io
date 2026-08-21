import type { CSSProperties } from "react";
import { prose, proseQuiet } from "@/engine";
import type { MenuScale } from "./menuScale";

/**
 * The menu's palette and prose, scaled.
 *
 * The values themselves live in the engine (`ui/uiLook`) because the dialogue
 * box and the monologues use them too — the title screen's look became the
 * game's text look, and one of the two had to own it. This file only binds them
 * to the menu's size tiers.
 */

export { DIM, GROUND, PARCHMENT, RULE, SIGNAL } from "@/engine";

export const PROSE = {
  base: (s: MenuScale): CSSProperties => prose(s.note + 1),
  quiet: (s: MenuScale): CSSProperties => proseQuiet(s.note),
};
