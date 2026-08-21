import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { mumble, SpeechPanel, SpeechText, voiceFor } from "@/engine";

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
  const [bob, setBob] = useState(0);
  const [halfWidth, setHalfWidth] = useState(0);
  const lastIndex = useRef(-1);
  const token = useRef({});
  const boxRef = useRef<HTMLDivElement | null>(null);
  const still = useReducedMotion();

  // ---- the cycle: wait, take the floor, speak, give it back ----------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart the cycle when reduced motion changes, though the body no longer reads it
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

  // The typewriter lives in `SpeechText` now. It used to chain a `setTimeout`
  // per character, which loses time whenever the main thread is busy — walking
  // made the text visibly crawl, because every dropped timer was a dropped
  // letter. The replacement derives the letter count from elapsed wall time on
  // an animation frame, so a busy frame skips ahead instead of falling behind.

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
  // Measured once per line, not once per letter. Keyed on `shown` this read
  // `offsetWidth` — a forced synchronous layout — for every character typed,
  // which in the district cost 853 ms over twenty idle seconds because the
  // layout it forced was of a nine-thousand-node scene. The bubble is sized by
  // its longest line, so measuring the finished text is also the correct answer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the bubble reappears
  useLayoutEffect(() => {
    if (!line || !boxRef.current) return;
    setHalfWidth(boxRef.current.offsetWidth / 2 / scale);
  }, [line, scale]);

  if (!line) return <AnimatePresence />;

  // one game pixel, in CSS px
  const u = Math.max(1, Math.round(scale));
  const font = Math.max(9, Math.round(3 * scale));
  const lead = font + u * 2;

  // no smoothing, no ligatures, no hinting games — let it alias

  // a two-step staircase at every corner, cut in whole pixels

  // shifted off the head, then clamped into the scene; the trail stays over it
  const pad = 4;
  let cx = x + offsetX;
  if (sceneWidth && halfWidth > 0) {
    cx = Math.min(Math.max(cx, halfWidth + pad), sceneWidth - halfWidth - pad);
  }
  /** how far the bubble floats above the head, in game px */

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
        {/* The title screen's language: the speaker's name in the pixel font
            with a rule off it, the line in mono under that, and a scrim dark
            enough to read against. No plate. A bubble drawn out of the HUD's
            riveted frame was consistent with the clock and still lost the words
            to the decoration around them. */}
        <div ref={boxRef}>
          <SpeechPanel
            u={u}
            tone="say"
            bare
            maxWidth={Math.round(58 * scale)}
            title={showSpeaker ? speaker.toUpperCase() : undefined}
          >
            <SpeechText
              key={line}
              text={line}
              done={still}
              u={u}
              pace={1.45}
              fontSize={font}
              lineHeight={lead}
            />
          </SpeechPanel>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
