import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

/**
 * How big the menu's type is, given how much screen there is.
 *
 * The title screen was drawn at 1280×800 and every size in it was a number.
 * On a 520 px-tall window that composition collapses: the wordmark keeps its
 * full height, the four options keep theirs, and CONTINUE ends up tucked under
 * the subtitle with no air between them. On a 1080 line it goes the other way
 * and the whole thing sits small in the corner of a large screen.
 *
 * So the sizes come from a table indexed by viewport height. Tiers rather than
 * a continuous ratio, because these are pixel fonts: `PixelLabel` draws a 3×5
 * grid scaled by an integer, and 4.7 px per cell is a blurred glyph. Four
 * steps, each one crisp, is worth more here than a smooth curve.
 *
 * Only height is consulted. The menu is a column down the left of a wide
 * picture — it runs out of room vertically long before it runs out
 * horizontally, and tying it to width makes it lurch when a window is dragged
 * wider without getting any taller.
 */

export type MenuScale = {
  /** the wordmark */
  title: number;
  /** the line under it */
  sub: number;
  /** a main menu option */
  item: number;
  /** the sub-screen heading, and the settings labels */
  heading: number;
  /** px, for the prose that is not pixel type */
  note: number;
  /** px, the gap between menu options */
  gap: number;
  /** the smallest type in the frame — the build stamp, the back hint */
  chrome: number;
};

const TIERS: readonly (readonly [number, MenuScale])[] = [
  [980, { title: 12, sub: 3, item: 5, heading: 5, note: 13, gap: 18, chrome: 3 }],
  [760, { title: 9, sub: 2, item: 4, heading: 4, note: 11, gap: 12, chrome: 2 }],
  [620, { title: 7, sub: 2, item: 3, heading: 3, note: 10, gap: 10, chrome: 2 }],
  [0, { title: 6, sub: 2, item: 3, heading: 3, note: 9, gap: 7, chrome: 2 }],
];

/**
 * The wordmark is the one size that must not sawtooth.
 *
 * With the tiers alone its cap height swung between 4.3% and 6.9% of the
 * viewport, and the two commonest laptop windows — 1280×800 and 1366×768 —
 * both land just above a breakpoint, which is why the title looked small and
 * adrift on exactly the screens most people have. Above 1080p there was no
 * tier at all and the whole menu shrank relatively.
 *
 * So the title is computed rather than tabled: one integer step per 88 px of
 * height, which holds it at a steady ~5.7% on every screen. It is still an
 * integer, which is the part that actually matters for a 3×5 font — the tiers
 * were the right idea applied to the wrong value.
 */
function titleFor(h: number): number {
  return Math.max(6, Math.min(18, Math.round(h / 88)));
}

export function scaleForHeight(h: number): MenuScale {
  for (const [min, scale] of TIERS) {
    if (h >= min) return { ...scale, title: titleFor(h) };
  }
  return TIERS[TIERS.length - 1][1];
}

const ScaleContext = createContext<MenuScale>(TIERS[1][1]);

export function MenuScaleProvider({ children }: { children: ReactNode }) {
  const [h, setH] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));
  useEffect(() => {
    const on = () => setH(window.innerHeight);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  // the tier object is stable across every height inside a tier, so nothing
  // downstream re-renders while a window is being dragged within one band
  const scale = useMemo(() => scaleForHeight(h), [h]);
  return <ScaleContext.Provider value={scale}>{children}</ScaleContext.Provider>;
}

export function useMenuScale(): MenuScale {
  return useContext(ScaleContext);
}
