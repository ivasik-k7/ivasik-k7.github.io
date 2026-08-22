import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mumble, voiceFor } from "../audio/voice";
import { acquireVoice, dwellMs, type MonologueKind, releaseVoice } from "../core/monologue";
import { useAnimationGate, useReducedMotion } from "./animationGate";
import { PixelFrame } from "./PixelFrame";
import { PixelProse } from "./PixelProse";
import { PARCHMENT } from "./uiLook";

/**
 * Monologue — every short line anybody says outside a dialogue tree.
 *
 * One component for what used to be three implementations and a half: the NPC
 * ambient mutter (game/NpcMonologue), the player's inner voice
 * (game/CharacterMonologue), the station PA strip (hand-rolled in
 * trainStation), and the commented-out plans in scenes that never got built
 * because building one meant copying one of the others.
 *
 * It draws in the HUD's own language: every utterance sits on a `PixelFrame`
 * plate — the chamfered, edge-lit chrome the clock and the music deck wear —
 * with the words set in `PixelProse`, the interface's 3×5 glyph font one step
 * smaller than the HUD's labels. A speaker rides the plate's title tab the way
 * the clock names its room. The one colour this file owns is the PA's amber,
 * a departure board's colour rather than the interface's.
 *
 * What is centralized here is the BEHAVIOUR:
 *
 *   KIND decides everything a call site used to hand-tune. `ambient` floats
 *   over a head in scene space, drawls at 1.45× and takes the world floor;
 *   `thought` sits in the runtime's player slot, runs quick and quiet at
 *   0.78×, no name, no voice; `speech` is a scripted one-liner over a head —
 *   same dress as ambient, but caller-controlled and by default one priority
 *   step up, so it takes the floor off a mutterer instead of queueing behind
 *   one; `announce` and `narrate` belong to the viewport.
 *
 *   THE FLOOR lives in core/monologue.ts — one voice per channel, priority
 *   evicts — so a scripted line clears an ambient bubble on the same frame
 *   instead of waiting nine seconds for it.
 *
 *   THE CLOCK GATE: ambient cycling parks whenever the runtime's animation
 *   gate is closed (dialogue, overlay, pause, intro). The old component kept
 *   its wall-clock timers running behind the pause menu and spoke into it —
 *   the engine roadmap's "NpcMonologue has pause bugs", fixed here by reading
 *   the same gate every actor reads.
 *
 * Content comes in one of two modes:
 *
 *   `lines` — ambient: the component self-schedules, picking lines at random
 *   with an anti-repeat, waiting its turn on the channel floor.
 *
 *   `text` — controlled: the caller owns the lifetime (pass null to hide),
 *   or sets `durationMs` to have it fold itself away. `contentKey` restarts
 *   the typewriter when the same text repeats.
 *
 * `objId` and `meta` are carried, not consumed: the character reference is
 * the hook a later pass needs to make a speaker gesture through the
 * `useSpeaking` channel (today that channel is dialogue-only), and `meta` is
 * for whatever a scene wants to pin on an utterance. Neither adds a pixel.
 */

/** Everything a call site can say about one utterance. */
export interface MonologueProps {
  /** one CSS px per game px — the same scale every Effects layer receives */
  scale: number;

  /* ---- content: exactly one of `lines` (ambient) or `text` (controlled) */
  lines?: readonly string[];
  text?: string | null;
  /** restart typing when the same text is shown twice (the toast id) */
  contentKey?: string | number;
  speaker?: string;
  showSpeaker?: boolean;

  /* ---- presentation */
  kind?: MonologueKind;
  /** higher takes the channel floor; ambient defaults 0, speech defaults 1 */
  priority?: number;
  /** on-screen time for ambient lines; defaults to the shared dwell curve */
  durationMs?: number;
  /** disable bob, typewriter and entry motion — the PA strip's default */
  animate?: boolean;
  /** read the line aloud through the mumble synth; defaults per kind */
  voice?: boolean;
  /** logical px; defaults per kind (58 world / 62 thought) */
  maxWidth?: number;

  /* ---- position (world kinds) */
  /** head centre, logical px */
  x?: number;
  headY?: number;
  offsetX?: number;
  offsetY?: number;
  /** clamp the bubble into the scene, tail-safe */
  sceneWidth?: number;

  /** hold the tongue (a dialogue is open, a cutscene is running) */
  muted?: boolean;

  /* ---- reserved: carried through, not yet consumed */
  /** the scene object this voice belongs to — future useSpeaking hook-up */
  objId?: string;
  meta?: unknown;
}

/** How each voice paces against the player's TEXT SPEED — tuned ratios. */
const PACE: Record<MonologueKind, number> = {
  speech: 1,
  ambient: 1.45,
  thought: 0.78,
  announce: 1,
  narrate: 1,
};

export function Monologue(props: MonologueProps) {
  const kind = props.kind ?? (props.lines ? "ambient" : "speech");
  if (kind === "announce" || kind === "narrate") return <ScreenLine {...props} kind={kind} />;
  if (kind === "thought") return <SlotLine {...props} kind={kind} />;
  return <WorldLine {...props} kind={kind} />;
}

/* ======================================================================= *
 * shared bits
 * ======================================================================= */

/** One whole pixel of bob, never a fraction. */
function useBob(active: boolean): number {
  const [bob, setBob] = useState(0);
  useEffect(() => {
    if (!active) {
      setBob(0);
      return;
    }
    const t = window.setInterval(() => setBob((b) => (b === 0 ? -1 : 0)), 720);
    return () => window.clearInterval(t);
  }, [active]);
  return bob;
}

/**
 * The interface unit. The HUD is built at u=3 REGARDLESS of camera scale —
 * that is what makes it read as chrome rather than as part of the picture —
 * and the first cut of these plates derived u from the camera instead, which
 * on any full-screen window meant bubbles LARGER than the HUD they were meant
 * to match. Same fixed unit now, prose one step smaller than the HUD's
 * labels; only the anchor position is in world scale.
 */
const UI_U = 3;
const UI_PX = 2;

/* ======================================================================= *
 * world: a line floating over a head, in scene space
 * ======================================================================= */

function WorldLine(props: MonologueProps & { kind: "speech" | "ambient" }) {
  const {
    scale,
    kind,
    speaker = "",
    lines,
    text,
    muted = false,
    x = 0,
    headY = 78,
    /* tuned for a plate the HUD's size — the old -30/-20 was for a bubble
       twice as wide, and skewed the small one clean off its speaker */
    offsetX = -8,
    offsetY = -4,
    sceneWidth,
    showSpeaker = true,
    priority = kind === "speech" ? 1 : 0,
    durationMs,
    voice = true,
    animate = true,
  } = props;
  const running = useAnimationGate();
  const still = useReducedMotion();
  const hushed = muted || !running;

  const [line, setLine] = useState<string | null>(null);
  const [halfWidth, setHalfWidth] = useState(0);
  const lastIndex = useRef(-1);
  const token = useRef({});
  const boxRef = useRef<HTMLDivElement | null>(null);

  // ---- ambient: wait, take the floor, speak, give it back -----------------
  useEffect(() => {
    if (!lines) return;
    const me = token.current;
    if (hushed) {
      setLine(null);
      releaseVoice("world", me);
      return;
    }
    let showTimer = 0;
    let hideTimer = 0;
    let alive = true;

    const evicted = () => {
      if (!alive) return;
      window.clearTimeout(hideTimer);
      setLine(null);
      cycle(9000 + Math.random() * 8000);
    };
    const cycle = (delayMs: number) => {
      showTimer = window.setTimeout(() => {
        if (!alive) return;
        // somebody else is talking — hang back and try again shortly
        if (!acquireVoice("world", me, priority, evicted)) {
          cycle(1500 + Math.random() * 2500);
          return;
        }
        let index = Math.floor(Math.random() * lines.length);
        if (index === lastIndex.current) index = (index + 1) % lines.length;
        lastIndex.current = index;
        const said = lines[index];
        setLine(said);
        if (voice) mumble(said, voiceFor(speaker));
        hideTimer = window.setTimeout(() => {
          if (!alive) return;
          setLine(null);
          releaseVoice("world", me);
          cycle(9000 + Math.random() * 8000);
        }, durationMs ?? dwellMs(said));
      }, delayMs);
    };

    cycle(2500 + Math.random() * 4000);
    return () => {
      alive = false;
      releaseVoice("world", me);
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [lines, speaker, hushed, priority, voice, durationMs]);

  // ---- controlled: the caller owns the lifetime; we only hold the floor ---
  useEffect(() => {
    if (lines) return;
    const me = token.current;
    if (hushed || !text) {
      setLine(null);
      releaseVoice("world", me);
      return;
    }
    // a scripted line outranks a mutterer and clears it on the same frame
    if (!acquireVoice("world", me, priority, () => setLine(null))) {
      setLine(null);
      return;
    }
    setLine(text);
    if (voice && speaker) mumble(text, voiceFor(speaker));
    let hideTimer = 0;
    if (durationMs) hideTimer = window.setTimeout(() => setLine(null), durationMs);
    return () => {
      releaseVoice("world", me);
      window.clearTimeout(hideTimer);
    };
  }, [lines, text, hushed, priority, voice, durationMs, speaker]);

  const bob = useBob(Boolean(line) && animate && !still);

  // Measured once per line, not once per letter — see the forced-layout note
  // in the git history of NpcMonologue: reading offsetWidth per typed char
  // forced layout of the whole scene under it.
  useLayoutEffect(() => {
    if (!line || !boxRef.current) return;
    setHalfWidth(boxRef.current.offsetWidth / 2 / scale);
  }, [line, scale]);

  if (!line) return <AnimatePresence />;

  const u = UI_U;
  const px = UI_PX;
  const pad = 4;
  let cx = x + offsetX;
  if (sceneWidth && halfWidth > 0) {
    cx = Math.min(Math.max(cx, halfWidth + pad), sceneWidth - halfWidth - pad);
  }

  return (
    <AnimatePresence>
      <motion.div
        key={line}
        className="pointer-events-none absolute z-20"
        data-monologue={kind}
        data-obj={props.objId}
        style={{
          left: Math.round(cx * scale),
          top: Math.round((headY + offsetY) * scale) + bob * u,
          transform: "translate(-50%, -100%)",
        }}
        initial={{ opacity: 0, y: u }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -u }}
        transition={{ duration: still || !animate ? 0 : 0.16, ease: "linear" }}
      >
        {/* The HUD's own plate: chamfered edge, dark fill, the speaker on a
            title plate straddling the top the way the clock names its room.
            Rivets and scanlines stay off — at bubble size they read as noise,
            and the HUD itself drops them on its smallest chips. */}
        <div ref={boxRef}>
          <PixelFrame
            u={u}
            tone="plate"
            rivets={false}
            scan={false}
            title={showSpeaker && speaker ? speaker.toUpperCase() : undefined}
            /* the title tab straddles the top edge and reaches u*3 into the
               frame — the body pads past it or the name sits on the words */
            bodyStyle={{
              padding: `${showSpeaker && speaker ? u * 4 : u * 2}px ${u * 3}px ${u * 2}px`,
            }}
            style={{ width: "max-content", maxWidth: props.maxWidth ?? 208 }}
          >
            <PixelProse
              key={`${props.contentKey ?? ""}:${line}`}
              text={line}
              px={px}
              fill={PARCHMENT}
              opacity={0.92}
              maxWidth={(props.maxWidth ?? 208) - u * 8}
              done={still || !animate}
              pace={PACE[kind]}
              caret
            />
          </PixelFrame>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ======================================================================= *
 * slot: the player's inner voice, positioned by the runtime per frame
 * ======================================================================= */

function SlotLine(props: MonologueProps & { kind: "thought" }) {
  const { text, contentKey, animate = true } = props;
  const still = useReducedMotion();
  const bob = useBob(Boolean(text) && animate && !still);
  const u = UI_U;
  const px = UI_PX;

  return (
    <AnimatePresence>
      {text ? (
        <motion.div
          key={contentKey ?? text}
          className="pointer-events-none absolute top-0 left-0"
          data-monologue="thought"
          data-obj={props.objId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: still || !animate ? 0 : 0.16, ease: "linear" }}
        >
          <div
            style={{
              transform: "translate(-50%, -100%)",
              width: "max-content",
              marginTop: bob * u,
            }}
          >
            {/* the same plate as everyone else, unbadged and sat back a
                little — an inner voice has no nameplate and no rivets */}
            <PixelFrame
              u={u}
              tone="plate"
              rivets={false}
              scan={false}
              bodyStyle={{ padding: `${u * 2}px ${u * 3}px` }}
              style={{ width: "max-content", maxWidth: props.maxWidth ?? 224, opacity: 0.94 }}
            >
              <PixelProse
                key={`${contentKey ?? ""}:${text}`}
                text={text}
                px={px}
                fill={PARCHMENT}
                opacity={0.85}
                maxWidth={(props.maxWidth ?? 224) - u * 8}
                done={still || !animate}
                pace={PACE.thought}
                caret
              />
            </PixelFrame>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ======================================================================= *
 * screen: the viewport's own voice — the PA strip, and quiet narration
 * ======================================================================= */

/** CIP amber — a departure board's colour, not the interface's. */
const PA_AMBER = "#ffb03a";

function ScreenLine(props: MonologueProps & { kind: "announce" | "narrate" }) {
  const { scale, text, kind, muted = false } = props;
  // the PA does not type itself out — a tannoy has no cursor
  const animate = props.animate ?? kind === "narrate";
  const still = useReducedMotion();
  if (!text || muted) return null;
  const u = UI_U;
  const px = UI_PX;

  /**
   * Portalled to the body: Effects mount inside the camera transform, where
   * even `fixed` anchors to the scene. A voice that belongs to the whole
   * place — a PA, a narrator — belongs to the viewport.
   */
  return createPortal(
    <div
      className="pointer-events-none fixed right-0 left-0 z-40 flex justify-center"
      data-monologue={kind}
      data-obj={props.objId}
      style={{ top: Math.round(10 * scale) }}
    >
      {/* the same plate as the clock, hung from the top of the screen; the
          PA speaks in the departure board's amber, narration in parchment */}
      <PixelFrame
        u={2}
        tone="plate"
        rivets={false}
        bodyStyle={{ padding: `${u}px ${u * 3}px` }}
        style={{ maxWidth: "72%" }}
      >
        <PixelProse
          key={`${props.contentKey ?? ""}:${text}`}
          text={text}
          px={px}
          fill={kind === "announce" ? PA_AMBER : PARCHMENT}
          opacity={0.9}
          maxWidth={720}
          done={still || !animate}
          pace={PACE.narrate}
        />
      </PixelFrame>
    </div>,
    document.body,
  );
}
