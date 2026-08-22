import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { subscribePrefs, textCharMs } from "../core/prefs";
import { textPath, textWidth } from "../scene/pixelKit";

/**
 * PixelProse — a paragraph in the interface's own 3×5 font.
 *
 * `PixelLabel` draws one unwrappable line, which is right for a plate title
 * and useless for a sentence of dialogue. This wraps words onto as many lines
 * as `maxWidth` allows and types them out, so speech and thoughts can be set
 * in the same glyphs as the HUD instead of switching to web type the moment a
 * character opens their mouth.
 *
 * The typewriter is the SpeechText trick transplanted to SVG: nothing above
 * this re-renders per character. Each wrapped line is one `<svg>` of one
 * `<path>` inside an `overflow:hidden` div, and a rAF loop derives the letter
 * count from elapsed wall time and writes each div's WIDTH — glyphs emerge
 * from behind the clip on their own advance widths, a busy frame skips ahead
 * instead of falling behind, and React hears about none of it. The block
 * caret is one absolutely-positioned span moved the same way.
 *
 * Pace rides the player's TEXT SPEED preference exactly like SpeechText did,
 * through the same subscription, times the same per-surface ratios.
 */

/** advance width of one character, in font units, including the letter gap */
function advance(ch: string, gap: number): number {
  return textWidth(ch, gap) + gap;
}

type Line = { text: string; d: string; widthU: number; cum: number[] };

/** Greedy word wrap in font units; a word longer than the measure gets its own line. */
function wrap(text: string, maxU: number, gap: number): Line[] {
  const words = text.split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let row = "";
  for (const word of words) {
    const tryRow = row ? `${row} ${word}` : word;
    if (row && textWidth(tryRow, gap) > maxU) {
      rows.push(row);
      row = word;
    } else {
      row = tryRow;
    }
  }
  if (row) rows.push(row);
  return rows.map((t) => {
    const cum: number[] = [];
    let atU = 0;
    for (const ch of t) {
      atU += advance(ch, gap);
      cum.push(atU);
    }
    return { text: t, d: textPath(t, 0, 0, gap), widthU: Math.max(1, textWidth(t, gap)), cum };
  });
}

export function PixelProse({
  text,
  px = 2,
  fill = "#e3d9c2",
  opacity,
  maxWidth,
  gap = 1,
  /** already finished — render it whole, no animation */
  done = true,
  /** ratio against the player's TEXT SPEED; 0 disables typing regardless */
  pace = 1,
  caret = false,
  onDone,
  className,
}: {
  text: string;
  /** the size of one font pixel — the HUD's labels sit at 3; prose runs smaller */
  px?: number;
  fill?: string;
  opacity?: number;
  /** the measure, CSS px; omit for a single unwrapped line */
  maxWidth?: number;
  gap?: number;
  done?: boolean;
  pace?: number;
  /** a block caret riding the reveal — dialogue wants it, labels do not */
  caret?: boolean;
  onDone?: () => void;
  className?: string;
}) {
  const ms = useSyncExternalStore(subscribePrefs, textCharMs, () => 18);
  const charMs = pace <= 0 || ms <= 0 ? 0 : Math.round(ms * pace);
  /**
   * The measure. A number wraps to it; leaving it out wraps to the container,
   * measured once per text — which is how the dialogue panel hands its width
   * down without every caller doing rectangle arithmetic.
   */
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const [autoMax, setAutoMax] = useState<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `text` is the re-measure trigger, not a read
  useLayoutEffect(() => {
    if (maxWidth !== undefined || !rootRef.current) return;
    setAutoMax(rootRef.current.offsetWidth || null);
  }, [maxWidth, text]);
  const measure = maxWidth ?? autoMax;
  const maxU = measure ? Math.max(8, Math.floor(measure / px) - 1) : Number.POSITIVE_INFINITY;
  const ready = maxWidth !== undefined || autoMax !== null;
  const lines = useMemo(() => wrap(text, maxU, gap), [text, maxU, gap]);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const caretRef = useRef<HTMLSpanElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const lineH = 8 * px; // the glyph cell plus the accent rows, same as PixelLabel
  const total = lines.reduce((n, l) => n + l.text.length, 0);

  useEffect(() => {
    const caretEl = caretRef.current;
    const setWidths = (shown: number) => {
      let before = 0;
      for (const [i, line] of lines.entries()) {
        const el = lineRefs.current[i];
        if (!el) continue;
        const inLine = Math.max(0, Math.min(line.text.length, shown - before));
        const w = inLine >= line.text.length ? line.widthU : inLine > 0 ? line.cum[inLine - 1] : 0;
        el.style.width = `${w * px}px`;
        if (caretEl && shown < total && shown >= before && shown - before <= line.text.length) {
          caretEl.style.transform = `translate(${w * px}px, ${i * (lineH + px)}px)`;
        }
        before += line.text.length;
      }
      if (caretEl) caretEl.style.display = shown < total ? "" : "none";
    };
    if (!ready) return;
    if (done || charMs <= 0) {
      setWidths(total);
      return;
    }
    let raf = 0;
    const started = performance.now();
    let shown = -1;
    const tick = (now: number) => {
      const n = Math.min(total, Math.floor((now - started) / charMs));
      if (n !== shown) {
        shown = n;
        setWidths(n);
      }
      if (n < total) {
        raf = requestAnimationFrame(tick);
      } else {
        doneRef.current?.();
      }
    };
    setWidths(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lines, total, done, charMs, px, lineH, ready]);

  return (
    <span
      ref={rootRef}
      role="img"
      aria-label={text}
      className={`relative block ${className ?? ""}`}
      style={{ opacity, visibility: ready ? undefined : "hidden" }}
    >
      {lines.map((line, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: wrapped rows are positional; two rows can hold identical text
          key={`${i}:${line.text}`}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
          className="block overflow-hidden"
          style={{ height: lineH, marginTop: i === 0 ? 0 : px }}
        >
          <svg
            aria-hidden="true"
            width={line.widthU * px}
            height={lineH}
            viewBox={`0 -2 ${line.widthU} 8`}
            shapeRendering="crispEdges"
            style={{ display: "block", flexShrink: 0 }}
          >
            <path d={line.d} fill={fill} />
          </svg>
        </span>
      ))}
      {caret ? (
        <span
          ref={caretRef}
          aria-hidden="true"
          className="absolute top-0 left-0"
          style={{
            width: px * 3,
            height: px * 5,
            marginTop: px * 2,
            background: fill,
            opacity: 0.7,
          }}
        />
      ) : null}
    </span>
  );
}
