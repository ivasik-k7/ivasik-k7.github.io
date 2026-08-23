import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/engine";
import {
  AO,
  Bev,
  bevelPaths,
  dth,
  Light,
  M,
  PixelText,
  pxPath,
  type Rect,
  SharedDefs,
  steppedEllipse,
  tiers,
  Vignette,
  vignettePaths,
} from "@/engine/scene/pixelKit";

/**
 * GUITAR — the old acoustic, close up, by lamplight.
 *
 * Chord marks drift toward the strike line; you meet them with A S D F.
 * The sfx engine already walks an Am–F–C–G loop one strum at a time, so
 * playing IN time literally plays the progression — the reward for rhythm
 * is the song assembling itself, and the punishment for rushing is the same
 * chord twice, which is also how learning guitar actually sounds.
 *
 * Volumetric rules: the neck is a wood ramp with its bevel light, frets are
 * steel, strings catch the lamp as bright runs with a shadow line under
 * each, the body throws a stepped pool of shade onto the floor, and the
 * whole close-up sits in the desk lamp's quantized glow.
 */

const W = 260;
const H = 150;
const VIGNETTE = vignettePaths(W, H);

/* the strike line and the lane the marks travel */
const LANE_Y = 34;
const STRIKE_X = 56;
/* the neck runs from the body to the headstock, front view */
const NECK: Rect = [84, 95, 144, 12];
const HEAD: Rect = [228, 92, 26, 18];
const KEYS = ["A", "S", "D", "F"] as const;
const KEY_CODES = ["KeyA", "KeyS", "KeyD", "KeyF"] as const;

/** His strum timeline, twice through, as (ms, lane) — lanes just vary the hand. */
const PATTERN: readonly (readonly [number, number])[] = [
  [1280, 0],
  [1600, 1],
  [1920, 2],
  [2240, 1],
  [2560, 0],
  [3200, 2],
  [3840, 0],
  [4160, 1],
  [4480, 2],
  [4800, 3],
  [5120, 0],
  [5440, 1],
  [5760, 2],
  [6080, 3],
  [6720, 0],
  [7040, 1],
  [7360, 2],
  [7680, 1],
  [8000, 0],
  [8640, 2],
  [9280, 0],
  [9600, 1],
  [9920, 2],
  [10240, 3],
  [10560, 0],
  [10880, 1],
  [11200, 2],
  [11520, 3],
] as const;
const SPEED = 0.055; // logical px per ms — marks cross the screen unhurried
const WINDOW_MS = 150;
const END_AT = 12400;

export function Guitar({
  onClose,
  onVerdict,
}: {
  onClose: () => void;
  onVerdict: (line: string) => void;
}) {
  const laneRef = useRef<SVGGElement | null>(null);
  const plectrumRef = useRef<SVGGElement | null>(null);
  const stringsRef = useRef<SVGGElement | null>(null);
  const noteRefs = useRef<(SVGGElement | null)[]>([]);
  const state = useRef({
    start: 0,
    hit: new Array(PATTERN.length).fill(false) as boolean[],
    gone: new Array(PATTERN.length).fill(false) as boolean[],
    hits: 0,
    strums: 0,
    done: false,
  });
  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");
  const [verdict, setVerdict] = useState("");

  /* the run loop: one transform per frame, zero React */
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const st = state.current;
    st.start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const t = now - st.start;
      if (laneRef.current) {
        laneRef.current.style.transform = `translateX(${-t * SPEED}px)`;
      }
      // marks that sailed past unhit go quiet
      PATTERN.forEach(([at], i) => {
        if (!st.gone[i] && !st.hit[i] && t > at + WINDOW_MS) {
          st.gone[i] = true;
          const el = noteRefs.current[i];
          if (el) el.style.opacity = "0.25";
        }
      });
      if (t > END_AT && !st.done) {
        st.done = true;
        playSfx("guitarEnd");
        const ratio = st.hits / PATTERN.length;
        const line =
          ratio >= 0.85
            ? "Сусіди не стукали. Це овації."
            : ratio >= 0.55
              ? "Prawie melodia. Prawie — це вже щось."
              : "The E string files a complaint. You promise to practice.";
        setVerdict(line);
        setPhase("done");
        window.setTimeout(() => {
          onVerdict(line);
          onClose();
        }, 2600);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, onClose, onVerdict]);

  /* strums */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") return;
      e.stopPropagation();
      if (phase === "intro" && (e.code === "KeyE" || e.code === "Enter" || e.code === "Space")) {
        setPhase("playing");
        return;
      }
      if (phase !== "playing") return;
      const lane = KEY_CODES.indexOf(e.code as (typeof KEY_CODES)[number]);
      if (lane < 0 || e.repeat) return;
      const st = state.current;
      const t = performance.now() - st.start;
      st.strums++;
      // the plectrum dips; the strings shiver — whatever the verdict
      const pl = plectrumRef.current;
      if (pl) {
        pl.style.transform = "translateY(4px)";
        window.setTimeout(() => {
          if (pl) pl.style.transform = "translateY(0)";
        }, 90);
      }
      const strs = stringsRef.current;
      if (strs) {
        strs.style.transform = "translateY(1px)";
        window.setTimeout(() => {
          if (strs) strs.style.transform = "translateY(0)";
        }, 70);
      }
      // the nearest unhit mark in the right lane, inside the window
      let best = -1;
      let bestD = WINDOW_MS + 1;
      PATTERN.forEach(([at, ln], i) => {
        if (ln !== lane || st.hit[i] || st.gone[i]) return;
        const d = Math.abs(t - at);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best >= 0) {
        st.hit[best] = true;
        st.hits++;
        playSfx("guitar"); // the loop advances: rhythm assembles the song
        const el = noteRefs.current[best];
        if (el) el.style.opacity = "0";
      } else {
        playSfx("thud"); // a chastened thunk
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase]);

  const lamp = tiers(
    (s) => steppedEllipse(130, 60, Math.round(95 * s), Math.round(52 * s), 4),
    "w",
    0.9,
  );

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85">
      <div className="relative w-full max-w-3xl px-[6%]">
        <svg
          aria-hidden="true"
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          shapeRendering="crispEdges"
          style={{ imageRendering: "pixelated" }}
        >
          <SharedDefs />
          {/* the room: wall above, plank floor below, the lamp pooled on both */}
          <rect width={W} height={116} fill="#14110d" />
          <rect x={0} y={116} width={W} height={2} fill="#0a0806" />
          <rect x={0} y={118} width={W} height={H - 118} fill="#0d0a08" />
          {[52, 118, 186].map((px) => (
            <rect key={px} x={px} y={118} width={1} height={H - 118} fill="#080604" opacity={0.6} />
          ))}
          <rect width={W} height={H} fill={dth("n", "25")} />
          <Light set={lamp} op={0.9} />

          {/* the lane: chord marks drifting toward the strike line */}
          <rect x={0} y={LANE_Y - 12} width={W} height={26} fill="#0c0b09" opacity={0.6} />
          {/* strike line: a worn brass fret standing upright */}
          <rect x={STRIKE_X - 1} y={LANE_Y - 12} width={3} height={26} fill={M.brass.base} />
          <rect x={STRIKE_X - 1} y={LANE_Y - 12} width={1} height={26} fill={M.brass.hi} />
          <g style={{ overflow: "hidden" }}>
            <g ref={laneRef}>
              {PATTERN.map(([at, lane], i) => (
                <g
                  key={`${at}`}
                  ref={(el) => {
                    noteRefs.current[i] = el;
                  }}
                  transform={`translate(${STRIKE_X + at * SPEED} ${LANE_Y - 8 + lane * 4})`}
                >
                  {/* a plectrum-shaped mark, keyed by lane letter */}
                  <path
                    d={pxPath([
                      [0, 0, 6, 3],
                      [1, 3, 4, 2],
                      [2, 5, 2, 1],
                    ])}
                    fill={M.enamel.base}
                  />
                  <path d={pxPath([[0, 0, 6, 1]])} fill={M.enamel.hi} />
                  <PixelText x={8} y={0} text={KEYS[lane]} fill={M.linen.base} />
                </g>
              ))}
            </g>
          </g>

          {/* the instrument's stepped shadow, thrown right-down onto the floor */}
          <path
            d={pxPath([
              [14, 124, 54, 4],
              [24, 128, 50, 3],
              [88, 110, 138, 3],
              [92, 113, 132, 2],
            ])}
            fill="#070503"
            opacity={0.55}
          />

          {/* the body: two bouts of old spruce, lamp-lit from above */}
          <path d={pxPath(steppedEllipse(34, 100, 27, 24, 3))} fill={M.wood.base} />
          <path d={pxPath(steppedEllipse(66, 98, 17, 17, 3))} fill={M.wood.base} />
          {/* top rim catches the lamp; the under-curve falls to deep */}
          <path
            d={pxPath([
              [16, 77, 30, 2],
              [54, 82, 22, 2],
            ])}
            fill={M.wood.hi}
          />
          <path
            d={pxPath([
              [14, 118, 34, 3],
              [50, 110, 24, 3],
            ])}
            fill={M.wood.deep}
            opacity={0.8}
          />
          {/* rosette ring, then the soundhole carved dark inside it */}
          <path d={pxPath(steppedEllipse(74, 100, 10, 10, 2))} fill={M.brass.lo} opacity={0.7} />
          <path d={pxPath(steppedEllipse(74, 100, 8, 8, 2))} fill="#0c0906" />
          {/* bridge with its bone saddle */}
          <rect x={16} y={95} width={14} height={7} fill={M.wood.deep} />
          <rect x={17} y={95} width={12} height={1} fill={M.wood.lo} />
          <rect x={18} y={97} width={2} height={4} fill={M.linen.base} />

          {/* neck: wood ramp, bevel edge-light, steel frets, dot inlays */}
          <rect x={NECK[0]} y={NECK[1]} width={NECK[2]} height={NECK[3]} fill={M.wood.mid} />
          <Bev set={bevelPaths([NECK])} mat={M.wood} />
          <rect
            x={NECK[0]}
            y={NECK[1] + NECK[3] - 2}
            width={NECK[2]}
            height={2}
            fill={M.wood.deep}
          />
          {/* nut */}
          <rect
            x={NECK[0] + NECK[2] - 2}
            y={NECK[1]}
            width={2}
            height={NECK[3]}
            fill={M.linen.base}
          />
          {/* frets crowd toward the body, the way real ones do */}
          {[18, 34, 48, 61, 73, 84, 94, 103, 111, 118, 124, 130].map((off) => (
            <g key={off}>
              <rect
                x={NECK[0] + NECK[2] - 2 - off}
                y={NECK[1] + 1}
                width={2}
                height={NECK[3] - 2}
                fill={M.steel.base}
              />
              <rect
                x={NECK[0] + NECK[2] - 2 - off}
                y={NECK[1] + 1}
                width={1}
                height={NECK[3] - 2}
                fill={M.steel.hi}
              />
            </g>
          ))}
          <rect
            x={NECK[0] + NECK[2] - 2 - 55}
            y={NECK[1] + 5}
            width={2}
            height={2}
            fill={M.linen.base}
          />
          <rect
            x={NECK[0] + NECK[2] - 2 - 79}
            y={NECK[1] + 5}
            width={2}
            height={2}
            fill={M.linen.base}
          />

          {/* headstock with its brass tuners, three up, three down */}
          <path
            d={pxPath([
              [HEAD[0], HEAD[1], HEAD[2], HEAD[3]],
              [HEAD[0] + HEAD[2] - 4, HEAD[1] - 2, 4, HEAD[3] + 4],
            ])}
            fill={M.wood.lo}
          />
          <rect x={HEAD[0]} y={HEAD[1]} width={HEAD[2]} height={1} fill={M.wood.base} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect
                x={HEAD[0] + 4 + i * 7}
                y={HEAD[1] - 3}
                width={3}
                height={3}
                fill={M.brass.base}
              />
              <rect
                x={HEAD[0] + 4 + i * 7}
                y={HEAD[1] - 3}
                width={3}
                height={1}
                fill={M.brass.hi}
              />
              <rect
                x={HEAD[0] + 4 + i * 7}
                y={HEAD[1] + HEAD[3]}
                width={3}
                height={3}
                fill={M.brass.base}
              />
              <rect
                x={HEAD[0] + 4 + i * 7}
                y={HEAD[1] + HEAD[3] + 2}
                width={3}
                height={1}
                fill={M.brass.lo}
              />
            </g>
          ))}

          {/* strings: bridge to nut, bright over the lamp with a shadow line each */}
          <g ref={stringsRef} style={{ transition: "transform 50ms steps(2, end)" }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <g key={i}>
                <rect
                  x={20}
                  y={96 + i * 2}
                  width={NECK[0] + NECK[2] - 20}
                  height={1}
                  fill={i < 3 ? "#d8d3c5" : "#b0a890"}
                  opacity={0.9}
                />
                <rect
                  x={20}
                  y={97 + i * 2}
                  width={NECK[0] + NECK[2] - 20}
                  height={1}
                  fill="#0a0806"
                  opacity={0.3}
                />
              </g>
            ))}
          </g>
          <AO x={20} y={124} w={200} op={0.5} />

          {/* the plectrum, hovering over the soundhole, dipping on each strum */}
          <g ref={plectrumRef} style={{ transition: "transform 60ms steps(2, end)" }}>
            <path
              d={pxPath([
                [70, 82, 8, 4],
                [71, 86, 6, 2],
                [72, 88, 4, 2],
              ])}
              fill={M.red.base}
            />
            <path d={pxPath([[70, 82, 8, 1]])} fill={M.red.hi} />
          </g>

          {/* intro / verdict text on the lamp pool */}
          {phase === "intro" ? (
            <g>
              <PixelText x={92} y={50} text="A S D F - AKORDY" fill={M.linen.base} />
              <PixelText x={92} y={60} text="TRAF W ZNAK NAD PROGIEM" fill={M.linen.lo} />
              <PixelText x={92} y={72} text="[E] GRAJ" fill={M.enamel.base} />
            </g>
          ) : null}
          {phase === "done" ? <PixelText x={122} y={62} text="..." fill={M.linen.base} /> : null}

          <Vignette set={VIGNETTE} />
        </svg>
        <p className="mt-3 text-center font-mono text-[11px] text-parchment/50">
          {phase === "done" ? verdict : "a s d f struny · esc відкласти гітару"}
        </p>
      </div>
    </div>
  );
}
