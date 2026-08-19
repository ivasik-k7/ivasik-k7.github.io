import type { CSSProperties, ReactNode } from "react";
import { textPath, textWidth } from "../scene/pixelKit";

/**
 * PixelFrame — the one way this game draws a box.
 *
 * Every plate, panel and menu page is this component, so the interface reads as
 * one manufactured object rather than a pile of CSS borders. It is built the way
 * the scenes are built: whole pixels only, light from the top-left, no radii and
 * no gradients.
 *
 *   · `u` is one interface pixel. Every dimension here is an integer multiple.
 *   · The corners are chamfered two pixels deep with clip-path, so they hold at
 *     any content size — the same cut the speech bubbles use.
 *   · Two layers: a border layer, and a fill inset by one pixel. The fill wears
 *     a lit top edge and a dark bottom edge, which is the whole trick.
 *   · Four rivets, one per corner, because a plate is screwed to something.
 *   · An optional title plate straddles the top edge, the way a machine's badge
 *     sits proud of its case.
 *
 * Interactive frames (onClick) get a hover lift and a focus ring in signal
 * yellow, and render as a real <button> so the keyboard reaches them.
 */

export type FrameTone = "panel" | "plate" | "inset" | "active";

const FILL: Record<FrameTone, string> = {
  panel: "rgba(9,11,16,0.97)",
  plate: "rgba(11,14,20,0.9)",
  inset: "rgba(0,0,0,0.34)",
  active: "rgba(24,22,12,0.95)",
};

const EDGE: Record<FrameTone, string> = {
  panel: "rgba(227,217,194,0.34)",
  plate: "rgba(227,217,194,0.3)",
  inset: "rgba(227,217,194,0.14)",
  active: "rgba(252,238,10,0.7)",
};

/** A two-step staircase at every corner, cut in whole pixels. */
export function chamferClip(u: number): string {
  return `polygon(${[
    `${u * 2}px 0`,
    `calc(100% - ${u * 2}px) 0`,
    `calc(100% - ${u}px) ${u}px`,
    `100% ${u * 2}px`,
    `100% calc(100% - ${u * 2}px)`,
    `calc(100% - ${u}px) calc(100% - ${u}px)`,
    `calc(100% - ${u * 2}px) 100%`,
    `${u * 2}px 100%`,
    `${u}px calc(100% - ${u}px)`,
    `0 calc(100% - ${u * 2}px)`,
    `0 ${u * 2}px`,
    `${u}px ${u}px`,
  ].join(", ")})`;
}

/** One-pixel scanlines over the fill, the same trick the scenes use. */
export function scanlines(u: number, alpha = 0.05): string {
  return `repeating-linear-gradient(180deg, rgba(232,230,224,${alpha}) 0px, rgba(232,230,224,${alpha}) ${u}px, rgba(0,0,0,0) ${u}px, rgba(0,0,0,0) ${u * 2}px)`;
}

/** Type that never smooths, never ligatures, never drifts off the grid. */
export const CRISP: CSSProperties = {
  WebkitFontSmoothing: "none",
  MozOsxFontSmoothing: "unset",
  textRendering: "optimizeSpeed",
  fontVariantLigatures: "none",
};

function Rivets({ u, color }: { u: number; color: string }) {
  const spots: CSSProperties[] = [
    { top: u, left: u },
    { top: u, right: u },
    { bottom: u, left: u },
    { bottom: u, right: u },
  ];
  return (
    <>
      {spots.map((pos) => (
        <span
          key={`${pos.top ?? "b"}${pos.left ?? "r"}`}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ ...pos, width: u, height: u, background: color }}
        />
      ))}
    </>
  );
}

export function PixelFrame({
  u = 3,
  tone = "panel",
  title,
  badge,
  rivets = true,
  scan = true,
  onClick,
  ariaLabel,
  className,
  style,
  bodyStyle,
  children,
}: {
  /** one interface pixel */
  u?: number;
  tone?: FrameTone;
  /** small plate straddling the top edge — a string is set in the pixel font */
  title?: ReactNode;
  /** small plate on the top-right edge — counts, keys, status */
  badge?: ReactNode;
  rivets?: boolean;
  scan?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
  children?: ReactNode;
}) {
  const clip = chamferClip(u);
  const interactive = Boolean(onClick);

  const frame = (
    <span
      className="relative block"
      style={{
        clipPath: clip,
        backgroundColor: EDGE[tone],
        padding: u,
        filter: `drop-shadow(0 ${u}px 0 rgba(0,0,0,0.5))`,
      }}
    >
      <span
        className="relative block"
        style={{
          clipPath: clip,
          // backgroundColor, never the `background` shorthand: this element also
          // sets backgroundImage, and mixing the two makes React re-apply one
          // without the other on rerender (it warns, and the fill can flicker)
          backgroundColor: FILL[tone],
          backgroundImage: scan ? scanlines(u) : "none",
          boxShadow: `inset 0 ${u}px 0 rgba(232,230,224,0.09), inset 0 ${-u}px 0 rgba(0,0,0,0.45)`,
          ...bodyStyle,
        }}
      >
        {rivets ? <Rivets u={u} color="rgba(227,217,194,0.22)" /> : null}
        {children}
      </span>
    </span>
  );

  const plates = (
    <>
      {title !== undefined ? (
        <span
          className="pointer-events-none absolute z-10 flex items-center whitespace-nowrap font-mono text-signal/90 uppercase"
          style={{
            ...CRISP,
            left: u * 4,
            top: -u * 2,
            clipPath: clip,
            backgroundColor: "rgba(11,14,20,0.98)",
            border: `${u}px solid ${EDGE[tone]}`,
            padding: `0 ${u * 2}px`,
            fontSize: Math.max(8, u * 3),
            lineHeight: `${Math.max(12, u * 5)}px`,
            letterSpacing: "0.18em",
          }}
        >
          {typeof title === "string" ? (
            <PixelLabel text={title} px={u - 1} fill="#fcee0a" opacity={0.9} />
          ) : (
            title
          )}
        </span>
      ) : null}
      {badge !== undefined ? (
        <span
          className="pointer-events-none absolute z-10 flex items-center whitespace-nowrap font-mono text-parchment/70"
          style={{
            ...CRISP,
            right: u * 4,
            top: -u * 2,
            clipPath: clip,
            backgroundColor: "rgba(11,14,20,0.98)",
            border: `${u}px solid ${EDGE[tone]}`,
            padding: `0 ${u * 2}px`,
            fontSize: Math.max(8, u * 3),
            lineHeight: `${Math.max(12, u * 5)}px`,
            letterSpacing: "0.16em",
          }}
        >
          {typeof badge === "string" ? (
            <PixelLabel text={badge} px={u - 1} fill="#e3d9c2" opacity={0.6} />
          ) : (
            badge
          )}
        </span>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        onPointerDown={(e) => e.stopPropagation()}
        className={`group relative block text-left transition-transform duration-100 hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-signal ${className ?? ""}`}
        style={style}
      >
        {plates}
        {frame}
      </button>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`} style={style}>
      {plates}
      {frame}
    </div>
  );
}

/**
 * A meter drawn as whole cells, not a percentage of a rounded rectangle. Ten
 * cells is the game's unit of measure for anything about a person.
 */
export function PixelMeter({
  value,
  max = 10,
  u = 3,
  tint = "#fcee0a",
}: {
  value: number;
  max?: number;
  u?: number;
  tint?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`${value} of ${max}`}
      className="inline-flex items-center"
      style={{ gap: u }}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed row of cells, never reordered
          key={`cell${i * 1}`}
          style={{
            width: u * 2,
            height: u * 3,
            background: i < value ? tint : "rgba(227,217,194,0.13)",
            boxShadow: i < value ? `inset 0 ${-u}px 0 rgba(0,0,0,0.35)` : undefined,
          }}
        />
      ))}
    </span>
  );
}

/**
 * PixelLabel — interface type set in the game's own 3x5 font.
 *
 * The HUD used to be mono-spaced web type sitting on top of a pixel world, and
 * it always read as a browser in front of a game. This renders the same glyphs
 * the street signs and lift displays use, so a room name on the clock plate and
 * a room name painted on a wall are literally the same typeface.
 *
 * `px` is the size of one font pixel. Everything is integer, so it never
 * antialiases; the viewBox leaves two rows above and one below for Polish
 * accents and ogonki.
 */
export function PixelLabel({
  text,
  px = 3,
  fill = "currentColor",
  gap = 1,
  opacity,
  className,
  title,
}: {
  text: string;
  px?: number;
  fill?: string;
  gap?: number;
  opacity?: number;
  className?: string;
  /** accessible name; defaults to the text itself */
  title?: string;
}) {
  const w = Math.max(1, textWidth(text, gap));
  return (
    <svg
      role="img"
      aria-label={title ?? text}
      width={w * px}
      height={8 * px}
      viewBox={`0 -2 ${w} 8`}
      shapeRendering="crispEdges"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      <path d={textPath(text, 0, 0, gap)} fill={fill} opacity={opacity} />
    </svg>
  );
}
