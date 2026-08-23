import { useCallback, useEffect, useRef, useState } from "react";
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
  steppedEllipse,
  tiers,
} from "@/engine/scene/pixelKit";
import { Juice, MinigameShell, makeParticlePool, tierOf } from "./kit";

/**
 * GUITAR — the studio corner at lamplight, the whole room listening.
 *
 * Chord marks drift to a brass strike line; A/S/D/F meets them. The sfx
 * engine walks an Am–F–C–G loop one strum at a time, so playing in time
 * assembles the song — and the room answers: the lamp warms with a streak,
 * Gross's ears keep the score more honestly than any counter, rain keeps
 * time on the window, and a perfect strum stops the world for a breath.
 *
 * The song has three sections. If the verse goes well, the chorus leans in
 * and offers more — difficulty that arrives as generosity, not punishment.
 */

const W = 300;
const H = 190;

/** the room reads in depth planes: wall, floor, then the lap nearest the eye */
const FLOOR_Y = 106;
const LANE_Y = 18;
const STRIKE_X = 74;
const BODY_X = 62;
const BODY_Y = 148;
const NECK: Rect = [104, 142, 132, 13];
const HEAD: Rect = [236, 139, 24, 19];
const KEYS = ["A", "S", "D", "F"] as const;
const KEY_CODES = ["KeyA", "KeyS", "KeyD", "KeyF"] as const;
const CHORDS = ["AM", "F", "C", "G"] as const;

type Mark = { at: number; lane: number; extra?: boolean };

/** intro breathes, the verse walks, the chorus doubles up */
const SONG: readonly Mark[] = [
  // intro — one strum per bar, finding the hands
  { at: 1400, lane: 0 },
  { at: 2040, lane: 1 },
  { at: 2680, lane: 2 },
  { at: 3320, lane: 1 },
  // verse — steady eighths
  { at: 3960, lane: 0 },
  { at: 4280, lane: 1 },
  { at: 4600, lane: 2 },
  { at: 4920, lane: 3 },
  { at: 5240, lane: 0 },
  { at: 5560, lane: 1 },
  { at: 5880, lane: 2 },
  { at: 6200, lane: 1 },
  { at: 6520, lane: 0 },
  { at: 6840, lane: 2 },
  { at: 7160, lane: 3 },
  { at: 7480, lane: 1 },
  // chorus — pairs, with the lean-in extras hidden until earned
  { at: 8120, lane: 0 },
  { at: 8280, lane: 0, extra: true },
  { at: 8760, lane: 1 },
  { at: 8920, lane: 1, extra: true },
  { at: 9400, lane: 2 },
  { at: 9560, lane: 2, extra: true },
  { at: 10040, lane: 3 },
  { at: 10200, lane: 3, extra: true },
  { at: 10680, lane: 0 },
  { at: 11000, lane: 2 },
  { at: 11320, lane: 1 },
  { at: 11640, lane: 3 },
  { at: 12280, lane: 0 },
  { at: 12600, lane: 1 },
  { at: 12920, lane: 2 },
] as const;
const SPEED = 0.055;
const GOOD_MS = 150;
const PERFECT_MS = 60;
const CHORUS_AT = 8000;
const END_AT = 13800;

export function Guitar({
  best = 0,
  onClose,
  onVerdict,
}: {
  /** Best tier ever reached here: the room remembers, and the song grows. */
  best?: number;
  onClose: () => void;
  onVerdict: (tier: 0 | 1 | 2) => void;
}) {
  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");
  const [verdict, setVerdict] = useState<string | null>(null);
  const stageRef = useRef<SVGGElement | null>(null);
  const laneRef = useRef<SVGGElement | null>(null);
  const plectrumRef = useRef<SVGGElement | null>(null);
  const stringsRef = useRef<SVGGElement | null>(null);
  const lampGlowRef = useRef<SVGGElement | null>(null);
  const chordRef = useRef<SVGGElement | null>(null);
  const chordTextRefs = useRef<(SVGGElement | null)[]>([]);
  const earsUpRef = useRef<SVGGElement | null>(null);
  const earsDownRef = useRef<SVGGElement | null>(null);
  const headUpRef = useRef<SVGGElement | null>(null);
  const rainRef = useRef<SVGGElement | null>(null);
  const noteRefs = useRef<(SVGGElement | null)[]>([]);
  const juice = useRef(new Juice()).current;
  const sparks = useRef(makeParticlePool(40)).current;
  const st = useRef({
    start: 0,
    last: 0,
    t: 0,
    hit: new Array(SONG.length).fill(false) as boolean[],
    gone: new Array(SONG.length).fill(false) as boolean[],
    hits: 0,
    /* mastery: once the song has gone perfectly, it never holds back again */
    offered: best >= 2 ? SONG.length : SONG.filter((m) => !m.extra).length,
    strums: 0,
    streak: 0,
    leanIn: best >= 2,
    leanDecided: best >= 2,
    steamAt: 0,
    done: false,
  });

  /** The dog's ears are the scoreboard; refs only, so the identity is stable. */
  const setEars = useCallback((up: boolean) => {
    if (earsUpRef.current) earsUpRef.current.style.display = up ? "" : "none";
    if (earsDownRef.current) earsDownRef.current.style.display = up ? "none" : "";
  }, []);

  /* the loop */
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const s = st.current;
    s.start = s.last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const { frozen, dx, dy } = juice.sample(now, now - s.start);
      if (stageRef.current) stageRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      const dtMs = now - s.last;
      s.last = now;
      if (frozen) return; // hit-stop: the world holds its breath
      s.t += dtMs;
      const t = s.t;
      const dt = dtMs / 1000;

      if (laneRef.current) laneRef.current.style.transform = `translateX(${-t * SPEED}px)`;
      if (rainRef.current) rainRef.current.style.transform = `translateY(${(t * 0.045) % 26}px)`;
      sparks.update(now, dt);

      /* tea steam, one lazy puff a second */
      if (t > s.steamAt) {
        s.steamAt = t + 900;
        sparks.spawn({
          x: 34,
          y: 118,
          vx: 2,
          vy: -7,
          life: 2100,
          color: "#8d8676",
          size: 1,
          gravity: -2,
        });
      }

      /* the chorus decides whether to lean in */
      if (!s.leanDecided && t >= CHORUS_AT - 400) {
        s.leanDecided = true;
        const soFar = SONG.filter((m, i) => !m.extra && m.at < CHORUS_AT - 400 && s.hit[i]).length;
        const offered = SONG.filter((m) => !m.extra && m.at < CHORUS_AT - 400).length;
        if (soFar / offered >= 0.75) {
          s.leanIn = true;
          s.offered = SONG.length;
          SONG.forEach((m, i) => {
            const el = noteRefs.current[i];
            if (m.extra && el) el.style.display = "";
          });
        }
      }

      /* marks that sailed past unhit go quiet; the dog notices */
      SONG.forEach((m, i) => {
        if (s.gone[i] || s.hit[i]) return;
        if (m.extra && !s.leanIn) return;
        if (t > m.at + GOOD_MS) {
          s.gone[i] = true;
          s.streak = 0;
          const el = noteRefs.current[i];
          if (el) el.style.opacity = "0.22";
          setEars(false);
          if (lampGlowRef.current) lampGlowRef.current.style.opacity = "0.55";
        }
      });

      if (t > END_AT && !s.done) {
        s.done = true;
        playSfx("guitarEnd");
        if (headUpRef.current) headUpRef.current.style.display = "";
        const ratio = s.hits / s.offered;
        const tier = tierOf(ratio);
        const line =
          tier === 2
            ? s.leanIn
              ? "Пісня сама попросила ще. Сусіди не стукали — це овації. Gross підняв голову."
              : "Сусіди не стукали. Це овації."
            : tier === 1
              ? "Prawie melodia. Prawie — це вже щось. Gross ворухнув вухом."
              : "The E string files a complaint. Gross удає, що спить.";
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
  }, [phase, juice, sparks, setEars, onClose, onVerdict]);

  /* strums */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") return;
      e.stopPropagation();
      if (phase === "intro" && (e.code === "KeyE" || e.code === "Enter" || e.code === "Space")) {
        setPhase("playing");
        return;
      }
      if (phase !== "playing" || e.repeat) return;
      const lane = KEY_CODES.indexOf(e.code as (typeof KEY_CODES)[number]);
      if (lane < 0) return;
      const s = st.current;
      const t = s.t;
      s.strums++;
      const pl = plectrumRef.current;
      if (pl) {
        pl.style.transform = "translateY(5px)";
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
      let best = -1;
      let bestD = GOOD_MS + 1;
      SONG.forEach((m, i) => {
        if (m.lane !== lane || s.hit[i] || s.gone[i]) return;
        if (m.extra && !s.leanIn) return;
        const d = Math.abs(t - m.at);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best < 0) {
        playSfx("thud");
        s.streak = 0;
        setEars(false);
        return;
      }
      s.hit[best] = true;
      s.hits++;
      s.streak++;
      playSfx("guitar"); // the loop advances: rhythm assembles the song
      const el = noteRefs.current[best];
      if (el) el.style.opacity = "0";
      const perfect = bestD <= PERFECT_MS;
      /* the chord name lands at the strike line */
      if (chordRef.current) {
        const which = (s.hits - 1) % 4;
        chordTextRefs.current.forEach((el, i) => {
          if (el) el.style.display = i === which ? "" : "none";
        });
        chordRef.current.style.opacity = "1";
        chordRef.current.style.transform = perfect ? "translateY(-2px)" : "translateY(0)";
        window.setTimeout(
          () => {
            if (chordRef.current) chordRef.current.style.opacity = "0";
          },
          perfect ? 520 : 360,
        );
      }
      /* sparks off the strings; more of them when the strum is dead on */
      const n = perfect ? 7 : 3;
      for (let k = 0; k < n; k++) {
        sparks.spawn({
          x: STRIKE_X + 4,
          y: 100,
          vx: 8 + k * 6 * (k % 2 ? 1 : -0.4),
          vy: -22 - k * 5,
          life: 420 + k * 60,
          color: k % 2 ? "#ffca85" : "#f2d86a",
          size: perfect ? 2 : 1,
          gravity: 90,
        });
      }
      if (perfect) {
        juice.hitStop(45);
        juice.shake(1, 70);
      }
      if (s.streak >= 6) {
        setEars(true);
        if (lampGlowRef.current) lampGlowRef.current.style.opacity = "1";
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase, juice, sparks, setEars]);

  const lamp = tiers(
    (s) => steppedEllipse(104, 128, Math.round(64 * s), Math.round(17 * s), 3),
    "w",
    0.75,
  );

  return (
    <MinigameShell
      w={W}
      h={H}
      bg="#14110d"
      stageRef={stageRef}
      verdict={verdict}
      hint={phase === "done" ? "" : "a s d f струни · esc відкласти гітару"}
    >
      {/* -------------------------------------------------- wall, then floor */}
      <rect x={0} y={0} width={W} height={FLOOR_Y} fill="#171410" />
      <rect x={0} y={FLOOR_Y - 3} width={W} height={3} fill="#0d0b08" />
      <rect x={0} y={FLOOR_Y} width={W} height={H - FLOOR_Y} fill="#110e0a" />
      {[54, 118, 182, 246].map((x) => (
        <rect
          key={x}
          x={x}
          y={FLOOR_Y}
          width={1}
          height={H - FLOOR_Y}
          fill="#080604"
          opacity={0.55}
        />
      ))}
      {/* the room's grain, on the bare surfaces only — never over the props */}
      <rect width={W} height={H} fill={dth("n", "25")} />
      {/* the wall's damp patch, because this building has always had one */}
      <path
        d={pxPath([
          [150, 40, 34, 12],
          [158, 52, 22, 6],
        ])}
        fill="#1c1712"
        opacity={0.7}
      />

      {/* the window: night, rain keeping time, the frame catching the lamp */}
      <rect x={230} y={34} width={58} height={48} fill="#0a0e16" />
      <g style={{ overflow: "hidden" }}>
        <g ref={rainRef}>
          {[236, 245, 254, 263, 272, 281].map((x, i) => (
            <g key={x}>
              <rect x={x} y={36 + i * 8} width={1} height={6} fill="#3b4552" opacity={0.85} />
              <rect x={x + 3} y={30 + i * 10} width={1} height={5} fill="#2c343d" opacity={0.7} />
            </g>
          ))}
        </g>
      </g>
      <path
        d={pxPath([
          [228, 32, 62, 2],
          [228, 80, 62, 3],
          [228, 32, 2, 51],
          [288, 32, 2, 51],
          [257, 32, 2, 48],
        ])}
        fill={M.wood.lo}
      />
      <rect x={228} y={32} width={62} height={1} fill={M.wood.base} />
      <rect x={226} y={83} width={66} height={2} fill={M.wood.base} />
      <AO x={228} y={85} w={62} op={0.5} />

      {/* the radiator under the sill, ribbed, honest */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={232 + i * 8} y={88} width={6} height={16} fill={M.steel.lo} />
      ))}
      <rect x={232} y={88} width={54} height={1} fill={M.steel.base} />
      <rect x={231} y={104} width={56} height={2} fill={M.steel.deep} />

      {/* the poster nobody has straightened since the move */}
      <path d={pxPath([[104, 30, 34, 44]])} fill="#241f18" />
      <path
        d={pxPath([
          [104, 30, 34, 1],
          [104, 30, 1, 44],
        ])}
        fill="#372f24"
      />
      <path
        d={pxPath([
          [110, 38, 22, 2],
          [110, 44, 16, 1],
          [110, 62, 20, 1],
        ])}
        fill="#4a4032"
      />

      {/* the floor lamp, its warmth answering the streak */}
      <rect x={44} y={44} width={2} height={FLOOR_Y - 44} fill={M.graphite.lo} />
      <path
        d={pxPath([
          [36, 32, 18, 10],
          [39, 29, 12, 3],
        ])}
        fill={M.brass.lo}
      />
      <path d={pxPath([[36, 32, 18, 1]])} fill={M.brass.hi} />
      <rect x={38} y={42} width={14} height={2} fill="#ffca85" opacity={0.9} />
      {/* the bulb's own halo, right at the shade */}
      <path d={pxPath(steppedEllipse(45, 44, 16, 8, 3))} fill="#ffca85" opacity={0.1} />

      {/* --------------------------------------------------------- the floor */}
      {/* the lamp pool, quantized, lying across the boards */}
      <g ref={lampGlowRef} style={{ opacity: 0.4, transition: "opacity 700ms steps(4, end)" }}>
        <Light set={lamp} op={0.7} />
      </g>

      {/* the couch arm at the left edge, someone's blanket over it */}
      <path
        d={pxPath([
          [0, 64, 30, 62],
          [28, 74, 6, 52],
        ])}
        fill="#2e2a22"
      />
      <path d={pxPath([[0, 64, 30, 2]])} fill="#443e33" />
      <path
        d={pxPath([
          [0, 78, 26, 9],
          [4, 87, 20, 4],
        ])}
        fill={M.red.deep}
        opacity={0.85}
      />
      <path
        d={pxPath([
          [0, 126, 34, 3],
          [6, 129, 28, 2],
        ])}
        fill="#070503"
        opacity={0.5}
      />

      {/* the stool and the tea on it, still hot */}
      <rect x={40} y={112} width={20} height={3} fill={M.wood.mid} />
      <rect x={40} y={112} width={20} height={1} fill={M.wood.hi} />
      <rect x={43} y={115} width={2} height={12} fill={M.wood.deep} />
      <rect x={55} y={115} width={2} height={12} fill={M.wood.deep} />
      <rect x={46} y={104} width={8} height={8} fill="#3d2f1c" />
      <rect x={46} y={104} width={8} height={2} fill="#5a4526" />
      <rect x={45} y={103} width={10} height={1} fill={M.steel.lo} />
      <path d={pxPath([[40, 127, 22, 2]])} fill="#070503" opacity={0.5} />

      {/* the rug, and Gross on it — the honest scoreboard of this room */}
      <path
        d={pxPath([
          [152, 106, 122, 18],
          [158, 124, 110, 4],
        ])}
        fill="#241d15"
      />
      <path d={pxPath([[152, 106, 122, 1]])} fill="#3a2f20" />
      <path
        d={pxPath([
          [164, 112, 98, 2],
          [170, 117, 86, 1],
        ])}
        fill="#31281c"
      />
      <g>
        {/* his shadow first, pooled where the lamp cannot reach */}
        <path
          d={pxPath([
            [186, 118, 62, 3],
            [194, 121, 48, 2],
          ])}
          fill="#080604"
          opacity={0.55}
        />
        {/* the curled body: back high at the hip, tapering to the shoulder */}
        <path
          d={pxPath([
            [188, 108, 46, 11],
            [192, 104, 38, 4],
            [198, 101, 26, 3],
          ])}
          fill="#4a3323"
        />
        <path
          d={pxPath([
            [198, 101, 26, 1],
            [192, 104, 6, 1],
            [224, 104, 6, 1],
          ])}
          fill="#6b4d36"
        />
        <path d={pxPath([[188, 116, 46, 3]])} fill="#33220f" opacity={0.8} />
        <path d={pxPath(steppedEllipse(197, 111, 9, 7, 2))} fill="#513724" />
        <path
          d={pxPath([
            [212, 114, 14, 4],
            [214, 118, 10, 2],
          ])}
          fill="#5c4130"
        />
        <path
          d={pxPath([
            [184, 113, 8, 3],
            [180, 111, 5, 3],
            [178, 108, 3, 3],
          ])}
          fill="#5c4130"
        />
        {/* the head, laid down and pointed at the music */}
        <path
          d={pxPath([
            [230, 103, 13, 10],
            [242, 106, 6, 6],
            [247, 108, 3, 3],
          ])}
          fill="#54392a"
        />
        <path d={pxPath([[230, 103, 13, 1]])} fill="#6b4d36" />
        <rect x={248} y={109} width={2} height={2} fill="#0c0906" />
        <rect x={239} y={107} width={2} height={1} fill="#0c0906" />
        <path d={pxPath([[242, 111, 6, 1]])} fill="#3c2a1e" />
        <g ref={earsDownRef}>
          <path
            d={pxPath([
              [229, 101, 5, 5],
              [234, 102, 4, 4],
            ])}
            fill="#3c2a1e"
          />
        </g>
        <g ref={earsUpRef} style={{ display: "none" }}>
          <path
            d={pxPath([
              [229, 94, 4, 8],
              [235, 95, 4, 7],
            ])}
            fill="#3c2a1e"
          />
          <path
            d={pxPath([
              [229, 94, 4, 1],
              [235, 95, 4, 1],
            ])}
            fill="#5c4130"
          />
        </g>
        <g ref={headUpRef} style={{ display: "none" }}>
          <path
            d={pxPath([
              [230, 92, 13, 11],
              [242, 95, 6, 7],
              [247, 98, 3, 3],
            ])}
            fill="#54392a"
          />
          <path d={pxPath([[230, 92, 13, 1]])} fill="#6b4d36" />
          <rect x={248} y={99} width={2} height={2} fill="#0c0906" />
          <rect x={239} y={96} width={2} height={1} fill="#0c0906" />
          <path
            d={pxPath([
              [229, 84, 4, 8],
              [235, 85, 4, 7],
            ])}
            fill="#3c2a1e"
          />
          <path d={pxPath([[232, 103, 10, 3]])} fill="#3f2a1c" />
        </g>
      </g>

      {/* ------------------------------------------- the guitar, across the lap */}
      {/* the lap: two knees of worn denim, holding the instrument up */}
      {[38, 196].map((kx) => (
        <g key={kx}>
          <path d={pxPath(steppedEllipse(kx, H + 6, 54, 34, 4))} fill="#161c28" />
          <path d={pxPath(steppedEllipse(kx, H + 8, 48, 30, 4))} fill="#1b2230" />
          {/* the crown of the knee, worn pale where it bends */}
          <path
            d={pxPath([
              [kx - 24, H - 28, 48, 2],
              [kx - 15, H - 30, 30, 2],
            ])}
            fill="#28323f"
          />
          {/* the seam, and the crease the guitar has pressed in */}
          <rect x={kx - 1} y={H - 28} width={2} height={28} fill="#101620" opacity={0.8} />
          <path d={pxPath([[kx - 30, H - 18, 60, 1]])} fill="#0e131c" opacity={0.7} />
        </g>
      ))}
      {/* the instrument's shadow onto the lap and the boards */}
      <path
        d={pxPath([
          [30, 168, 72, 4],
          [44, 172, 60, 3],
          [110, 154, 138, 4],
          [116, 158, 128, 2],
        ])}
        fill="#070503"
        opacity={0.6}
      />
      {/* body: two bouts of old spruce */}
      <path d={pxPath(steppedEllipse(BODY_X, BODY_Y, 30, 27, 3))} fill={M.wood.base} />
      <path d={pxPath(steppedEllipse(BODY_X + 34, BODY_Y - 2, 19, 19, 3))} fill={M.wood.base} />
      <path
        d={pxPath([
          [BODY_X - 22, BODY_Y - 25, 34, 2],
          [BODY_X + 20, BODY_Y - 20, 24, 2],
        ])}
        fill={M.wood.hi}
      />
      <path
        d={pxPath([
          [BODY_X - 24, BODY_Y + 20, 38, 3],
          [BODY_X + 18, BODY_Y + 12, 26, 3],
        ])}
        fill={M.wood.deep}
        opacity={0.85}
      />
      {/* rosette and the soundhole carved dark inside it */}
      <path
        d={pxPath(steppedEllipse(BODY_X + 42, BODY_Y, 11, 11, 2))}
        fill={M.brass.lo}
        opacity={0.7}
      />
      <path d={pxPath(steppedEllipse(BODY_X + 42, BODY_Y, 9, 9, 2))} fill="#0c0906" />
      {/* bridge with its bone saddle */}
      <rect x={BODY_X - 18} y={BODY_Y - 5} width={15} height={8} fill={M.wood.deep} />
      <rect x={BODY_X - 17} y={BODY_Y - 5} width={13} height={1} fill={M.wood.lo} />
      <rect x={BODY_X - 16} y={BODY_Y - 3} width={2} height={5} fill={M.linen.base} />

      {/* neck: wood ramp, bevel edge-light, crowding frets, dot inlays */}
      <rect x={NECK[0]} y={NECK[1]} width={NECK[2]} height={NECK[3]} fill={M.wood.mid} />
      <Bev set={bevelPaths([NECK])} mat={M.wood} />
      <rect x={NECK[0]} y={NECK[1] + NECK[3] - 2} width={NECK[2]} height={2} fill={M.wood.deep} />
      <rect x={NECK[0] + NECK[2] - 2} y={NECK[1]} width={2} height={NECK[3]} fill={M.linen.base} />
      {[16, 31, 45, 58, 70, 81, 91, 100, 108, 115, 121, 126].map((off) => (
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
        x={NECK[0] + NECK[2] - 2 - 51}
        y={NECK[1] + 5}
        width={2}
        height={3}
        fill={M.linen.base}
      />
      <rect
        x={NECK[0] + NECK[2] - 2 - 75}
        y={NECK[1] + 5}
        width={2}
        height={3}
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
          <rect x={HEAD[0] + 4 + i * 7} y={HEAD[1] - 3} width={3} height={3} fill={M.brass.base} />
          <rect x={HEAD[0] + 4 + i * 7} y={HEAD[1] - 3} width={3} height={1} fill={M.brass.hi} />
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

      {/* strings: bridge to nut, catching the lamp, each with its shadow */}
      <g ref={stringsRef} style={{ transition: "transform 50ms steps(2, end)" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i}>
            <rect
              x={BODY_X - 14}
              y={NECK[1] + 1 + i * 2}
              width={NECK[0] + NECK[2] - (BODY_X - 14)}
              height={1}
              fill={i < 3 ? "#e2ddcf" : "#b8b099"}
              opacity={0.92}
            />
            <rect
              x={BODY_X - 14}
              y={NECK[1] + 2 + i * 2}
              width={NECK[0] + NECK[2] - (BODY_X - 14)}
              height={1}
              fill="#0a0806"
              opacity={0.32}
            />
          </g>
        ))}
      </g>

      {/* the plectrum over the soundhole, dipping on every strum */}
      <g ref={plectrumRef} style={{ transition: "transform 60ms steps(2, end)" }}>
        <path
          d={pxPath([
            [BODY_X + 38, BODY_Y - 18, 9, 5],
            [BODY_X + 39, BODY_Y - 13, 7, 2],
            [BODY_X + 40, BODY_Y - 11, 5, 2],
          ])}
          fill={M.red.base}
        />
        <path d={pxPath([[BODY_X + 38, BODY_Y - 18, 9, 1]])} fill={M.red.hi} />
      </g>

      {/* --------------------------------------------------------- the lane */}
      <rect x={0} y={0} width={W} height={LANE_Y + 14} fill="#0b0a08" opacity={0.82} />
      <rect x={0} y={LANE_Y + 14} width={W} height={1} fill="#241f18" />
      <rect x={STRIKE_X - 1} y={0} width={3} height={LANE_Y + 14} fill={M.brass.base} />
      <rect x={STRIKE_X - 1} y={0} width={1} height={LANE_Y + 14} fill={M.brass.hi} />
      {/* the line's own glow, so the eye knows where to meet the marks */}
      <path d={pxPath(steppedEllipse(STRIKE_X, LANE_Y, 12, 14, 3))} fill="#ffca85" opacity={0.09} />
      <g style={{ overflow: "hidden" }}>
        <g ref={laneRef}>
          {SONG.map((m, i) => (
            <g
              key={m.at}
              ref={(el) => {
                noteRefs.current[i] = el;
              }}
              style={{ display: m.extra && best < 2 ? "none" : "" }}
              transform={`translate(${STRIKE_X + m.at * SPEED} ${LANE_Y - 9 + m.lane * 5})`}
            >
              <path
                d={pxPath([
                  [0, 0, 7, 3],
                  [1, 3, 5, 2],
                  [2, 5, 3, 1],
                ])}
                fill={m.extra ? "#c9924b" : M.enamel.base}
              />
              <path d={pxPath([[0, 0, 7, 1]])} fill={M.enamel.hi} />
              <PixelText x={9} y={0} text={KEYS[m.lane]} fill={M.linen.base} />
            </g>
          ))}
        </g>
      </g>
      {/* the chord name, landing where the strum lands */}
      <g
        ref={chordRef}
        style={{
          opacity: 0,
          transition: "opacity 120ms steps(2, end), transform 120ms steps(2, end)",
        }}
      >
        <rect
          x={STRIKE_X + 8}
          y={LANE_Y + 20}
          width={24}
          height={12}
          fill="#0b0a08"
          opacity={0.85}
        />
        {CHORDS.map((name, i) => (
          <g
            key={name}
            ref={(el) => {
              chordTextRefs.current[i] = el;
            }}
            style={{ display: "none" }}
          >
            <PixelText x={STRIKE_X + 12} y={LANE_Y + 23} text={name} fill="#f2d86a" />
          </g>
        ))}
      </g>

      {/* sparks and steam, above everything they come off */}
      <g>{sparks.nodes}</g>

      {phase === "intro" ? (
        <g>
          <rect x={92} y={60} width={132} height={44} fill="#0b0a08" opacity={0.88} />
          <rect x={92} y={60} width={132} height={1} fill="#372f24" />
          <PixelText x={100} y={67} text="A S D F - AKORDY" fill={M.linen.base} />
          <PixelText x={100} y={77} text="TRAF W ZNAK NAD PROGIEM" fill={M.linen.lo} />
          <PixelText
            x={100}
            y={91}
            text={best >= 2 ? "[E] CALA PIOSENKA" : "[E] GRAJ"}
            fill={M.enamel.base}
          />
        </g>
      ) : null}
    </MinigameShell>
  );
}
