import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { subscribePrefs, textCharMs } from "../core/prefs";
import { type FrameTone, PixelFrame } from "./PixelFrame";

/**
 * SpeechPanel — the surface every word a character says is written on.
 *
 * It is a `PixelFrame`. Not something that resembles one: the same riveted,
 * chamfered plate the clock, the pocket, the music deck and the interact chip
 * are built from, with the speaker's name in the title plate that straddles
 * the top edge exactly as "MUSIC" or "THE YARD" does.
 *
 * That is the whole point. A monologue and a conversation are the game
 * talking to you, and they were the two surfaces that did not look like the
 * game — the dialogue box was a plain rectangle with a hairline CSS border and
 * the bubbles hand-rolled a plate of their own. Anything the player reads now
 * comes out of the same box as everything else on the HUD.
 *
 * The one thing that is not pixel type is the prose. `PixelLabel` draws the
 * 3×5 glyph font as a single unwrappable SVG line, which is right for
 * "SANDWICH BOARD" and impossible for a paragraph of Polish, so the body text
 * is mono set on the HUD's parchment. Every label around it — speaker, badge,
 * counts — is the real thing.
 */

export type SpeechTone = "say" | "think" | "narrate";

/**
 * Spoken aloud gets the solid panel; an inner voice sits back on the inset
 * tone; narration is not a person talking at all and takes the flattest plate.
 */
const FRAME: Record<SpeechTone, FrameTone> = {
  say: "panel",
  think: "inset",
  narrate: "plate",
};

/**
 * The tail's colour. Deliberately not the frame's own edge alpha — a tail is
 * three loose pixels with no fill behind them, so at the inset tone's 0.14 it
 * simply disappeared and the bubble floated unattached to anybody.
 */
const TAIL: Record<SpeechTone, string> = {
  say: "rgba(227,217,194,0.34)",
  think: "rgba(227,217,194,0.30)",
  narrate: "rgba(227,217,194,0.26)",
};

export function SpeechPanel({
  u = 3,
  tone = "say",
  title,
  badge,
  maxWidth,
  align = "center",
  rivets = true,
  className,
  style,
  children,
}: {
  u?: number;
  tone?: SpeechTone;
  /** the speaker, set in the pixel font on the plate over the top edge */
  title?: ReactNode;
  badge?: ReactNode;
  maxWidth?: number;
  align?: "left" | "center";
  rivets?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <div style={{ maxWidth, ...style }}>
      <PixelFrame u={u} tone={FRAME[tone]} title={title} badge={badge} rivets={rivets}>
        <span
          className={className}
          style={{ display: "block", padding: `${u * 2}px ${u * 2}px ${u}px`, textAlign: align }}
        >
          {children}
        </span>
      </PixelFrame>
    </div>
  );
}

/**
 * The tail: three stepped pixels narrowing toward whoever is speaking, in the
 * frame's own edge colour so it reads as part of the same plate. Drawn rather
 * than rotated, because a rotated square stops being pixel art.
 */
export function SpeechTail({ u = 3, tone = "say" }: { u?: number; tone?: SpeechTone }) {
  return (
    <div className="relative" style={{ height: u * 3, marginLeft: "50%", width: u * 5 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: -u * (2.5 - i),
            top: u * i,
            width: u * (5 - i * 2),
            height: u,
            background: TAIL[tone],
          }}
        />
      ))}
    </div>
  );
}

/**
 * Typed-out prose with a block cursor.
 *
 * The text is written straight into a DOM node on an animation frame rather
 * than through React state. The old dialogue box called `setState` once per
 * character at 18 ms — around fifty-five renders a second, of a tree sitting
 * on top of a running game, to animate a string. Nothing above this needs to
 * know how far the sentence has got.
 */
/**
 * The player's typing speed, live. Subscribed rather than read once, so
 * changing TEXT SPEED in the pause menu re-paces the line already on screen.
 */
function useCharMs(pace: number): number {
  const ms = useSyncExternalStore(subscribePrefs, textCharMs, () => 18);
  return ms <= 0 ? 0 : Math.round(ms * pace);
}

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
   * voice runs at 0.78, because they were tuned against each other that way
   * and a single speed for all three read wrong. The absolute numbers are the
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

  return (
    <span
      className={className}
      style={{ fontSize, lineHeight: lineHeight ? `${lineHeight}px` : undefined }}
    >
      <span ref={textRef} />
      <span
        ref={caretRef}
        aria-hidden="true"
        className="ml-px inline-block align-baseline bg-parchment/85"
        style={{ width: u, height: (fontSize ?? u * 4) - u }}
      />
    </span>
  );
}
