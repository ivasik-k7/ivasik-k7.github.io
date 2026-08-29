import i18n from "i18next";
import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/engine";
import { dth, M, PixelText, pxPath, steppedEllipse } from "@/engine/scene/pixelKit";
import { Juice, MinigameShell, makeParticlePool } from "./kit";

/**
 * DRIVING — the Golf on the night obwodnica, and the road has weather.
 *
 * Three lanes, W/S between them, SHIFT to lean on it and SPACE to lift off.
 * Speed is the whole game: fast closes gaps you have to read early, slow is
 * safe and never gets you to Stocznia before the club shuts. Traffic is
 * lawful and slower than you; a lorry sits in the middle lane for a
 * kilometre because that is what lorries do.
 *
 * Rain arrives halfway and changes the road rather than the rules — the
 * wipers start, the lamps smear, the tyre spray comes up, and the gaps you
 * were reading at 130 want reading at 110. Clipping someone costs paint and
 * speed, never the run: the failure state is Marek noticing in the morning.
 */

const W = 320;
const H = 190;

/* the world, in metres, and the strip of it we can see */
const PX_PER_M = 3;
const RUN_M = 2400;
const LANES = [104, 122, 140] as const; // feet lines: top lane is farthest
const GOLF_X = 88;
const CAR_H = 15;
const CRUISE = 30; // m/s cruising
const PUSH = 40; // m/s leaning on it
const LIFT = 19; // m/s lifted off
const RAIN_AT = 1000; // metres in, the sky lets go
const HORIZON = 92;

type Car = { m: number; lane: number; v: number; kind: 0 | 1; clipped: boolean };

/** authored traffic: metre, lane, speed offset, kind (0 car, 1 lorry) */
const TRAFFIC: readonly (readonly [number, number, number, 0 | 1])[] = [
  [180, 1, 0, 0],
  [300, 2, 1, 0],
  [430, 0, -2, 0],
  [540, 1, 2, 0],
  [650, 2, 0, 0],
  [760, 1, -4, 1], // the lorry, sitting in the middle lane
  [880, 0, 1, 0],
  [980, 2, 2, 0],
  [1080, 0, 0, 0],
  [1160, 1, 1, 0],
  [1280, 2, -2, 0],
  [1370, 0, 2, 0],
  [1470, 1, -5, 1], // and another, once the rain has started
  [1580, 2, 1, 0],
  [1690, 0, -1, 0],
  [1790, 1, 2, 0],
  [1880, 2, 0, 0],
  [1980, 0, 1, 0],
  [2090, 1, -1, 0],
  [2190, 2, 2, 0],
] as const;
const ONCOMING = [2600, 6800, 9200, 13400, 17800, 21600, 25200, 29800, 33400] as const;
const BODIES = [M.red, M.steel, M.graphite, M.wood] as const;

export function Driving({
  best = 0,
  onClose,
  onVerdict,
}: {
  /** Best tier ever reached: a clean past run means the road starts wet. */
  best?: number;
  onClose: () => void;
  onVerdict: (tier: 0 | 1 | 2) => void;
}) {
  const [phase, setPhase] = useState<"intro" | "driving" | "done">("intro");
  const [verdict, setVerdict] = useState<string | null>(null);
  const stageRef = useRef<SVGGElement | null>(null);
  const roadRef = useRef<SVGGElement | null>(null);
  const lampsRef = useRef<SVGGElement | null>(null);
  const farRef = useRef<SVGGElement | null>(null);
  const nearRef = useRef<SVGGElement | null>(null);
  const golfRef = useRef<SVGGElement | null>(null);
  const golfLeanRef = useRef<SVGGElement | null>(null);
  const trafficRefs = useRef<(SVGGElement | null)[]>([]);
  const oncomingRef = useRef<SVGGElement | null>(null);
  const signRef = useRef<SVGGElement | null>(null);
  const rainRef = useRef<SVGGElement | null>(null);
  const wiperRef = useRef<SVGGElement | null>(null);
  const needleRef = useRef<SVGGElement | null>(null);
  const beamRef = useRef<SVGGElement | null>(null);
  const scrapeRefs = useRef<(SVGGElement | null)[]>([]);
  const juice = useRef(new Juice()).current;
  const spray = useRef(makeParticlePool(52)).current;
  const st = useRef({
    start: 0,
    last: 0,
    t: 0,
    dist: 0,
    speed: 0,
    want: CRUISE,
    lane: 1,
    scrapes: 0,
    invulnUntil: 0,
    wet: best >= 2,
    sprayAt: 0,
    cars: TRAFFIC.map(([m, lane, dv, kind]) => ({
      m,
      lane,
      v: 22 + dv,
      kind,
      clipped: false,
    })) as Car[],
    done: false,
  });

  /* the run */
  useEffect(() => {
    if (phase !== "driving") return;
    let raf = 0;
    const s = st.current;
    s.start = s.last = performance.now();
    playSfx("engine");
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const { frozen, dx, dy } = juice.sample(now, now - s.start);
      if (stageRef.current) stageRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      const dtMs = Math.min(64, now - s.last);
      s.last = now;
      if (frozen) return;
      s.t += dtMs;
      const dt = dtMs / 1000;
      const t = s.t;

      /* the throttle: he leans on it or lifts off, and the car takes its time */
      const grip = s.wet ? 0.6 : 1;
      const toward = s.want > s.speed ? 10 * grip : 16;
      s.speed += Math.sign(s.want - s.speed) * Math.min(Math.abs(s.want - s.speed), toward * dt);
      s.dist += s.speed * dt;
      for (const c of s.cars) c.m += c.v * dt;

      /* the rain arrives once, and then it is simply raining */
      if (!s.wet && s.dist > RAIN_AT) {
        s.wet = true;
        if (rainRef.current) rainRef.current.style.display = "";
        if (wiperRef.current) wiperRef.current.style.display = "";
      }

      /* the needle: the only instrument that matters, and it never says a number */
      if (needleRef.current) {
        const k = Math.min(1, s.speed / 46);
        needleRef.current.style.transform = `translateX(${Math.round(k * 34)}px)`;
      }
      /* the headlight beam stretches as he goes faster */
      if (beamRef.current) {
        const k = Math.min(1, s.speed / 46);
        beamRef.current.style.transform = `scaleX(${(0.7 + k * 0.7).toFixed(2)})`;
      }

      /* the layers, each at its own share of the speed */
      const px = s.dist * PX_PER_M;
      if (farRef.current) farRef.current.style.transform = `translateX(${-((px * 0.1) % 320)}px)`;
      if (lampsRef.current) lampsRef.current.style.transform = `translateX(${-(px % 160)}px)`;
      if (nearRef.current) nearRef.current.style.transform = `translateX(${-((px * 1.6) % 80)}px)`;
      if (roadRef.current) roadRef.current.style.transform = `translateX(${-(px % 32)}px)`;
      if (rainRef.current && s.wet) {
        rainRef.current.style.transform = `translate(${-((px * 0.9) % 24)}px, ${(t * 0.6) % 20}px)`;
      }
      /* the wipers sweep on their own slow clock, not the car's */
      if (wiperRef.current && s.wet) {
        const k = (t % 1600) / 1600;
        wiperRef.current.style.transform = `translateX(${Math.round((k < 0.5 ? k : 1 - k) * 180)}px)`;
      }
      /* tyre spray, thrown up behind whoever is closest */
      if (s.wet && t > s.sprayAt) {
        s.sprayAt = t + 90;
        spray.spawn({
          x: GOLF_X + 4,
          y: LANES[s.lane] - 2,
          vx: -40 - s.speed,
          vy: -12,
          life: 460,
          color: "#4a525c",
          size: 1,
          gravity: 70,
        });
      }
      spray.update(now, dt);

      /* traffic into screen space */
      s.cars.forEach((c, i) => {
        const el = trafficRefs.current[i];
        if (!el) return;
        const x = GOLF_X + (c.m - s.dist) * PX_PER_M;
        if (x < -90 || x > W + 50) {
          el.style.display = "none";
          return;
        }
        el.style.display = "";
        el.style.transform = `translate(${Math.round(x)}px, ${LANES[c.lane] - CAR_H}px)`;
      });

      /* oncoming beyond the barrier */
      if (oncomingRef.current) {
        const active = ONCOMING.find((at) => t >= at && t < at + 1700);
        if (active !== undefined) {
          const k = (t - active) / 1700;
          oncomingRef.current.style.display = "";
          oncomingRef.current.style.transform = `translateX(${Math.round(W - k * (W + 70))}px)`;
        } else {
          oncomingRef.current.style.display = "none";
        }
      }

      /* the clip: bumper into bumper, in lane, not while still flinching */
      if (now > s.invulnUntil) {
        /* his bumper, in the same screen space everything else is drawn in */
        const noseX = GOLF_X + 42;
        for (const c of s.cars) {
          if (c.lane !== s.lane || c.clipped) continue;
          const x = GOLF_X + (c.m - s.dist) * PX_PER_M; // their tail
          const gap = x - noseX;
          if (gap < 0 && gap > -15) {
            c.clipped = true;
            s.scrapes++;
            s.speed *= 0.45;
            s.want = CRUISE;
            s.invulnUntil = now + 1500;
            playSfx("thud");
            playSfx("denied");
            juice.hitStop(70);
            juice.shake(3, 380);
            /* a scrape mark appears on the wing, and stays there */
            const mark = scrapeRefs.current[Math.min(s.scrapes - 1, scrapeRefs.current.length - 1)];
            if (mark) mark.style.display = "";
            /* and paint flakes off into the dark */
            for (let k = 0; k < 8; k++) {
              spray.spawn({
                x: GOLF_X + 38,
                y: LANES[s.lane] - 8,
                vx: -20 - k * 12,
                vy: -28 + k * 4,
                life: 620,
                color: k % 3 ? "#e8e2d2" : "#b03030",
                size: 1,
                gravity: 120,
              });
            }
          }
        }
      }

      /* the exit sign comes up over the last stretch */
      if (signRef.current) {
        const x = GOLF_X + (RUN_M + 40 - s.dist) * PX_PER_M;
        signRef.current.style.display = x < W + 50 ? "" : "none";
        signRef.current.style.transform = `translateX(${Math.round(x)}px)`;
      }

      if (s.dist >= RUN_M && !s.done) {
        s.done = true;
        playSfx("carlock");
        const tier = s.scrapes === 0 ? 2 : s.scrapes <= 2 ? 1 : 0;
        const line =
          tier === 2
            ? s.wet
              ? i18n.t("minigame.verdict.driving.bestWet")
              : i18n.t("minigame.verdict.driving.best")
            : tier === 1
              ? i18n.t("minigame.verdict.driving.mid")
              : i18n.t("minigame.verdict.driving.low");
        setVerdict(line);
        setPhase("done");
        window.setTimeout(() => {
          onVerdict(tier);
          onClose();
        }, 3000);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, juice, spray, onClose, onVerdict]);

  /* the controls: lanes, throttle, brake */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") return;
      e.stopPropagation();
      if (phase === "intro" && (e.code === "KeyE" || e.code === "Enter")) {
        setPhase("driving");
        return;
      }
      if (phase !== "driving") return;
      const s = st.current;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        s.want = PUSH;
        if (golfLeanRef.current) golfLeanRef.current.style.transform = "translateX(3px)";
        return;
      }
      if (e.code === "Space") {
        s.want = LIFT;
        if (golfLeanRef.current) golfLeanRef.current.style.transform = "translateX(-3px)";
        return;
      }
      if (e.repeat) return;
      const dir =
        e.code === "KeyW" || e.code === "ArrowUp"
          ? -1
          : e.code === "KeyS" || e.code === "ArrowDown"
            ? 1
            : 0;
      if (!dir) return;
      const next = Math.max(0, Math.min(LANES.length - 1, s.lane + dir));
      if (next === s.lane) return;
      s.lane = next;
      const g = golfRef.current;
      if (g) g.style.transform = `translate(${GOLF_X - 4}px, ${LANES[next] - CAR_H}px)`;
      /* changing lanes on a wet road costs a little speed, as it should */
      if (s.wet) s.speed *= 0.96;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code.startsWith("Shift") || e.code === "Space") {
        st.current.want = CRUISE;
        if (golfLeanRef.current) golfLeanRef.current.style.transform = "translateX(0)";
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onUp, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onUp, true);
    };
  }, [phase]);

  /* one traffic car or lorry: body ramp, rear glows, wheels, sill shadow */
  const vehicle = (mat: (typeof BODIES)[number], i: number, lorry: boolean) => (
    <g
      key={i}
      ref={(el) => {
        trafficRefs.current[i] = el;
      }}
      style={{ display: "none" }}
    >
      {lorry ? (
        <>
          {/* the box, its ribs, and the cab up front */}
          <rect x={2} y={-14} width={52} height={26} fill={M.linen.deep} />
          <rect x={2} y={-14} width={52} height={2} fill={M.linen.lo} />
          {[10, 20, 30, 40].map((rx) => (
            <rect key={rx} x={rx} y={-12} width={1} height={22} fill="#8d8676" opacity={0.5} />
          ))}
          <path
            d={pxPath([
              [54, -6, 18, 18],
              [58, -10, 12, 4],
            ])}
            fill={M.red.base}
          />
          <path d={pxPath([[58, -10, 12, 1]])} fill={M.red.hi} />
          <rect x={62} y={-6} width={8} height={5} fill="#1a222c" />
          <rect x={0} y={-2} width={3} height={4} fill="#ff5050" opacity={0.9} />
          <rect x={0} y={8} width={3} height={3} fill="#ffca85" opacity={0.6} />
          {[10, 26, 58, 68].map((wx) => (
            <g key={wx}>
              <path d={pxPath(steppedEllipse(wx, 12, 5, 5, 2))} fill="#0a0a0c" />
              <rect x={wx - 1} y={11} width={2} height={2} fill={M.steel.lo} />
            </g>
          ))}
          <path d={pxPath([[2, 16, 70, 2]])} fill="#050507" opacity={0.6} />
        </>
      ) : (
        <>
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
        </>
      )}
    </g>
  );

  return (
    <MinigameShell
      w={W}
      h={H}
      bg="#080b12"
      stageRef={stageRef}
      verdict={verdict}
      hint={phase === "done" ? "" : i18n.t("minigame.driving")}
    >
      {/* night over the bay */}
      <rect x={0} y={0} width={W} height={HORIZON} fill="#0a0d14" />
      <rect x={0} y={0} width={W} height={44} fill="#0c1018" />
      {[
        [44, 12],
        [128, 8],
        [222, 16],
        [286, 10],
      ].map(([sx, sy]) => (
        <rect key={`${sx}`} x={sx} y={sy} width={1} height={1} fill="#aab4c4" opacity={0.6} />
      ))}

      {/* far parallax: blocks with lit windows, the cranes over everything */}
      <g ref={farRef}>
        {[0, 320].map((ox) => (
          <g key={ox} transform={`translate(${ox} 0)`}>
            <path
              d={pxPath([
                [14, 46, 32, 46],
                [64, 54, 26, 38],
                [190, 42, 36, 50],
                [252, 56, 24, 36],
              ])}
              fill="#101420"
            />
            {[
              [18, 54],
              [26, 64],
              [34, 54],
              [68, 62],
              [196, 50],
              [204, 60],
              [212, 70],
              [258, 64],
            ].map(([wx, wy]) => (
              <rect
                key={`${wx}:${wy}`}
                x={wx}
                y={wy}
                width={2}
                height={3}
                fill="#ffca85"
                opacity={0.5}
              />
            ))}
            {/* the cranes, upright, red aircraft lights on */}
            <path
              d={pxPath([
                [110, 30, 4, 62],
                [100, 30, 22, 3],
                [118, 33, 3, 12],
                [102, 33, 3, 7],
              ])}
              fill="#121725"
            />
            <path
              d={pxPath([
                [150, 22, 4, 70],
                [140, 22, 26, 3],
                [162, 25, 3, 14],
              ])}
              fill="#121725"
            />
            <rect x={111} y={28} width={2} height={2} fill="#ff5050" opacity={0.85} />
            <rect x={151} y={20} width={2} height={2} fill="#ff5050" opacity={0.85} />
          </g>
        ))}
      </g>

      {/* the far barrier and the oncoming carriageway behind it */}
      <g ref={oncomingRef} style={{ display: "none" }}>
        <rect x={0} y={84} width={3} height={3} fill="#fff2c8" />
        <rect x={7} y={84} width={3} height={3} fill="#fff2c8" />
        <path d={pxPath([[-4, 83, 22, 5]])} fill="#39404e" opacity={0.55} />
        <path d={pxPath([[-16, 84, 12, 3]])} fill="#fff2c8" opacity={0.16} />
      </g>
      <rect x={0} y={HORIZON} width={W} height={4} fill={M.graphite.deep} />
      <rect x={0} y={HORIZON} width={W} height={1} fill={M.graphite.base} />
      {/* the armco, its posts flicking past */}
      <g>
        {Array.from({ length: 11 }, (_, i) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: static posts
            key={i}
            x={i * 32 + 6}
            y={HORIZON + 4}
            width={2}
            height={5}
            fill={M.graphite.lo}
          />
        ))}
      </g>

      {/* the roadbed */}
      <rect x={0} y={HORIZON + 4} width={W} height={H - HORIZON - 4} fill="#13161c" />
      <rect x={0} y={HORIZON + 4} width={W} height={H - HORIZON - 4} fill={dth("n", "25")} />
      <g ref={roadRef}>
        {Array.from({ length: 12 }, (_, i) => (
          <g
            // biome-ignore lint/suspicious/noArrayIndexKey: static dash tiles
            key={i}
          >
            <rect x={i * 32} y={112} width={15} height={2} fill="#3f4450" opacity={0.75} />
            <rect x={i * 32} y={130} width={15} height={2} fill="#3f4450" opacity={0.75} />
          </g>
        ))}
      </g>
      <rect x={0} y={148} width={W} height={2} fill="#20242e" />
      {/* the hard shoulder and its rumble strip, nearest the eye */}
      <rect x={0} y={150} width={W} height={12} fill="#101319" />
      <g ref={nearRef}>
        {Array.from({ length: 6 }, (_, i) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: static rumble teeth
            key={i}
            x={i * 80}
            y={151}
            width={40}
            height={2}
            fill="#1a1f27"
          />
        ))}
      </g>

      {/* sodium lamps on their stride, pools quantized onto the tarmac */}
      <g ref={lampsRef}>
        {[0, 160, 320, 480].map((ox) => (
          <g key={ox} transform={`translate(${ox} 0)`}>
            <rect x={22} y={40} width={3} height={HORIZON - 40} fill={M.graphite.lo} />
            <path d={pxPath([[22, 40, 16, 3]])} fill={M.graphite.lo} />
            <rect x={36} y={42} width={5} height={3} fill="#ffca85" />
            {[1, 0.68, 0.38].map((f, i) => (
              <path
                key={f}
                d={pxPath(steppedEllipse(38, 122, Math.round(34 * f), Math.round(9 * f), 2))}
                fill="#ffca85"
                opacity={0.06 + i * 0.05}
              />
            ))}
          </g>
        ))}
      </g>

      {/* traffic */}
      {TRAFFIC.map(([, , , kind], i) => vehicle(BODIES[i % BODIES.length], i, kind === 1))}

      {/* the exit sign, planted on the verge */}
      <g ref={signRef} style={{ display: "none" }}>
        <rect x={0} y={58} width={3} height={38} fill={M.steel.lo} />
        <rect x={-28} y={44} width={60} height={18} fill="#0f4a34" />
        <rect x={-28} y={44} width={60} height={1} fill="#2a7a58" />
        <PixelText x={-23} y={48} text="STOCZNIA" fill="#e8f4ec" />
        <PixelText x={-23} y={56} text="500 M" fill="#9fc9b2" />
      </g>

      {/* the Golf — Snow White, 310 horses, one careful owner */}
      <g
        ref={golfRef}
        style={{
          transform: `translate(${GOLF_X - 4}px, ${LANES[1] - CAR_H}px)`,
          transition: "transform 110ms steps(3, end)",
        }}
      >
        <g ref={golfLeanRef} style={{ transition: "transform 200ms steps(3, end)" }}>
          {/* the beam, stepped, stretching with the speed */}
          <g
            ref={beamRef}
            style={{ transformOrigin: "44px 6px", transition: "transform 400ms linear" }}
          >
            <path d={pxPath([[44, 5, 14, 4]])} fill="#ffe9a8" opacity={0.14} />
            <path d={pxPath([[58, 4, 18, 6]])} fill="#ffe9a8" opacity={0.08} />
            <path d={pxPath([[76, 3, 22, 8]])} fill="#ffe9a8" opacity={0.045} />
          </g>
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
          <path
            d={pxPath([
              [12, 1, 9, 3],
              [23, 1, 9, 3],
            ])}
            fill="#1a222c"
          />
          <path d={pxPath([[24, 2, 4, 2]])} fill="#0c0e12" />
          <rect x={42} y={5} width={3} height={3} fill="#fff2c8" />
          <rect x={1} y={5} width={2} height={3} fill="#ff5050" opacity={0.9} />
          {/* the scrapes: each clip leaves one, and it stays for the drive */}
          {[0, 1, 2].map((i) => (
            <g
              key={i}
              ref={(el) => {
                scrapeRefs.current[i] = el;
              }}
              style={{ display: "none" }}
            >
              <rect x={30 - i * 9} y={7 + (i % 2)} width={7} height={1} fill="#8a2424" />
              <rect x={31 - i * 9} y={8 + (i % 2)} width={5} height={1} fill="#5f1818" />
            </g>
          ))}
          {[9, 35].map((wx) => (
            <g key={wx}>
              <path d={pxPath(steppedEllipse(wx, 13, 4, 4, 2))} fill="#0a0a0c" />
              <rect x={wx - 1} y={12} width={2} height={2} fill={M.steel.base} />
            </g>
          ))}
          <path d={pxPath([[3, 16, 40, 2]])} fill="#050507" opacity={0.65} />
        </g>
      </g>

      {/* spray and paint flakes live above the road */}
      <g>{spray.nodes}</g>

      {/* the rain, arriving once and then simply raining */}
      <g ref={rainRef} style={{ display: best >= 2 ? "" : "none" }}>
        {Array.from({ length: 26 }, (_, i) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: static rain streaks
            key={i}
            x={(i * 37) % (W + 24)}
            y={((i * 53) % 150) + 20}
            width={1}
            height={5}
            fill="#5b6572"
            opacity={0.35}
          />
        ))}
      </g>

      {/* --------------------------------------------------- inside the car */}
      {/* the windscreen's lower edge, the dash, and one honest instrument */}
      <rect x={0} y={162} width={W} height={H - 162} fill="#0b0d11" />
      {/* the windscreen's lower rubber, then the dash top catching the gauges */}
      <rect x={0} y={162} width={W} height={2} fill="#05070a" />
      <rect x={0} y={164} width={W} height={1} fill="#1b1f26" />
      <rect x={0} y={186} width={W} height={4} fill="#070910" />
      {/* the wiper, sweeping the glass above the dash */}
      <g ref={wiperRef} style={{ display: best >= 2 ? "" : "none" }}>
        {/* the blade, leaning back the way a wiper arm does */}
        <path
          d={pxPath([
            [40, 96, 2, 22],
            [41, 118, 2, 22],
            [42, 140, 2, 22],
          ])}
          fill="#0a0c10"
          opacity={0.9}
        />
        {/* the water it shoves ahead of itself */}
        <path d={pxPath([[43, 96, 3, 66]])} fill="#5b6572" opacity={0.12} />
        <rect x={40} y={158} width={7} height={4} fill="#14171d" />
      </g>
      {/* the binnacle: a bar that fills, a needle that never says a number */}
      <rect x={116} y={168} width={88} height={14} fill="#0c0e12" />
      <rect x={116} y={168} width={88} height={1} fill="#2b2f38" />
      <rect x={120} y={174} width={40} height={2} fill="#2a3038" />
      <rect x={160} y={174} width={20} height={2} fill="#6b5a2a" />
      <rect x={180} y={174} width={20} height={2} fill="#7a2a2a" />
      <g ref={needleRef} style={{ transition: "transform 120ms linear" }}>
        <rect x={120} y={170} width={2} height={10} fill="#ffca85" />
      </g>
      <PixelText x={122} y={177} text="" fill={M.linen.base} />
      {/* the vents, the radio, and the one warm light on the whole dash */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={222 + i * 7} y={170} width={5} height={9} fill="#0e1015" />
      ))}
      <rect x={40} y={170} width={44} height={10} fill="#0c0e12" />
      <rect x={43} y={173} width={16} height={4} fill="#2a7a58" opacity={0.5} />
      <rect x={62} y={174} width={18} height={2} fill="#1d2129" />
      <rect x={94} y={172} width={4} height={4} fill="#ffca85" opacity={0.8} />

      {phase === "intro" ? (
        <g>
          <rect x={82} y={30} width={158} height={54} fill="#0a0d14" opacity={0.9} />
          <rect x={82} y={30} width={158} height={1} fill="#2b2f38" />
          <PixelText x={90} y={37} text="OBWODNICA. NOC." fill={M.linen.base} />
          <PixelText x={90} y={47} text="W S - PASY RUCHU" fill={M.linen.lo} />
          <PixelText x={90} y={57} text="SHIFT - GAZ  SPACE - LUZ" fill={M.linen.lo} />
          <PixelText
            x={90}
            y={71}
            text={best >= 2 ? "[E] ZAPLON - JEDZIE DESZCZ" : "[E] ZAPLON"}
            fill="#ffca85"
          />
        </g>
      ) : null}
    </MinigameShell>
  );
}
