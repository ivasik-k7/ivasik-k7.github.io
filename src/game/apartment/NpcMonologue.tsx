import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { mumble, voiceFor } from "@/engine";

/**
 * Ambient monologue: an NPC mutters to nobody in particular.
 *
 * Redrawn to sit inside the game's own visual language rather than beside it:
 *
 *   Everything is measured in game pixels. `scale` is one pixel, and every
 *   dimension — border, chamfer, padding, tail, bob, type size — is an integer
 *   multiple of it, rounded before it reaches the DOM. Nothing lands on a
 *   half-pixel, so the bubble stays as crisp as the scene behind it.
 *
 *   Chamfered corners, one pixel deep, cut with clip-path so they hold at any
 *   content size. Same chrome as the HUD otherwise: parchment border, near-black
 *   fill, a one-pixel lit edge along the top and a hard shadow one pixel below.
 *
 *   The speaker is finally visible. It was only ever used to pick a voice; now
 *   it rides the top border as a nameplate in `signal`, the way the rest of the
 *   interface labels things.
 *
 *   The line types itself, a character at a time, with a block cursor — a
 *   pixel-game convention and it makes the mumble underneath read as speech
 *   rather than a sound effect. A ▾ marker pulses once it finishes.
 *
 *   One voice at a time. A module-level lock means five NPCs in one shop take
 *   turns instead of stacking five bubbles over each other; whoever is late
 *   simply waits and tries again.
 *
 *   Bobs one whole pixel, never a fraction. Honours prefers-reduced-motion by
 *   skipping the bob, the typing and the cursor entirely.
 */

// ---------------------------------------------------------------------------
// one voice at a time, across every mounted instance
// ---------------------------------------------------------------------------

let holder: object | null = null;

function acquire(token: object) {
  if (holder && holder !== token) return false;
  holder = token;
  return true;
}

function release(token: object) {
  if (holder === token) holder = null;
}

// ---------------------------------------------------------------------------

function useReducedMotion() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setStill(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return still;
}

export function NpcMonologue({
  x,
  headY = 78,
  scale,
  speaker,
  lines,
  muted = false,
  sceneWidth,
  showSpeaker = true,
  offsetX = -30,
  offsetY = -20,
}: {
  /** NPC head center, logical px. */
  x: number;
  headY?: number;
  scale: number;
  speaker: string;
  lines: readonly string[];
  /** While true (dialogue open), the NPC keeps their thoughts to themselves. */
  muted?: boolean;
  /** Pass the scene width and the bubble will stay inside it, tail and all. */
  sceneWidth?: number;
  showSpeaker?: boolean;
  /** Game px the bubble sits left of the head. Negative is left. */
  offsetX?: number;
  /** Game px the bubble sits above the head. Negative is up. */
  offsetY?: number;
}) {
  const [line, setLine] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const [bob, setBob] = useState(0);
  const [halfWidth, setHalfWidth] = useState(0);
  const lastIndex = useRef(-1);
  const token = useRef({});
  const boxRef = useRef<HTMLDivElement | null>(null);
  const still = useReducedMotion();

  // ---- the cycle: wait, take the floor, speak, give it back ----------------
  useEffect(() => {
    if (muted) {
      setLine(null);
      release(token.current);
      return;
    }
    const me = token.current;
    let showTimer = 0;
    let hideTimer = 0;
    let alive = true;

    const cycle = (delayMs: number) => {
      showTimer = window.setTimeout(() => {
        if (!alive) return;
        // somebody else is talking — hang back and try again shortly
        if (!acquire(me)) {
          cycle(1500 + Math.random() * 2500);
          return;
        }
        let index = Math.floor(Math.random() * lines.length);
        if (index === lastIndex.current) index = (index + 1) % lines.length;
        lastIndex.current = index;
        const text = lines[index];
        setLine(text);
        setShown(still ? text.length : 0);
        mumble(text, voiceFor(speaker));
        // long lines get longer on screen; short ones don't linger
        const dwell = 1800 + text.length * 48;
        hideTimer = window.setTimeout(() => {
          if (!alive) return;
          setLine(null);
          release(me);
          cycle(9000 + Math.random() * 8000);
        }, dwell);
      }, delayMs);
    };

    cycle(2500 + Math.random() * 4000);
    return () => {
      alive = false;
      release(me);
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [lines, speaker, muted, still]);

  // ---- the typewriter ------------------------------------------------------
  useEffect(() => {
    if (!line || still) return;
    if (shown >= line.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), 26);
    return () => window.clearTimeout(t);
  }, [line, shown, still]);

  // ---- one whole pixel of bob, never a fraction ---------------------------
  useEffect(() => {
    if (!line || still) {
      setBob(0);
      return;
    }
    const t = window.setInterval(() => setBob((b) => (b === 0 ? -1 : 0)), 720);
    return () => window.clearInterval(t);
  }, [line, still]);

  // ---- measure, so the bubble can stay inside the scene -------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the bubble reappears
  useLayoutEffect(() => {
    if (!line || !boxRef.current) return;
    setHalfWidth(boxRef.current.offsetWidth / 2 / scale);
  }, [line, shown, scale]);

  if (!line) return <AnimatePresence />;

  // one game pixel, in CSS px
  const u = Math.max(1, Math.round(scale));
  const font = Math.max(9, Math.round(3 * scale));
  const nameFont = Math.max(7, Math.round(2.25 * scale));
  const lead = font + u * 2;

  // no smoothing, no ligatures, no hinting games — let it alias
  const crisp = {
    WebkitFontSmoothing: "none",
    MozOsxFontSmoothing: "unset",
    textRendering: "optimizeSpeed",
    fontVariantLigatures: "none",
  } as React.CSSProperties;

  // a two-step staircase at every corner, cut in whole pixels
  const chamfer = [
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
  ].join(", ");
  const clip = `polygon(${chamfer})`;
  // one-pixel scanlines across the fill, the same trick the scenes use
  const scan = `repeating-linear-gradient(180deg, rgba(232,230,224,0.055) 0px, rgba(232,230,224,0.055) ${u}px, rgba(0,0,0,0) ${u}px, rgba(0,0,0,0) ${u * 2}px)`;

  // shifted off the head, then clamped into the scene; the trail stays over it
  const pad = 4;
  let cx = x + offsetX;
  if (sceneWidth && halfWidth > 0) {
    cx = Math.min(Math.max(cx, halfWidth + pad), sceneWidth - halfWidth - pad);
  }
  const tailOffset = Math.round((x - cx) * scale);
  /** how far the bubble floats above the head, in game px */
  const gap = Math.max(3, -offsetY);

  const typing = shown < line.length;

  return (
    <AnimatePresence>
      <motion.div
        key={line}
        className="pointer-events-none absolute z-20"
        style={{
          left: Math.round(cx * scale),
          top: Math.round((headY + offsetY) * scale) + bob * u,
          transform: "translate(-50%, -100%)",
          filter: `drop-shadow(0 ${u}px 0 rgba(0,0,0,0.55))`,
        }}
        initial={{ opacity: 0, y: u }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -u }}
        transition={{ duration: still ? 0 : 0.16, ease: "linear" }}
      >
        {/* the frame: border layer, chamfered, with the fill inset one pixel */}
        <div
          ref={boxRef}
          style={{
            clipPath: clip,
            background: "rgba(232,230,224,0.32)",
            padding: u,
            maxWidth: Math.round(52 * scale),
          }}
        >
          <div
            className="text-center font-mono text-parchment/90"
            style={{
              ...crisp,
              clipPath: clip,
              backgroundColor: "rgba(11,14,20,0.92)",
              backgroundImage: scan,
              boxShadow: `inset 0 ${u}px 0 rgba(232,230,224,0.10)`,
              padding: `${u}px ${u * 2}px`,
              fontSize: font,
              lineHeight: `${lead}px`,
              letterSpacing: 0,
            }}
          >
            {still ? line : line.slice(0, shown)}
            {typing ? (
              <span
                aria-hidden="true"
                className="ml-px inline-block align-baseline bg-parchment/85"
                style={{ width: u, height: font - u }}
              />
            ) : (
              <span
                aria-hidden="true"
                className="ml-1 inline-block align-baseline"
                style={{ width: u * 3, height: u * 2 }}
              >
                <span className="block bg-signal/70" style={{ width: u * 3, height: u }} />
                <span
                  className="block bg-signal/70"
                  style={{ width: u, height: u, marginLeft: u }}
                />
              </span>
            )}
          </div>
        </div>

        {/* the nameplate, riding the top border */}
        {showSpeaker ? (
          <div
            className="absolute whitespace-nowrap font-mono text-signal/85 uppercase"
            style={{
              ...crisp,
              left: u * 3,
              top: -(nameFont + u * 3),
              clipPath: clip,
              backgroundColor: "rgba(11,14,20,0.94)",
              border: `${u}px solid rgba(232,230,224,0.28)`,
              padding: `${u}px ${u * 2}px`,
              fontSize: nameFont,
              lineHeight: `${nameFont}px`,
              letterSpacing: "0.16em",
            }}
          >
            {speaker}
          </div>
        ) : null}

        {/* the tail: three pixel steps down, then a thought trail leaning back
            toward the head it came out of — it is a mutter, not a shout */}
        <div
          className="absolute"
          style={{
            left: "50%",
            bottom: -gap * u,
            height: gap * u,
            transform: `translateX(${tailOffset - u * 2.5}px)`,
          }}
        >
          {/* the outline steps */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: u * 5,
              height: u,
              background: "rgba(232,230,224,0.32)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: u,
              top: u,
              width: u * 3,
              height: u,
              background: "rgba(232,230,224,0.32)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: u * 2,
              top: u * 2,
              width: u,
              height: u,
              background: "rgba(232,230,224,0.32)",
            }}
          />
          {/* the fill, so the outline reads continuously into the bubble */}
          <div
            style={{
              position: "absolute",
              left: u,
              top: 0,
              width: u * 3,
              height: u,
              background: "rgba(11,14,20,0.92)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: u * 2,
              top: u,
              width: u,
              height: u,
              background: "rgba(11,14,20,0.92)",
            }}
          />
          {/* and the dots closing the rest of the distance */}
          {Array.from({ length: Math.max(0, Math.floor((gap - 3) / 2)) }, (_, i) => {
            const step = 3 + i * 2;
            if (step >= gap) return null;
            return (
              <div
                key={`tr${step}`}
                style={{
                  position: "absolute",
                  left: u * 2 + Math.round((i + 1) * 0.6 * u),
                  top: step * u,
                  width: u,
                  height: u,
                  background: "rgba(232,230,224,0.28)",
                  opacity: 1 - i * 0.22,
                }}
              />
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
