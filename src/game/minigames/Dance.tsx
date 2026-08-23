import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/engine";
import {
  Bev,
  bevelPaths,
  dth,
  M,
  PixelText,
  pxPath,
  type Rect,
  SharedDefs,
  steppedEllipse,
  Vignette,
  vignettePaths,
} from "@/engine/scene/pixelKit";

/**
 * DANCE — the Turbina floor at 126 bpm.
 *
 * No note highway. You follow the floor: half a beat before each kick a cue
 * lights one side, on the kick the whole crowd leans that way, and you take
 * the step with A or D inside the window. Watching people instead of UI is
 * the entire skill — which is also how you actually learn to dance in a
 * club, and why the count-in beats are free.
 *
 * Volumetric rules: the turbine hall is concrete with bevel edge-light, the
 * beams are quantized light tiers that trade sides with the beat, the crowd
 * is three depths of silhouette rim-lit from above, hits fire a one-frame
 * strobe, and the whole floor sits under the vignette like everything else.
 */

const W = 280;
const H = 160;
const VIGNETTE = vignettePaths(W, H);

const BPM = 126;
const BEAT = 60000 / BPM;
const COUNT_IN = 4;
/** authored 32-step side sequence: mostly alternating, with honest doubles */
const STEPS = "LRLRLLRLRLRRLRLRLLRRLRLRLRLLRLRR".split("").map((c) => (c === "L" ? 0 : 1));
const WINDOW_MS = 170;
const PILLAR_L: Rect = [6, 18, 18, 118];
const PILLAR_R: Rect = [256, 18, 18, 118];

export function Dance({
  onClose,
  onVerdict,
}: {
  onClose: () => void;
  onVerdict: (line: string) => void;
}) {
  const crowdBackRef = useRef<SVGGElement | null>(null);
  const crowdMidRef = useRef<SVGGElement | null>(null);
  const dancerRef = useRef<SVGGElement | null>(null);
  const strobeRef = useRef<SVGRectElement | null>(null);
  const beamLRef = useRef<SVGGElement | null>(null);
  const beamRRef = useRef<SVGGElement | null>(null);
  const cueLRef = useRef<SVGGElement | null>(null);
  const cueRRef = useRef<SVGGElement | null>(null);
  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");
  const [verdict, setVerdict] = useState("");
  const state = useRef({
    start: 0,
    lastBeat: -1,
    lastHalf: -1,
    hit: new Array(STEPS.length).fill(false) as boolean[],
    missed: new Array(STEPS.length).fill(false) as boolean[],
    hits: 0,
    done: false,
  });

  /* the loop: kicks, hats, leans, cues — all off one clock, no React */
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const st = state.current;
    st.start = performance.now();
    const lean = (el: SVGGElement | null, side: number, px: number) => {
      if (el) el.style.transform = `translate(${side === 0 ? -px : px}px, ${px > 2 ? 1 : 0}px)`;
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const t = now - st.start;
      const beat = Math.floor(t / BEAT);
      const half = Math.floor((t - BEAT / 2) / BEAT);

      /* half-beat early: the cue side lights, like a DJ pre-listening */
      if (half !== st.lastHalf && half >= COUNT_IN - 1 && half - COUNT_IN + 1 < STEPS.length) {
        st.lastHalf = half;
        const side = STEPS[half - COUNT_IN + 1];
        if (cueLRef.current) cueLRef.current.style.opacity = side === 0 ? "1" : "0";
        if (cueRRef.current) cueRRef.current.style.opacity = side === 1 ? "1" : "0";
      }

      if (beat !== st.lastBeat) {
        st.lastBeat = beat;
        playSfx("kick");
        if (beat % 2 === 1) playSfx("hat");
        /* beams trade sides with the beat parity */
        if (beamLRef.current) beamLRef.current.style.opacity = beat % 2 ? "0.35" : "0.8";
        if (beamRRef.current) beamRRef.current.style.opacity = beat % 2 ? "0.8" : "0.35";
        const idx = beat - COUNT_IN;
        if (idx >= 0 && idx < STEPS.length) {
          /* the crowd takes the step — back row lazier than the mid row */
          lean(crowdMidRef.current, STEPS[idx], 3);
          lean(crowdBackRef.current, STEPS[idx], 2);
        } else {
          /* count-in: the crowd just bobs in place */
          if (crowdMidRef.current)
            crowdMidRef.current.style.transform = `translateY(${beat % 2}px)`;
          if (crowdBackRef.current)
            crowdBackRef.current.style.transform = `translateY(${(beat + 1) % 2}px)`;
        }
        if (idx >= STEPS.length + 1 && !st.done) {
          st.done = true;
          const ratio = st.hits / STEPS.length;
          const line =
            ratio >= 0.8
              ? "Бармен кивнув. У Турбіні це орден."
              : ratio >= 0.5
                ? "Tańczysz jak spawacz. To komplement."
                : "The floor forgives. The bouncer saw nothing.";
          setVerdict(line);
          setPhase("done");
          window.setTimeout(() => {
            onVerdict(line);
            onClose();
          }, 2600);
        }
      }

      /* misses: a step whose window has closed unclaimed drops the dancer */
      STEPS.forEach((_, i) => {
        const at = (i + COUNT_IN) * BEAT;
        if (!st.hit[i] && !st.missed[i] && t > at + WINDOW_MS) {
          st.missed[i] = true;
          const d = dancerRef.current;
          if (d) {
            d.style.transform = "translateY(2px)";
            window.setTimeout(() => {
              if (d) d.style.transform = "translateY(0)";
            }, 140);
          }
        }
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, onClose, onVerdict]);

  /* steps */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") return;
      e.stopPropagation();
      if (phase === "intro" && (e.code === "KeyE" || e.code === "Enter" || e.code === "Space")) {
        setPhase("playing");
        return;
      }
      if (phase !== "playing" || e.repeat) return;
      const side =
        e.code === "KeyA" || e.code === "ArrowLeft"
          ? 0
          : e.code === "KeyD" || e.code === "ArrowRight"
            ? 1
            : -1;
      if (side < 0) return;
      const st = state.current;
      const t = performance.now() - st.start;
      /* the nearest unclaimed step of that side inside the window */
      let best = -1;
      let bestD = WINDOW_MS + 1;
      STEPS.forEach((s, i) => {
        if (s !== side || st.hit[i] || st.missed[i]) return;
        const d = Math.abs(t - (i + COUNT_IN) * BEAT);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      const dancer = dancerRef.current;
      if (dancer) {
        dancer.style.transform = `translateX(${side === 0 ? -3 : 3}px)`;
        window.setTimeout(() => {
          if (dancer) dancer.style.transform = "translateX(0)";
        }, 150);
      }
      if (best >= 0) {
        st.hit[best] = true;
        st.hits++;
        const strobe = strobeRef.current;
        if (strobe) {
          strobe.style.opacity = "0.14";
          window.setTimeout(() => {
            if (strobe) strobe.style.opacity = "0";
          }, 60);
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase]);

  /* quantized floor pools in the beams' own colors — tiers() has no magenta */
  const pool = (cx: number, ink: string) =>
    [1, 0.72, 0.45].map((f, i) => (
      <path
        key={f}
        d={pxPath(steppedEllipse(cx, 118, Math.round(58 * f), Math.round(24 * f), 3))}
        fill={ink}
        opacity={0.07 + i * 0.04}
      />
    ));

  /* one crowd silhouette: head, shoulders, torso — depth picks the ink */
  const figure = (x: number, y: number, h: number, ink: string, rim?: string) => (
    <g key={`${x}:${y}`}>
      <path
        d={pxPath([
          [x + 2, y, 5, 4],
          [x, y + 4, 9, 3],
          [x - 1, y + 7, 11, h - 7],
        ])}
        fill={ink}
      />
      {rim ? <path d={pxPath([[x + 2, y, 5, 1]])} fill={rim} opacity={0.5} /> : null}
    </g>
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
          {/* the hall: dark concrete, the old arched window grid high up */}
          <rect width={W} height={H} fill="#0b0a10" />
          <path
            d={pxPath([
              [40, 8, 200, 3],
              [40, 8, 3, 30],
              [237, 8, 3, 30],
              [88, 8, 3, 30],
              [137, 8, 3, 30],
              [186, 8, 3, 30],
              [40, 24, 200, 2],
            ])}
            fill="#15141c"
          />
          {/* cable tray across the top, hung on its drops */}
          <rect x={30} y={2} width={220} height={4} fill={M.steel.lo} />
          <rect x={30} y={2} width={220} height={1} fill={M.steel.base} />
          {[60, 140, 220].map((x) => (
            <rect key={x} x={x} y={0} width={2} height={4} fill={M.steel.lo} />
          ))}
          {/* the mirror ball, hung dead center, throwing its quantized flecks */}
          <rect x={139} y={6} width={2} height={5} fill={M.steel.deep} />
          <path d={pxPath(steppedEllipse(140, 16, 6, 6, 2))} fill={M.steel.lo} />
          <path
            d={pxPath([
              [137, 11, 3, 2],
              [142, 13, 2, 2],
              [136, 16, 2, 2],
              [141, 17, 3, 2],
            ])}
            fill={M.steel.hi}
          />
          <path d={pxPath([[138, 20, 4, 2]])} fill={M.steel.deep} />
          {[
            [92, 40],
            [118, 30],
            [168, 34],
            [196, 44],
            [130, 52],
            [154, 58],
          ].map(([fx, fy], i) => (
            <rect
              key={`${fx}:${fy}`}
              x={fx}
              y={fy}
              width={2}
              height={2}
              fill={i % 2 ? "#3fa7b8" : "#c34fa0"}
              opacity={0.5}
            />
          ))}

          {/* beams: two quantized fans that trade sides with the kick */}
          <g ref={beamLRef} style={{ transition: "opacity 90ms steps(2, end)" }}>
            <path
              d={pxPath([
                [56, 6, 6, 4],
                [50, 10, 14, 20],
                [42, 30, 26, 40],
                [32, 70, 42, 48],
              ])}
              fill="#c34fa0"
              opacity={0.14}
            />
            {pool(70, "#c34fa0")}
          </g>
          <g ref={beamRRef} style={{ transition: "opacity 90ms steps(2, end)" }}>
            <path
              d={pxPath([
                [218, 6, 6, 4],
                [216, 10, 14, 20],
                [212, 30, 26, 40],
                [206, 70, 42, 48],
              ])}
              fill="#3fa7b8"
              opacity={0.14}
            />
            {pool(210, "#3fa7b8")}
          </g>

          {/* the floor: dark checker catching the beams, dithered */}
          <rect x={0} y={118} width={W} height={H - 118} fill="#100e14" />
          {Array.from({ length: 14 }, (_, i) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: static checker tiles, index is the identity
              key={i}
              x={i * 20 + (i % 2 ? 0 : 10)}
              y={118 + (i % 2 ? 0 : 10)}
              width={10}
              height={10}
              fill="#16131b"
            />
          ))}
          <rect x={0} y={118} width={W} height={H - 118} fill={dth("n", "25")} />

          {/* concrete pillars, bevel-lit, holding the hall up since 1912 */}
          {[PILLAR_L, PILLAR_R].map((P) => (
            <g key={P[0]}>
              <rect x={P[0]} y={P[1]} width={P[2]} height={P[3]} fill={M.graphite.lo} />
              <Bev set={bevelPaths([P])} mat={M.graphite} />
              <rect
                x={P[0]}
                y={P[1] + 24}
                width={P[2]}
                height={2}
                fill={M.graphite.deep}
                opacity={0.8}
              />
              <rect
                x={P[0] - 2}
                y={P[1] + P[3]}
                width={P[2] + 4}
                height={4}
                fill={M.graphite.deep}
              />
              {/* each pillar borrows the color of the beam beside it */}
              <rect
                x={P[0]}
                y={P[1]}
                width={2}
                height={P[3]}
                fill={P[0] < 100 ? "#c34fa0" : "#3fa7b8"}
                opacity={0.25}
              />
            </g>
          ))}

          {/* step cues: floor arrows that light half a beat early */}
          <g ref={cueLRef} style={{ opacity: 0, transition: "opacity 60ms steps(2, end)" }}>
            <path
              d={pxPath([
                [52, 128, 4, 8],
                [56, 126, 4, 12],
                [60, 124, 4, 16],
              ])}
              fill="#c34fa0"
              opacity={0.8}
            />
            <PixelText x={52} y={144} text="A" fill="#c34fa0" />
          </g>
          <g ref={cueRRef} style={{ opacity: 0, transition: "opacity 60ms steps(2, end)" }}>
            <path
              d={pxPath([
                [224, 124, 4, 16],
                [228, 126, 4, 12],
                [232, 128, 4, 8],
              ])}
              fill="#3fa7b8"
              opacity={0.8}
            />
            <PixelText x={226} y={144} text="D" fill="#3fa7b8" />
          </g>

          {/* the crowd: three depths of people, rim-lit from the beams */}
          <g ref={crowdBackRef} style={{ transition: "transform 110ms steps(2, end)" }}>
            {[48, 76, 104, 132, 160, 188, 216].map((x, i) =>
              figure(x, 72 - (i % 2) * 3, 34, "#08070c"),
            )}
          </g>
          <g ref={crowdMidRef} style={{ transition: "transform 100ms steps(2, end)" }}>
            {[62, 98, 134, 170, 206].map((x, i) =>
              figure(x, 84 - (i % 2) * 2, 40, "#0d0b12", i % 2 ? "#c34fa0" : "#3fa7b8"),
            )}
          </g>

          {/* our man, front and center, jacket catching both beams */}
          <g ref={dancerRef} style={{ transition: "transform 90ms steps(2, end)" }}>
            <path
              d={pxPath([
                [133, 92, 8, 6],
                [130, 98, 14, 5],
                [128, 103, 18, 26],
                [130, 129, 6, 8],
                [138, 129, 6, 8],
              ])}
              fill="#12101a"
            />
            <path d={pxPath([[133, 92, 8, 1]])} fill="#3fa7b8" opacity={0.6} />
            <path d={pxPath([[128, 103, 2, 20]])} fill="#c34fa0" opacity={0.4} />
            <path d={pxPath([[144, 103, 2, 20]])} fill="#3fa7b8" opacity={0.4} />
            {/* his stepped shadow on the checker */}
            <path
              d={pxPath([
                [126, 137, 22, 3],
                [130, 140, 18, 2],
              ])}
              fill="#050408"
              opacity={0.7}
            />
          </g>

          {/* the strobe — one frame of white when a step lands */}
          <rect
            ref={strobeRef}
            width={W}
            height={H}
            fill="#e8e4f0"
            style={{ opacity: 0, transition: "opacity 40ms steps(1, end)" }}
          />

          {phase === "intro" ? (
            <g>
              <PixelText x={82} y={46} text="IDZ ZA PARKIETEM" fill={M.linen.base} />
              <PixelText x={82} y={56} text="A - LEWO   D - PRAWO" fill={M.linen.lo} />
              <PixelText x={82} y={66} text="CZTERY BITY NA WEJSCIE" fill={M.linen.lo} />
              <PixelText x={82} y={78} text="[E] NA PARKIET" fill="#c34fa0" />
            </g>
          ) : null}
          {phase === "done" ? <PixelText x={132} y={50} text="..." fill={M.linen.base} /> : null}

          <Vignette set={VIGNETTE} />
        </svg>
        <p className="mt-3 text-center font-mono text-[11px] text-parchment/50">
          {phase === "done" ? verdict : "a d кроки · esc зійти з паркету"}
        </p>
      </div>
    </div>
  );
}
