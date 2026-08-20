import { SIGNAL } from "./menuStyle";

/**
 * The cursor.
 *
 * This has been three things. First a 2 px rule centred against the row, which
 * landed flush with the bottom of the cap height and read as a typed underscore
 * before the word — `_ SETTINGS`. Then a shorter rule, which read as a hyphen.
 * Both failed for the same reason: a horizontal line beside a word is a
 * punctuation mark, and no amount of positioning stops the eye parsing it as
 * one.
 *
 * So it is an arrow, drawn on the same 3×5 grid as the game's own font and with
 * the same hard edges, which is unambiguous at any size and belongs to the same
 * material as everything else on screen. Unselected rows keep a single dim cell,
 * which is a tick on a scale rather than a character.
 *
 * The whole thing lives in a fixed-width box so that selecting a row cannot move
 * the words. The first version grew a rule from 10 px to 26 *and* shifted the row
 * 6 px right, which slid the entire type column back and forth by 22 px as the
 * cursor moved down it.
 */

/**
 * The arrow: a 3-wide right-pointing wedge on a 3×5 grid, traced as one stepped
 * outline rather than as fifteen cells.
 *
 *     ■··        M0,0 across the top of column 0, then down the staircase
 *     ■■·        on the right and back up the left, closing at the start.
 *     ■■■        One node, one path, and the steps stay square because the
 *     ■■·        outline itself is made of right angles — there is no
 *     ■··        diagonal to be antialiased.
 */
const ARROW_PATH = "M0,0 H1 V1 H2 V2 H3 V3 H2 V4 H1 V5 H0 Z";

export const MARK_W = 34;

export function MenuMark({
  active,
  disabled = false,
  /** the `px` of the label beside it, so the mark scales with the type */
  px,
}: {
  active: boolean;
  disabled?: boolean;
  px: number;
}) {
  const u = Math.max(2, Math.round(px * 0.7));
  const colour = disabled ? "rgba(227,217,194,0.24)" : active ? SIGNAL : "rgba(227,217,194,0.32)";
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-start justify-end"
      style={{
        width: MARK_W,
        // the pixel font draws its caps from row 2 of an 8-row box, so the top
        // of a line of it is two rows down, not at the top of the element
        paddingTop: px * 2,
        paddingRight: u * 2,
      }}
    >
      {active ? (
        <svg
          width={u * 3}
          height={u * 5}
          viewBox="0 0 3 5"
          shapeRendering="crispEdges"
          role="presentation"
          style={{ display: "block" }}
        >
          <path d={ARROW_PATH} fill={colour} />
        </svg>
      ) : (
        <span
          style={{
            display: "block",
            width: u,
            height: u,
            marginTop: u * 2,
            background: colour,
          }}
        />
      )}
    </span>
  );
}
