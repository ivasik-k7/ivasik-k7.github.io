import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { subscribePrefs, textCharMs } from "../core/prefs";
import { PixelLabel } from "./PixelFrame";
import { PARCHMENT, prose, RULE, SIGNAL } from "./uiLook";

/**
 * SpeechPanel — the surface every word a character says is written on.
 *
 * It is not a panel any more, and that is the point.
 *
 * This has been through two designs. The first hand-rolled a bubble with its
 * own chamfer and scanlines, which looked like a lookalike of the HUD sitting
 * next to the HUD. The second was the real thing — an actual `PixelFrame`, the
 * same riveted plate as the clock and the music deck, with the speaker on a
 * title plate straddling the top edge. That was consistent, and it was still
 * too much: four decorated edges, a chamfer, a scanline wash and eight rivets
 * around two lines of dialogue, on top of a scene that is itself dense pixel
 * art. The frame competed with the game behind it for every word.
 *
 * So it is now the title screen's language instead, which is the most legible
 * thing in the project precisely because it has nothing in it: a name in the
 * 3×5 pixel font, a two-pixel rule, prose underneath, and a soft dark scrim to
 * lift it off whatever is behind. No border, no plate, no rivets, no tail.
 *
 * The one thing that is not pixel type is the prose. `PixelLabel` draws the
 * glyph font as a single unwrappable SVG line, which is right for a speaker's
 * name and impossible for a paragraph of Polish, so the body is mono and every
 * label around it is the real thing.
 */

export type SpeechTone = "say" | "think" | "narrate";

/**
 * How dark the ground under the words is.
 *
 * Speech gets the most, because it is the longest read and usually sits over a
 * lit shopfront. A thought gets less — an inner voice should feel like it is
 * inside the picture rather than over it. Narration gets least of all.
 */
const SCRIM: Record<SpeechTone, string> = {
  say: "rgba(6,8,13,0.80)",
  think: "rgba(6,8,13,0.62)",
  narrate: "rgba(6,8,13,0.52)",
};

/** A thought is set back; narration is quieter still. */
const BODY_OPACITY: Record<SpeechTone, number> = { say: 1, think: 0.84, narrate: 0.72 };

/**
 * A one-pixel hard outline, in four offsets, no blur.
 *
 * This is what lets a floating line of speech have no box at all. Text over
 * dense pixel art is unreadable without *something* behind it, and the two
 * choices are a panel or an outline. A panel is a rectangle of interface
 * hanging in the middle of the picture; an outline is how pixel-art games have
 * always done floating text, it costs nothing, and it keeps the words in the
 * world rather than on top of it.
 *
 * Four offsets rather than eight: at one pixel the diagonals add nothing but a
 * heavier letterform. Blur is zero on purpose — a soft shadow under a 3-pixel
 * glyph is the fastest way to stop looking like pixel art.
 */
function outline(u: number, colour = "#000"): string {
  const d = Math.max(1, Math.round(u / 2));
  /**
   * Eight offsets, not four. Four leaves the diagonals of a glyph — the shoulder
   * of an `n`, the join of a `k` — touching the background directly, and against
   * a lit shopfront those are exactly the places a letter breaks up. Eight
   * closes the ring. Pure black rather than the interface's near-black, because
   * this has to work over a yellow paczkomat as well as over a night sky.
   */
  const at: [number, number][] = [
    [d, 0],
    [-d, 0],
    [0, d],
    [0, -d],
    [d, d],
    [-d, d],
    [d, -d],
    [-d, -d],
  ];
  return at.map(([x, y]) => `${x}px ${y}px 0 ${colour}`).join(", ");
}

export function SpeechPanel({
  u = 3,
  tone = "say",
  title,
  badge,
  maxWidth,
  bare = false,
  className,
  style,
  children,
}: {
  u?: number;
  tone?: SpeechTone;
  /** the speaker, set in the pixel font with a rule beside it */
  title?: string;
  /** a hint at the end of the speaker line — "[E]", "UP/DOWN" */
  badge?: string;
  maxWidth?: number;
  /**
   * No ground at all: the words float, outlined a pixel in the dark, with
   * nothing drawn behind them. This is how anything hanging over a character's
   * head is set — a rectangle parked in the middle of the picture reads as
   * interface, and a line somebody is saying should read as part of the world.
   */
  bare?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const pad = u * 2;
  return (
    <div
      className={className}
      style={{
        maxWidth,
        background: bare ? undefined : SCRIM[tone],
        padding: bare ? 0 : `${pad}px ${pad + u}px`,
        opacity: BODY_OPACITY[tone],
        textShadow: bare ? outline(u) : undefined,
        ...style,
      }}
    >
      {title ? <SpeakerLine u={u} name={title} badge={badge} bare={bare} /> : null}
      {children}
    </div>
  );
}

/**
 * The speaker's name, and the rule that runs off it.
 *
 * Lifted wholesale from the way the title screen sets a heading — `SETTINGS`
 * followed by a short rule — because a character's name is doing exactly that
 * job: naming the thing you are about to read.
 */
export function SpeakerLine({
  u = 3,
  name,
  badge,
  accent = SIGNAL,
  bare = false,
}: {
  u?: number;
  name: string;
  badge?: string;
  accent?: string;
  /** floating over the world: drop the rule, and outline the name instead */
  bare?: boolean;
}) {
  const px = Math.max(2, u - 1);
  if (bare) {
    /**
     * Just the name, a pixel outline behind it, and nothing else. The rule that
     * runs off a heading is a device for a page of type; over somebody's head it
     * is a line hanging in mid-air.
     */
    return (
      <span
        className="block"
        style={{
          marginBottom: Math.max(1, u - 1),
          filter: `drop-shadow(0 ${Math.max(1, Math.round(u / 2))}px 0 rgba(6,8,13,0.92))`,
        }}
      >
        <PixelLabel text={name.toUpperCase()} px={px} fill={accent} opacity={0.95} />
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2" style={{ marginBottom: u }}>
      <PixelLabel text={name.toUpperCase()} px={px} fill={accent} opacity={0.9} />
      <span style={{ flex: 1, height: 2, background: RULE }} />
      {badge ? <PixelLabel text={badge} px={px} fill={PARCHMENT} opacity={0.4} /> : null}
    </div>
  );
}

/**
 * The stem: two pixels wide, three tall, dropping from a floating line of
 * speech toward whoever said it.
 *
 * All that is left of what used to be a bubble tail. A tail is bubble
 * furniture and there are no bubbles here any more, but a line of text hanging
 * in the air over a street with four people in it still has to say which of
 * them is talking. Two pixels does that.
 */
export function SpeechStem({ u = 3, tone = "say" }: { u?: number; tone?: SpeechTone }) {
  return (
    <div style={{ height: u * 3, marginLeft: "50%", width: u * 2 }}>
      <div style={{ width: u * 2, height: u * 3, marginLeft: -u, background: SCRIM[tone] }} />
    </div>
  );
}

/**
 * Typed-out prose with a block cursor.
 *
 * The text is written straight into a DOM node on an animation frame rather
 * than through React state. The old dialogue box called `setState` once per
 * character at 18 ms — around fifty-five renders a second, of a tree sitting on
 * top of a running game, to animate a string. Nothing above this needs to know
 * how far the sentence has got.
 */
export function SpeechText({
  text,
  done,
  u = 3,
  pace = 1,
  fontSize,
  lineHeight,
  className,
  onDone,
}: {
  text: string;
  /** already finished — render it whole, no animation */
  done: boolean;
  u?: number;
  /**
   * How this surface's pace relates to the player's TEXT SPEED setting. 1 is
   * the setting exactly; a monologue drawls at 1.45 and the player's own inner
   * voice runs at 0.78, because they were tuned against each other that way and
   * a single speed for all three read wrong. The absolute numbers are the
   * player's to choose — these are only the ratios between the voices.
   */
  pace?: number;
  fontSize?: number;
  lineHeight?: number;
  className?: string;
  onDone?: () => void;
}) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const caretRef = useRef<HTMLSpanElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const charMs = useCharMs(pace);

  useEffect(() => {
    const node = textRef.current;
    const caret = caretRef.current;
    if (!node) return;
    if (done || charMs <= 0) {
      node.textContent = text;
      if (caret) caret.style.display = "none";
      return;
    }
    let raf = 0;
    const started = performance.now();
    let shown = -1;
    if (caret) caret.style.display = "";
    const tick = (now: number) => {
      const n = Math.min(text.length, Math.floor((now - started) / charMs));
      if (n !== shown) {
        shown = n;
        node.textContent = text.slice(0, n);
      }
      if (n < text.length) {
        raf = requestAnimationFrame(tick);
      } else {
        if (caret) caret.style.display = "none";
        doneRef.current?.();
      }
    };
    node.textContent = "";
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, done, charMs]);

  const base = prose(fontSize ?? u * 4);
  return (
    <span
      className={className}
      style={{ ...base, lineHeight: lineHeight ? `${lineHeight}px` : base.lineHeight }}
    >
      <span ref={textRef} />
      <span
        ref={caretRef}
        aria-hidden="true"
        className="ml-px inline-block align-baseline"
        style={{ width: u, height: (fontSize ?? u * 4) - u, background: "rgba(227,217,194,0.7)" }}
      />
    </span>
  );
}

/**
 * The player's typing speed, live. Subscribed rather than read once, so
 * changing TEXT SPEED in the pause menu re-paces the line already on screen.
 */
function useCharMs(pace: number): number {
  const ms = useSyncExternalStore(subscribePrefs, textCharMs, () => 18);
  return ms <= 0 ? 0 : Math.round(ms * pace);
}
