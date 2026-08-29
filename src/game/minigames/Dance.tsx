import i18n from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx } from "@/engine";
import {
  Bev,
  bevelPaths,
  dth,
  M,
  PixelText,
  pxPath,
  type Rect,
  steppedEllipse,
} from "@/engine/scene/pixelKit";
import { Juice, MinigameShell, makeParticlePool, tierOf } from "./kit";

/**
 * DANCE — the Turbina floor at 126 bpm, and the floor is the interface.
 *
 * There is no note highway and no meter. Half a beat before each kick the
 * floor lights a side; on the kick the whole crowd leans that way and you
 * take the step with A or D. On the peak, the DJ starts working the offbeat
 * and W joins in on the hats. Watching people instead of UI is the entire
 * skill, which is also how anyone learns to dance in a club.
 *
 * The crowd IS the score. Land steps and more of them turn to face you and
 * mirror the step; miss and they drift back to their own night. The barmaid
 * lifts a glass when it is going well, the bouncer looks over when it is
 * not, and none of it is ever a number.
 */

const W = 300;
const H = 190;

const BPM = 126;
const BEAT = 60000 / BPM;
const COUNT_IN = 4;

/** A step: which beat, which side, and whether it rides the offbeat (W). */
type Step = { beat: number; side: 0 | 1 | 2 };
const SIDE_L = 0;
const SIDE_R = 1;
const SIDE_UP = 2;

/** three sections: warm-up quarters, the main eighths, then the DJ's peak */
function buildSteps(fromPeak: boolean): Step[] {
  const out: Step[] = [];
  const add = (chart: string, from: number) => {
    for (let i = 0; i < chart.length; i++) {
      const c = chart[i];
      out.push({ beat: from + i, side: c === "L" ? SIDE_L : c === "R" ? SIDE_R : SIDE_UP });
    }
  };
  if (!fromPeak) {
    add("LRLRLLRR", 0); // warm-up: one step a beat, plenty of room
    add("LRLRLLRLRLRRLRLR", 8); // main: eighths, with honest doubles
  }
  // peak: the offbeat joins in — the hats are taken with W
  add("LRULRLURLRULRLURLRUL", fromPeak ? 0 : 24);
  return out;
}

const PERFECT_MS = 55;
const GOOD_MS = 150;
const PILLAR_L: Rect = [2, 26, 15, 116];
const PILLAR_R: Rect = [283, 26, 15, 116];
const MAGENTA = "#c34fa0";
const CYAN = "#3fa7b8";
const FLOOR_Y = 128;

/** the crowd, three depths; the mid row is who turns to face you */
const BACK_X = [40, 66, 92, 118, 146, 172, 198, 226, 252];
const MID_X = [52, 84, 116, 152, 186, 218, 248];

export function Dance({
  best = 0,
  onClose,
  onVerdict,
}: {
  /** Best tier ever reached: the DJ remembers, and starts you at the peak. */
  best?: number;
  onClose: () => void;
  onVerdict: (tier: 0 | 1 | 2) => void;
}) {
  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");
  const [verdict, setVerdict] = useState<string | null>(null);
  const stageRef = useRef<SVGGElement | null>(null);
  const crowdBackRef = useRef<SVGGElement | null>(null);
  const crowdMidRef = useRef<SVGGElement | null>(null);
  const facingRefs = useRef<(SVGGElement | null)[]>([]);
  const dancerRef = useRef<SVGGElement | null>(null);
  const dancerArmsRef = useRef<SVGGElement | null>(null);
  const strobeRef = useRef<SVGRectElement | null>(null);
  const beamLRef = useRef<SVGGElement | null>(null);
  const beamRRef = useRef<SVGGElement | null>(null);
  const laserRef = useRef<SVGGElement | null>(null);
  const cueLRef = useRef<SVGGElement | null>(null);
  const cueRRef = useRef<SVGGElement | null>(null);
  const cueUpRef = useRef<SVGGElement | null>(null);
  const djRef = useRef<SVGGElement | null>(null);
  const stackLRef = useRef<SVGGElement | null>(null);
  const stackRRef = useRef<SVGGElement | null>(null);
  const ballRef = useRef<SVGGElement | null>(null);
  const barmaidRef = useRef<SVGGElement | null>(null);
  const bouncerRef = useRef<SVGGElement | null>(null);
  const juice = useRef(new Juice()).current;
  const smoke = useRef(makeParticlePool(44)).current;
  const steps = useRef(buildSteps(best >= 2)).current;
  const st = useRef({
    start: 0,
    last: 0,
    lastBeat: -1,
    lastCue: -1,
    hit: new Array(steps.length).fill(false) as boolean[],
    missed: new Array(steps.length).fill(false) as boolean[],
    hits: 0,
    streak: 0,
    facing: 0,
    done: false,
  });
  const endBeat = steps[steps.length - 1].beat + COUNT_IN + 3;

  /** How many of the mid row have turned to face you — the crowd as the meter. */
  const setFacing = useCallback((n: number) => {
    const s = st.current;
    const want = Math.max(0, Math.min(MID_X.length, n));
    if (want === s.facing) return;
    s.facing = want;
    facingRefs.current.forEach((el, i) => {
      if (el) el.style.display = i < want ? "" : "none";
    });
    if (barmaidRef.current) barmaidRef.current.style.display = want >= 5 ? "" : "none";
    if (bouncerRef.current) bouncerRef.current.style.display = want === 0 ? "" : "none";
  }, []);

  /* the loop */
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const s = st.current;
    s.start = s.last = performance.now();
    const lean = (el: SVGGElement | null, side: number, px: number) => {
      if (!el) return;
      el.style.transform =
        side === SIDE_UP
          ? `translateY(${-px}px)`
          : `translate(${side === SIDE_L ? -px : px}px, ${px > 2 ? 1 : 0}px)`;
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const { frozen, dx, dy } = juice.sample(now, now - s.start);
      if (stageRef.current) stageRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      const dtMs = now - s.last;
      s.last = now;
      if (frozen) return;
      const t = now - s.start;
      smoke.update(now, dtMs / 1000);

      /* the cue lights half a beat early, on the side the floor will take */
      const half = Math.floor((t - BEAT / 2) / BEAT) - COUNT_IN + 1;
      if (half !== s.lastCue) {
        s.lastCue = half;
        const next = steps.find((x) => x.beat === half);
        if (cueLRef.current) cueLRef.current.style.opacity = next?.side === SIDE_L ? "1" : "0";
        if (cueRRef.current) cueRRef.current.style.opacity = next?.side === SIDE_R ? "1" : "0";
        if (cueUpRef.current) cueUpRef.current.style.opacity = next?.side === SIDE_UP ? "1" : "0";
      }

      const beat = Math.floor(t / BEAT);
      if (beat !== s.lastBeat) {
        s.lastBeat = beat;
        playSfx("kick");
        if (beat % 2 === 1) playSfx("hat");
        /* the stacks pump, the ball turns, the beams trade sides */
        const pump = beat % 2 ? 1 : 0;
        if (stackLRef.current) stackLRef.current.style.transform = `translateY(${pump}px)`;
        if (stackRRef.current) stackRRef.current.style.transform = `translateY(${1 - pump}px)`;
        if (ballRef.current) ballRef.current.style.transform = `translateX(${pump ? 1 : -1}px)`;
        if (beamLRef.current) beamLRef.current.style.opacity = beat % 2 ? "0.4" : "0.85";
        if (beamRRef.current) beamRRef.current.style.opacity = beat % 2 ? "0.85" : "0.4";
        /* the DJ works, one hand then the other */
        if (djRef.current) djRef.current.style.transform = `translateX(${pump ? 1 : -1}px)`;
        /* smoke rolls off the risers, caught in whichever beam is up */
        smoke.spawn({
          x: beat % 2 ? 58 : 232,
          y: FLOOR_Y - 4,
          vx: beat % 2 ? 5 : -5,
          vy: -9,
          life: 2400,
          color: beat % 2 ? MAGENTA : CYAN,
          size: 2,
          gravity: -3,
        });
        /* a laser sweep on the bar line */
        if (beat % 4 === 0 && laserRef.current) {
          const el = laserRef.current;
          el.style.opacity = "0.5";
          el.style.transform = `translateX(${beat % 8 === 0 ? -16 : 16}px)`;
          window.setTimeout(() => {
            if (el) el.style.opacity = "0";
          }, 260);
        }

        const idx = beat - COUNT_IN;
        const now2 = steps.find((x) => x.beat === idx);
        if (now2) {
          lean(crowdMidRef.current, now2.side, 3);
          lean(crowdBackRef.current, now2.side, 2);
        } else if (idx < 0) {
          if (crowdMidRef.current)
            crowdMidRef.current.style.transform = `translateY(${beat % 2}px)`;
          if (crowdBackRef.current)
            crowdBackRef.current.style.transform = `translateY(${(beat + 1) % 2}px)`;
        }

        if (beat >= endBeat && !s.done) {
          s.done = true;
          const ratio = s.hits / steps.length;
          const tier = tierOf(ratio);
          if (dancerArmsRef.current && tier === 2) dancerArmsRef.current.style.display = "";
          const line =
            tier === 2
              ? i18n.t("minigame.verdict.dance.best")
              : tier === 1
                ? i18n.t("minigame.verdict.dance.mid")
                : i18n.t("minigame.verdict.dance.low");
          setVerdict(line);
          setPhase("done");
          window.setTimeout(() => {
            onVerdict(tier);
            onClose();
          }, 3000);
        }
      }

      /* a step whose window closed unclaimed: the dancer drops, the crowd cools */
      for (let i = 0; i < steps.length; i++) {
        if (s.hit[i] || s.missed[i]) continue;
        if (t > (steps[i].beat + COUNT_IN) * BEAT + GOOD_MS) {
          s.missed[i] = true;
          s.streak = 0;
          setFacing(s.facing - 2);
          const d = dancerRef.current;
          if (d) {
            d.style.transform = "translateY(2px)";
            window.setTimeout(() => {
              if (d) d.style.transform = "translateY(0)";
            }, 140);
          }
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, juice, smoke, steps, endBeat, setFacing, onClose, onVerdict]);

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
          ? SIDE_L
          : e.code === "KeyD" || e.code === "ArrowRight"
            ? SIDE_R
            : e.code === "KeyW" || e.code === "ArrowUp"
              ? SIDE_UP
              : -1;
      if (side < 0) return;
      const s = st.current;
      const t = performance.now() - s.start;
      let bestI = -1;
      let bestD = GOOD_MS + 1;
      for (let i = 0; i < steps.length; i++) {
        if (steps[i].side !== side || s.hit[i] || s.missed[i]) continue;
        const d = Math.abs(t - (steps[i].beat + COUNT_IN) * BEAT);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
      /* he moves whether or not it counted — the body commits either way */
      const d = dancerRef.current;
      if (d) {
        d.style.transform =
          side === SIDE_UP ? "translateY(-3px)" : `translateX(${side === SIDE_L ? -3 : 3}px)`;
        window.setTimeout(() => {
          if (d) d.style.transform = "translate(0,0)";
        }, 150);
      }
      if (bestI < 0) {
        s.streak = 0;
        setFacing(s.facing - 1);
        return;
      }
      s.hit[bestI] = true;
      s.hits++;
      s.streak++;
      const perfect = bestD <= PERFECT_MS;
      const strobe = strobeRef.current;
      if (strobe) {
        strobe.style.opacity = perfect ? "0.2" : "0.1";
        window.setTimeout(
          () => {
            if (strobe) strobe.style.opacity = "0";
          },
          perfect ? 70 : 50,
        );
      }
      if (perfect) {
        juice.hitStop(40);
        juice.shake(1, 80);
        /* the floor throws grit up around his shoes */
        for (let k = 0; k < 5; k++) {
          smoke.spawn({
            x: 150 + (k - 2) * 3,
            y: FLOOR_Y + 22,
            vx: (k - 2) * 9,
            vy: -16,
            life: 380,
            color: k % 2 ? MAGENTA : CYAN,
            size: 1,
            gravity: 110,
          });
        }
      }
      if (s.streak % 3 === 0) setFacing(s.facing + 1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase, juice, smoke, steps, setFacing]);

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

  /* quantized pools in the beams' own colors — tiers() has no magenta */
  const pool = (cx: number, ink: string) =>
    [1, 0.72, 0.45].map((f, i) => (
      <path
        key={f}
        d={pxPath(steppedEllipse(cx, FLOOR_Y + 6, Math.round(56 * f), Math.round(16 * f), 3))}
        fill={ink}
        opacity={0.07 + i * 0.045}
      />
    ));

  return (
    <MinigameShell
      w={W}
      h={H}
      bg="#0b0a10"
      stageRef={stageRef}
      verdict={verdict}
      hint={phase === "done" ? "" : i18n.t("minigame.dance")}
    >
      {/* the hall: brick to the arches, the old turbine windows blacked out */}
      <rect x={0} y={0} width={W} height={FLOOR_Y} fill="#0d0c13" />
      <path
        d={pxPath([
          [34, 10, 232, 3],
          [34, 10, 3, 34],
          [263, 10, 3, 34],
          [86, 10, 3, 34],
          [140, 10, 3, 34],
          [194, 10, 3, 34],
          [34, 26, 232, 2],
        ])}
        fill="#14131c"
      />
      <rect x={0} y={FLOOR_Y - 3} width={W} height={3} fill="#07060a" />
      {/* the floor: dark checker, dithered, catching the beams */}
      <rect x={0} y={FLOOR_Y} width={W} height={H - FLOOR_Y} fill="#100e15" />
      {Array.from({ length: 15 }, (_, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: static checker tiles
          key={i}
          x={i * 20 + (i % 2 ? 0 : 10)}
          y={FLOOR_Y + (i % 2 ? 0 : 10)}
          width={10}
          height={10}
          fill="#1b1726"
        />
      ))}
      <rect width={W} height={H} fill={dth("n", "25")} />

      {/* the truss, the cable tray, the mirror ball hung dead centre */}
      <rect x={24} y={4} width={252} height={4} fill={M.steel.lo} />
      <rect x={24} y={4} width={252} height={1} fill={M.steel.base} />
      {[60, 150, 240].map((x) => (
        <rect key={x} x={x} y={0} width={2} height={4} fill={M.steel.lo} />
      ))}
      <g ref={ballRef} style={{ transition: "transform 90ms steps(2, end)" }}>
        <rect x={149} y={8} width={2} height={5} fill={M.steel.deep} />
        <path d={pxPath(steppedEllipse(150, 18, 6, 6, 2))} fill={M.steel.lo} />
        <path
          d={pxPath([
            [147, 13, 3, 2],
            [152, 15, 2, 2],
            [146, 18, 2, 2],
            [151, 19, 3, 2],
          ])}
          fill={M.steel.hi}
        />
      </g>
      {[
        [96, 42],
        [124, 32],
        [178, 36],
        [206, 46],
        [140, 54],
        [164, 60],
      ].map(([fx, fy], i) => (
        <rect
          key={`${fx}:${fy}`}
          x={fx}
          y={fy}
          width={2}
          height={2}
          fill={i % 2 ? CYAN : MAGENTA}
          opacity={0.5}
        />
      ))}

      {/* the beams: two quantized fans that trade sides with the kick */}
      <g ref={beamLRef} style={{ transition: "opacity 90ms steps(2, end)" }}>
        <path
          d={pxPath([
            [57, 6, 5, 6],
            [54, 12, 11, 18],
            [49, 30, 21, 22],
            [43, 52, 33, 26],
            [36, 78, 47, 26],
            [28, 104, 63, 24],
          ])}
          fill={MAGENTA}
          opacity={0.2}
        />
        {pool(58, MAGENTA)}
      </g>
      <g ref={beamRRef} style={{ transition: "opacity 90ms steps(2, end)" }}>
        <path
          d={pxPath([
            [238, 6, 5, 6],
            [235, 12, 11, 18],
            [230, 30, 21, 22],
            [224, 52, 33, 26],
            [217, 78, 47, 26],
            [209, 104, 63, 24],
          ])}
          fill={CYAN}
          opacity={0.2}
        />
        {pool(236, CYAN)}
      </g>
      {/* the laser: a thin quantized sweep across the heads on every bar */}
      <g
        ref={laserRef}
        style={{
          opacity: 0,
          transition: "opacity 120ms steps(2, end), transform 240ms steps(4, end)",
        }}
      >
        <rect x={30} y={64} width={240} height={1} fill="#7ef2c9" />
        <rect x={30} y={65} width={240} height={1} fill="#7ef2c9" opacity={0.4} />
      </g>

      {/* the DJ on the riser, behind everyone, working */}
      <rect x={116} y={92} width={68} height={12} fill={M.graphite.lo} />
      <rect x={116} y={92} width={68} height={1} fill={M.graphite.hi} />
      <rect x={118} y={104} width={64} height={8} fill={M.graphite.deep} />
      <g ref={djRef} style={{ transition: "transform 90ms steps(2, end)" }}>
        <path
          d={pxPath([
            [146, 74, 8, 6],
            [142, 80, 16, 12],
          ])}
          fill="#171622"
        />
        <path d={pxPath([[146, 74, 8, 1]])} fill={CYAN} opacity={0.7} />
        {/* the cans, and the hand on the platter */}
        <path
          d={pxPath([
            [144, 75, 2, 3],
            [154, 75, 2, 3],
          ])}
          fill={M.steel.lo}
        />
        <rect x={138} y={88} width={5} height={3} fill="#2a2836" />
        <rect x={157} y={88} width={5} height={3} fill="#2a2836" />
      </g>
      {/* the decks: two platters and the mixer between them */}
      <path d={pxPath(steppedEllipse(130, 96, 8, 4, 2))} fill="#1d1b26" />
      <path d={pxPath(steppedEllipse(170, 96, 8, 4, 2))} fill="#1d1b26" />
      <rect x={146} y={93} width={8} height={6} fill="#22202c" />
      <rect x={147} y={94} width={2} height={1} fill="#7ef2c9" opacity={0.8} />
      <rect x={151} y={94} width={2} height={1} fill={MAGENTA} opacity={0.8} />

      {/* the speaker stacks, pumping on the kick */}
      <g ref={stackLRef} style={{ transition: "transform 70ms steps(2, end)" }}>
        <rect x={30} y={78} width={26} height={50} fill="#15141c" />
        <Bev set={bevelPaths([[30, 78, 26, 50] as Rect])} mat={M.graphite} />
        {[0, 1, 2].map((i) => (
          <path key={i} d={pxPath(steppedEllipse(43, 90 + i * 15, 8, 8, 2))} fill="#0b0a0f" />
        ))}
      </g>
      <g ref={stackRRef} style={{ transition: "transform 70ms steps(2, end)" }}>
        <rect x={244} y={78} width={26} height={50} fill="#15141c" />
        <Bev set={bevelPaths([[244, 78, 26, 50] as Rect])} mat={M.graphite} />
        {[0, 1, 2].map((i) => (
          <path key={i} d={pxPath(steppedEllipse(257, 90 + i * 15, 8, 8, 2))} fill="#0b0a0f" />
        ))}
      </g>

      {/* the bar at the left edge: the barmaid lifts a glass when it goes well */}
      <g ref={barmaidRef} style={{ display: "none" }}>
        <path
          d={pxPath([
            [8, 84, 7, 5],
            [6, 89, 11, 14],
          ])}
          fill="#1a1824"
        />
        <path d={pxPath([[8, 84, 7, 1]])} fill={MAGENTA} opacity={0.6} />
        <rect x={17} y={82} width={3} height={5} fill="#d8d3c5" opacity={0.7} />
      </g>
      {/* the bouncer, who only appears in your eyeline when you deserve it */}
      <g ref={bouncerRef}>
        <path
          d={pxPath([
            [282, 78, 9, 6],
            [279, 84, 15, 20],
          ])}
          fill="#141320"
        />
        <path d={pxPath([[282, 78, 9, 1]])} fill={CYAN} opacity={0.5} />
        <rect x={279} y={104} width={15} height={2} fill="#0a0910" />
      </g>

      {/* concrete pillars, bevel-lit, holding the hall up since 1912 */}
      {[PILLAR_L, PILLAR_R].map((P) => (
        <g key={P[0]}>
          <rect x={P[0]} y={P[1]} width={P[2]} height={P[3]} fill={M.graphite.lo} />
          <Bev set={bevelPaths([P])} mat={M.graphite} />
          <rect
            x={P[0]}
            y={P[1] + 26}
            width={P[2]}
            height={2}
            fill={M.graphite.deep}
            opacity={0.8}
          />
          <rect x={P[0] - 2} y={P[1] + P[3]} width={P[2] + 4} height={4} fill={M.graphite.deep} />
          <rect
            x={P[0]}
            y={P[1]}
            width={2}
            height={P[3]}
            fill={P[0] < 100 ? MAGENTA : CYAN}
            opacity={0.25}
          />
        </g>
      ))}

      {/* the crowd: three depths, rim-lit by whichever beam is up */}
      <g ref={crowdBackRef} style={{ transition: "transform 110ms steps(2, end)" }}>
        {BACK_X.map((x, i) => figure(x, 78 - (i % 2) * 3, 34, "#08070c"))}
      </g>
      <g ref={crowdMidRef} style={{ transition: "transform 100ms steps(2, end)" }}>
        {MID_X.map((x, i) => (
          <g key={x}>
            {figure(x, 92 - (i % 2) * 2, 38, "#0d0b12", i % 2 ? MAGENTA : CYAN)}
            {/* the same person, turned to face you — shown as the room warms */}
            <g
              ref={(el) => {
                facingRefs.current[i] = el;
              }}
              style={{ display: "none" }}
            >
              <path
                d={pxPath([
                  [x + 1, 90 - (i % 2) * 2, 7, 5],
                  [x - 2, 95 - (i % 2) * 2, 13, 4],
                  [x - 3, 99 - (i % 2) * 2, 15, 31],
                ])}
                fill="#13111a"
              />
              <path d={pxPath([[x + 1, 90 - (i % 2) * 2, 7, 1]])} fill={i % 2 ? MAGENTA : CYAN} />
              {/* two eyes' worth of attention, which is the whole reward */}
              <rect
                x={x + 2}
                y={92 - (i % 2) * 2}
                width={1}
                height={1}
                fill="#e8e4f0"
                opacity={0.5}
              />
              <rect
                x={x + 6}
                y={92 - (i % 2) * 2}
                width={1}
                height={1}
                fill="#e8e4f0"
                opacity={0.5}
              />
            </g>
          </g>
        ))}
      </g>

      {/* the step cues, painted on the floor where he can see them */}
      <g ref={cueLRef} style={{ opacity: 0, transition: "opacity 60ms steps(2, end)" }}>
        <path
          d={pxPath([
            [104, FLOOR_Y + 14, 4, 8],
            [108, FLOOR_Y + 12, 4, 12],
            [112, FLOOR_Y + 10, 4, 16],
          ])}
          fill={MAGENTA}
          opacity={0.85}
        />
        <PixelText x={104} y={FLOOR_Y + 30} text="A" fill={MAGENTA} />
      </g>
      <g ref={cueRRef} style={{ opacity: 0, transition: "opacity 60ms steps(2, end)" }}>
        <path
          d={pxPath([
            [184, FLOOR_Y + 10, 4, 16],
            [188, FLOOR_Y + 12, 4, 12],
            [192, FLOOR_Y + 14, 4, 8],
          ])}
          fill={CYAN}
          opacity={0.85}
        />
        <PixelText x={190} y={FLOOR_Y + 30} text="D" fill={CYAN} />
      </g>
      <g ref={cueUpRef} style={{ opacity: 0, transition: "opacity 60ms steps(2, end)" }}>
        <path
          d={pxPath([
            [146, FLOOR_Y + 8, 8, 4],
            [148, FLOOR_Y + 12, 4, 10],
          ])}
          fill="#7ef2c9"
          opacity={0.85}
        />
        <PixelText x={147} y={FLOOR_Y + 30} text="W" fill="#7ef2c9" />
      </g>

      {/* our man, nearest the eye and lit like it — the only face in focus */}
      <g ref={dancerRef} style={{ transition: "transform 90ms steps(2, end)" }}>
        {/* his shadow, stepped, thrown onto the checker */}
        <path
          d={pxPath([
            [132, FLOOR_Y + 30, 34, 4],
            [138, FLOOR_Y + 34, 24, 3],
          ])}
          fill="#050408"
          opacity={0.75}
        />
        {/* legs and the white shoes, the only bright thing he owns */}
        <path
          d={pxPath([
            [140, 132, 8, 20],
            [152, 132, 8, 20],
          ])}
          fill="#1a2230"
        />
        <path
          d={pxPath([
            [140, 132, 8, 1],
            [152, 132, 8, 1],
          ])}
          fill="#27313f"
        />
        <rect x={137} y={152} width={12} height={4} fill="#ddd8ca" />
        <rect x={151} y={152} width={12} height={4} fill="#ddd8ca" />
        <rect x={137} y={152} width={12} height={1} fill="#f4f0e4" />
        <rect x={151} y={152} width={12} height={1} fill="#f4f0e4" />
        {/* the jacket: graphite, so the beams have something to land on */}
        <path
          d={pxPath([
            [138, 108, 24, 26],
            [135, 112, 30, 18],
          ])}
          fill="#39414f"
        />
        <path d={pxPath([[138, 108, 24, 2]])} fill="#4d5768" />
        <path d={pxPath([[135, 128, 30, 3]])} fill="#232935" />
        {/* the beams' rims, one down each shoulder */}
        <path d={pxPath([[135, 112, 3, 17]])} fill={MAGENTA} opacity={0.55} />
        <path d={pxPath([[162, 112, 3, 17]])} fill={CYAN} opacity={0.55} />
        {/* the head: a face, turned to the floor, catching the ball's light */}
        <path d={pxPath([[143, 96, 14, 12]])} fill="#8a6a4e" />
        <path d={pxPath([[143, 96, 14, 3]])} fill="#40332a" />
        <rect x={146} y={101} width={2} height={2} fill="#14100c" />
        <rect x={152} y={101} width={2} height={2} fill="#14100c" />
        <path d={pxPath([[145, 105, 10, 1]])} fill="#5f4636" />
        <path d={pxPath([[143, 96, 14, 1]])} fill="#c9b79c" opacity={0.5} />
        {/* both arms up: only at the end, only if the floor was his */}
        <g ref={dancerArmsRef} style={{ display: "none" }}>
          <path
            d={pxPath([
              [126, 92, 6, 22],
              [168, 92, 6, 22],
            ])}
            fill="#39414f"
          />
          <path
            d={pxPath([
              [126, 92, 6, 2],
              [168, 92, 6, 2],
            ])}
            fill="#8a6a4e"
          />
          <path
            d={pxPath([
              [126, 92, 6, 1],
              [168, 92, 6, 1],
            ])}
            fill={MAGENTA}
            opacity={0.6}
          />
        </g>
      </g>

      {/* smoke and grit ride above the floor */}
      <g>{smoke.nodes}</g>

      {/* the strobe: one frame of white when a step lands */}
      <rect
        ref={strobeRef}
        width={W}
        height={H}
        fill="#e8e4f0"
        style={{ opacity: 0, transition: "opacity 40ms steps(1, end)" }}
      />

      {phase === "intro" ? (
        <g>
          <rect x={78} y={44} width={144} height={50} fill="#0b0a10" opacity={0.88} />
          <rect x={78} y={44} width={144} height={1} fill="#2a2836" />
          <PixelText x={86} y={51} text="IDZ ZA PARKIETEM" fill={M.linen.base} />
          <PixelText x={86} y={61} text="A - LEWO   D - PRAWO" fill={M.linen.lo} />
          <PixelText x={86} y={71} text="W - OFFBEAT NA SZCZYCIE" fill={M.linen.lo} />
          <PixelText
            x={86}
            y={85}
            text={best >= 2 ? "[E] OD RAZU SZCZYT" : "[E] NA PARKIET"}
            fill={MAGENTA}
          />
        </g>
      ) : null}
    </MinigameShell>
  );
}
