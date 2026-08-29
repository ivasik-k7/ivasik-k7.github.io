import i18n from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx } from "@/engine";
import {
  dth,
  Light,
  pxPath,
  type Rect,
  steppedEllipse,
  steppedQuad,
  tiers,
} from "@/engine/scene/pixelKit";
import { Juice, MinigameShell, makeParticlePool, tierOf } from "./kit";

/**
 * MISKI — breakfast for Gross.
 *
 * The floor of the studio, at floor height, first light coming in flat from the
 * window off-frame left. Two bowls on their mat: water on the left, kibble on
 * the right. Hold on a bowl and its vessel tips over it; let go and it stops.
 * Each bowl fills in thirteen visible notches and both of them want to end up
 * in the band moulded into the rim — not full, not half, the amount a dog
 * actually gets.
 *
 * The game is the dog. Gross does not wait; he creeps, in the dishonest
 * sideways way a dog creeps when it knows perfectly well it has been told to
 * sit. Click him and he sits back down — but only while he is actually moving,
 * because telling a dog off for something he is not doing teaches him nothing
 * and costs you the beat. Let him reach a bowl and he shoves it with his nose:
 * the bowl slides along the mat, so the thing you were aiming at is no longer
 * where you were aiming, and it loses a third of what was in it.
 *
 * Get both bowls into their band and he is released early, which is the whole
 * skill — the clock is not a countdown to fail, it is the time you have before
 * he stops asking.
 *
 * WHY IT LOOKS LIKE THIS. Nothing here is a gauge. The level in a bowl is the
 * level in the bowl, quantized to notches so it reads at a glance and clicks
 * up like a real measure; the band is a moulded ring inside the rim with two
 * ticks on the outside, the way a plastic dog bowl actually is; the clock is a
 * kitchen clock on the wall with a single hand; the pressure is a dog's face.
 * The only non-diegetic thing in the frame is the verdict, and that arrives
 * after it is over.
 *
 * Depth is built in five planes — wall, radiator, floor, the vessels standing
 * on it, and the mat nearest the eye — and the light does the rest: one raking
 * shaft off the left, contact shadows under everything, the shaft catching the
 * water surface, and dust turning over in it. The floor is lino, and it is a
 * kitchen floor in a flat where a dog lives, so it has a worn lane and paw
 * prints going to the bowls.
 */

const W = 300;
const H = 190;

/* the planes */
const SKIRT_Y = 96;
const FLOOR_Y = 102;
const MAT: Rect = [78, 140, 148, 30];

/** Bowl centres at rest. They move: Gross moves them. */
const WATER_X = 124;
const FOOD_X = 200;
/**
 * The bowl, in near-side elevation with a lip wider than its body.
 *
 * It was drawn as a stepped ellipse rim over a cone, which is what a bowl looks
 * like from three-quarters above — and at this scale the rim then covered the
 * top two thirds of the well, so the one thing the whole game is about was a
 * three-pixel sliver of colour almost the same hue as the bowl around it. A
 * flat lip over a trapezoid reads as a bowl instantly and leaves the entire
 * inside visible, which is the only thing that matters here.
 */
const LIP_Y = 132;
const LIP_HW = 21;
const WELL_TOP = 138;
const WELL_BOTTOM = 156;
const BOWL_FOOT = 162;
/** nine notches from empty to the lip, two pixels each — a measure you can see */
const NOTCHES = 9;
const NOTCH_H = 2;

/** How fast a vessel pours, in notches per second. */
const POUR_RATE = 4;

const ROUND_MS = 26000;
/** how long a "czekaj" is worth, and how long before you may say it again */
const WAIT_GRANT = 5200;
const WAIT_COOLDOWN = 900;

/** Gross's four stations, right to left: sat down, up, closer, at the bowls. */
const DOG_STOPS = [286, 262, 240, 222] as const;
/**
 * The line his paws stand on. His art is drawn with y = 0 AT the floor and
 * everything above it negative, which is the only sane way to draw a standing
 * animal: the thing that is fixed is where it touches the ground.
 */
const DOG_FEET = 141;

type Which = "water" | "food";

/** Show or hide one element. Module scope so it is not a hook dependency. */
function setDisp(el: { style: CSSStyleDeclaration } | null, on: boolean) {
  if (el) el.style.display = on ? "" : "none";
}

/* ---------------------------------------------------------------- the room */

const WALL = pxPath([[0, 0, W, SKIRT_Y]]);
const WALL_SEAM = pxPath([
  [96, 0, 1, SKIRT_Y],
  [204, 0, 1, SKIRT_Y],
]);
/** the damp bloom every flat in this block has above the skirting */
const WALL_DAMP = pxPath([
  [140, 62, 30, 16],
  [148, 78, 18, 8],
]);
const SKIRT = pxPath([
  [0, SKIRT_Y, W, 6],
  [0, SKIRT_Y, W, 1],
]);
const SKIRT_SHADOW = pxPath([[0, FLOOR_Y, W, 2]]);

/** Lino: a big soft check, a worn lane to the bowls, and the seam it was laid on. */
const LINO = pxPath([[0, FLOOR_Y, W, H - FLOOR_Y]]);
const LINO_GRID = pxPath([
  ...Array.from({ length: 7 }, (_, i) => [i * 44 + 12, FLOOR_Y, 1, H - FLOOR_Y] as Rect),
  ...Array.from({ length: 4 }, (_, i) => [0, FLOOR_Y + 8 + i * 22, W, 1] as Rect),
]);
const LINO_SEAM = pxPath([[0, FLOOR_Y + 30, W, 1]]);
const LINO_WORN = pxPath([
  [76, 128, 150, 12],
  [92, 120, 116, 8],
]);
/** Paw prints, in dog order, coming in from the right. */
const PAWS = pxPath(
  [
    [232, 172],
    [244, 166],
    [258, 174],
    [270, 168],
    [284, 176],
  ].flatMap(([x, y]) => [
    [x, y, 2, 2],
    [x + 3, y - 1, 2, 2],
    [x + 1, y + 2, 3, 2],
  ]) as Rect[],
);

/** The radiator behind him — the warmest place in the flat, which is why he is there. */
const RAD_BODY = pxPath([[240, 44, 54, 50]]);
const RAD_RIBS = pxPath(Array.from({ length: 9 }, (_, i) => [244 + i * 6, 46, 3, 46] as Rect));
const RAD_TOP = pxPath([[238, 42, 58, 3]]);
const RAD_PIPE = pxPath([
  [246, 94, 3, 8],
  [286, 94, 3, 8],
]);
const RAD_VALVE = pxPath([
  [284, 88, 8, 6],
  [286, 84, 4, 4],
]);

/** The kitchen clock: a single hand, in twelve whole-pixel positions. */
const CLOCK_C = { x: 52, y: 40, r: 13 };
const CLOCK_FACE = pxPath(steppedEllipse(CLOCK_C.x, CLOCK_C.y, CLOCK_C.r, CLOCK_C.r, 2));
const CLOCK_INNER = pxPath(steppedEllipse(CLOCK_C.x, CLOCK_C.y, CLOCK_C.r - 2, CLOCK_C.r - 2, 2));
const CLOCK_PIPS = pxPath(
  Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return [
      CLOCK_C.x + Math.round(Math.cos(a) * 10),
      CLOCK_C.y + Math.round(Math.sin(a) * 10),
      1,
      1,
    ] as Rect;
  }),
);
/** One hand, drawn twelve times so it never lands off the grid. */
const CLOCK_HANDS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
  const out: Rect[] = [];
  for (let r = 0; r <= 8; r += 1) {
    out.push([
      CLOCK_C.x + Math.round(Math.cos(a) * r),
      CLOCK_C.y + Math.round(Math.sin(a) * r),
      1,
      1,
    ]);
  }
  return pxPath(out);
});

/** The mat, in slight perspective: the back edge is shorter than the front. */
const MAT_BACK = pxPath([[MAT[0] + 8, MAT[1], MAT[2] - 16, 5]]);
const MAT_BODY = pxPath([[MAT[0], MAT[1] + 5, MAT[2], MAT[3] - 8]]);
const MAT_LIP = pxPath([[MAT[0] + 8, MAT[1], MAT[2] - 16, 1]]);
const MAT_FRINGE = pxPath(
  Array.from({ length: 33 }, (_, i) => [MAT[0] + i * 4, MAT[1] + MAT[3] - 3, 2, 3] as Rect),
);
const MAT_WEAVE = pxPath([
  [MAT[0] + 6, MAT[1] + 10, MAT[2] - 12, 1],
  [MAT[0] + 12, MAT[1] + 16, MAT[2] - 24, 1],
]);
const MAT_AO = pxPath([
  [MAT[0] - 2, MAT[1] + MAT[3] - 2, MAT[2] + 4, 2],
  [MAT[0], MAT[1] + MAT[3], MAT[2], 1],
]);

/* --------------------------------------------------------------- the bowls */

/** Half-width of the bowl's outside wall at y. */
function wallHw(y: number) {
  const t = (y - WELL_TOP) / (BOWL_FOOT - WELL_TOP);
  return Math.round(19 - t * 9);
}
/** The outside of the bowl: the lip, then the tapering wall under it. */
function bowlWall(cx: number): Rect[] {
  const out: Rect[] = [[cx - LIP_HW, LIP_Y, LIP_HW * 2, WELL_TOP - LIP_Y]];
  for (let y = WELL_TOP; y <= BOWL_FOOT; y++) out.push([cx - wallHw(y), y, wallHw(y) * 2, 1]);
  return out;
}
/** The inside of it — three pixels in from the wall, and dark. */
function bowlWell(cx: number): Rect[] {
  const out: Rect[] = [];
  for (let y = WELL_TOP; y <= WELL_BOTTOM; y++) {
    const hw = Math.max(2, wallHw(y) - 3);
    out.push([cx - hw, y, hw * 2, 1]);
  }
  return out;
}
/** The band of contents at notch `n`: two pixels, the width of the well there. */
function levelRow(cx: number, n: number): Rect {
  const y = WELL_BOTTOM - n * NOTCH_H;
  const hw = Math.max(2, wallHw(y + 1) - 3);
  return [cx - hw, y, hw * 2, NOTCH_H];
}
const LIP_LIGHT = (cx: number) =>
  pxPath([
    [cx - LIP_HW, LIP_Y, LIP_HW * 2, 1],
    [cx - LIP_HW, LIP_Y, 2, WELL_TOP - LIP_Y],
  ]);
const LIP_SHADE = (cx: number) => pxPath([[cx - LIP_HW + 2, WELL_TOP - 1, LIP_HW * 2 - 4, 1]]);
const BOWL_SHADOW = (cx: number) =>
  pxPath([
    [cx - 16, BOWL_FOOT, 32, 2],
    [cx - 12, BOWL_FOOT + 2, 24, 1],
  ]);

/* ---------------------------------------------------------- the two vessels */

/** The water jug, standing behind the water bowl. */
const JUG_BODY = pxPath([
  [70, 108, 24, 32],
  [72, 104, 20, 4],
]);
const JUG_LIP = pxPath([[90, 104, 9, 3]]);
const JUG_HANDLE = pxPath([
  [66, 112, 4, 2],
  [64, 114, 2, 10],
  [66, 124, 4, 2],
]);
const JUG_HI = pxPath([
  [72, 108, 3, 32],
  [72, 104, 18, 1],
]);
const JUG_WATER = pxPath([[73, 114, 18, 24]]);
const JUG_SHADOW = pxPath([
  [66, 140, 32, 2],
  [70, 142, 24, 1],
]);

/** The feed sack, rolled shut, standing behind the food bowl. */
const SACK_BODY = pxPath([
  [154, 100, 30, 40],
  [156, 96, 26, 4],
]);
const SACK_ROLL = pxPath([
  [154, 96, 30, 4],
  [158, 92, 22, 4],
]);
const SACK_HI = pxPath([[156, 100, 3, 40]]);
const SACK_LABEL = pxPath([
  [159, 112, 20, 14],
  [161, 116, 16, 2],
  [161, 121, 11, 2],
]);
const SACK_SHADOW = pxPath([
  [150, 140, 38, 2],
  [154, 142, 30, 1],
]);

/* ------------------------------------------------------------------- Gross */

/**
 * A DOG SAT DOWN, drawn facing LEFT, because that is where the bowls are.
 *
 * y = 0 is the floor and everything above it is negative: what is fixed about a
 * standing animal is where it touches the ground, and measuring from anywhere
 * else means every pose has to be re-registered by hand.
 *
 * The proportions are the point. He was drawn as a 44×27 slab with the head
 * inside the body's own vertical range, and a head at shoulder height is not a
 * dog, it is a loaf. A sitting dog is a tall triangle: haunches on the floor
 * behind, front legs straight, chest rising forward, and the head a clear
 * fifteen pixels above the shoulder with the ears above that again. The
 * silhouette has to read at a glance from across the room, because it is the
 * thing the player is watching instead of a timer.
 *
 * The coat is the corridor rig's, to the hex — #4a3323 with #6b4d36 along the
 * top line and #3c2a1e in the ears — because it has to be the same dog.
 */
const COAT = "#4a3323";
const COAT_HI = "#6b4d36";
const COAT_LO = "#33220f";
const HEAD_C = "#54392a";
const EAR_C = "#3c2a1e";
const LIMB = "#5c4130";
const JET = "#0c0906";

const DOG_SHADOW = pxPath([
  [-16, 0, 46, 3],
  [-8, 3, 30, 2],
]);
/** haunches on the floor behind, and the thigh over them */
const DOG_RUMP = pxPath([
  [8, -24, 22, 24],
  [10, -28, 18, 4],
]);
const DOG_THIGH = pxPath(steppedEllipse(17, -12, 9, 10, 2));
/** the chest, rising forward off the haunches */
const DOG_BODY = pxPath([
  [-8, -30, 20, 30],
  [-6, -34, 16, 4],
  [0, -36, 10, 2],
]);
const DOG_TOPLINE = pxPath([
  [0, -36, 10, 1],
  [-6, -34, 6, 1],
  [10, -34, 2, 1],
  [10, -28, 18, 1],
]);
const DOG_BELLY = pxPath([
  [-8, -8, 20, 8],
  [8, -6, 22, 6],
]);
/** front legs, straight down, the near one a shade lighter */
const DOG_LEG_FAR = pxPath([
  [-2, -20, 6, 20],
  [-5, -3, 10, 3],
]);
const DOG_LEG_NEAR = pxPath([
  [-8, -22, 7, 22],
  [-12, -3, 12, 3],
]);
const DOG_PAWS = pxPath([
  [-12, -3, 12, 1],
  [-5, -3, 10, 1],
]);
/** two tails: down along the rump, and up in a wag */
const DOG_TAIL_DOWN = pxPath([
  [28, -18, 5, 4],
  [31, -14, 4, 5],
  [32, -9, 3, 5],
]);
const DOG_TAIL_UP = pxPath([
  [28, -22, 5, 4],
  [31, -28, 4, 6],
  [32, -34, 4, 6],
  [30, -38, 5, 4],
]);
/**
 * The head, in the two poses the game is played in: up, watching you, waiting
 * to be told; and down, over the rim, which is what he wants.
 */
const HEAD_UP_NECK = pxPath([
  [-10, -40, 12, 8],
  [-12, -44, 12, 6],
]);
const HEAD_UP = pxPath([
  [-24, -52, 17, 15],
  [-31, -48, 8, 8],
  [-34, -45, 3, 4],
]);
const HEAD_UP_HI = pxPath([
  [-24, -52, 17, 1],
  [-31, -48, 7, 1],
]);
const HEAD_UP_MUZZLE = pxPath([[-31, -41, 8, 2]]);
const EARS_UP = pxPath([
  [-22, -62, 5, 11],
  [-15, -61, 5, 10],
]);
const EARS_UP_HI = pxPath([
  [-22, -62, 5, 1],
  [-15, -61, 5, 1],
]);
/** down: the neck stretches out low and the muzzle is in the bowl */
const HEAD_DOWN_NECK = pxPath([
  [-12, -34, 14, 9],
  [-18, -28, 12, 8],
]);
const HEAD_DOWN = pxPath([
  [-32, -26, 17, 14],
  [-39, -22, 8, 8],
  [-42, -19, 3, 4],
]);
const HEAD_DOWN_HI = pxPath([[-32, -26, 17, 1]]);
const EARS_DOWN = pxPath([
  [-30, -34, 5, 9],
  [-23, -33, 5, 9],
]);

/* ----------------------------------------------------------------- helpers */

/** How well a level sits in its band: 1 inside, falling away outside it. */
function closeness(n: number, lo: number, hi: number) {
  if (n >= lo && n <= hi) return 1;
  const d = n < lo ? lo - n : n - hi;
  return Math.max(0, 1 - d / 4);
}

export function Bowls({
  best = 0,
  onClose,
  onVerdict,
}: {
  /** Best tier ever reached. He has learned the game too, and gets quicker. */
  best?: number;
  onClose: () => void;
  onVerdict: (tier: 0 | 1 | 2) => void;
}) {
  const mastered = best >= 2;
  /** The band moulded into the rim, in notches. Narrower once he trusts you. */
  const BAND_LO = mastered ? 9 : 8;
  const BAND_HI = mastered ? 10 : 11;
  /** How long between his creeps. He is faster once he knows the routine. */
  const CREEP_MS = mastered ? 2300 : 3100;

  const [phase, setPhase] = useState<"intro" | "playing" | "done">("intro");
  const [verdict, setVerdict] = useState<string | null>(null);

  const stageRef = useRef<SVGGElement | null>(null);
  const dogRef = useRef<SVGGElement | null>(null);
  const headUpRef = useRef<SVGGElement | null>(null);
  const headDownRef = useRef<SVGGElement | null>(null);
  const earsUpRef = useRef<SVGGElement | null>(null);
  const earsDownRef = useRef<SVGGElement | null>(null);
  const tailUpRef = useRef<SVGGElement | null>(null);
  const tailDownRef = useRef<SVGGElement | null>(null);
  const jugRef = useRef<SVGGElement | null>(null);
  const sackRef = useRef<SVGGElement | null>(null);
  const streamRefs = useRef<Record<Which, SVGGElement | null>>({ water: null, food: null });
  const bowlRefs = useRef<Record<Which, SVGGElement | null>>({ water: null, food: null });
  const rowRefs = useRef<Record<Which, (SVGRectElement | null)[]>>({ water: [], food: [] });
  const bandRefs = useRef<Record<Which, SVGGElement | null>>({ water: null, food: null });
  /**
   * The one unmissable readout. The moulded band and its ticks are honest but
   * quiet — at this scale a two-pixel tick inside a bowl is something you have
   * to go looking for. A bowl that is right lights along its lip, which is
   * exactly where the eye already is while pouring.
   */
  const okRefs = useRef<Record<Which, SVGGElement | null>>({ water: null, food: null });
  const surfaceRefs = useRef<Record<Which, SVGRectElement | null>>({ water: null, food: null });
  const spillRefs = useRef<(SVGGElement | null)[]>([]);
  const handRefs = useRef<(SVGPathElement | null)[]>([]);
  const biscuitRef = useRef<SVGGElement | null>(null);

  const juice = useRef(new Juice()).current;
  const bits = useRef(makeParticlePool(52)).current;

  const st = useRef({
    t: 0,
    last: 0,
    /** notches in each bowl, fractional while pouring */
    level: { water: 0, food: 0 } as Record<Which, number>,
    /** whole notches currently shown, so the click only fires on a change */
    shown: { water: 0, food: 0 } as Record<Which, number>,
    /** how far each bowl has been shoved along the mat */
    slide: { water: 0, food: 0 } as Record<Which, number>,
    pouring: null as Which | null,
    spilled: 0,
    nosed: 0,
    scolds: 0,
    /** which of DOG_STOPS he is standing on */
    step: 0,
    patience: 0,
    waitReadyAt: 0,
    /** he is mid-creep: a "czekaj" only lands in this window */
    creeping: false,
    biscuit: mastered,
    hand: 0,
    dustAt: 0,
    banded: false,
    done: false,
  });

  /** Head up, ears up: what he does when he is being spoken to. */
  const setAttention = useCallback((up: boolean) => {
    setDisp(headUpRef.current, up);
    setDisp(earsUpRef.current, up);
    setDisp(headDownRef.current, !up);
    setDisp(earsDownRef.current, !up);
  }, []);

  /** Move the whole dog to his station. */
  const placeDog = useCallback((step: number) => {
    if (dogRef.current) {
      dogRef.current.style.transform = `translate(${DOG_STOPS[step] - DOG_STOPS[0]}px, 0px)`;
    }
  }, []);

  /** Paint one bowl's contents from its level. Discrete: it clicks up a notch. */
  const paintLevel = useCallback(
    (which: Which) => {
      const s = st.current;
      const n = Math.min(NOTCHES, Math.floor(s.level[which]));
      const rows = rowRefs.current[which];
      for (let i = 0; i < rows.length; i++) setDisp(rows[i], i < n);
      const surf = surfaceRefs.current[which];
      if (surf) {
        if (n === 0) surf.style.display = "none";
        else {
          const r = levelRow(which === "water" ? WATER_X : FOOD_X, n);
          surf.style.display = "";
          surf.setAttribute("x", String(r[0] + 1));
          surf.setAttribute("y", String(r[1]));
          surf.setAttribute("width", String(Math.max(1, r[2] - 2)));
        }
      }
      /* the moulded band lights up when the level is sitting in it */
      const inBand = n >= BAND_LO && n <= BAND_HI;
      const band = bandRefs.current[which];
      if (band) band.style.opacity = inBand ? "1" : "0.55";
      return inBand;
    },
    [BAND_LO, BAND_HI],
  );

  /* ------------------------------------------------------------- the loop */
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const s = st.current;
    s.last = performance.now();
    placeDog(0);
    setAttention(true);

    const finish = (early: boolean) => {
      s.done = true;
      s.pouring = null;
      setDisp(streamRefs.current.water, false);
      setDisp(streamRefs.current.food, false);
      /* he is released: head down in the food, tail going */
      placeDog(3);
      setAttention(false);
      setDisp(tailUpRef.current, true);
      setDisp(tailDownRef.current, false);
      playSfx("chime");
      for (let k = 0; k < 10; k++) {
        bits.spawn({
          x: FOOD_X + s.slide.food - 6 + ((k * 5) % 13),
          y: WELL_TOP + 2,
          vx: (k % 2 ? 1 : -1) * (6 + k * 3),
          vy: -14 - k * 2,
          life: 620,
          color: k % 3 ? "#c9762a" : "#8a5a26",
          size: 1,
          gravity: 220,
        });
      }
      const water = closeness(Math.floor(s.level.water), BAND_LO, BAND_HI);
      const food = closeness(Math.floor(s.level.food), BAND_LO, BAND_HI);
      const spill = Math.min(0.3, s.spilled * 0.05);
      const shoved = s.nosed * 0.09;
      const bonus = early ? 0.08 : 0;
      const ratio = Math.max(0, Math.min(1, (water + food) / 2 - spill - shoved + bonus));
      const tier = tierOf(ratio, 0.82, 0.5);
      const line =
        tier === 2
          ? s.nosed === 0
            ? i18n.t("minigame.verdict.bowls.best")
            : i18n.t("minigame.verdict.bowls.bestNosed")
          : tier === 1
            ? s.spilled > 3
              ? i18n.t("minigame.verdict.bowls.midSpill")
              : i18n.t("minigame.verdict.bowls.mid")
            : s.nosed > 1
              ? i18n.t("minigame.verdict.bowls.lowNosed")
              : i18n.t("minigame.verdict.bowls.low");
      setVerdict(line);
      setPhase("done");
      window.setTimeout(() => {
        onVerdict(tier);
        onClose();
      }, 3200);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const { frozen, dx, dy } = juice.sample(now, now - s.last);
      if (stageRef.current) stageRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      const dtMs = Math.min(50, now - s.last);
      s.last = now;
      if (frozen || s.done) return;
      s.t += dtMs;
      const dt = dtMs / 1000;
      bits.update(now, dt);

      /* the clock: one hand round the whole round */
      const hand = Math.min(11, Math.floor((s.t / ROUND_MS) * 12));
      if (hand !== s.hand) {
        s.hand = hand;
        handRefs.current.forEach((el, i) => {
          setDisp(el, i === hand);
        });
      }

      /* dust turning over in the shaft, because the light needs something in it */
      if (s.t > s.dustAt) {
        s.dustAt = s.t + 420;
        bits.spawn({
          x: 30 + ((s.t * 7) % 90),
          y: 40 + ((s.t * 11) % 60),
          vx: 3,
          vy: -1,
          life: 2600,
          color: "#e8d6b0",
          size: 1,
          gravity: 3,
        });
      }

      /* pouring */
      if (s.pouring) {
        const which = s.pouring;
        const before = Math.floor(s.level[which]);
        s.level[which] += POUR_RATE * dt;
        if (s.level[which] > NOTCHES) {
          const over = s.level[which] - NOTCHES;
          s.level[which] = NOTCHES;
          s.spilled += over;
          const patch = Math.min(2, Math.floor(s.spilled / 1.6));
          for (let i = 0; i <= patch; i++) setDisp(spillRefs.current[i], true);
        }
        const after = Math.floor(s.level[which]);
        if (after !== before) {
          playSfx(which === "water" ? "trickle" : "coins");
          paintLevel(which);
        }
        /* the stream lands: splashes out of the water, kibble bounces */
        const cx = (which === "water" ? WATER_X : FOOD_X) + s.slide[which];
        bits.spawn({
          x: cx - 3 + ((s.t * 5) % 7),
          y: WELL_TOP + 2,
          vx: (((s.t * 13) % 5) - 2) * 6,
          vy: -18,
          life: 320,
          color: which === "water" ? "#8fd0e8" : "#c98a3a",
          size: 1,
          gravity: 240,
        });
      }

      /* patience: he creeps, one station at a time */
      s.patience += dtMs;
      if (s.patience > CREEP_MS && s.step < 3) {
        s.patience = 0;
        s.creeping = true;
        /* the window in which a "czekaj" lands — long enough to be a beat you
           read off the dog, short enough that you cannot just hold the button */
        window.setTimeout(() => {
          s.creeping = false;
        }, 1300);
        s.step++;
        placeDog(s.step);
        setAttention(s.step < 3);
        playSfx("click");
        if (s.step === 3) {
          /* he has arrived at the bowls, and a bowl gets shoved */
          /**
           * Always the food bowl. It used to be whichever bowl held more, and
           * the water one is at the far end of the mat where his muzzle does not
           * reach — so half the time the player watched a bowl lose a third of
           * its contents to a dog standing two feet away from it. He mugs the
           * food, which is also what a dog does.
           */
          s.nosed++;
          s.slide.food += 7;
          const el = bowlRefs.current.food;
          if (el) el.style.transform = `translate(${s.slide.food}px, 0px)`;
          s.level.food = Math.max(0, s.level.food - NOTCHES * 0.28);
          paintLevel("food");
          playSfx("thud");
          juice.shake(2, 140);
          juice.hitStop(40);
          const cx = FOOD_X + s.slide.food;
          for (let k = 0; k < 8; k++) {
            bits.spawn({
              x: cx,
              y: WELL_TOP + 3,
              vx: (k % 2 ? 1 : -1) * (14 + k * 5),
              vy: -26 - k * 3,
              life: 520,
              color: k % 3 ? "#c98a3a" : "#8a5a26",
              size: 1,
              gravity: 260,
            });
          }
          /* and then he backs off on his own, looking innocent */
          window.setTimeout(() => {
            if (s.done) return;
            s.step = 1;
            s.patience = 0;
            placeDog(1);
            setAttention(true);
          }, 900);
        }
      }

      /* the tail keeps the score: it goes faster as the bowls fill */
      const fill = (s.level.water + s.level.food) / (NOTCHES * 2);
      const wagMs = 520 - fill * 300;
      const wag = Math.floor(s.t / wagMs) % 2 === 0;
      setDisp(tailUpRef.current, wag);
      setDisp(tailDownRef.current, !wag);

      /* both bowls in the band ends it early, which is the point */
      const wOk = Math.floor(s.level.water) >= BAND_LO && Math.floor(s.level.water) <= BAND_HI;
      const fOk = Math.floor(s.level.food) >= BAND_LO && Math.floor(s.level.food) <= BAND_HI;
      if (wOk && fOk && !s.banded) {
        s.banded = true;
        finish(true);
        return;
      }
      if (!(wOk && fOk)) s.banded = false;

      if (s.t > ROUND_MS) finish(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    phase,
    juice,
    bits,
    onClose,
    onVerdict,
    paintLevel,
    placeDog,
    setAttention,
    BAND_LO,
    BAND_HI,
    CREEP_MS,
  ]);

  /* ------------------------------------------------------------- the verbs */

  const startPour = useCallback((which: Which) => {
    const s = st.current;
    if (s.done) return;
    s.pouring = which;
    setDisp(streamRefs.current[which], true);
    /* the vessel tips over its bowl */
    const vessel = which === "water" ? jugRef.current : sackRef.current;
    if (vessel) vessel.style.transform = which === "water" ? "rotate(16deg)" : "rotate(-14deg)";
    playSfx("pour");
  }, []);

  const stopPour = useCallback(() => {
    const s = st.current;
    s.pouring = null;
    setDisp(streamRefs.current.water, false);
    setDisp(streamRefs.current.food, false);
    if (jugRef.current) jugRef.current.style.transform = "rotate(0deg)";
    if (sackRef.current) sackRef.current.style.transform = "rotate(0deg)";
  }, []);

  /**
   * "Czekaj." It only lands while he is actually moving — a dog told off for
   * something he is not doing learns nothing, and the beat is the skill.
   */
  const scold = useCallback(() => {
    const s = st.current;
    if (s.done || s.t < s.waitReadyAt) return;
    s.waitReadyAt = s.t + WAIT_COOLDOWN;
    if (!s.creeping || s.step === 0) {
      playSfx("click");
      return;
    }
    s.scolds++;
    s.step = Math.max(0, s.step - 1);
    s.patience = -WAIT_GRANT;
    placeDog(s.step);
    setAttention(true);
    playSfx("chime");
    juice.shake(1, 60);
  }, [juice, placeDog, setAttention]);

  /** The biscuit, once he trusts you: three seconds of patience, bought. */
  const treat = useCallback(() => {
    const s = st.current;
    if (s.done || !s.biscuit) return;
    s.biscuit = false;
    s.patience -= 4200;
    setDisp(biscuitRef.current, false);
    playSfx("chime");
    for (let k = 0; k < 6; k++) {
      bits.spawn({
        x: DOG_STOPS[s.step] - 30,
        y: DOG_FEET - 6,
        vx: (k % 2 ? 1 : -1) * (8 + k * 4),
        vy: -20,
        life: 480,
        color: "#d8a55c",
        size: 1,
        gravity: 240,
      });
    }
  }, [bits]);

  /* keys: the same three verbs, for hands that would rather not use a mouse */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") return;
      e.stopPropagation();
      if (phase === "intro") {
        if (e.code === "KeyE" || e.code === "Enter" || e.code === "Space") setPhase("playing");
        return;
      }
      if (phase !== "playing" || e.repeat) return;
      if (e.code === "KeyA") startPour("water");
      else if (e.code === "KeyD") startPour("food");
      else if (e.code === "Space" || e.code === "Enter") scold();
      else if (e.code === "KeyS") treat();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "KeyA" || e.code === "KeyD") stopPour();
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("pointerup", stopPour);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("pointerup", stopPour);
    };
  }, [phase, startPour, stopPour, scold, treat]);

  /* ------------------------------------------------------------- the light */

  /** First light, flat off the window to the left, landing across the lino. */
  const shaft = useRef(
    tiers(
      (s) => steppedQuad(10, 0, Math.round(46 * s), H, Math.round(60 * s), Math.round(210 * s), 7),
      "e",
      0.9,
    ),
  ).current;
  /** and the pool it makes where it meets the mat */
  const pool = useRef(
    tiers((s) => steppedEllipse(120, 150, Math.round(74 * s), Math.round(15 * s), 3), "e", 0.6),
  ).current;

  const bowl = (which: Which) => {
    const cx = which === "water" ? WATER_X : FOOD_X;
    /**
     * The shells are deliberately duller than the contents. They were a bright
     * plastic blue and a bright plastic orange with contents almost the same
     * hue inside them, and the level — the only thing the game is about —
     * disappeared into its own bowl. Dull bowl, bright contents.
     */
    const contents = which === "water" ? "#3f8fc4" : "#a86a24";
    const surface = which === "water" ? "#bfe8f8" : "#dda94e";
    const shell = which === "water" ? "#2d4a6e" : "#7d4522";
    const shellHi = which === "water" ? "#48709c" : "#a2643a";
    const shellLo = which === "water" ? "#1c2f47" : "#502b13";
    const bandY = levelRow(cx, BAND_LO)[1] + NOTCH_H;
    const bandTopY = levelRow(cx, BAND_HI)[1];
    return (
      <g
        ref={(el) => {
          bowlRefs.current[which] = el;
        }}
        style={{ transition: "transform 180ms steps(3, end)" }}
      >
        <path d={BOWL_SHADOW(cx)} fill="#0b0806" opacity={0.55} />
        {/* the outside: a lip wider than the body, then the tapering wall */}
        <path d={pxPath(bowlWall(cx))} fill={shell} />
        <path d={LIP_LIGHT(cx)} fill={shellHi} />
        <path d={LIP_SHADE(cx)} fill={shellLo} />
        {/* the inside, and the notches of contents standing in it */}
        <path d={pxPath(bowlWell(cx))} fill="#17130e" />
        {Array.from({ length: NOTCHES }, (_, i) => {
          const r = levelRow(cx, i + 1);
          return (
            <rect
              key={`n${
                // biome-ignore lint/suspicious/noArrayIndexKey: nine fixed notches
                i
              }`}
              ref={(el) => {
                rowRefs.current[which][i] = el;
              }}
              x={r[0]}
              y={r[1]}
              width={r[2]}
              height={NOTCH_H}
              fill={contents}
              style={{ display: "none" }}
            />
          );
        })}
        <rect
          ref={(el) => {
            surfaceRefs.current[which] = el;
          }}
          x={cx - 8}
          y={WELL_BOTTOM}
          width={16}
          height={1}
          fill={surface}
          style={{ display: "none" }}
        />
        {/*
         * The band: the line moulded into the inside of the bowl, and two ticks
         * on the outside wall so it can still be read once the bowl is full.
         */}
        <g
          ref={(el) => {
            bandRefs.current[which] = el;
          }}
          opacity={0.55}
          style={{ transition: "opacity 160ms steps(2, end)" }}
        >
          <path
            d={pxPath([
              [cx - 8, bandTopY, 16, 1],
              [cx - 8, bandY - 1, 16, 1],
            ])}
            fill="#f0e2c0"
            opacity={0.45}
          />
          <path
            d={pxPath([
              [cx - wallHw(bandY) - 3, bandY - 1, 4, 1],
              [cx + wallHw(bandY) - 1, bandY - 1, 4, 1],
              [cx - wallHw(bandTopY) - 3, bandTopY, 4, 1],
              [cx + wallHw(bandTopY) - 1, bandTopY, 4, 1],
            ])}
            fill="#f0e2c0"
          />
        </g>
        {/* right amount: the lip takes the light */}
        <g
          ref={(el) => {
            okRefs.current[which] = el;
          }}
          style={{ display: "none" }}
        >
          <path
            d={pxPath([
              [cx - LIP_HW, LIP_Y, LIP_HW * 2, 2],
              [cx - LIP_HW + 1, LIP_Y + 2, LIP_HW * 2 - 2, 1],
            ])}
            fill="#f6e6bc"
          />
          <path
            d={pxPath([[cx - LIP_HW, LIP_Y - 2, LIP_HW * 2, 1]])}
            fill="#f6e6bc"
            opacity={0.4}
          />
        </g>
        {/* where the pointer goes: the whole bowl, and it slides with it */}
        <rect
          x={cx - LIP_HW - 2}
          y={LIP_Y - 6}
          width={LIP_HW * 2 + 4}
          height={BOWL_FOOT - LIP_Y + 10}
          fill="transparent"
          style={{ pointerEvents: "all", cursor: "pointer" }}
          onPointerDown={(e) => {
            e.preventDefault();
            startPour(which);
          }}
        />
      </g>
    );
  };

  return (
    <MinigameShell
      w={W}
      h={H}
      bg="#1a160f"
      stageRef={stageRef}
      verdict={verdict}
      hint={
        phase === "done"
          ? ""
          : phase === "intro"
            ? i18n.t("minigame.bowlsIntro")
            : mastered
              ? "trzymaj na misce — nalej · klik na Grossa — czekaj · s — sucharek · esc"
              : "trzymaj na misce — nalej · klik na Grossa — czekaj · esc"
      }
    >
      {/* ------------------------------------------------ wall, and its damp */}
      <path d={WALL} fill="#2e2719" />
      <path d={WALL} fill={dth("n", "12")} opacity={0.5} />
      <path d={WALL_SEAM} fill="#231d13" opacity={0.8} />
      <path d={WALL_DAMP} fill="#262015" opacity={0.8} />

      {/* the radiator: the warmest place in the flat, which is why he lives here */}
      <path d={RAD_TOP} fill="#5a544a" />
      <path d={RAD_BODY} fill="#4a453d" />
      <path d={RAD_RIBS} fill="#3c3831" />
      <path d={RAD_BODY} fill={dth("n", "12")} opacity={0.4} />
      <path d={RAD_PIPE} fill="#3f3a33" />
      <path d={RAD_VALVE} fill="#6a6155" />

      {/* the clock, which is the whole HUD */}
      <path d={CLOCK_FACE} fill="#2b2419" />
      <path d={CLOCK_INNER} fill="#d8cdb2" />
      <path d={CLOCK_PIPS} fill="#3a3226" />
      {CLOCK_HANDS.map((d, i) => (
        <path
          key={`h${
            // biome-ignore lint/suspicious/noArrayIndexKey: twelve fixed hand positions
            i
          }`}
          ref={(el) => {
            handRefs.current[i] = el;
          }}
          d={d}
          fill="#241d13"
          style={{ display: i === 0 ? "" : "none" }}
        />
      ))}

      <path d={SKIRT} fill="#3d3220" />
      <path d={SKIRT_SHADOW} fill="#0d0b08" opacity={0.6} />

      {/* --------------------------------------------------------- the floor */}
      <path d={LINO} fill="#2a2318" />
      <path d={LINO_GRID} fill="#221c13" opacity={0.85} />
      <path d={LINO_SEAM} fill="#1b1610" opacity={0.8} />
      <path d={LINO_WORN} fill="#352c1e" opacity={0.7} />
      <path d={LINO} fill={dth("n", "06")} opacity={0.6} />
      <path d={PAWS} fill="#3a3122" opacity={0.8} />

      {/* first light, flat across everything, and the pool where it lands */}
      <Light set={shaft} />
      <Light set={pool} />

      {/* ------------------------------------- the vessels, standing behind */}
      <path d={JUG_SHADOW} fill="#0b0806" opacity={0.5} />
      <g
        ref={jugRef}
        style={{
          transformOrigin: "82px 140px",
          transition: "transform 200ms steps(3, end)",
        }}
      >
        <path d={JUG_BODY} fill="#8d99a2" />
        <path d={JUG_WATER} fill="#3d6f92" opacity={0.85} />
        <path d={JUG_HI} fill="#c3ccd2" opacity={0.6} />
        <path d={JUG_HANDLE} fill="#7c878f" />
        <path d={JUG_LIP} fill="#a4aeb5" />
      </g>
      <path d={SACK_SHADOW} fill="#0b0806" opacity={0.5} />
      <g
        ref={sackRef}
        style={{
          transformOrigin: "169px 140px",
          transition: "transform 200ms steps(3, end)",
        }}
      >
        <path d={SACK_BODY} fill="#8a6a3a" />
        <path d={SACK_ROLL} fill="#6f552c" />
        <path d={SACK_HI} fill="#a5834c" opacity={0.7} />
        <path d={SACK_LABEL} fill="#c3512f" opacity={0.85} />
      </g>

      {/* ------------------------------------------------------------- Gross */}
      {/*
       * Two groups, and it has to be two: the outer one carries his place in
       * the room as an SVG `transform` attribute, the inner one carries how far
       * he has crept as a CSS transform. A CSS transform REPLACES the attribute
       * rather than composing with it, so writing `style.transform` onto the
       * element that also had `transform="translate(...)"` put the dog at the
       * origin of the frame and left the room empty.
       */}
      <g transform={`translate(${DOG_STOPS[0]} ${DOG_FEET})`}>
        <g ref={dogRef} style={{ transition: "transform 260ms steps(4, end)" }}>
          <path d={DOG_SHADOW} fill="#0b0806" opacity={0.55} />
          <g ref={tailDownRef}>
            <path d={DOG_TAIL_DOWN} fill={LIMB} />
          </g>
          <g ref={tailUpRef} style={{ display: "none" }}>
            <path d={DOG_TAIL_UP} fill={LIMB} />
          </g>
          <path d={DOG_RUMP} fill={COAT} />
          <path d={DOG_LEG_FAR} fill={COAT_LO} />
          <path d={DOG_BODY} fill={COAT} />
          <path d={DOG_THIGH} fill="#513724" />
          <path d={DOG_BELLY} fill={COAT_LO} opacity={0.85} />
          <path d={DOG_TOPLINE} fill={COAT_HI} />
          <path d={DOG_LEG_NEAR} fill={LIMB} />
          <path d={DOG_PAWS} fill="#7a5a42" />
          {/* the head, in the two poses that matter: watching you, or in the bowl */}
          <g ref={headDownRef} style={{ display: "none" }}>
            <path d={HEAD_DOWN_NECK} fill={HEAD_C} />
            <path d={HEAD_DOWN} fill={HEAD_C} />
            <path d={HEAD_DOWN_HI} fill={COAT_HI} />
            <rect x={-42} y={-18} width={3} height={2} fill={JET} />
            <rect x={-26} y={-22} width={2} height={2} fill={JET} />
          </g>
          <g ref={headUpRef}>
            <path d={HEAD_UP_NECK} fill={HEAD_C} />
            <path d={HEAD_UP} fill={HEAD_C} />
            <path d={HEAD_UP_HI} fill={COAT_HI} />
            <path d={HEAD_UP_MUZZLE} fill={COAT_LO} opacity={0.7} />
            {/* the nose, and the eye that is on you and not on the bowl */}
            <rect x={-34} y={-45} width={3} height={3} fill={JET} />
            <rect x={-21} y={-47} width={3} height={3} fill={JET} />
            <rect x={-20} y={-46} width={1} height={1} fill="#c9a06a" />
            <rect x={-19} y={-39} width={6} height={1} fill={COAT_LO} opacity={0.6} />
          </g>
          <g ref={earsDownRef} style={{ display: "none" }}>
            <path d={EARS_DOWN} fill={EAR_C} />
          </g>
          <g ref={earsUpRef}>
            <path d={EARS_UP} fill={EAR_C} />
            <path d={EARS_UP_HI} fill={LIMB} />
          </g>
          {/* click him here: "czekaj" */}
          <rect
            x={-36}
            y={-64}
            width={44}
            height={44}
            fill="transparent"
            style={{ pointerEvents: "all", cursor: "pointer" }}
            onPointerDown={(e) => {
              e.preventDefault();
              scold();
            }}
          />
        </g>
      </g>

      {/* ----------------------------------------- the mat, nearest the eye */}
      <path d={MAT_AO} fill="#0b0806" opacity={0.55} />
      <path d={MAT_BACK} fill="#4a3b26" />
      <path d={MAT_BODY} fill="#32281b" />
      <path d={MAT_LIP} fill="#5c4a30" />
      <path d={MAT_WEAVE} fill="#3f3323" />
      <path d={MAT_FRINGE} fill="#463a26" />
      {/* what went over the side, in three stages */}
      {[0, 1, 2].map((i) => (
        <g
          key={`sp${i}`}
          ref={(el) => {
            spillRefs.current[i] = el;
          }}
          style={{ display: "none" }}
        >
          <path
            d={pxPath([
              [104 + i * 26, 156 + i, 22 - i * 4, 3],
              [110 + i * 26, 159 + i, 12, 2],
            ])}
            fill="#101a20"
            opacity={0.6}
          />
        </g>
      ))}

      {bowl("water")}
      {bowl("food")}

      {/* the streams, one per vessel, shown only while it is tipped */}
      <g
        ref={(el) => {
          streamRefs.current.water = el;
        }}
        style={{ display: "none" }}
      >
        <path d={pxPath([[99, 108, 2, 12]])} fill="#6fb4d8" opacity={0.85} />
        <path d={pxPath([[103, 118, 2, 12]])} fill="#6fb4d8" opacity={0.85} />
        <path d={pxPath([[107, 128, 2, 12]])} fill="#a8dcf0" opacity={0.7} />
      </g>
      <g
        ref={(el) => {
          streamRefs.current.food = el;
        }}
        style={{ display: "none" }}
      >
        <path
          d={pxPath([
            [180, 104, 2, 6],
            [184, 112, 2, 6],
            [188, 120, 2, 6],
            [192, 128, 2, 6],
          ])}
          fill="#c9762a"
        />
      </g>

      {/* the biscuit in your other hand, once he trusts you */}
      {mastered ? (
        <g ref={biscuitRef}>
          <path
            d={pxPath([
              [252, 128, 10, 5],
              [254, 126, 6, 2],
            ])}
            fill="#c9a05c"
          />
          <path d={pxPath([[254, 128, 6, 1]])} fill="#e8c68a" />
          <rect
            x={248}
            y={122}
            width={18}
            height={14}
            fill="transparent"
            style={{ pointerEvents: "all", cursor: "pointer" }}
            onPointerDown={(e) => {
              e.preventDefault();
              treat();
            }}
          />
        </g>
      ) : null}

      {bits.nodes}

      {/* the round has not started: he is sitting, and looking at you */}
      {phase === "intro" ? (
        <g>
          <rect x={0} y={0} width={W} height={H} fill="#0b0906" opacity={0.45} />
          <rect
            x={0}
            y={0}
            width={W}
            height={H}
            fill="transparent"
            style={{ pointerEvents: "all", cursor: "pointer" }}
            onPointerDown={(e) => {
              e.preventDefault();
              setPhase("playing");
            }}
          />
        </g>
      ) : null}
    </MinigameShell>
  );
}
