import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/engine";
import {
  dth,
  M,
  PixelText,
  pxPath,
  SharedDefs,
  steppedEllipse,
  Vignette,
  vignettePaths,
} from "@/engine/scene/pixelKit";

/**
 * DRIVING — the Golf on the night obwodnica, Stocznia-bound.
 *
 * Side view, three lanes, W/S to change them. Traffic ahead drives slower
 * than you because everyone on this road at this hour is either careful or
 * finished being careful. Clipping someone costs speed and paint, never the
 * run — the game about this city does not total your car, it makes Marek
 * notice. The exit sign ends it.
 *
 * Volumetric rules: the Golf is Snow White with its material ramps and a
 * stepped headlight cone, sodium lamps drop quantized pools that strobe
 * past at your actual speed, the shipyard cranes ride the slow parallax
 * with their red aircraft lights, and every car on the road carries rear
 * glows and a shadow under the sill.
 */

const W = 300;
const H = 170;
const VIGNETTE = vignettePaths(W, H);

/* the road */
const LANES = [112, 128, 144] as const; // feet lines, top lane farthest
const GOLF_X = 60;
const PX_PER_M = 3; // world meters to logical px
const CRUISE = 36; // m/s once wound up (~130, but nobody says numbers)
const TRAFFIC_MS = 22; // everyone else holds a lawful ~80
const RUN_M = 2000; // the exit comes up in two kilometres
const CAR_W = 46;
const CAR_H = 15;

/** authored traffic: position on the road (m), lane, a little speed variance */
const TRAFFIC: readonly (readonly [number, number, number])[] = [
  [140, 1, 0],
  [260, 2, 1],
  [390, 0, -2],
  [500, 1, 2],
  [610, 2, 0],
  [700, 0, 1],
  [820, 1, -1],
  [900, 2, 2],
  [1010, 0, 0],
  [1090, 1, 1],
  [1200, 2, -2],
  [1290, 0, 2],
  [1400, 1, 0],
  [1490, 2, 1],
  [1600, 0, -1],
  [1700, 1, 2],
  [1790, 2, 0],
  [1880, 0, 1],
] as const;
/** oncoming headlights beyond the barrier: start time (ms), gap between */
const ONCOMING = [2600, 6800, 9200, 13400, 17800, 21600, 25200, 29800, 33400] as const;

const BODIES = [M.red, M.steel, M.graphite, M.wood] as const;

export function Driving({
  onClose,
  onVerdict,
}: {
  onClose: () => void;
  onVerdict: (line: string) => void;
}) {
  const [phase, setPhase] = useState<"intro" | "driving" | "done">("intro");
  const [verdict, setVerdict] = useState("");
  const roadRef = useRef<SVGGElement | null>(null);
  const lampsRef = useRef<SVGGElement | null>(null);
  const farRef = useRef<SVGGElement | null>(null);
  const golfRef = useRef<SVGGElement | null>(null);
  const trafficRefs = useRef<(SVGGElement | null)[]>([]);
  const oncomingRef = useRef<SVGGElement | null>(null);
  const signRef = useRef<SVGGElement | null>(null);
  const state = useRef({
    start: 0,
    last: 0,
    dist: 0,
    speed: 0,
    lane: 1,
    scrapes: 0,
    invulnUntil: 0,
    cars: TRAFFIC.map(([m, lane, dv]) => ({ m, lane, v: TRAFFIC_MS + dv, clipped: false })),
    done: false,
  });

  /* the run loop — one clock, refs only */
  useEffect(() => {
    if (phase !== "driving") return;
    let raf = 0;
    const st = state.current;
    st.start = st.last = performance.now();
    playSfx("engine");
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(64, now - st.last) / 1000;
      st.last = now;
      const t = now - st.start;

      /* wind up to cruise; traffic rolls at its own pace */
      st.speed = Math.min(CRUISE, st.speed + dt * 9);
      st.dist += st.speed * dt;
      for (const c of st.cars) c.m += c.v * dt;

      /* layers: far city crawls, lamps stride, the road runs */
      const px = st.dist * PX_PER_M;
      if (farRef.current) farRef.current.style.transform = `translateX(${-((px * 0.12) % 300)}px)`;
      if (lampsRef.current) lampsRef.current.style.transform = `translateX(${-(px % 150)}px)`;
      if (roadRef.current) roadRef.current.style.transform = `translateX(${-(px % 30)}px)`;

      /* traffic to screen space */
      st.cars.forEach((c, i) => {
        const el = trafficRefs.current[i];
        if (!el) return;
        const x = GOLF_X + (c.m - st.dist) * PX_PER_M;
        if (x < -70 || x > W + 40) {
          el.style.display = "none";
          return;
        }
        el.style.display = "";
        el.style.transform = `translate(${Math.round(x)}px, ${LANES[c.lane] - CAR_H}px)`;
      });

      /* oncoming beyond the barrier: a pair of lights, right to left */
      if (oncomingRef.current) {
        const active = ONCOMING.find((at) => t >= at && t < at + 1900);
        if (active !== undefined) {
          const k = (t - active) / 1900;
          oncomingRef.current.style.display = "";
          oncomingRef.current.style.transform = `translateX(${Math.round(W - k * (W + 60))}px)`;
        } else {
          oncomingRef.current.style.display = "none";
        }
      }

      /* the collision: same lane, bumper into bumper, not while flinching */
      if (now > st.invulnUntil) {
        for (const c of st.cars) {
          if (c.lane !== st.lane || c.clipped) continue;
          const x = GOLF_X + (c.m - st.dist) * PX_PER_M;
          if (x > GOLF_X + CAR_W - 8 && x < GOLF_X + CAR_W + 6) {
            c.clipped = true;
            st.scrapes++;
            st.speed *= 0.45;
            st.invulnUntil = now + 1400;
            playSfx("thud");
            playSfx("denied");
            const g = golfRef.current;
            if (g) {
              g.style.transform = `translateY(${LANES[st.lane] - CAR_H + 2}px)`;
              window.setTimeout(() => {
                if (g) g.style.transform = `translateY(${LANES[state.current.lane] - CAR_H}px)`;
              }, 160);
            }
          }
        }
      }

      /* the exit sign scrolls in over the last stretch */
      if (signRef.current) {
        const x = GOLF_X + (RUN_M + 30 - st.dist) * PX_PER_M;
        signRef.current.style.display = x < W + 40 ? "" : "none";
        signRef.current.style.transform = `translateX(${Math.round(x)}px)`;
      }

      if (st.dist >= RUN_M && !st.done) {
        st.done = true;
        playSfx("carlock");
        const line =
          st.scrapes === 0
            ? "Ani rysy. Golf pachnie jak przed wyjazdem."
            : st.scrapes <= 2
              ? "Serce stanęło dwa razy. Lakier cały — prawie."
              : "Marek zauważy. Marek wszystko zauważa.";
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

  /* lane changes */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") return;
      e.stopPropagation();
      if (phase === "intro" && (e.code === "KeyE" || e.code === "Enter" || e.code === "Space")) {
        setPhase("driving");
        return;
      }
      if (phase !== "driving" || e.repeat) return;
      const st = state.current;
      const dir =
        e.code === "KeyW" || e.code === "ArrowUp"
          ? -1
          : e.code === "KeyS" || e.code === "ArrowDown"
            ? 1
            : 0;
      if (!dir) return;
      const next = Math.max(0, Math.min(LANES.length - 1, st.lane + dir));
      if (next === st.lane) return;
      st.lane = next;
      const g = golfRef.current;
      if (g) g.style.transform = `translateY(${LANES[next] - CAR_H}px)`;
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase]);

  /* one traffic car: body ramp, rear glows, cabin, wheels, sill shadow */
  const car = (mat: (typeof BODIES)[number], i: number) => (
    <g
      key={i}
      ref={(el) => {
        trafficRefs.current[i] = el;
      }}
      style={{ display: "none" }}
    >
      <path
        d={pxPath([
          [4, 4, 38, 5],
          [10, 0, 22, 5],
          [2, 9, 42, 4],
        ])}
        fill={mat.base}
      />
      <path
        d={pxPath([
          [10, 0, 22, 1],
          [4, 4, 38, 1],
        ])}
        fill={mat.hi}
      />
      <path d={pxPath([[2, 11, 42, 2]])} fill={mat.deep} />
      <path
        d={pxPath([
          [12, 1, 8, 3],
          [22, 1, 8, 3],
        ])}
        fill="#1a222c"
      />
      <rect x={1} y={5} width={3} height={3} fill="#ff5050" opacity={0.9} />
      <rect x={0} y={6} width={2} height={2} fill="#ff8080" opacity={0.5} />
      {[8, 32].map((wx) => (
        <g key={wx}>
          <path d={pxPath(steppedEllipse(wx, 13, 4, 4, 2))} fill="#0a0a0c" />
          <rect x={wx - 1} y={12} width={2} height={2} fill={M.steel.lo} />
        </g>
      ))}
      <path d={pxPath([[3, 16, 40, 2]])} fill="#050507" opacity={0.6} />
    </g>
  );

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/85">
      <div className="relative w-full max-w-3xl px-[4%]">
        <svg
          aria-hidden="true"
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          shapeRendering="crispEdges"
          style={{ imageRendering: "pixelated" }}
        >
          <SharedDefs />
          {/* night sky over the bay */}
          <rect width={W} height={H} fill="#0a0d14" />
          <rect width={W} height={60} fill="#0d1119" />
          <rect x={40} y={12} width={1} height={1} fill="#aab4c4" opacity={0.7} />
          <rect x={122} y={8} width={1} height={1} fill="#aab4c4" opacity={0.5} />
          <rect x={214} y={16} width={1} height={1} fill="#aab4c4" opacity={0.6} />

          {/* far parallax: blocks with lit windows, the cranes, twice for wrap */}
          <g ref={farRef}>
            {[0, 300].map((ox) => (
              <g key={ox} transform={`translate(${ox} 0)`}>
                <path
                  d={pxPath([
                    [10, 34, 30, 34],
                    [60, 40, 24, 28],
                    [180, 30, 34, 38],
                    [240, 42, 22, 26],
                  ])}
                  fill="#111521"
                />
                {[
                  [14, 40],
                  [22, 48],
                  [30, 40],
                  [64, 46],
                  [186, 36],
                  [194, 44],
                  [202, 52],
                  [246, 48],
                ].map(([wx, wy]) => (
                  <rect
                    key={`${wx}:${wy}`}
                    x={wx}
                    y={wy}
                    width={2}
                    height={3}
                    fill="#ffca85"
                    opacity={0.55}
                  />
                ))}
                {/* the cranes, upright over everything, red lights on */}
                <path
                  d={pxPath([
                    [104, 22, 4, 46],
                    [96, 22, 20, 3],
                    [112, 25, 3, 10],
                    [98, 25, 3, 6],
                  ])}
                  fill="#131826"
                />
                <path
                  d={pxPath([
                    [140, 16, 4, 52],
                    [132, 16, 24, 3],
                    [152, 19, 3, 12],
                  ])}
                  fill="#131826"
                />
                <rect x={105} y={20} width={2} height={2} fill="#ff5050" opacity={0.8} />
                <rect x={141} y={14} width={2} height={2} fill="#ff5050" opacity={0.8} />
              </g>
            ))}
          </g>

          {/* the far barrier and the oncoming lane behind it */}
          <rect x={0} y={92} width={W} height={2} fill="#1b2029" />
          <g ref={oncomingRef} style={{ display: "none" }}>
            {/* a pair of headlights and the smear of a car you never see */}
            <rect x={0} y={86} width={3} height={3} fill="#fff2c8" />
            <rect x={7} y={86} width={3} height={3} fill="#fff2c8" />
            <path d={pxPath([[-4, 85, 22, 5]])} fill="#3a3f4c" opacity={0.5} />
            <path d={pxPath([[-14, 86, 10, 3]])} fill="#fff2c8" opacity={0.18} />
          </g>
          <rect x={0} y={94} width={W} height={4} fill={M.graphite.deep} />
          <rect x={0} y={94} width={W} height={1} fill={M.graphite.base} />

          {/* the roadbed */}
          <rect x={0} y={98} width={W} height={54} fill="#14161c" />
          <rect x={0} y={98} width={W} height={54} fill={dth("n", "25")} />
          {/* dashes between lanes, wrapped on their 30px period */}
          <g ref={roadRef}>
            {Array.from({ length: 12 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static dash tiles, index is the identity
              <g key={`${i}`}>
                <rect x={i * 30} y={118} width={14} height={2} fill="#3f4450" opacity={0.8} />
                <rect x={i * 30} y={134} width={14} height={2} fill="#3f4450" opacity={0.8} />
              </g>
            ))}
          </g>
          <rect x={0} y={150} width={W} height={2} fill="#20242e" />

          {/* sodium lamps on their 150px stride, pools quantized */}
          <g ref={lampsRef}>
            {[0, 150, 300, 450].map((ox) => (
              <g key={ox} transform={`translate(${ox} 0)`}>
                <rect x={20} y={56} width={3} height={42} fill={M.graphite.lo} />
                <path d={pxPath([[20, 56, 14, 3]])} fill={M.graphite.lo} />
                <rect x={32} y={58} width={4} height={3} fill="#ffca85" />
                {[1, 0.66, 0.36].map((f, i) => (
                  <path
                    key={f}
                    d={pxPath(steppedEllipse(34, 110, Math.round(30 * f), Math.round(8 * f), 2))}
                    fill="#ffca85"
                    opacity={0.06 + i * 0.05}
                  />
                ))}
              </g>
            ))}
          </g>

          {/* traffic */}
          {TRAFFIC.map((_, i) => car(BODIES[i % BODIES.length], i))}

          {/* the exit sign, planted on the verge, sliding in at the end */}
          <g ref={signRef} style={{ display: "none" }}>
            <rect x={0} y={64} width={3} height={40} fill={M.steel.lo} />
            <rect x={-26} y={52} width={56} height={16} fill="#0f4a34" />
            <rect x={-26} y={52} width={56} height={1} fill="#2a7a58" />
            <PixelText x={-21} y={56} text="STOCZNIA" fill="#e8f4ec" />
            <PixelText x={-21} y={63} text="500 M" fill="#9fc9b2" />
          </g>

          {/* the Golf — Snow White, 310 horses, one careful owner */}
          <g
            ref={golfRef}
            style={{
              transform: `translateY(${LANES[1] - CAR_H}px)`,
              transition: "transform 110ms steps(3, end)",
            }}
          >
            {/* stepped headlight wedge: brightest at the lamp, gone in three steps */}
            <path d={pxPath([[44, 5, 12, 4]])} fill="#ffe9a8" opacity={0.13} />
            <path d={pxPath([[56, 4, 16, 6]])} fill="#ffe9a8" opacity={0.07} />
            <path d={pxPath([[72, 3, 20, 8]])} fill="#ffe9a8" opacity={0.04} />
            <path
              d={pxPath([
                [4, 4, 38, 5],
                [10, 0, 24, 5],
                [2, 9, 42, 4],
              ])}
              fill={M.linen.base}
            />
            <path
              d={pxPath([
                [10, 0, 24, 1],
                [4, 4, 38, 1],
              ])}
              fill={M.linen.hi}
            />
            <path d={pxPath([[2, 11, 42, 2]])} fill={M.linen.deep} />
            {/* glasshouse with the driver's silhouette */}
            <path
              d={pxPath([
                [12, 1, 9, 3],
                [23, 1, 9, 3],
              ])}
              fill="#1a222c"
            />
            <path d={pxPath([[24, 2, 4, 2]])} fill="#0c0e12" />
            {/* headlight block and taillight */}
            <rect x={42} y={5} width={3} height={3} fill="#fff2c8" />
            <rect x={1} y={5} width={2} height={3} fill="#ff5050" opacity={0.9} />
            {[9, 35].map((wx) => (
              <g key={wx}>
                <path d={pxPath(steppedEllipse(wx, 13, 4, 4, 2))} fill="#0a0a0c" />
                <rect x={wx - 1} y={12} width={2} height={2} fill={M.steel.base} />
              </g>
            ))}
            <path d={pxPath([[3, 16, 40, 2]])} fill="#050507" opacity={0.6} />
          </g>

          {phase === "intro" ? (
            <g>
              <rect x={70} y={20} width={160} height={44} fill="#0b0d12" opacity={0.8} />
              <PixelText x={80} y={26} text="OBWODNICA. NOC." fill={M.linen.base} />
              <PixelText x={80} y={36} text="W S - PASY RUCHU" fill={M.linen.lo} />
              <PixelText x={80} y={46} text="NIE OBUDZ LAKIERU" fill={M.linen.lo} />
              <PixelText x={80} y={56} text="[E] ZAPLON" fill="#ffca85" />
            </g>
          ) : null}
          {phase === "done" ? <PixelText x={140} y={40} text="..." fill={M.linen.base} /> : null}

          <Vignette set={VIGNETTE} />
        </svg>
        <p className="mt-3 text-center font-mono text-[11px] text-parchment/50">
          {phase === "done" ? verdict : "w s смуги · esc з'їхати на узбіччя"}
        </p>
      </div>
    </div>
  );
}
