import type { ActionDef, PlayerConfig, SpriteMap, SpritePalette } from "../core/types";
import { createCharacter } from "./characterBuilder";

/**
 * animalBuilder — the four-legged rig.
 *
 * The human rig stacks a head on a torso on a pair of legs, because a person
 * seen from the front is three boxes in a column. An animal is not: it is a
 * barrel slung between four legs with a head on a neck at one end and a tail
 * at the other, and none of it stacks. So none of the human rig's machinery
 * carries over except the idea behind it — a spec names what an animal is, and
 * the code draws it.
 *
 * What replaces the stack is a skeleton. Every frame is a `Pose`: the two ends
 * of the trunk, the head, the nose, four paw positions, and the state of the
 * ears, eyes, mouth and tail. The painter is the only thing that knows a leg
 * is made of pixels. That is what buys the animation vocabulary — a walk is
 * four paw offsets, a scratch is one hind paw put next to an ear, a stretch is
 * the front of the trunk on the floor with the back of it in the air, and none
 * of them are hand-drawn.
 *
 * Everything is built from three primitives, because that is what an animal
 * actually is when you look at how anyone draws one: overlapping discs for the
 * masses, tapered capsules between them for the limbs and the barrel, and a
 * triangle for an ear. A capsule from the hip to the paw is a leg at any angle,
 * which is why the same four lines of code draw a dog standing, sitting,
 * walking and scratching its ear.
 *
 * The output is a PlayerConfig, so an animal goes anywhere an NPC goes.
 */

// ---------------------------------------------------------------------------
// the grid
// ---------------------------------------------------------------------------

/**
 * A quadruped is wide and low where a person is narrow and tall, so the grid
 * is the other way round from the human one: 40 columns and 26 rows.
 *
 * Both numbers are set by the worst case rather than the common one, because
 * every animal shares the grid. Forty columns is a tail tip to a nose on the
 * largest dog with the longest muzzle; twenty-six rows is that dog's ear tips
 * above the floor line with two rows to spare for a head thrown back in a
 * yawn. A small dog leaves a lot of it empty, which costs nothing — the actor
 * grounds a sprite on its lowest painted pixel, so the margin never reaches
 * the screen.
 */
const W = 40;
const ROWS = 26;
const FLOOR = ROWS - 1;

type Pt = readonly [x: number, y: number];
type Cell = { x: number; y: number; z: string };

const blank = (): string[] => Array.from({ length: ROWS }, () => ".".repeat(W));

/** Paint cells onto a map. The one way anything gets drawn. */
function paint(map: SpriteMap, cells: readonly Cell[]): string[] {
  const out = map.map((r) => [...r]);
  for (const { x, y, z } of cells) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (cy >= 0 && cy < ROWS && cx >= 0 && cx < W) out[cy][cx] = z;
  }
  return out.map((r) => r.join(""));
}

/**
 * Paint only where the map already has fur. A marking changes an animal's
 * colour and never its silhouette: a sock that painted outside the leg would
 * be a puddle.
 */
function tint(map: SpriteMap, cells: readonly Cell[], table: Record<string, string>): string[] {
  const out = map.map((r) => [...r]);
  // once per pixel, however many marks overlap it. Tabby bars cross the spine
  // stripe, and a pixel darkened twice came out two steps down the ramp — the
  // black speckle that made a grey cat look like it had been shot at.
  const done = new Set<number>();
  for (const { x, y } of cells) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (cy < 0 || cy >= ROWS || cx < 0 || cx >= W) continue;
    const key = cy * W + cx;
    if (done.has(key)) continue;
    const to = table[out[cy][cx]];
    if (to) {
      out[cy][cx] = to;
      done.add(key);
    }
  }
  return out.map((r) => r.join(""));
}

/** Fur under a marking: two tones, because a marking is a coat and not a decal. */
const LIGHTEN: Record<string, string> = { f: "m", l: "m", F: "M", u: "m", U: "M" };
/** A tabby's stripe is the same coat one step down, not a second colour. */
const DARKEN: Record<string, string> = { l: "f", f: "F", u: "U", m: "M" };

/** A filled ellipse — a skull, a haunch, a shoulder, a paw. */
function disc(cx: number, cy: number, rx: number, ry: number, z: string): Cell[] {
  const cells: Cell[] = [];
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / Math.max(0.01, rx);
      const dy = (y - cy) / Math.max(0.01, ry);
      if (dx * dx + dy * dy <= 1.02) cells.push({ x, y, z });
    }
  }
  // a disc smaller than a pixel still has to be a pixel. Without this a capsule
  // that tapers below half a pixel — a muzzle tip, the end of a whip tail —
  // drops samples and comes out as a dotted line with the tip floating free.
  if (cells.length === 0) cells.push({ x: Math.round(cx), y: Math.round(cy), z });
  return cells;
}

/**
 * The shape between two circles: a ribcage, a thigh, a neck, a tail segment.
 * Sampled along its axis rather than solved, because at this size the two are
 * indistinguishable and a sampled capsule never opens a hole at a joint.
 */
function capsule(a: Pt, ra: number, b: Pt, rb: number, z: string): Cell[] {
  const steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
  const cells: Cell[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    cells.push(
      ...disc(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        ra + (rb - ra) * t,
        ra + (rb - ra) * t,
        z,
      ),
    );
  }
  return cells;
}

/**
 * A rounded rectangle: vertical walls, a flat top, four blunted corners.
 *
 * The one shape a capsule cannot make, and the only shape a loafing cat is.
 * Posed out of the general trunk — two circles with a taper between them — a
 * loaf comes out as a lying cat with its legs hidden, because a capsule has no
 * flat anywhere on it. The whole joke of the pose is that the animal has
 * stopped being animal-shaped, so it gets its own primitive.
 */
function slab(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  round: number,
  z: string,
): Cell[] {
  const cells: Cell[] = [];
  for (let y = Math.round(cy - halfH); y <= Math.round(cy + halfH); y++) {
    for (let x = Math.round(cx - halfW); x <= Math.round(cx + halfW); x++) {
      const dx = Math.abs(x - cx) - (halfW - round);
      const dy = Math.abs(y - cy) - (halfH - round);
      if (dx > 0 && dy > 0 && dx * dx + dy * dy > round * round + 0.3) continue;
      cells.push({ x, y, z });
    }
  }
  return cells;
}

/**
 * The ragged edge where one colour of coat gives way to another.
 *
 * A marking solved as a shape has a boundary one pixel wide and dead straight
 * along its whole length, which reads as paint rather than as fur — the saddle
 * on a shepherd looked like a horse blanket for exactly this reason. Given the
 * marking and the same marking a size larger, this keeps a hashed share of the
 * ring between the two: a few hairs of the top colour reaching down past the
 * line, in a pattern that is fixed per pixel so it does not crawl from frame
 * to frame.
 */
function feather(core: readonly Cell[], grown: readonly Cell[], every: number): Cell[] {
  const inside = new Set(core.map((c) => Math.round(c.y) * W + Math.round(c.x)));
  return scatter(
    grown.filter((c) => !inside.has(Math.round(c.y) * W + Math.round(c.x))),
    every,
  );
}

/**
 * A hashed share of a set of cells: a broken line, a few loose hairs, a
 * dapple. Fixed per pixel rather than random, so a marking is the same
 * marking on every frame instead of crawling as the animal moves.
 */
function scatter(cells: readonly Cell[], every: number): Cell[] {
  return cells.filter(
    ({ x, y }) =>
      ((Math.imul(Math.round(x), 668265263) ^ Math.imul(Math.round(y), 374761393)) >>> 5) %
        every ===
      0,
  );
}

/** A filled triangle. Ears, and nothing else. */
function tri(p0: Pt, p1: Pt, p2: Pt, z: string): Cell[] {
  const cells: Cell[] = [];
  const side = (a: Pt, b: Pt, x: number, y: number) =>
    (x - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (y - b[1]);
  for (
    let y = Math.floor(Math.min(p0[1], p1[1], p2[1]));
    y <= Math.ceil(Math.max(p0[1], p1[1], p2[1]));
    y++
  ) {
    for (
      let x = Math.floor(Math.min(p0[0], p1[0], p2[0]));
      x <= Math.ceil(Math.max(p0[0], p1[0], p2[0]));
      x++
    ) {
      const d1 = side(p0, p1, x, y);
      const d2 = side(p1, p2, x, y);
      const d3 = side(p2, p0, x, y);
      const neg = d1 < -0.2 || d2 < -0.2 || d3 < -0.2;
      const pos = d1 > 0.2 || d2 > 0.2 || d3 > 0.2;
      if (!(neg && pos)) cells.push({ x, y, z });
    }
  }
  return cells;
}

const unit = (from: Pt, to: Pt): Pt => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const m = Math.hypot(dx, dy) || 1;
  return [dx / m, dy / m];
};
const along = (p: Pt, d: Pt, k: number): Pt => [p[0] + d[0] * k, p[1] + d[1] * k];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
/** Degrees, measured from "straight back" and turning up through vertical. */
const heading = (deg: number): Pt => {
  const r = (deg * Math.PI) / 180;
  return [-Math.cos(r), -Math.sin(r)];
};

// ---------------------------------------------------------------------------
// colour
// ---------------------------------------------------------------------------

type Hsl = { h: number; s: number; l: number };
const HEX6 = /^#([0-9a-f]{6})$/i;

function toHsl(hex: string): Hsl | null {
  const match = HEX6.exec(hex.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const c = max - min;
  const l = (max + min) / 2;
  if (c === 0) return { h: 0, s: 0, l };
  const sixth = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return { h: (sixth * 60 + 360) % 360, s: c / (1 - Math.abs(2 * l - 1)), l };
}

function toHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const floor = l - c / 2;
  const sector = Math.floor((((h % 360) + 360) % 360) / 60) % 6;
  const rgb: [number, number, number] =
    sector === 0
      ? [c, x, 0]
      : sector === 1
        ? [x, c, 0]
        : sector === 2
          ? [0, c, x]
          : sector === 3
            ? [0, x, c]
            : sector === 4
              ? [x, 0, c]
              : [c, 0, x];
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round((v + floor) * 255)));
  return `#${((1 << 24) | (byte(rgb[0]) << 16) | (byte(rgb[1]) << 8) | byte(rgb[2])).toString(16).slice(1)}`;
}

/**
 * The three tones of a coat.
 *
 * Fur is not cloth, and the difference is the whole reason this is not the
 * NPC ramp with different numbers. Cloth has a flat dyed surface and takes a
 * hard step into shadow. Fur is a thousand translucent hairs: light gets into
 * it and comes back warmer, so the lit tone bleaches toward yellow at the
 * tips, and the shadow keeps almost all of its colour rather than going grey —
 * a red dog's shaded flank is still obviously red, only deeper. A ramp that
 * mixed toward black gave a shiba a slate-grey underside, which is the one
 * mistake that makes a warm animal read as taxidermy.
 */
const FUR_DROP = 0.4;
const FUR_CLIMB = 0.19;
/**
 * Degrees the hue turns off the base, and which way round.
 *
 * The split is the one from the people's palette and for the same reason: a
 * warm coat darkens toward red and bleaches toward yellow, a cool one darkens
 * toward violet and lifts toward cyan. Turned the wrong way, a red-fawn dog
 * gets a salmon-pink back and a mustard-coloured shadow — the highlight looked
 * like sunburn, which is how this was found.
 */
const FUR_SHADE_TURN = 9;
const FUR_LIT_TURN = 11;
const WARM_ARC_END = 40;
const COOL_ARC_END = 250;
const turnDirection = (h: number): 1 | -1 => (h >= WARM_ARC_END && h < COOL_ARC_END ? 1 : -1);
/** Shadows stop here — pure black on a small sprite reads as a hole. */
const SHADE_FLOOR_L = 0.06;
const LIT_CEIL_L = 0.95;
/** A pale coat keeps more of its lightness in shade than a dark one does. */
const LIGHT_RELIEF = 0.4;
const MAX_SAT_GAIN = 1.3;
/** Below this there is no hue to protect: a white cat borrows the light's own. */
const ACHROMATIC_S = 0.07;
const SHADOW_TINT_HUE = 226;
const WARM_TINT_HUE = 42;
const MIN_SHADE_CHROMA = 0.055;

type Ramp = { lit: string; base: string; shade: string };

function furRamp(hex: string): Ramp {
  const hsl = toHsl(hex);
  if (!hsl) return { lit: hex, base: hex, shade: hex };
  const { h, s, l } = hsl;
  const chroma = s * (1 - Math.abs(2 * l - 1));
  const achromatic = s < ACHROMATIC_S;
  const shadeL = Math.max(SHADE_FLOOR_L, l * (1 - FUR_DROP * (1 - LIGHT_RELIEF * l)));
  const litL = Math.min(LIT_CEIL_L, l + (LIT_CEIL_L - l) * FUR_CLIMB);
  const wrap = (v: number) => ((v % 360) + 360) % 360;
  const satFor = (c: number, toneL: number) => {
    const room = 1 - Math.abs(2 * toneL - 1);
    return room < 1e-4 ? 0 : Math.min(1, c / room);
  };
  const carry = (target: number, toneL: number, floor: number) =>
    Math.min(1, Math.max(Math.min(satFor(target, toneL), s * MAX_SAT_GAIN), satFor(floor, toneL)));
  return {
    // the tips catch the sun and give up chroma doing it
    lit: toHex({
      h: achromatic ? WARM_TINT_HUE : wrap(h - turnDirection(h) * FUR_LIT_TURN),
      s: carry(chroma * 0.78, litL, 0.04),
      l: litL,
    }),
    base: hex,
    shade: toHex({
      h: achromatic ? SHADOW_TINT_HUE : wrap(h + turnDirection(h) * FUR_SHADE_TURN),
      s: carry(chroma * 1.08, shadeL, MIN_SHADE_CHROMA),
      l: shadeL,
    }),
  };
}

/**
 * Named coats. A spec says `fur: "redFawn"`, never a hex — same rule as the
 * people. Named after the animal rather than the hue wherever the animal is
 * more specific than the hue: a shiba's red is not orange, it is a shiba's
 * red, and there is no other reason for that exact number to exist.
 */
export const ANIMAL_FURS = {
  /** Shiba red. Orange underneath, never brown. */
  redFawn: "#b8763a",
  cream: "#e0cfab",
  /** Red hairs with black tips — a sesame shiba, an agouti anything. */
  sesame: "#8d6942",
  /** The orange tabby off every Polish estate. */
  ginger: "#c1742d",
  sand: "#cfab73",
  chestnut: "#8a4f2a",
  chocolate: "#59392a",
  /** Blue-black. Warm black is the tell of a sepia palette. */
  black: "#25252e",
  charcoal: "#3b3e46",
  /** Russian blue, and every grey cat that has ever sat on a bin shed. */
  slate: "#6c7681",
  smoke: "#99a0a6",
  white: "#e7e3d8",
  golden: "#cca052",
  fawn: "#c7a67c",
  /** Dust and dishwater: a stray's colour. */
  ash: "#8a857a",
  ink: "#1f212a",
} as const;

/**
 * Noses, eyes and collars. Not coats — a nose is skin and an eye is glass, and
 * neither belongs in a list of furs where somebody might put one on a dog.
 */
export const ANIMAL_TRIM = {
  jet: "#241f26",
  liver: "#77503f",
  rose: "#c88d8d",
  amber: "#b57a2a",
  hazel: "#6a4a24",
  copper: "#9c5a24",
  jade: "#3f7a55",
  olive: "#5d6b34",
  ice: "#7fa3bd",
  red: "#b23129",
  navy: "#243a63",
  forest: "#2d5236",
  oxblood: "#6d2a2d",
  tan: "#a97c4a",
  cherry: "#8f2f36",
  steel: "#6f7d8c",
} as const;

export type FurName = keyof typeof ANIMAL_FURS;
export type TrimName = keyof typeof ANIMAL_TRIM;

/** A named coat, a named trim, or somebody's literal hex. In that order. */
function colour(name: string): string {
  return (
    (ANIMAL_FURS as Record<string, string>)[name] ??
    (ANIMAL_TRIM as Record<string, string>)[name] ??
    name
  );
}

/**
 * Zone letters. Lower case is the material as it is, upper case the same in
 * shadow.
 *
 *   f F l   coat, shade, sunlit tips     u U   belly and underside, shade
 *   m M     markings, shade              n     nose leather and paw pads
 *   e w     eye, and the glint in it     t     tongue and gum
 *   c C     collar, shade                k     claw
 *   d       occlusion: inside an ear, under a belly, behind a foreleg
 */
export type AnimalZone =
  | "f"
  | "F"
  | "l"
  | "u"
  | "U"
  | "m"
  | "M"
  | "n"
  | "e"
  | "w"
  | "t"
  | "c"
  | "C"
  | "k"
  | "d";

/** Where the light does not reach. Mixed off the coat rather than fixed, so a
 * black cat's contact shadow is not the same pixel as a cream one's — a flat
 * near-black under a pale animal reads as a hole cut in the floor. */
const SHADOW_TOWARD = "#0f0c14";
const SHADOW_MIX = 0.52;
const GLINT = "#efe9dc";
const TONGUE = "#c0707c";
const CLAW = "#cfc3ac";

/** Mix a hex toward another. Used where two materials meet, not for shading. */
function mix(hex: string, toward: string, amount: number): string {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(toward.slice(1), 16);
  const ch = (shift: number) => {
    const va = (a >> shift) & 255;
    const vb = (b >> shift) & 255;
    return Math.round(va + (vb - va) * amount);
  };
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

export function animalPalette(look: AnimalLook = {}): SpritePalette {
  const coat = furRamp(colour(look.fur ?? "redFawn"));
  const under = furRamp(colour(look.belly ?? "cream"));
  const mark = furRamp(colour(look.patch ?? look.belly ?? "cream"));
  const collar = furRamp(colour(look.collar ?? "red"));
  return {
    f: coat.base,
    F: coat.shade,
    l: coat.lit,
    u: under.base,
    U: under.shade,
    m: mark.base,
    M: mark.shade,
    n: colour(look.nose ?? "jet"),
    e: colour(look.eye ?? "hazel"),
    w: GLINT,
    t: TONGUE,
    c: collar.base,
    C: collar.shade,
    k: CLAW,
    d: mix(coat.shade, SHADOW_TOWARD, SHADOW_MIX),
  };
}

// ---------------------------------------------------------------------------
// proportions
// ---------------------------------------------------------------------------

export type AnimalSpecies = "cat" | "dog";
export type AnimalSize = "tiny" | "small" | "medium" | "large";
export type AnimalEars = "prick" | "folded" | "drop" | "tufted";
export type AnimalTail = "curled" | "plume" | "whip" | "stub" | "bushy";
export type AnimalMuzzle = "short" | "medium" | "long";
export type AnimalCoat = "short" | "medium" | "fluffy";
export type AnimalPattern = "solid" | "tabby" | "patched" | "socks" | "mask" | "saddle";

/**
 * Floor to elbow. This one number is most of what separates a dachshund from
 * a wolfhound, and it is measured in whole rows because a leg that is 6.5 rows
 * long has a paw half a pixel into the floor.
 */
const LEG: Record<AnimalSize, number> = { tiny: 4, small: 6, medium: 7, large: 9 };
/** The ribcage's radius at its deepest. */
const CHEST: Record<AnimalSize, number> = { tiny: 2.5, small: 3.0, medium: 3.4, large: 3.9 };
/** Croup to chest, in columns. A body is about as long as the animal is tall. */
const SPAN: Record<AnimalSize, number> = { tiny: 9, small: 11, medium: 12, large: 14 };
/**
 * Nose forward of the front of the skull. Small numbers, because a muzzle
 * drawn at the length a real one is — half the head again — comes out as a
 * two-pixel spike with a nose on the end, and every dog in the game looked
 * like an anteater until these came down.
 */
const MUZZLE: Record<AnimalMuzzle, number> = { short: 0.7, medium: 1.7, long: 2.7 };

type Anatomy = {
  species: AnimalSpecies;
  /** floor to elbow, which is what every folded pose measures against */
  leg: number;
  /** the trunk, standing square */
  rear: Pt;
  fore: Pt;
  rearR: number;
  foreR: number;
  hipR: number;
  shoulderR: number;
  legR: number;
  neckR: number;
  headRx: number;
  headRy: number;
  /** the head's centre when the animal is standing and looking ahead */
  head: Pt;
  muzzle: number;
  muzzleR: number;
  earH: number;
  earW: number;
  tailR: number;
  /** degrees added to every tail carriage: a cat holds its up, a dog does not */
  tailLift: number;
  frontPaw: number;
  hindPaw: number;
};

/**
 * Where everything on this animal is.
 *
 * Both ends of the trunk sit on the same horizontal axis and the front one is
 * fatter, which gets two things for free that would otherwise be hand-drawn:
 * the withers come out higher than the croup, and the loin tucks up above the
 * brisket. That is the outline of a dog. A cat gets a shallower chest and a
 * longer back, so the same construction gives a tube where the dog gives a
 * wedge — which is the actual difference between the two animals at this size,
 * far more than the ears are.
 */
function anatomy(species: AnimalSpecies, size: AnimalSize, look: AnimalLook): Anatomy {
  const cat = species === "cat";
  // a cat stands taller on its legs relative to how deep it is through the body
  const leg = LEG[size];
  const foreR = CHEST[size] * (cat ? 0.86 : 1);
  const rearR = foreR - (cat ? 0.4 : 0.85);
  const span = SPAN[size] - (cat ? 1 : 0);
  const axisY = FLOOR - leg - foreR;
  const rearX = 11;
  const foreX = rearX + span;
  // a cat's head is nearly as big as a dog's on half the body, which is most
  // of why a cat reads as a cat: the skull is round and the muzzle is barely
  // there, where a dog is the other way round
  const headRx = cat ? foreR * 0.98 : foreR * 0.96;
  const headRy = cat ? foreR * 0.92 : foreR * 0.86;
  // the neck carries the skull up and forward off the withers; a cat's is
  // longer and lower, which is why a cat can look round a corner and a dog
  // has to lean
  const headUp = cat ? foreR * 1.15 : foreR * 1.25;
  const headFwd = cat ? 4.4 : 4.0;
  return {
    species,
    leg,
    rear: [rearX, axisY],
    fore: [foreX, axisY],
    rearR,
    foreR,
    hipR: rearR + 0.35,
    shoulderR: foreR - 0.5,
    legR: cat ? 1.05 : 1.15,
    neckR: cat ? foreR * 0.44 : foreR * 0.58,
    headRx,
    headRy,
    head: [foreX + headFwd, axisY - headUp],
    muzzle: MUZZLE[look.muzzle ?? (cat ? "short" : "medium")],
    muzzleR: cat ? headRy * 0.6 : headRy * 0.72,
    /**
     * Wide at the base and barely taller than it is wide. Authored at the
     * proportion a real prick ear has — half again as tall as its base — an
     * ear comes out one pixel across for its top two rows and reads as an
     * aerial. Everything on a sprite this size has to be squatter than the
     * animal it is copied from, and an ear is where that bites hardest.
     */
    earH: headRy * (cat ? 1.05 : 1.0),
    earW: headRy * (cat ? 1.45 : 1.5),
    tailR: cat ? 1.3 : 1.0,
    tailLift: cat ? 34 : 0,
    frontPaw: foreX - 1,
    hindPaw: rearX - 1,
  };
}

// ---------------------------------------------------------------------------
// the pose
// ---------------------------------------------------------------------------

type FrontFold = "stand" | "forward" | "tuck" | "reach" | "hidden";
type HindFold = "stand" | "sit" | "fold" | "reach" | "hidden";
type EyeState = "open" | "half" | "shut" | "wide" | "wink";
type MouthState = "shut" | "open" | "pant" | "yawn" | "bark" | "lick" | "lap";
type TailFold = "free" | "tuck" | "wrap";

/**
 * One drawn animal. Everything a frame needs, in grid coordinates: a frame is
 * data and the painter is the only code that knows what a leg looks like.
 */
type Pose = {
  /** the trunk's two ends and how thick it is at each */
  rear: Pt;
  fore: Pt;
  rearR: number;
  foreR: number;
  /** the skull's centre, and the tip of the nose. Everything on the head — the
   * eye, the ears, the mouth — is placed off the line between the two, so one
   * pair of numbers turns a head down into a bowl or up at a person. */
  head: Pt;
  nose: Pt;
  /** looking at you rather than past you */
  face: "side" | "front";
  fn: Pt;
  ff: Pt;
  hn: Pt;
  hf: Pt;
  front: FrontFold;
  hind: HindFold;
  /** degrees off the tail's resting carriage: a wag, a flick, a lash */
  tailSwing: number;
  tailFold: TailFold;
  /** each ear's heading in degrees: 90 is straight up, 180 flat back */
  earNear: number;
  earFar: number;
  eyes: EyeState;
  mouth: MouthState;
  /** a curl on the floor is one mass, not a trunk with legs under it */
  curl?: { at: Pt; r: number };
  /** a loaf is a brick: no trunk, no legs, no neck, and four blunt corners */
  block?: { at: Pt; halfW: number; halfH: number; round: number };
};

/**
 * Ear carriage, in the same degrees the tail uses: 0 points straight back
 * along the spine and 90 points straight up, so anything over 90 is pricked
 * toward whatever the animal is looking at and anything under it is going
 * back. The four settings between them carry most of what an animal is
 * saying at any moment — an ear is the loudest two pixels on the sprite.
 */
const EAR_FWD = 110;
const EAR_UP = 92;
const EAR_HALF = 62;
const EAR_BACK = 34;
const EAR_FLAT = 12;

/** A standing animal, from which nearly every other pose is a small edit. */
function standPose(a: Anatomy): Pose {
  return {
    rear: a.rear,
    fore: a.fore,
    rearR: a.rearR,
    foreR: a.foreR,
    head: a.head,
    nose: [a.head[0] + a.headRx + a.muzzle, a.head[1] + 0.7],
    face: "side",
    fn: [a.frontPaw, FLOOR],
    ff: [a.frontPaw - 1.1, FLOOR],
    hn: [a.hindPaw, FLOOR],
    hf: [a.hindPaw - 1.1, FLOOR],
    front: "stand",
    hind: "stand",
    tailSwing: 0,
    tailFold: "free",
    earNear: EAR_UP,
    earFar: EAR_UP,
    eyes: "open",
    mouth: "shut",
  };
}

// ---------------------------------------------------------------------------
// limbs
// ---------------------------------------------------------------------------

/**
 * A hind leg. Thigh forward and down to the stifle, then *back* to the hock,
 * then straight down the cannon to the paw — the zigzag that is the single
 * silhouette separating a dog from a coffee table. Drawing it as a straight
 * column, which is what the old sprite did, is why nothing before this could
 * sit down convincingly.
 */
function hindLeg(a: Anatomy, hip: Pt, paw: Pt, fold: HindFold, z: string, dark: string): Cell[] {
  const r = a.legR;
  if (fold === "hidden") return [];
  if (fold === "reach") {
    // two bones and a target: the leg that comes up to scratch an ear
    const knee = along(mid(hip, paw), unit(hip, paw), 0);
    const bend: Pt = [knee[0] - 2, knee[1] + 1];
    return [
      ...capsule(hip, r * 1.6, bend, r * 1.15, z),
      ...capsule(bend, r * 1.15, paw, r * 0.8, z),
      ...disc(paw[0], paw[1], r + 0.3, r + 0.3, dark),
    ];
  }
  if (fold === "sit" || fold === "fold") {
    // hock on the ground and the metatarsus lying flat along it, which is what
    // a sitting animal actually does with its back legs
    const stifle: Pt = [hip[0] + 2.6, Math.min(FLOOR - 2, hip[1] + 4.4)];
    const hock: Pt = [hip[0] - 0.8, FLOOR - 1];
    return [
      ...capsule(hip, r * 1.9, stifle, r * 1.35, z),
      ...capsule(stifle, r * 1.35, hock, r * 1.05, z),
      ...capsule(hock, r * 1.05, [paw[0], FLOOR - 0.4], r * 0.95, z),
      ...disc(paw[0] + 0.4, FLOOR - 0.2, r + 0.7, 0.9, z),
      ...disc(paw[0] + 0.4, FLOOR, r + 0.5, 0.5, dark),
    ];
  }
  const drop = paw[1] - hip[1];
  const stifle: Pt = [hip[0] + 2.2, hip[1] + drop * 0.42];
  const hock: Pt = [paw[0] - 1.4, hip[1] + drop * 0.74];
  return [
    ...capsule(hip, r * 1.8, stifle, r * 1.3, z),
    ...capsule(stifle, r * 1.3, hock, r * 0.95, z),
    ...capsule(hock, r * 0.95, [paw[0], paw[1] - 0.6], r * 0.85, z),
    ...disc(paw[0] + 0.3, paw[1] - 0.3, r + 0.5, 0.9, dark),
  ];
}

/** A front leg: a straight column off the shoulder, or folded away under it. */
function frontLeg(
  a: Anatomy,
  shoulder: Pt,
  paw: Pt,
  fold: FrontFold,
  z: string,
  dark: string,
): Cell[] {
  const r = a.legR;
  if (fold === "hidden") return [];
  if (fold === "tuck") {
    // folded under the chest: only the paw shows past the elbow
    return disc(shoulder[0] + 1.4, FLOOR - 0.4, r + 1.1, 1.0, z);
  }
  if (fold === "reach") {
    const bend: Pt = [mid(shoulder, paw)[0] - 1, mid(shoulder, paw)[1] + 0.6];
    return [
      ...capsule(shoulder, r * 1.5, bend, r * 1.1, z),
      ...capsule(bend, r * 1.1, paw, r * 0.85, z),
      ...disc(paw[0], paw[1], r + 0.3, r + 0.3, dark),
    ];
  }
  if (fold === "forward") {
    // elbow down, then the pastern lying forward along the floor
    const elbow: Pt = [shoulder[0], FLOOR - 1.4];
    return [
      ...capsule(shoulder, r * 1.45, elbow, r * 1.05, z),
      ...capsule(elbow, r * 1.05, [paw[0] - 0.6, FLOOR - 0.4], r * 0.95, z),
      ...disc(paw[0], FLOOR - 0.2, r + 0.7, 0.9, z),
      ...disc(paw[0], FLOOR, r + 0.5, 0.5, dark),
    ];
  }
  const elbow: Pt = [shoulder[0] - 0.2, shoulder[1] + (paw[1] - shoulder[1]) * 0.5];
  return [
    ...capsule(shoulder, r * 1.5, elbow, r * 1.1, z),
    ...capsule(elbow, r * 1.1, [paw[0], paw[1] - 0.6], r * 0.9, z),
    ...disc(paw[0] + 0.3, paw[1] - 0.3, r + 0.5, 0.9, z),
    ...disc(paw[0] + 0.3, paw[1], r + 0.3, 0.5, dark),
  ];
}

// ---------------------------------------------------------------------------
// tail
// ---------------------------------------------------------------------------

/** Where a tail starts out pointing, and how hard it keeps turning. */
const TAIL_SET: Record<AnimalTail, { angle: number; curl: number; len: number; r: number }> = {
  /** Over the loin in a ring. A shiba, an akita, a spitz. */
  curled: { angle: 68, curl: 23, len: 8, r: 1.2 },
  /** A flag: up and back, opening out as it goes. */
  plume: { angle: 52, curl: -4, len: 8, r: 1.25 },
  /**
   * Thin, level, faintly hooked. A cat carries it up; a hound holds it out.
   * "Thin" still has to mean three pixels at the root: at two it is a wire
   * drawn beside the animal rather than something growing out of it, and a
   * cat's tail is up and in shot most of the time the cat is awake.
   */
  whip: { angle: 22, curl: -4, len: 7, r: 1.05 },
  stub: { angle: 46, curl: 14, len: 3, r: 1.1 },
  /**
   * Low and heavy: back off the croup, then down in a sabre curve to somewhere
   * around the hock. Eight segments at a gentle turn stopped level with the
   * rump and read as docked, so it is longer now and turns harder — the length
   * goes into the drop rather than into the reach, which also keeps the tip
   * of a big dog's tail on the canvas.
   */
  bushy: { angle: -4, curl: -11, len: 9, r: 1.45 },
};

/**
 * The tail, walked one segment at a time with the heading turning by a fixed
 * amount each step. Every carriage in the table is those three numbers, which
 * is why a wag is one added degree count rather than five drawn tails: the
 * whole spine re-solves and the tip travels the arc it should.
 */
function tailCells(a: Anatomy, kind: AnimalTail, base: Pt, p: Pose, z: string, grow = 0): Cell[] {
  const set = TAIL_SET[kind];
  const fluff = a.tailR / 1.0 + grow;
  if (p.tailFold === "wrap") {
    /**
     * Round the front, along the floor. An animal sitting on its own tail
     * carries it forward past the paws, and a heading-walked tail cannot do
     * that — sent backward it drags across the ground behind and reads as a
     * smear rather than as a tail.
     */
    const cells: Cell[] = [];
    // started at the chest and not at the rump: a wrapped tail only exists on
    // screen where it clears the body, and every column of it behind the
    // shoulder is drawn underneath an animal that is sitting on it
    let at: Pt = [p.fore[0] - 2, FLOOR - 0.6];
    for (let i = 0; i < set.len; i++) {
      const t = i / set.len;
      // slimmer than the same tail carried: what is drawn here is a tail seen
      // lying flat on the floor and going away from the viewer, not one held
      // up broadside
      const r = Math.max(0.5, set.r * fluff * 0.5 * (1 - t * 0.25));
      const next: Pt = [at[0] + 1.15, FLOOR - 0.6 - Math.max(0, (t - 0.6) * 7)];
      cells.push(...capsule(at, r, next, r, z));
      at = next;
    }
    return cells;
  }
  const swing = p.tailSwing;
  let angle = set.angle + a.tailLift + (p.tailFold === "tuck" ? -70 : swing);
  let at: Pt = base;
  const cells: Cell[] = [];
  const steps = set.len;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const r = set.r * fluff * (1 - t * (kind === "whip" ? 0.32 : 0.28));
    const next = along(at, heading(angle), 1.15);
    cells.push(...capsule(at, r, next, Math.max(0.5, r * 0.9), z));
    at = next;
    angle += set.curl;
  }
  return cells;
}

/** How wide and how tall a curled animal is, against the radius it curls at. */
const CURL_WIDE = 1.33;
const CURL_TALL = 0.93;

/** A curled tail is drawn over the back it lies on; every other one hangs behind. */
const OVER_THE_BACK: AnimalTail = "curled";

/**
 * The tail of a sleeping animal, which obeys no carriage table at all: it
 * follows the outside of the curled mass, over the back from the rump and down
 * the front until the tip is somewhere near the nose. Solved off the mass's own
 * ellipse rather than by walking a heading, because a tail that wraps has to
 * stay exactly one hair clear of the body the whole way round and a walked
 * heading drifts off it within four steps.
 */
function wrapTail(a: Anatomy, at: Pt, r: number, thick: number, z: string): Cell[] {
  const rx = r * 1.52;
  const ry = r * 1.06;
  const FROM = 172;
  const TO = 8;
  const steps = 11;
  const cells: Cell[] = [];
  let prev: Pt | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const th = ((FROM + (TO - FROM) * t) * Math.PI) / 180;
    const here: Pt = [at[0] + rx * Math.cos(th), at[1] - ry * Math.sin(th)];
    const w = thick * a.tailR * (1 - t * 0.35);
    if (prev) cells.push(...capsule(prev, w, here, w, z));
    prev = here;
  }
  return cells;
}

// ---------------------------------------------------------------------------
// head
// ---------------------------------------------------------------------------

function earCells(
  a: Anatomy,
  kind: AnimalEars,
  base: Pt,
  deg: number,
  z: string,
  inner: string,
): Cell[] {
  const d = heading(deg);
  const side: Pt = [-d[1], d[0]];
  const tip = along(base, d, a.earH);
  const l: Pt = [base[0] - side[0] * a.earW * 0.5, base[1] - side[1] * a.earW * 0.5];
  const r: Pt = [base[0] + side[0] * a.earW * 0.5, base[1] + side[1] * a.earW * 0.5];
  switch (kind) {
    case "drop": {
      // hangs from the base and falls past the cheek, so it takes the heading
      // only as a hint and gravity for the rest
      const hang: Pt = [base[0] + d[0] * 0.8, base[1] + a.earH * 1.15];
      return [
        ...capsule(base, a.earW * 0.55, hang, a.earW * 0.5, z),
        ...disc(hang[0], hang[1], a.earW * 0.5, 0.9, inner),
      ];
    }
    case "folded": {
      // the top third flops forward: a small triangle with its point turned over
      const knuckle = along(base, d, a.earH * 0.55);
      const over = along(knuckle, heading(deg - 62), a.earH * 0.5);
      return [...tri(l, r, knuckle, z), ...capsule(knuckle, a.earW * 0.42, over, a.earW * 0.3, z)];
    }
    case "tufted":
      return [
        ...tri(l, r, tip, z),
        ...tri(
          [l[0] + side[0] * 0.8, l[1] + side[1] * 0.8],
          [r[0] - side[0] * 0.8, r[1] - side[1] * 0.8],
          along(base, d, a.earH * 0.5),
          inner,
        ),
        // the lynx tip: two hairs past the point, and the ear reads as a cat's
        ...capsule(tip, 0.5, along(tip, d, 1.6), 0.4, z),
      ];
    default: {
      /**
       * A prick ear, drawn with its point cut off. A true triangle tapers to
       * one pixel for its top two rows however wide the base is, and one pixel
       * standing above a head is an aerial rather than an ear — the single
       * most conspicuous fault in the first two passes of this rig. Every
       * pixel artist blunts the tip; this blunts it by a little over half a
       * pixel each way, which is the smallest amount that reads.
       */
      const cut = 0.6;
      const tipL: Pt = [tip[0] - side[0] * cut, tip[1] - side[1] * cut];
      const tipR: Pt = [tip[0] + side[0] * cut, tip[1] + side[1] * cut];
      return [
        ...tri(l, r, tipR, z),
        ...tri(l, tipR, tipL, z),
        ...tri(
          [l[0] + side[0] * 0.9, l[1] + side[1] * 0.9],
          [r[0] - side[0] * 0.9, r[1] - side[1] * 0.9],
          along(base, d, a.earH * 0.6),
          inner,
        ),
      ];
    }
  }
}

/**
 * The head's own frame: which way is back along the skull, and which way is up
 * off it.
 *
 * Everything on a head has to be placed in this and not in the world's, and
 * finding that out cost the first two rounds of this rig. An ear pinned to
 * world-up sits correctly on a level head and then floats two rows clear of
 * the skull the moment the animal puts its nose in a bowl — and half the poses
 * here move the nose. Rotate with the skull and a head-down, a head-up and a
 * head-tucked-into-the-flank all carry their ears without a single extra line.
 */
function headFrame(p: Pose): { back: Pt; up: Pt; pitch: number } {
  const back = unit(p.nose, p.head);
  const a: Pt = [back[1], -back[0]];
  const up: Pt = a[1] <= 0 ? a : [-a[0], -a[1]];
  return { back, up, pitch: (Math.atan2(-back[1], -back[0]) * 180) / Math.PI };
}

/** Where an ear sits on the skull: back off the brow, on top, and to one side. */
function earBase(a: Anatomy, p: Pose, far: boolean): Pt {
  if (p.face === "front") {
    // seen head on, the two ears are symmetric about the centre line and
    // neither of them is the far one
    return [p.head[0] + a.headRx * 0.78 * (far ? -1 : 1), p.head[1] - a.headRy * 0.62];
  }
  const { back, up } = headFrame(p);
  const b = along(along(p.head, back, a.headRx * 0.45), up, a.headRy * 0.6);
  // the far ear is set back along the skull rather than sideways in the world,
  // so the pair still reads as a pair on a head that is looking at the floor
  return far ? along(along(b, back, 1.1), up, -0.5) : b;
}

/** The eye, the nose leather, the mouth and whatever is coming out of it. */
function faceCells(a: Anatomy, p: Pose): Cell[] {
  const fwd = unit(p.head, p.nose);
  const cells: Cell[] = [];

  if (p.face === "front") {
    // two eyes, symmetric, and a nose between them. A head turned to the
    // viewer is how an animal asks a question.
    const [hx, hy] = p.head;
    const dx = a.headRx * 0.62;
    for (const s of [-1, 1]) {
      const ex = hx + s * dx;
      if (p.eyes === "shut") {
        cells.push({ x: ex - 0.5, y: hy, z: "n" }, { x: ex + 0.5, y: hy, z: "n" });
      } else {
        cells.push({ x: ex, y: hy, z: "e" });
        if (p.eyes === "wide") cells.push({ x: ex, y: hy - 1, z: "e" });
        if (p.eyes === "wide") cells.push({ x: ex + s, y: hy - 1, z: "w" });
      }
    }
    cells.push(
      { x: hx, y: hy + a.headRy * 0.75, z: "n" },
      { x: hx - 1, y: hy + a.headRy * 0.75, z: "n" },
    );
    if (p.mouth !== "shut") {
      cells.push(...disc(hx - 0.5, hy + a.headRy * 1.15, 1.4, 0.9, "n"));
      cells.push({ x: hx - 0.5, y: hy + a.headRy * 1.15, z: "t" });
    }
    return cells;
  }

  /**
   * The eye rides forward of the skull's centre and a touch above it, which is
   * where an eye is on every animal that hunts — but "above" has to mean above
   * *the skull*, not above the floor. Measured against the world, an eye slides
   * down to the jaw hinge the moment the animal puts its nose down, and a cat
   * grooming a paw is looking at the paw with its chin.
   */
  const eye = along(along(p.head, fwd, a.headRx * 0.44), headFrame(p).up, a.headRy * 0.38);
  if (p.eyes === "shut") {
    // a closed eye is a dark line, and the line is what makes an animal read
    // as asleep rather than as blind
    cells.push(
      { x: eye[0] - 0.6, y: eye[1], z: "n" },
      { x: eye[0] + 0.6, y: eye[1], z: "n" },
      { x: eye[0] + 1.6, y: eye[1] + 0.4, z: "F" },
    );
  } else if (p.eyes === "half") {
    cells.push({ x: eye[0], y: eye[1] + 0.4, z: "e" }, { x: eye[0], y: eye[1] - 0.6, z: "n" });
  } else {
    /**
     * The eye, and one dark pixel behind it for the outer corner. No catchlight
     * unless the eye is wide: on a skull five pixels across a near-white glint
     * beside a one-pixel eye is brighter than the eye is dark, and what reads
     * from a metre away is the glint — every dog in the first pass looked like
     * it had a white eye and a mole.
     */
    cells.push({ x: eye[0], y: eye[1], z: "e" });
    cells.push({ x: eye[0] - 1, y: eye[1], z: "n" });
    if (p.eyes === "wide") {
      cells.push({ x: eye[0], y: eye[1] - 1, z: "e" }, { x: eye[0] + 1, y: eye[1] - 1, z: "w" });
    }
  }

  // the nose leather. Anchored back into the muzzle rather than centred on the
  // tip, or on a short-muzzled animal it hangs off the front as a loose pixel.
  cells.push(...disc(p.nose[0] - 0.6, p.nose[1], Math.min(1.05, a.muzzleR * 0.72), 0.8, "n"));

  const jaw = along(p.nose, fwd, -1.6);
  switch (p.mouth) {
    case "shut":
      cells.push(
        { x: jaw[0], y: jaw[1] + 1.1, z: "F" },
        { x: jaw[0] - 1.2, y: jaw[1] + 1.2, z: "F" },
      );
      break;
    case "lick":
      cells.push(...disc(p.nose[0] - 0.6, p.nose[1] + 1.4, 1.0, 0.7, "t"));
      break;
    case "lap":
      // the tongue goes down and curls back under, which is the only way a
      // cat or a dog has ever got water into itself
      cells.push(...capsule([jaw[0], jaw[1] + 1], 0.7, [jaw[0] - 0.5, jaw[1] + 3.2], 0.55, "t"), {
        x: jaw[0] - 1.6,
        y: jaw[1] + 3.2,
        z: "t",
      });
      break;
    case "pant": {
      // the jaw parts and the tongue hangs out of the side of it
      cells.push(...disc(jaw[0] - 0.4, jaw[1] + 1.4, 1.5, 0.9, "n"));
      cells.push(
        ...capsule([jaw[0] + 0.4, jaw[1] + 1.6], 0.75, [jaw[0] - 0.6, jaw[1] + 3.4], 0.6, "t"),
      );
      break;
    }
    case "open":
    case "bark": {
      const gape = p.mouth === "bark" ? 2.6 : 1.7;
      cells.push(
        ...tri(
          [jaw[0] + 1.4, jaw[1] + 0.3],
          [jaw[0] - 2.2, jaw[1] + 0.2],
          [jaw[0] + 0.6, jaw[1] + gape],
          "n",
        ),
      );
      cells.push({ x: jaw[0] - 0.4, y: jaw[1] + gape * 0.55, z: "t" });
      break;
    }
    case "yawn": {
      // the whole head hinges open. Nothing else an animal does is this wide.
      cells.push(
        ...tri(
          [jaw[0] + 1.8, jaw[1] - 0.3],
          [jaw[0] - 2.6, jaw[1] + 0.4],
          [jaw[0] + 1.2, jaw[1] + 4.0],
          "n",
        ),
      );
      cells.push(
        ...capsule([jaw[0] - 0.6, jaw[1] + 1.6], 0.8, [jaw[0] + 0.6, jaw[1] + 3.0], 0.6, "t"),
      );
      cells.push(
        { x: jaw[0] + 1.6, y: jaw[1] + 0.6, z: "k" },
        { x: jaw[0] + 0.4, y: jaw[1] + 3.6, z: "k" },
      );
      break;
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// markings
// ---------------------------------------------------------------------------

/**
 * Markings, painted as geometry and applied only where there is already fur.
 * The alternative — drawing a mask as a patch of rows — puts half a cheek in
 * mid-air the moment a head turns, and every pose here turns the head.
 */
function markCells(kind: AnimalPattern, a: Anatomy, p: Pose): { light: Cell[]; dark: Cell[] } {
  const light: Cell[] = [];
  const dark: Cell[] = [];
  const fwd = unit(p.head, p.nose);
  const under = mid(p.rear, p.fore);
  const socks = (rows: number): Cell[] => {
    const out: Cell[] = [];
    for (let y = FLOOR - rows + 1; y <= FLOOR; y++)
      for (let x = 0; x < W; x++) out.push({ x, y, z: "m" });
    return out;
  };
  switch (kind) {
    case "solid":
      break;
    case "socks":
      light.push(...socks(3));
      break;
    case "mask":
      /**
       * Urajiro: the cream that runs up the muzzle's sides, over the cheeks,
       * down the throat and along the belly to the inside of every leg. It is
       * one continuous underside rather than four separate markings, and
       * drawing it as one is why a shiba looks like a shiba and not like a fox
       * with a white chin.
       *
       * Every piece of it is offset downward off the landmark it hangs from.
       * Centred instead, the muzzle mark swallows the bridge of the nose and
       * the throat mark swallows the neck, and what comes out is a cream dog
       * with a red back.
       */
      light.push(
        ...(p.face === "front"
          ? disc(p.head[0] - 0.5, p.head[1] + a.headRy * 0.7, a.headRx * 0.6, a.headRy * 0.42, "m")
          : capsule(
              along(along(p.head, fwd, a.headRx * 0.5), [0, 1], 0.95),
              a.muzzleR * 0.85,
              along(p.nose, [0, 1], 0.75),
              a.muzzleR * 0.6,
              "m",
            )),
        ...disc(
          p.head[0] - a.headRx * 0.2,
          p.head[1] + a.headRy * 0.7,
          a.headRx * 0.5,
          a.headRy * 0.3,
          "m",
        ),
        ...capsule(
          along(p.head, [0, 1], a.headRy * 0.95),
          a.neckR * 0.38,
          [p.fore[0] - 1.5, p.fore[1] + p.foreR * 0.4],
          a.neckR * 0.42,
          "m",
        ),
        ...capsule(
          [p.rear[0] + 0.5, p.rear[1] + p.rearR - 0.1],
          0.55,
          [p.fore[0], p.fore[1] + p.foreR - 0.2],
          0.8,
          "m",
        ),
        ...socks(2),
      );
      break;
    case "saddle": {
      /**
       * A blanket, laid on the back and stopping at the flank. Drawn any
       * thicker it stops being a marking and becomes the dog's colour, which
       * is what a saddle is specifically not.
       *
       * The lower edge is feathered rather than cut. Two black coats meeting
       * a tan one along a clean line is a horse blanket; on a real shepherd
       * the two interleave for half a centimetre, and half a centimetre is
       * one pixel here. `grow` is the same saddle a size larger, and the ring
       * between the two is what the dither is drawn from.
       */
      const saddle = (grow: number): Cell[] => [
        ...capsule(
          [p.rear[0] - 1.5, p.rear[1] - p.rearR * 0.62],
          p.rearR * 0.42 + grow,
          [p.fore[0] - 2, p.fore[1] - p.foreR * 0.34],
          p.foreR * 0.62 + grow,
          "m",
        ),
        ...disc(
          p.fore[0] - 3.5,
          p.fore[1] - p.foreR * 0.2,
          p.foreR * 0.75 + grow,
          p.foreR * 0.62 + grow,
          "m",
        ),
      ];
      const core = saddle(0);
      light.push(
        ...core,
        // the cap over the skull, which a saddle-marked dog wears as a mask
        ...disc(
          p.head[0] - a.headRx * 0.15,
          p.head[1] - a.headRy * 0.45,
          a.headRx * 0.9,
          a.headRy * 0.6,
          "m",
        ),
        ...feather(core, saddle(1), 2),
        ...feather(saddle(1), saddle(2), 5),
      );
      break;
    }
    case "patched":
      light.push(
        ...disc(
          p.head[0] + a.headRx * 0.1,
          p.head[1] - a.headRy * 0.2,
          a.headRx * 0.75,
          a.headRy * 0.8,
          "m",
        ),
        ...disc(under[0] + 2.5, under[1] + 0.5, 3.2, 2.6, "m"),
        ...disc(p.rear[0] - 1, p.rear[1] + 1, 2.4, 2.2, "m"),
        ...socks(2),
      );
      break;
    case "tabby": {
      // bars down the ribs, rings round the tail, and the M on the brow that
      // every tabby that has ever existed is wearing
      for (let x = Math.round(p.rear[0]) - 1; x <= Math.round(p.fore[0]); x += 4) {
        dark.push(
          ...capsule(
            [x, under[1] - p.foreR + 0.8],
            0.5,
            [x - 1.1, under[1] + p.foreR * 0.1],
            0.5,
            "M",
          ),
        );
      }
      // no dorsal stripe on a block. On a loaf the spine is the top edge, which
      // is also where the highlight goes, and six rows of animal cannot carry
      // a pale line and a dark one a pixel apart without reading as a sandwich
      if (!p.block) {
        /**
         * The dorsal stripe: broken, and placed as a fraction of the trunk's
         * radius rather than a fixed inset from the top of it.
         *
         * Both halves of that were bugs. A fixed inset is right for a standing
         * cat and lands on the lit topline of a shallow one — a crouch, a
         * stretch, a cat folded over its own paw — and an unbroken run of ten
         * dark pixels along a back reads as a painted line whatever height it
         * sits at. Dashed, it reads as the seam between two planes of fur,
         * which is what it is.
         */
        dark.push(
          ...scatter(
            capsule(
              [p.rear[0] - 2, p.rear[1] - p.rearR * 0.62],
              0.6,
              [p.fore[0], p.fore[1] - p.foreR * 0.62],
              0.6,
              "M",
            ),
            2,
          ),
        );
      }
      dark.push(
        ...disc(p.head[0] - a.headRx * 0.3, p.head[1] - a.headRy * 0.55, 1.5, 0.5, "M"),
        ...disc(p.head[0] - a.headRx * 0.05, p.head[1] - a.headRy * 0.85, 1.1, 0.5, "M"),
      );
      break;
    }
  }
  return { light, dark };
}

// ---------------------------------------------------------------------------
// the painter
// ---------------------------------------------------------------------------

/** A pale coat's lit tone on the top plane of everything with mass under it. */
function topLight(map: SpriteMap): string[] {
  const out = map.map((r) => [...r]);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < ROWS - 2; y++) {
      const c = out[y][x];
      if (c === ".") continue;
      // only where there is body underneath: a lone ear tip lit white is a
      // firefly, not a highlight
      if (c === "f" && out[y + 1][x] !== "." && out[y + 2][x] !== ".") out[y][x] = "l";
      break;
    }
  }
  return out.map((r) => r.join(""));
}

/**
 * A fluffy coat is not a bigger animal, it is a broken edge. Every third pixel
 * on the top and back of the silhouette grows one hair outward, deterministic
 * so the same animal is the same animal on every frame rather than shimmering.
 */
function fringe(map: SpriteMap, every: number): string[] {
  const out = map.map((r) => [...r]);
  for (let y = 1; y < ROWS - 2; y++) {
    for (let x = 1; x < W - 1; x++) {
      const c = map[y][x];
      if (c !== "f" && c !== "l" && c !== "F" && c !== "m") continue;
      // hashed rather than a modulus of x and y. Any linear test repeats with
      // a period of three or four columns and lays the fringe down the back as
      // an evenly spaced comb, which reads as a stegosaurus and not as fur.
      if (((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 4) % every !== 0) continue;
      if (map[y - 1][x] === ".") out[y - 1][x] = c === "l" ? "f" : c;
      else if (map[y][x - 1] === ".") out[y][x - 1] = c === "l" ? "f" : c;
    }
  }
  return out.map((r) => r.join(""));
}

type Look = Required<Pick<AnimalLook, "ears" | "tail" | "coat" | "pattern">> & AnimalLook;

/** The whole animal, painted back to front the way a body actually occludes. */
function render(a: Anatomy, look: Look, p: Pose): string[] {
  let m = blank();
  const hip: Pt = [p.rear[0] + 0.6, p.rear[1] + 0.8];
  const shoulder: Pt = [p.fore[0] - 1.2, p.fore[1] + 0.9];
  const tailBase: Pt = [p.rear[0] - p.rearR * 0.75, p.rear[1] - p.rearR * 0.55];

  if (p.curl) {
    /**
     * Asleep: one mass on the floor with the legs inside it. Nothing here is
     * the standing animal rearranged — a curled animal has no visible limbs,
     * no topline and no neck, and keeping any of them is what makes a sleeping
     * sprite read as a standing one that fell over.
     */
    const { at, r } = p.curl;
    m = paint(m, disc(at[0], at[1], r * CURL_WIDE, r * CURL_TALL, "f"));
    m = paint(m, disc(at[0] - r * 0.2, at[1] + r * CURL_TALL * 0.62, r * 1.05, r * 0.3, "u"));
    m = topLight(m);
    // the one piece of leg a curled animal still shows: two front paws out at
    // the bottom of the front
    m = paint(m, disc(at[0] + r * 0.85, FLOOR - 0.4, a.legR + 0.9, 0.9, "F"));
    m = paint(m, disc(at[0] + r * 0.35, FLOOR - 0.3, a.legR + 0.8, 0.9, "f"));
    // a shade rim, then the tail on top of it, so it lies over the back rather
    // than becoming part of it
    m = paint(m, wrapTail(a, at, r, 1.15, "F"));
    m = paint(m, wrapTail(a, at, r, 0.72, "f"));
  } else if (p.block) {
    /**
     * The loaf. A slab on the floor with nothing showing underneath it: no
     * paws, no elbow, no gap between the body and the ground. The front wall
     * is vertical and the top is flat, which is what turns a cat into a
     * doorstop — a sloped front and a domed back are the two things that make
     * a low animal read as lying down rather than as parked.
     *
     * No neck is drawn either. A loafing cat's shoulders come up to its jaw,
     * so the skull that goes on afterwards sits straight on the block, and any
     * neck between the two would jack the head up off it.
     */
    const { at, halfW, halfH, round } = p.block;
    m = paint(m, slab(at[0], at[1], halfW, halfH, round, "f"));
    m = paint(m, slab(at[0], at[1] + halfH - 0.4, halfW - 0.8, 0.6, 0.5, "u"));
    m = paint(m, slab(at[0] - 0.5, at[1] + halfH, halfW - 1.6, 0.4, 0.3, "U"));
    /**
     * The light on top is inset from both ends rather than run edge to edge.
     * `topLight` lights the highest pixel of every column, which on a shape
     * with a genuinely flat top puts one unbroken pale row across the whole
     * width — a shelf, and the strongest line in the sprite. Inset by a
     * column at the rump and two at the shoulder, the same highlight reads as
     * light landing on a back.
     */
    m = paint(m, slab(at[0] - halfW * 0.18, at[1] - halfH, halfW * 0.6, 0.25, 0.2, "l"));
  } else {
    // a tail that hangs goes behind the animal; one carried over the back or
    // wrapped round the front is drawn last, after the legs it lies in front of
    if (look.tail !== OVER_THE_BACK && p.tailFold !== "wrap") {
      // shade rim, then the coat on top of it. Painted entirely in the shade
      // tone — which is what a tail behind a body wants to be — a tail carried
      // up is a dark flag beside a light animal, and a cat's tail is up most
      // of the time it is awake.
      m = paint(m, tailCells(a, look.tail, tailBase, p, "F", 0.4));
      m = paint(m, tailCells(a, look.tail, tailBase, p, "f"));
    }
    m = paint(m, hindLeg(a, [hip[0] - 1.4, hip[1]], p.hf, p.hind, "F", "F"));
    m = paint(m, frontLeg(a, [shoulder[0] - 1.4, shoulder[1]], p.ff, p.front, "F", "F"));
    // the trunk: ribcage, haunch, shoulder, neck — four masses, one animal
    m = paint(m, capsule(p.rear, p.rearR, p.fore, p.foreR, "f"));
    m = paint(m, disc(hip[0], hip[1], a.hipR, a.hipR * 0.95, "f"));
    m = paint(m, disc(shoulder[0], shoulder[1] - 0.4, a.shoulderR, a.shoulderR * 0.95, "f"));
    m = paint(
      m,
      capsule(
        [p.fore[0] - 0.5, p.fore[1] - p.foreR * 0.45],
        a.neckR * 1.15,
        along(p.head, unit(p.nose, p.head), a.headRx * 0.35),
        a.neckR * 0.85,
        "f",
      ),
    );
    // the underside, along the brisket and the loin
    m = paint(
      m,
      capsule(
        [p.rear[0] + 0.5, p.rear[1] + p.rearR - 0.5],
        0.95,
        [p.fore[0], p.fore[1] + p.foreR - 0.6],
        1.15,
        "u",
      ),
    );
    m = topLight(m);
    m = paint(m, hindLeg(a, hip, p.hn, p.hind, "f", "F"));
    m = paint(m, frontLeg(a, shoulder, p.fn, p.front, "f", "F"));
  }

  // ears: the far one behind the skull, the near one over it
  const skull = p.curl ? null : p.head;
  // a head turned to the viewer has no pitch to speak of and no near or far
  // side, so both ears go straight up off a symmetric skull
  const pitch = p.face === "front" ? 0 : headFrame(p).pitch;
  m = paint(m, earCells(a, look.ears, earBase(a, p, true), p.earFar + pitch, "F", "F"));
  if (skull && p.face === "front") {
    /**
     * Head on. Not the profile skull with a second eye added: a muzzle drawn
     * as a capsule out to the side is a beak growing out of the cheek, and
     * seen from the front a muzzle is a small round mass hanging under the
     * middle of the face. The skull is wider and shorter too, because that is
     * what a head does when it turns toward you.
     */
    m = paint(m, disc(skull[0], skull[1], a.headRx * 1.15, a.headRy * 1.05, "f"));
    m = paint(
      m,
      disc(skull[0] - 0.5, skull[1] + a.headRy * 0.7, a.headRx * 0.62, a.headRy * 0.45, "f"),
    );
    m = topLight(m);
  } else if (skull) {
    m = paint(m, disc(skull[0], skull[1], a.headRx, a.headRy, "f"));
    m = paint(
      m,
      capsule(
        along(skull, unit(skull, p.nose), a.headRx * 0.35),
        a.muzzleR,
        p.nose,
        a.muzzleR * 0.7,
        "f",
      ),
    );
    m = topLight(m);
  } else {
    // a rim only on the underside of the skull, which is the edge that lies
    // against the body it is resting on
    /**
     * The body in the head's shadow, and then the head on top of it. An
     * outline round the skull would separate the two but turns the softest
     * shape in the game into a sticker; a cast shadow does the same job and
     * is what is actually there. It is painted in `d` and not in the coat's
     * shade because the marking pass runs after this and would otherwise read
     * a shaded flank as somewhere to put cream.
     */
    m = paint(m, disc(p.head[0] - 1.3, p.head[1] + 1.5, a.headRx * 0.8, 0.85, "d"));
    m = paint(m, disc(p.head[0], p.head[1], a.headRx, a.headRy, "f"));
    m = paint(
      m,
      capsule(
        along(p.head, unit(p.head, p.nose), a.headRx * 0.3),
        a.muzzleR,
        p.nose,
        a.muzzleR * 0.7,
        "f",
      ),
    );
    m = paint(m, disc(p.head[0] + 0.3, p.head[1] + a.headRy * 0.95, a.headRx * 0.8, 0.5, "F"));
    m = paint(m, disc(p.head[0] - 0.3, p.head[1] - a.headRy * 0.72, a.headRx * 0.65, 0.55, "l"));
  }

  const marks = markCells(look.pattern, a, p);
  if (marks.light.length) m = tint(m, marks.light, LIGHTEN);
  if (marks.dark.length) m = tint(m, marks.dark, DARKEN);

  m = paint(m, earCells(a, look.ears, earBase(a, p, false), p.earNear + pitch, "f", "d"));
  m = paint(m, faceCells(a, p));

  if (look.collar && !p.curl) {
    // on the neck's own axis, banded across it. A collar hung off the skull
    // instead sits on the cheek, which is a hat strap.
    const throat = along(p.head, unit(p.nose, p.head), a.headRx * 0.4);
    const withers: Pt = [p.fore[0] - 0.5, p.fore[1] - p.foreR * 0.45];
    const at: Pt = [
      withers[0] + (throat[0] - withers[0]) * 0.62,
      withers[1] + (throat[1] - withers[1]) * 0.62,
    ];
    const axis = unit(withers, throat);
    const side: Pt = [-axis[1], axis[0]];
    const half = a.neckR * 1.05;
    m = paint(
      m,
      capsule(
        [at[0] - side[0] * half, at[1] - side[1] * half],
        0.85,
        [at[0] + side[0] * half, at[1] + side[1] * half],
        0.85,
        "c",
      ),
    );
    // the tag, hanging off the front of it
    m = paint(m, [{ x: at[0] + side[0] * half, y: at[1] + side[1] * half + 1, z: "C" }]);
  }

  if (!p.curl && (look.tail === OVER_THE_BACK || p.tailFold === "wrap")) {
    m = paint(m, tailCells(a, look.tail, tailBase, p, "F", 0.5));
    m = paint(m, tailCells(a, look.tail, tailBase, p, "f"));
  }
  if (look.coat === "fluffy") m = fringe(m, 3);
  else if (look.coat === "medium") m = fringe(m, 7);
  return m;
}

// ---------------------------------------------------------------------------
// the spec
// ---------------------------------------------------------------------------

export interface AnimalLook {
  ears?: AnimalEars;
  tail?: AnimalTail;
  muzzle?: AnimalMuzzle;
  coat?: AnimalCoat;
  /** the coat itself */
  fur?: FurName;
  pattern?: AnimalPattern;
  /** the second colour a pattern paints in; falls back to the belly's */
  patch?: FurName;
  belly?: FurName;
  nose?: TrimName | string;
  eye?: TrimName | string;
  collar?: TrimName | FurName;
}

export interface AnimalReactions {
  /** what it does when you crouch down and put a hand on it */
  onPet?: string;
  /** what it does when you walk into the room */
  onNotice?: string;
  /** what it does when you say its name */
  onCall?: string;
  idle?: string;
}

export type AnimalDoing = "standing" | "sitting" | "lying" | "sleeping" | "loafing" | "prowling";

export interface AnimalSpec {
  id: string;
  name: string;
  species: AnimalSpecies;
  size?: AnimalSize;
  look?: AnimalLook;
  /** the default behaviour; decides which action `idleAction` points at */
  doing?: AnimalDoing;
  reactions?: AnimalReactions;
  palette?: SpritePalette;
  cell?: number;
  walkSpeed?: number;
}

export interface AnimalConfig extends PlayerConfig {
  id: string;
  name: string;
  species: AnimalSpecies;
  idleAction: string;
  reactions: Required<AnimalReactions>;
  look: AnimalLook;
}

// ---------------------------------------------------------------------------
// gait
// ---------------------------------------------------------------------------

/**
 * One paw at a point in the cycle. The first half is stance — the paw is on
 * the ground and the ground goes past it; the second is swing, forward and
 * off the floor on a sine. Feeding the four legs the same function at
 * different phases is what makes a gait a gait rather than four legs sliding:
 * change the offsets and a walk becomes a trot.
 */
function step(phase: number, stride: number, lift: number): Pt {
  const t = ((phase % 1) + 1) % 1;
  if (t < 0.5) return [stride * (1 - 4 * t), 0];
  const k = (t - 0.5) * 2;
  return [stride * (2 * k - 1), -lift * Math.sin(Math.PI * k)];
}

export function createAnimal(spec: AnimalSpec): AnimalConfig {
  const species = spec.species;
  const cat = species === "cat";
  const size = spec.size ?? (cat ? "small" : "medium");
  const raw = spec.look ?? {};
  const look: Look = {
    ears: raw.ears ?? "prick",
    tail: raw.tail ?? (cat ? "whip" : "plume"),
    coat: raw.coat ?? "short",
    pattern: raw.pattern ?? "solid",
    ...raw,
  };
  const a = anatomy(species, size, look);
  const palette = { ...animalPalette(look), ...(spec.palette ?? {}) };
  const b = createCharacter({
    palette,
    cell: spec.cell ?? 2,
    walkSpeed: spec.walkSpeed ?? (cat ? 34 : 40),
  });

  const base = standPose(a);
  const put = (o: Partial<Pose>): Pose => ({ ...base, ...o });
  const draw = (name: string, o: Partial<Pose>) => {
    b.frame(name, (f) => f.raw(render(a, look, put(o))));
  };

  // --- standing -------------------------------------------------------------
  draw("stand", {});
  /** The breath is the ribcage filling, not the whole animal moving up a pixel. */
  draw("standB", { foreR: a.foreR + 0.45, rearR: a.rearR + 0.2 });
  draw("blink", { eyes: "shut" });
  draw("earFlick", { earNear: EAR_FWD + 14, earFar: EAR_HALF + 8 });
  draw("earBack", { earNear: EAR_BACK, earFar: EAR_HALF });
  /** Head turned out of the picture plane: the animal has noticed you. */
  draw("look", {
    face: "front",
    head: [a.head[0] - 0.6, a.head[1]],
    earNear: EAR_FWD,
    earFar: EAR_FWD,
  });
  draw("lookB", {
    face: "front",
    head: [a.head[0] - 0.6, a.head[1] - 0.6],
    eyes: "wide",
    earNear: EAR_FWD,
    earFar: EAR_FWD,
  });
  draw("lookUp", {
    head: [a.head[0] - 1, a.head[1] - 1.4],
    nose: [a.head[0] + a.headRx + a.muzzle - 1.6, a.head[1] - 2.8],
    eyes: "wide",
    earNear: EAR_FWD,
    earFar: EAR_FWD,
  });
  draw("sniff", {
    head: [a.head[0] + 0.4, a.head[1] + 1.8],
    nose: [a.head[0] + a.headRx + a.muzzle + 0.8, a.head[1] + 3.2],
    earNear: EAR_FWD,
  });

  // --- sitting --------------------------------------------------------------
  /**
   * A sit is one edit: the croup goes to the floor and the chest stays where
   * it was, which tilts the trunk's axis and takes the head up with it. The
   * hind legs fold themselves — the painter already knows what a sitting leg
   * does — so nothing here is drawn twice.
   */
  const sitRear: Pt = [a.rear[0] + 1.5, FLOOR - a.rearR - a.leg * 0.36];
  const sitFore: Pt = [a.fore[0], a.fore[1] - 0.3];
  const sitHead: Pt = [a.head[0] - 0.8, a.head[1] - 1.4];
  const sitting: Partial<Pose> = {
    rear: sitRear,
    fore: sitFore,
    head: sitHead,
    nose: [sitHead[0] + a.headRx + a.muzzle, sitHead[1] + 0.7],
    hind: "sit",
    hn: [a.hindPaw + 4, FLOOR],
    hf: [a.hindPaw + 2.5, FLOOR],
  };
  draw("sit", sitting);
  draw("sitB", { ...sitting, foreR: a.foreR + 0.45 });
  draw("sitBlink", { ...sitting, eyes: "shut" });
  draw("sitLook", { ...sitting, face: "front", earNear: EAR_FWD, earFar: EAR_FWD });
  draw("sitEar", { ...sitting, earNear: EAR_HALF + 6, earFar: EAR_UP });
  /** Halfway down: the hocks are bending but the croup has not landed. */
  draw("sitHalf", {
    rear: [a.rear[0] + 0.5, a.rear[1] + 2.2],
    fore: [a.fore[0], a.fore[1] - 0.2],
    head: [a.head[0], a.head[1] - 0.4],
    nose: [a.head[0] + a.headRx + a.muzzle, a.head[1] + 0.3],
    hind: "sit",
    hn: [a.hindPaw + 3, FLOOR],
    hf: [a.hindPaw + 1.5, FLOOR],
  });

  // --- lying ----------------------------------------------------------------
  /** The sphinx: belly on the floor, front legs out in front, head up. */
  const lieRear: Pt = [a.rear[0] + 1, FLOOR - a.rearR + 0.4];
  const lieFore: Pt = [a.fore[0], FLOOR - a.foreR + 0.4];
  const lieHead: Pt = [a.head[0] - 1.4, FLOOR - a.foreR * 2 - a.headRy - 0.6];
  const lying: Partial<Pose> = {
    rear: lieRear,
    fore: lieFore,
    head: lieHead,
    nose: [lieHead[0] + a.headRx + a.muzzle, lieHead[1] + 0.8],
    front: "forward",
    hind: "fold",
    fn: [a.frontPaw + 4, FLOOR],
    ff: [a.frontPaw + 2.5, FLOOR],
    hn: [a.hindPaw + 4, FLOOR],
    hf: [a.hindPaw + 2.5, FLOOR],
  };
  draw("lie", lying);
  draw("lieB", { ...lying, foreR: a.foreR + 0.4, rearR: a.rearR + 0.3 });
  draw("lieBlink", { ...lying, eyes: "shut" });
  draw("lieLook", { ...lying, face: "front", earNear: EAR_FWD, earFar: EAR_FWD });
  /** Chin down on the paws — the pose of a dog waiting for something. */
  draw("lieDown", {
    ...lying,
    head: [lieHead[0] + 0.6, lieHead[1] + 2.2],
    nose: [lieHead[0] + a.headRx + a.muzzle + 1.4, lieHead[1] + 3.2],
    earNear: EAR_HALF,
    earFar: EAR_HALF,
    eyes: "half",
  });
  draw("lieShut", {
    ...lying,
    head: [lieHead[0] + 0.6, lieHead[1] + 2.2],
    nose: [lieHead[0] + a.headRx + a.muzzle + 1.4, lieHead[1] + 3.2],
    earNear: EAR_BACK,
    earFar: EAR_BACK,
    eyes: "shut",
  });

  // --- the curl -------------------------------------------------------------
  /**
   * Asleep. Not a lying animal with its eyes shut: a curled one is a single
   * round mass with the head folded into the flank and the tail over the nose,
   * and the only thing that moves is the ribs.
   */
  const curlR = a.foreR * 1.15;
  const curlAt: Pt = [a.rear[0] + 5, FLOOR - curlR * CURL_TALL + 0.6];
  /**
   * The head goes at the front-top of the mass with the muzzle running down
   * onto the paws. Tucked into the flank the way an animal genuinely sleeps,
   * the whole face is buried — and the one beat this pose exists for is an eye
   * opening when you come in, which needs an eye that is on the silhouette.
   */
  /**
   * The head goes on the end of the oval and not on top of it: far enough out
   * that the skull is its own shape against the background, close enough that
   * the jaw still touches the shoulder it is resting on. Solved off the mass's
   * own radius rather than eyeballed, so a big dog and a kitten both get a
   * head that sits against the body instead of one sunk into it.
   */
  const curlHead: Pt = [
    curlAt[0] + curlR * CURL_WIDE + a.headRx * 0.72,
    curlAt[1] - curlR * CURL_TALL * 0.98,
  ];
  const curled: Partial<Pose> = {
    curl: { at: curlAt, r: curlR },
    // the trunk's landmarks move inside the mass. Markings are geometry, so a
    // curl that left them on the standing body would paint a belly stripe and
    // a throat across thin air above a sleeping animal.
    rear: [curlAt[0] - curlR * 0.9, curlAt[1]],
    fore: [curlAt[0] + curlR * 0.9, curlAt[1]],
    rearR: curlR * 0.85,
    foreR: curlR * 0.85,
    head: curlHead,
    // the muzzle is foreshortened, not full length. A sleeping head is tucked
    // toward the viewer, and a nose carried out on a full-length stalk hangs
    // off the front of the skull with nothing under it.
    nose: [curlHead[0] + a.headRx + a.muzzle * 0.25, curlHead[1] + a.headRy * 0.3],
    front: "hidden",
    hind: "hidden",
    // half-back rather than flat: an ear laid along a skull that is already
    // lying on a body has no outline to break, and the ears are how anyone
    // tells this mass is a dog and not a cushion
    earNear: EAR_HALF,
    earFar: EAR_HALF - 14,
    eyes: "shut",
    tailSwing: -30,
  };
  draw("curl", curled);
  draw("curlB", { ...curled, curl: { at: [curlAt[0], curlAt[1] - 0.5], r: curlR + 0.5 } });
  draw("curlEye", { ...curled, eyes: "half", earNear: EAR_HALF });
  draw("curlEar", { ...curled, earNear: EAR_HALF - 14, earFar: EAR_BACK });

  // --- walking --------------------------------------------------------------
  /**
   * Diagonal pairs. Near-front and far-hind swing together against far-front
   * and near-hind, the body drops on contact and rides a pixel higher on the
   * pass, and every leg is redrawn from the hip to wherever the paw went — no
   * frame here is another frame nudged sideways.
   */
  const gait = (
    phase: number,
    stride: number,
    lift: number,
    o: Partial<Pose> = {},
  ): Partial<Pose> => {
    const dA = step(phase, stride, lift);
    const dB = step(phase + 0.5, stride, lift);
    const bob = phase % 0.5 === 0 ? 0 : -1;
    return {
      rear: [a.rear[0], a.rear[1] + bob],
      fore: [a.fore[0], a.fore[1] + bob],
      head: [a.head[0], a.head[1] + bob],
      nose: [a.head[0] + a.headRx + a.muzzle, a.head[1] + 0.7 + bob],
      fn: [a.frontPaw + dA[0], FLOOR + dA[1]],
      hf: [a.hindPaw - 1.1 + dA[0], FLOOR + dA[1]],
      ff: [a.frontPaw - 1.1 + dB[0], FLOOR + dB[1]],
      hn: [a.hindPaw + dB[0], FLOOR + dB[1]],
      ...o,
    };
  };
  const WALK_STRIDE = 2.0;
  draw("walkA", gait(0, WALK_STRIDE, 1.8));
  draw("walkB", gait(0.25, WALK_STRIDE, 1.8));
  draw("walkC", gait(0.5, WALK_STRIDE, 1.8));
  draw("walkD", gait(0.75, WALK_STRIDE, 1.8));
  b.walkCycle("walkA", "walkB", "walkC", "walkD");

  // --- eating, drinking -----------------------------------------------------
  /** Nose to the floor. The neck extends rather than the whole animal bowing. */
  const bowlHead: Pt = [a.head[0] + 1, FLOOR - a.headRy - 2.4];
  const atBowl: Partial<Pose> = {
    head: bowlHead,
    nose: [bowlHead[0] + a.muzzle * 0.5 + 1.4, bowlHead[1] + a.headRy + 1.2],
    earNear: EAR_HALF,
    earFar: EAR_HALF,
    eyes: "half",
  };
  draw("eatA", atBowl);
  draw("eatB", { ...atBowl, mouth: "open", head: [bowlHead[0], bowlHead[1] + 1] });
  draw("eatC", {
    head: [a.head[0], a.head[1] + 1.2],
    nose: [a.head[0] + a.headRx + a.muzzle - 0.4, a.head[1] + 1.6],
    mouth: "lick",
    eyes: "half",
  });
  draw("drinkA", { ...atBowl, mouth: "lap" });
  draw("drinkB", { ...atBowl, head: [bowlHead[0], bowlHead[1] + 0.8], mouth: "open" });

  // --- the stretch ----------------------------------------------------------
  /**
   * Front down, hips up: the elbows go to the floor, the chest with them, and
   * the croup stays where it was standing. Both species do this and it is the
   * one pose that says an animal has just woken up.
   */
  const stretchFore: Pt = [a.fore[0] - 0.5, FLOOR - a.foreR - 1.6];
  const stretchHead: Pt = [a.head[0] + 0.6, FLOOR - a.headRy - 2.2];
  draw("stretchA", {
    rear: [a.rear[0] - 0.5, a.rear[1] - 1],
    fore: stretchFore,
    head: stretchHead,
    nose: [stretchHead[0] + a.headRx + a.muzzle, stretchHead[1] + 1.4],
    front: "forward",
    fn: [a.frontPaw + 5, FLOOR],
    ff: [a.frontPaw + 3.5, FLOOR],
    hn: [a.hindPaw - 1, FLOOR],
    hf: [a.hindPaw - 2.5, FLOOR],
    earNear: EAR_HALF,
    earFar: EAR_HALF,
    tailSwing: 22,
  });
  draw("stretchB", {
    rear: [a.rear[0] - 1, a.rear[1] - 1.6],
    fore: [stretchFore[0], stretchFore[1] + 0.6],
    head: [stretchHead[0] + 0.4, stretchHead[1] + 1],
    nose: [stretchHead[0] + a.headRx + a.muzzle + 0.6, stretchHead[1] + 2.6],
    front: "forward",
    fn: [a.frontPaw + 6.5, FLOOR],
    ff: [a.frontPaw + 5, FLOOR],
    hn: [a.hindPaw - 1.5, FLOOR],
    hf: [a.hindPaw - 3, FLOOR],
    earNear: EAR_BACK,
    earFar: EAR_BACK,
    eyes: "shut",
    mouth: "yawn",
    tailSwing: 30,
  });
  /** Coming out of it: the back arches the other way and the legs walk home. */
  draw("stretchC", {
    rear: [a.rear[0] + 0.5, a.rear[1] + 0.8],
    fore: [a.fore[0] - 0.5, a.fore[1] + 0.6],
    head: [a.head[0] - 0.5, a.head[1] + 0.6],
    nose: [a.head[0] + a.headRx + a.muzzle - 1, a.head[1] + 1.4],
    fn: [a.frontPaw + 2, FLOOR],
    ff: [a.frontPaw + 0.5, FLOOR],
    hn: [a.hindPaw + 0.5, FLOOR],
    hf: [a.hindPaw - 1, FLOOR],
    earNear: EAR_HALF,
  });

  // --- scratching -----------------------------------------------------------
  /**
   * A hind leg up behind an ear. The near hind paw is simply put next to the
   * skull and the painter's two-bone reach finds the rest, which is the whole
   * argument for a skeleton: this pose cost three numbers.
   */
  const scratchSeat: Partial<Pose> = {
    rear: [a.rear[0] + 1, FLOOR - a.rearR - 0.6],
    fore: [a.fore[0], a.fore[1] - 0.2],
    hind: "reach",
    hf: [a.hindPaw + 3, FLOOR],
    earNear: EAR_HALF,
    earFar: EAR_HALF,
    eyes: "half",
  };
  const scratchHead: Pt = [a.head[0] - 0.6, a.head[1] - 0.4];
  const scratchFace = {
    head: scratchHead,
    nose: [scratchHead[0] + a.headRx + a.muzzle - 0.6, scratchHead[1] + 1.6] as Pt,
  };
  draw("scratchA", {
    ...scratchSeat,
    ...scratchFace,
    hn: [scratchHead[0] - a.headRx - 1, scratchHead[1] + 1.4],
  });
  draw("scratchB", {
    ...scratchSeat,
    ...scratchFace,
    head: [scratchHead[0], scratchHead[1] + 0.8],
    nose: [scratchHead[0] + a.headRx + a.muzzle - 0.4, scratchHead[1] + 2.6],
    hn: [scratchHead[0] - a.headRx - 0.4, scratchHead[1] + 2.6],
    eyes: "shut",
  });
  draw("scratchC", {
    ...scratchSeat,
    ...scratchFace,
    hn: [scratchHead[0] - a.headRx - 1.6, scratchHead[1] + 0.4],
    eyes: "shut",
    mouth: "open",
  });

  // --- the shake-off --------------------------------------------------------
  /**
   * A shake travels down the animal: the head goes first, the shoulders a beat
   * later, the hips last. Three frames, each with the ears thrown to a
   * different angle and the trunk swung the other way from the head.
   */
  draw("shakeA", {
    head: [a.head[0] - 1.2, a.head[1] - 0.4],
    nose: [a.head[0] + a.headRx + a.muzzle - 2.6, a.head[1] - 1.4],
    earNear: EAR_FLAT,
    earFar: EAR_FWD - 30,
    eyes: "shut",
    foreR: a.foreR + 0.4,
    tailSwing: -25,
  });
  draw("shakeB", {
    head: [a.head[0] + 0.8, a.head[1] + 0.6],
    nose: [a.head[0] + a.headRx + a.muzzle + 1, a.head[1] + 2],
    earNear: EAR_FWD - 40,
    earFar: EAR_FLAT,
    eyes: "shut",
    mouth: "open",
    rear: [a.rear[0], a.rear[1] - 1],
    tailSwing: 35,
  });
  draw("shakeC", {
    head: [a.head[0] - 0.8, a.head[1] + 0.2],
    nose: [a.head[0] + a.headRx + a.muzzle - 2, a.head[1] + 1],
    earNear: EAR_BACK,
    earFar: EAR_FWD - 20,
    eyes: "half",
    rearR: a.rearR + 0.4,
    tailSwing: -35,
  });

  // --- being petted ---------------------------------------------------------
  /** The head goes up and into the hand, the eyes half shut, the ears back. */
  const petHead: Pt = [a.head[0] - 1, a.head[1] - 1];
  draw("petA", {
    head: petHead,
    nose: [petHead[0] + a.headRx + a.muzzle - 1.4, petHead[1] - 1.6],
    earNear: EAR_BACK,
    earFar: EAR_BACK,
    eyes: "half",
  });
  draw("petB", {
    head: [petHead[0] - 0.4, petHead[1] + 0.6],
    nose: [petHead[0] + a.headRx + a.muzzle - 2, petHead[1] - 0.4],
    earNear: EAR_FLAT,
    earFar: EAR_BACK,
    eyes: "shut",
    mouth: "lick",
    foreR: a.foreR + 0.4,
  });

  const actions: Record<string, ActionDef> = {
    /**
     * Standing about. The same shape as the human idle and for the same
     * reason: long stretches of a breath and a blink, then one piece of small
     * business, so that a loop you can watch for a minute does not read as a
     * loop.
     */
    idle: {
      frames: [
        "stand",
        "standB",
        "stand",
        "blink",
        "stand",
        "standB",
        "earFlick",
        "stand",
        "standB",
        "stand",
        "look",
        "lookB",
        "look",
        "stand",
        "blink",
        "standB",
        "sniff",
        "sniff",
        "stand",
        "lookUp",
        "look",
        "stand",
        "earBack",
        "stand",
        "standB",
      ],
      frameMs: 560,
      loops: 1,
    },
    sit: {
      frames: [
        "sit",
        "sitB",
        "sit",
        "sitBlink",
        "sit",
        "sitEar",
        "sit",
        "sitB",
        "sitLook",
        "sit",
        "sitB",
      ],
      frameMs: 640,
      loops: 1,
    },
    sitDown: { frames: ["stand", "sitHalf", "sit", "sit"], frameMs: 200, loops: 1 },
    standUp: { frames: ["sit", "sitHalf", "stand", "stand"], frameMs: 200, loops: 1 },
    lie: {
      frames: [
        "lie",
        "lieB",
        "lie",
        "lieBlink",
        "lie",
        "lieB",
        "lieLook",
        "lie",
        "lieDown",
        "lieDown",
        "lieShut",
        "lieDown",
        "lie",
        "lieB",
      ],
      frameMs: 700,
      loops: 1,
    },
    lieDown: { frames: ["sit", "lieDown", "lie", "lie"], frameMs: 240, loops: 1 },
    sleep: {
      frames: [
        "curl",
        "curl",
        "curlB",
        "curlB",
        "curl",
        "curl",
        "curlB",
        "curlEar",
        "curl",
        "curlB",
      ],
      frameMs: 900,
      loops: 1,
    },
    wake: { frames: ["curl", "curlEye", "curlEar", "curlEye", "curl"], frameMs: 420, loops: 1 },
    walk: { frames: ["walkA", "walkB", "walkC", "walkD"], frameMs: 170, loops: 4 },
    eat: {
      frames: ["sniff", "eatA", "eatB", "eatA", "eatB", "eatA", "eatB", "eatC", "stand"],
      frameMs: 260,
      loops: 1,
    },
    drink: {
      frames: ["sniff", "drinkA", "drinkB", "drinkA", "drinkB", "drinkA", "eatC", "stand"],
      frameMs: 230,
      loops: 1,
    },
    stretch: {
      frames: [
        "stand",
        "stretchA",
        "stretchB",
        "stretchB",
        "stretchA",
        "stretchC",
        "stand",
        "standB",
      ],
      frameMs: 380,
      loops: 1,
    },
    scratch: {
      frames: [
        "sit",
        "scratchA",
        "scratchB",
        "scratchC",
        "scratchB",
        "scratchC",
        "scratchA",
        "sit",
        "sitEar",
      ],
      frameMs: 150,
      loops: 1,
    },
    shake: {
      frames: ["stand", "shakeA", "shakeB", "shakeC", "shakeA", "shakeB", "stand", "standB"],
      frameMs: 110,
      loops: 1,
    },
    lookUp: {
      frames: ["stand", "look", "lookUp", "lookUp", "look", "stand"],
      frameMs: 360,
      loops: 1,
    },
    /**
     * Being petted on your feet, which is a different animal from being
     * petted lying down: the head comes up into the hand rather than the eyes
     * just closing. `pet` starts as an alias and is what anybody calls; a
     * posture that has its own answer to a hand replaces it further down.
     */
    nuzzle: { frames: ["petA", "petB", "petA", "petB", "petA"], frameMs: 400, loops: 1 },
    notice: {
      frames: ["stand", "earFlick", "look", "lookB", "look", "stand"],
      frameMs: 260,
      loops: 1,
    },
  };
  // what anybody calls; a posture with its own answer to a hand replaces it
  actions.pet = actions.nuzzle;

  if (species === "dog") {
    // a trot is a walk with a longer stride and a shorter frame; a gallop is
    // not a faster trot at all, so it is authored beat by beat below
    draw("trotA", gait(0, 3.6, 2.6, { earNear: EAR_FWD, earFar: EAR_FWD, tailSwing: 14 }));
    draw("trotB", gait(0.25, 3.6, 2.6, { earNear: EAR_FWD, earFar: EAR_FWD, tailSwing: -14 }));
    draw("trotC", gait(0.5, 3.6, 2.6, { earNear: EAR_FWD, earFar: EAR_FWD, tailSwing: 14 }));
    draw("trotD", gait(0.75, 3.6, 2.6, { earNear: EAR_FWD, earFar: EAR_FWD, tailSwing: -14 }));

    /**
     * The gallop. Four beats and none of them are a trot: gathered with all
     * four feet under a rounded back, extended with the whole animal off the
     * ground, the front feet landing while the hind ones are still behind, and
     * the drive where the hind feet come through under the belly.
     */
    const run = (o: Partial<Pose>): Partial<Pose> => ({
      earNear: EAR_BACK,
      earFar: EAR_BACK,
      mouth: "pant",
      tailSwing: 8,
      ...o,
    });
    draw(
      "runA",
      run({
        rear: [a.rear[0] + 0.5, a.rear[1] - 1.4],
        fore: [a.fore[0] - 0.5, a.fore[1] - 0.6],
        head: [a.head[0] - 1, a.head[1] + 0.4],
        nose: [a.head[0] + a.headRx + a.muzzle - 1.6, a.head[1] + 1.4],
        fn: [a.frontPaw - 1, FLOOR - 3],
        ff: [a.frontPaw - 2.5, FLOOR - 2],
        hn: [a.hindPaw + 4, FLOOR - 1],
        hf: [a.hindPaw + 2.5, FLOOR],
      }),
    );
    draw(
      "runB",
      run({
        rear: [a.rear[0] - 1, a.rear[1] - 2.6],
        fore: [a.fore[0] + 0.5, a.fore[1] - 2.6],
        head: [a.head[0] + 0.5, a.head[1] - 2],
        nose: [a.head[0] + a.headRx + a.muzzle + 1.4, a.head[1] - 1.6],
        fn: [a.frontPaw + 5, FLOOR - 5],
        ff: [a.frontPaw + 3.5, FLOOR - 4],
        hn: [a.hindPaw - 3, FLOOR - 4],
        hf: [a.hindPaw - 4.5, FLOOR - 3],
        tailSwing: 26,
      }),
    );
    draw(
      "runC",
      run({
        rear: [a.rear[0] - 0.5, a.rear[1] - 0.6],
        fore: [a.fore[0] + 0.5, a.fore[1] + 0.4],
        head: [a.head[0] + 0.5, a.head[1] + 0.8],
        nose: [a.head[0] + a.headRx + a.muzzle + 1, a.head[1] + 1.6],
        fn: [a.frontPaw + 4, FLOOR],
        ff: [a.frontPaw + 2, FLOOR],
        hn: [a.hindPaw - 2, FLOOR - 3],
        hf: [a.hindPaw - 3.5, FLOOR - 2],
      }),
    );
    draw(
      "runD",
      run({
        rear: [a.rear[0], a.rear[1] - 1],
        fore: [a.fore[0], a.fore[1] - 0.2],
        head: [a.head[0] - 0.5, a.head[1] + 0.2],
        nose: [a.head[0] + a.headRx + a.muzzle - 1, a.head[1] + 1],
        fn: [a.frontPaw + 1, FLOOR],
        ff: [a.frontPaw - 0.5, FLOOR - 1],
        hn: [a.hindPaw + 2.5, FLOOR - 2],
        hf: [a.hindPaw + 1, FLOOR - 1],
        tailSwing: -12,
      }),
    );

    /** Sitting to attention: chest up, ears forward, and completely still. */
    draw("attention", {
      ...sitting,
      fore: [a.fore[0], a.fore[1] - 1],
      foreR: a.foreR + 0.3,
      head: [sitHead[0] - 0.4, sitHead[1] - 1],
      nose: [sitHead[0] + a.headRx + a.muzzle - 0.6, sitHead[1] - 0.6],
      earNear: EAR_FWD,
      earFar: EAR_FWD,
      eyes: "wide",
    });
    draw("attentionB", {
      ...sitting,
      fore: [a.fore[0], a.fore[1] - 1],
      foreR: a.foreR + 0.6,
      head: [sitHead[0] - 0.4, sitHead[1] - 1],
      nose: [sitHead[0] + a.headRx + a.muzzle - 0.6, sitHead[1] - 0.6],
      earNear: EAR_FWD - 6,
      earFar: EAR_FWD,
      eyes: "wide",
    });

    /** The bark: the chest comes up and the whole head goes into it. */
    draw("barkA", {
      fore: [a.fore[0], a.fore[1] - 0.8],
      foreR: a.foreR + 0.5,
      head: [a.head[0] - 0.4, a.head[1] - 1.2],
      nose: [a.head[0] + a.headRx + a.muzzle - 0.8, a.head[1] - 1.6],
      mouth: "bark",
      eyes: "wide",
      earNear: EAR_FWD,
      earFar: EAR_FWD,
      tailSwing: 24,
    });
    draw("barkB", {
      fore: [a.fore[0] - 0.4, a.fore[1] + 0.4],
      head: [a.head[0] - 1.2, a.head[1] + 0.4],
      nose: [a.head[0] + a.headRx + a.muzzle - 2.2, a.head[1] + 0.6],
      mouth: "shut",
      earNear: EAR_FWD - 14,
      earFar: EAR_UP,
      tailSwing: -18,
    });

    draw("yawnA", { ...sitting, mouth: "open", eyes: "half", earNear: EAR_HALF, earFar: EAR_HALF });
    draw("yawnB", {
      ...sitting,
      head: [sitHead[0] - 0.6, sitHead[1] - 0.8],
      nose: [sitHead[0] + a.headRx + a.muzzle - 1.4, sitHead[1] - 1.4],
      mouth: "yawn",
      eyes: "shut",
      earNear: EAR_BACK,
      earFar: EAR_BACK,
    });
    draw("yawnC", { ...sitting, mouth: "lick", eyes: "half", earNear: EAR_HALF, earFar: EAR_UP });

    /**
     * The wag, as an overlay: every wagging frame is its own pose with the
     * tail re-solved from a different set angle, so the tail sweeps a real arc
     * instead of the same three pixels blinking on and off. A wag over a
     * standing dog, a sitting one and a lying one, because a dog wags at all
     * three and it means something different each time.
     */
    for (const [suffix, over] of [
      ["", {} as Partial<Pose>],
      ["Sit", sitting],
      ["Lie", lying],
    ] as const) {
      draw(`wag${suffix}A`, { ...over, tailSwing: 30 });
      draw(`wag${suffix}B`, { ...over, tailSwing: -18 });
      draw(`wag${suffix}C`, { ...over, tailSwing: 44, foreR: a.foreR + 0.35 });
    }

    actions.trot = { frames: ["trotA", "trotB", "trotC", "trotD"], frameMs: 120, loops: 6 };
    actions.run = { frames: ["runA", "runB", "runC", "runD"], frameMs: 95, loops: 8 };
    actions.bark = {
      frames: ["stand", "barkA", "barkB", "barkA", "barkB", "stand", "wagA", "wagB"],
      frameMs: 160,
      loops: 1,
    };
    actions.yawn = {
      frames: ["sit", "yawnA", "yawnB", "yawnB", "yawnC", "sit", "sitB"],
      frameMs: 320,
      loops: 1,
    };
    actions.wag = { frames: ["wagA", "wagB", "wagC", "wagB"], frameMs: 130, loops: 6 };
    actions.wagSit = {
      frames: ["wagSitA", "wagSitB", "wagSitC", "wagSitB"],
      frameMs: 140,
      loops: 6,
    };
    actions.wagLie = {
      frames: ["wagLieA", "wagLieB", "wagLieC", "wagLieB"],
      frameMs: 150,
      loops: 6,
    };
    actions.attention = {
      frames: ["sit", "attention", "attentionB", "attention", "wagSitA", "wagSitB", "attention"],
      frameMs: 340,
      loops: 1,
    };
    actions.greet = {
      frames: [
        "stand",
        "look",
        "lookB",
        "wagA",
        "wagC",
        "wagB",
        "wagC",
        "barkA",
        "barkB",
        "wagA",
        "wagB",
      ],
      frameMs: 170,
      loops: 1,
    };
  }

  if (species === "cat") {
    /**
     * The loaf. Not a lying cat: every leg is folded away underneath and the
     * silhouette is a solid block with a head on it, which is the entire joke
     * and the reason it has a name.
     */
    /**
     * The block. Roughly twice as long as it is deep, sat flat on the floor,
     * with the head straight on the front of it — no neck, no shoulder, no
     * daylight underneath. The corners are rounded by a pixel and a half,
     * which is the whole difference between a cat and a shoebox.
     */
    /**
     * Three to two, not two to one. A loaf gathers the whole cat into a shape
     * shorter than the animal's own back — drawn at its standing length it is
     * a plank with a head on the end, which is what the first pass of this
     * pose was.
     */
    const loafHalfW = (a.fore[0] - a.rear[0] + a.foreR) * 0.43;
    const loafHalfH = a.foreR * 1.24;
    const loafAt: Pt = [a.rear[0] + (a.fore[0] - a.rear[0]) * 0.55, FLOOR - loafHalfH + 0.6];
    const loafRound = 1.2;
    const loafBlock = { at: loafAt, halfW: loafHalfW, halfH: loafHalfH, round: loafRound };
    /**
     * The head goes far enough forward that the muzzle clears the front wall
     * and low enough that the jaw is inside the block. Anything higher opens a
     * gap the eye reads as a neck, and a loaf with a neck is a cat sitting up.
     */
    const loafHead: Pt = [loafAt[0] + loafHalfW - a.headRx * 0.75, loafAt[1] - loafHalfH - 0.3];
    const loafing: Partial<Pose> = {
      block: loafBlock,
      // the trunk landmarks move inside the block so that markings — a tabby's
      // bars especially — land on the shape that is actually drawn
      rear: [loafAt[0] - loafHalfW * 0.55, loafAt[1] + 0.3],
      fore: [loafAt[0] + loafHalfW * 0.58, loafAt[1] + 0.3],
      // deliberately smaller than the block. Markings are placed off the trunk
      // radius, and at the block's own size a tabby lays its spine stripe
      // exactly along the highlight and turns the top of the cat into a
      // sandwich of three stripes.
      rearR: loafHalfH * 0.62,
      foreR: loafHalfH * 0.62,
      head: loafHead,
      nose: [loafHead[0] + a.headRx + a.muzzle, loafHead[1] + 0.7],
      front: "hidden",
      hind: "hidden",
      tailFold: "wrap",
      eyes: "half",
    };
    /** The breath: the block swells and the floor stays where it is. */
    const loafBreath = {
      ...loafBlock,
      halfH: loafHalfH + 0.45,
      at: [loafAt[0], loafAt[1] - 0.45] as Pt,
    };
    draw("loaf", loafing);
    draw("loafB", { ...loafing, block: loafBreath });
    draw("loafBlink", { ...loafing, eyes: "shut" });
    draw("loafEar", { ...loafing, earNear: EAR_FWD + 12, earFar: EAR_HALF, eyes: "open" });
    draw("loafLook", {
      ...loafing,
      face: "front",
      eyes: "open",
      earNear: EAR_FWD,
      earFar: EAR_FWD,
    });

    /**
     * Kneading. The front paws go alternately, and the paw that is down is
     * pushing — which is why the shoulder over it drops rather than the whole
     * cat bobbing.
     */
    const kneadBase: Partial<Pose> = {
      rear: [a.rear[0] + 0.5, a.rear[1] + 1.2],
      fore: [a.fore[0], a.fore[1] + 0.6],
      head: [a.head[0] - 0.5, a.head[1] + 1.4],
      nose: [a.head[0] + a.headRx + a.muzzle - 1, a.head[1] + 2],
      eyes: "half",
      earNear: EAR_HALF,
      earFar: EAR_HALF,
      hind: "fold",
      hn: [a.hindPaw + 3, FLOOR],
      hf: [a.hindPaw + 1.5, FLOOR],
    };
    draw("kneadA", {
      ...kneadBase,
      front: "reach",
      fn: [a.frontPaw + 2.5, FLOOR - 4],
      ff: [a.frontPaw + 1, FLOOR],
    });
    draw("kneadB", {
      ...kneadBase,
      front: "reach",
      fn: [a.frontPaw + 2, FLOOR],
      ff: [a.frontPaw + 0.5, FLOOR - 4],
      foreR: a.foreR + 0.3,
    });

    /**
     * Grooming a paw.
     *
     * The first version of this raised a paw to an upright chest and got a
     * meerkat. A cat does the opposite: the paw barely leaves the floor and
     * the whole spine rounds forward to bring the head down onto it, so the
     * shoulder drops below the croup and the animal folds into a comma. Every
     * number here is that one idea — the fore end of the trunk goes *down and
     * back*, which tips the topline into an arch, and the head goes below the
     * shoulder rather than above it.
     */
    const groomRear: Pt = [a.rear[0] + 3, FLOOR - a.rearR - a.leg * 0.36];
    const groomFore: Pt = [a.fore[0] - 2.6, a.fore[1] + 3.4];
    const groomPaw: Pt = [a.frontPaw + 0.5, FLOOR - 2.2];
    const groomHead: Pt = [groomPaw[0] + 0.6, groomPaw[1] - a.headRy - 1.6];
    const grooming: Partial<Pose> = {
      tailSwing: -50,
      rear: groomRear,
      fore: groomFore,
      // a rounded back is a fatter loin than chest, which is the reverse of a
      // standing animal and the reason a grooming cat has no withers
      rearR: a.rearR + 0.5,
      foreR: a.foreR - 0.5,
      hind: "sit",
      hn: [a.hindPaw + 4, FLOOR],
      hf: [a.hindPaw + 2.5, FLOOR],
      front: "reach",
      ff: [a.frontPaw - 1.5, FLOOR],
      earNear: EAR_HALF,
      earFar: EAR_HALF,
    };
    draw("groomA", {
      ...grooming,
      head: groomHead,
      // nose straight down into the paw, which is the whole pose
      nose: [groomHead[0] + 0.4, groomHead[1] + a.headRy + 1.2],
      fn: groomPaw,
      eyes: "shut",
      mouth: "lick",
    });
    draw("groomB", {
      ...grooming,
      head: [groomHead[0] - 0.4, groomHead[1] - 1.2],
      nose: [groomHead[0] + 0.2, groomHead[1] + a.headRy - 0.4],
      fn: [groomPaw[0] - 0.4, groomPaw[1] - 0.8],
      eyes: "half",
      earNear: EAR_BACK,
    });
    /**
     * The other grooming: a hind leg brought up past the shoulder. Even more
     * folded than the first — the head goes further down and further forward
     * to meet a foot, which is the only time a cat's nose is between its own
     * hind toes and it is entirely serene about it.
     */
    draw("groomC", {
      ...grooming,
      head: [groomHead[0] - 1.6, groomHead[1] + 1.4],
      nose: [groomHead[0] - 2.2, groomHead[1] + a.headRy + 2.2],
      front: "stand",
      fn: [a.frontPaw, FLOOR],
      hind: "reach",
      hn: [groomHead[0] - 2.6, groomHead[1] + a.headRy + 3.4],
      eyes: "shut",
      mouth: "lick",
      earFar: EAR_BACK,
    });

    /** The flick: a whip tail cracking at the tip and nothing else moving. */
    draw("flickA", { tailSwing: 26 });
    draw("flickB", { tailSwing: -20, earNear: EAR_FWD - 18 });
    draw("flickSitA", { ...sitting, tailSwing: 24 });
    draw("flickSitB", { ...sitting, tailSwing: -22, earNear: EAR_FWD - 18 });

    actions.loaf = {
      frames: [
        "loaf",
        "loafB",
        "loaf",
        "loafBlink",
        "loaf",
        "loafEar",
        "loaf",
        "loafB",
        "loafLook",
        "loaf",
        "loafBlink",
        "loafB",
      ],
      frameMs: 780,
      loops: 1,
    };
    actions.knead = {
      frames: ["kneadA", "kneadB", "kneadA", "kneadB", "kneadA", "kneadB", "loaf"],
      frameMs: 300,
      loops: 1,
    };
    actions.groom = {
      frames: [
        "sit",
        "groomA",
        "groomB",
        "groomA",
        "groomB",
        "groomC",
        "groomC",
        "groomA",
        "sit",
        "sitB",
      ],
      frameMs: 300,
      loops: 1,
    };
    actions.flick = {
      frames: ["stand", "flickA", "stand", "flickB", "stand", "standB"],
      frameMs: 220,
      loops: 2,
    };
    actions.flickSit = { frames: ["sit", "flickSitA", "sit", "flickSitB"], frameMs: 240, loops: 2 };
    actions.prowl = { frames: ["walkA", "walkB", "walkC", "walkD"], frameMs: 230, loops: 4 };
  }

  if ((spec.doing ?? "standing") === "sleeping") {
    /**
     * An animal whose whole day is sleeping needs more than a loop of one
     * curl. This is the vocabulary of a dog who is old enough to have opinions
     * and is exercising most of them lying down: the ribs, the paw that
     * twitches at something in a dream, the one eye that opens when the door
     * goes and closes again when it turns out to be you, the tail that thumps
     * the floor twice without the rest of him moving at all, and the long slow
     * unfold into a sit for the rare occasion that is worth it.
     *
     * Every frame here is a real redraw. A sleeping animal that is two pixels
     * of the previous frame reads as a bad GIF; a sleeping animal whose ribs
     * genuinely fill and empty reads as alive, and that is the only thing this
     * pose has to do.
     */
    const curlAtY = curlAt[1];
    const sleeping = (o: Partial<Pose>): Partial<Pose> => ({ ...curled, ...o });
    /** Right down: tucked half a pixel tighter, ears flat, nose in the flank. */
    draw(
      "sleepDeep",
      sleeping({
        curl: { at: [curlAt[0], curlAtY + 0.4], r: curlR - 0.35 },
        earNear: EAR_FLAT,
        earFar: EAR_FLAT,
        head: [curlHead[0] - 0.5, curlHead[1] + 0.5],
        nose: [curlHead[0] - a.headRx - a.muzzle * 0.75 - 0.5, curlHead[1] + 1.8],
      }),
    );
    /** The bottom of a breath, and the top of one. */
    draw("sleepOut", sleeping({ curl: { at: [curlAt[0], curlAtY + 0.35], r: curlR - 0.3 } }));
    draw("sleepIn", sleeping({ curl: { at: [curlAt[0], curlAtY - 0.7], r: curlR + 0.7 } }));
    /** Chasing something. The near hind paw comes out from under the mass. */
    draw(
      "sleepTwitch",
      sleeping({
        hind: "reach",
        hn: [curlAt[0] - curlR * 1.2, FLOOR - 1.5],
        earNear: EAR_FLAT - 12,
        mouth: "lick",
      }),
    );
    /** The ear alone: something in the corridor, and nothing else moves. */
    draw("sleepEar", sleeping({ earNear: EAR_FWD - 8, earFar: EAR_BACK }));
    /** One eye. This is the whole of his greeting, most days. */
    draw("sleepEye", sleeping({ eyes: "half", earNear: EAR_UP + 6, earFar: EAR_BACK }));
    draw(
      "sleepEyeB",
      sleeping({
        eyes: "open",
        earNear: EAR_FWD + 6,
        earFar: EAR_HALF,
        head: [curlHead[0], curlHead[1] - 0.6],
        nose: [curlHead[0] - a.headRx - a.muzzle * 0.75, curlHead[1] + 0.8],
      }),
    );
    /** Everything in order. It closes. */
    draw("sleepShut", sleeping({ eyes: "shut", earNear: EAR_BACK, earFar: EAR_FLAT }));

    /** The unfold: the head comes off the flank, the front legs find the floor. */
    draw(
      "unfoldA",
      sleeping({
        curl: { at: [curlAt[0], curlAtY - 0.4], r: curlR + 0.3 },
        head: [curlHead[0] + 0.6, curlHead[1] - 2.4],
        nose: [curlHead[0] - a.headRx - a.muzzle * 0.4, curlHead[1] - 2.6],
        eyes: "half",
        earNear: EAR_HALF,
        earFar: EAR_HALF,
      }),
    );
    draw("unfoldB", {
      ...lying,
      head: [lieHead[0] - 0.6, lieHead[1] + 1.6],
      nose: [lieHead[0] + a.headRx + a.muzzle - 1.4, lieHead[1] + 2.6],
      eyes: "half",
      earNear: EAR_HALF,
      earFar: EAR_HALF,
      mouth: "yawn",
    });
    draw("unfoldC", {
      ...lying,
      rear: [lieRear[0], lieRear[1] - 1.4],
      front: "stand",
      fn: [a.frontPaw + 1, FLOOR],
      ff: [a.frontPaw - 0.5, FLOOR],
      eyes: "open",
      earNear: EAR_UP,
      earFar: EAR_UP,
    });

    /**
     * The thump. A lying dog answers you with its tail and nothing else: the
     * tail comes up, hits the floor, and the ribs give one small bump where
     * the impact goes through him.
     */
    draw("thumpUp", { ...lying, tailSwing: 34, eyes: "half", earNear: EAR_HALF });
    draw("thumpDown", { ...lying, tailSwing: -34, foreR: a.foreR + 0.3, eyes: "half" });
    draw("thumpRest", { ...lying, tailSwing: -46, eyes: "shut", earNear: EAR_BACK });

    /**
     * The sigh: a long fill and a longer collapse, with the ears going back on
     * the way out. Nothing else in the set is this slow, which is what makes it
     * read as a comment rather than as breathing.
     */
    draw("sighIn", {
      ...lying,
      foreR: a.foreR + 0.8,
      rearR: a.rearR + 0.5,
      head: [lieHead[0] - 0.4, lieHead[1] - 0.8],
      nose: [lieHead[0] + a.headRx + a.muzzle - 0.4, lieHead[1] - 0.2],
      eyes: "shut",
      earNear: EAR_HALF,
      earFar: EAR_HALF,
    });
    draw("sighOut", {
      ...lying,
      foreR: a.foreR - 0.4,
      rearR: a.rearR - 0.3,
      head: [lieHead[0] + 0.8, lieHead[1] + 2.6],
      nose: [lieHead[0] + a.headRx + a.muzzle + 1.6, lieHead[1] + 3.4],
      eyes: "shut",
      mouth: "open",
      earNear: EAR_FLAT,
      earFar: EAR_FLAT,
    });
    /** Head off the paws, turned up at whoever is standing over him. */
    draw("upAt", {
      ...lying,
      face: "front",
      head: [lieHead[0] - 1, lieHead[1] - 1.2],
      eyes: "wide",
      earNear: EAR_FWD,
      earFar: EAR_FWD,
    });

    actions.sleep = {
      frames: [
        "curl",
        "sleepIn",
        "curl",
        "sleepOut",
        "sleepDeep",
        "sleepOut",
        "curl",
        "sleepIn",
        "curl",
        "sleepOut",
        "sleepTwitch",
        "sleepDeep",
        "curl",
        "curlB",
        "sleepEar",
        "curl",
        "sleepOut",
        "sleepDeep",
        "sleepIn",
        "curl",
      ],
      frameMs: 820,
      loops: 1,
    };
    actions.wake = {
      frames: [
        "sleepDeep",
        "curlEar",
        "sleepEye",
        "sleepEyeB",
        "sleepEyeB",
        "curlEye",
        "sleepShut",
        "curl",
      ],
      frameMs: 420,
      loops: 1,
    };
    actions.unfold = {
      frames: ["curl", "sleepEye", "unfoldA", "unfoldB", "unfoldC", "lie", "sitHalf", "sit"],
      frameMs: 400,
      loops: 1,
    };
    actions.thump = {
      frames: ["lie", "thumpUp", "thumpDown", "thumpUp", "thumpDown", "thumpRest", "lie"],
      frameMs: 190,
      loops: 1,
    };
    actions.sigh = {
      frames: ["lie", "sighIn", "sighIn", "sighOut", "sighOut", "lieShut", "lie"],
      frameMs: 560,
      loops: 1,
    };
    actions.lookUp = {
      frames: ["lieDown", "lie", "upAt", "upAt", "lie", "lieDown"],
      frameMs: 400,
      loops: 1,
    };
    actions.pet = {
      frames: ["lie", "upAt", "thumpUp", "thumpDown", "thumpUp", "sighOut", "lieShut", "lie"],
      frameMs: 300,
      loops: 1,
    };
    actions.notice = {
      frames: ["curl", "sleepEar", "sleepEye", "sleepEyeB", "sleepEye", "sleepShut", "curl"],
      frameMs: 380,
      loops: 1,
    };
  }

  for (const [id, def] of Object.entries(actions)) b.action(id, def);

  const doing = spec.doing ?? (cat ? "loafing" : "standing");
  const idleAction =
    spec.reactions?.idle ??
    (doing === "sitting"
      ? "sit"
      : doing === "lying"
        ? "lie"
        : doing === "sleeping"
          ? "sleep"
          : doing === "loafing"
            ? cat
              ? "loaf"
              : "lie"
            : doing === "prowling"
              ? cat
                ? "prowl"
                : "trot"
              : "idle");

  return {
    ...b.build(),
    id: spec.id,
    name: spec.name,
    species,
    idleAction,
    reactions: {
      onPet: spec.reactions?.onPet ?? "pet",
      onNotice: spec.reactions?.onNotice ?? (cat ? "flick" : "greet"),
      onCall: spec.reactions?.onCall ?? (cat ? "flick" : "attention"),
      idle: idleAction,
    },
    look,
  };
}
