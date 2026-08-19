import type { SpritePalette } from "../core/types";

/**
 * npcPalette — the thirty-odd colours a person is made of.
 *
 * Every pixel in an NPC sprite is one letter, and this is where a letter
 * becomes a colour. Three rules hold the whole scheme together:
 *
 *   1. Nothing is authored as a hex in a character spec. A spec says
 *      `skin: "olive"`, `topColour: "navy"`, and the ramp is derived here, so
 *      a hundred people share one set of decisions about light.
 *   2. Every material gets a lit tone, a base tone and a shade tone off the
 *      same colour, so cloth has form to it rather than being a flat
 *      rectangle.
 *   3. A shade is never the base mixed toward black. One dark drags every
 *      material toward the same brown-grey, which is what made a whole estate
 *      of people read as one person in six outfits — the sepia photograph
 *      problem. A shade here carries its chroma down, gives up a share of its
 *      lightness, and turns its hue: denim deepens into blue-violet, brick
 *      into oxblood, hi-vis into a saturated lime, black cotton into
 *      blue-black. Lit tones turn the other way, toward the warm end, because
 *      the light on this estate is low sun coming off concrete.
 */

/**
 * Zone letters. Lower case is the material as it is, upper case is that
 * material in shadow, and the odd extra letter is a third tone where two
 * would not carry the form.
 *
 *   s S y   skin, shade, highlight        h H i   hair, shade, lit
 *   e       eye                           f F     beard, shade
 *   t T l   top garment, shade, lit       a A g   accent, shade, lit
 *   p q m   trousers, shade, lit          b B     shoes, soles
 *   k K j   hat, shade, lit               c n     prop light, prop dark
 *   d       occlusion: the contact shadow under a brim, a chin, a hem
 *   w       smoke, breath on a cold morning
 *   o       something warm — an ember, a lit screen
 */
export type NpcZone =
  | "s"
  | "S"
  | "y"
  | "h"
  | "H"
  | "i"
  | "e"
  | "f"
  | "F"
  | "t"
  | "T"
  | "l"
  | "a"
  | "A"
  | "g"
  | "p"
  | "q"
  | "m"
  | "b"
  | "B"
  | "k"
  | "K"
  | "j"
  | "c"
  | "n"
  | "d"
  | "w"
  | "o";

// ---------------------------------------------------------------------------
// colour maths
// ---------------------------------------------------------------------------

type Hsl = { h: number; s: number; l: number };

const HEX6 = /^#([0-9a-f]{6})$/i;

/** Parse a hex. Anything else is somebody's literal CSS colour: leave it be. */
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

function channels(h: number, c: number, x: number): [number, number, number] {
  switch (Math.floor((((h % 360) + 360) % 360) / 60) % 6) {
    case 0:
      return [c, x, 0];
    case 1:
      return [x, c, 0];
    case 2:
      return [0, c, x];
    case 3:
      return [0, x, c];
    case 4:
      return [x, 0, c];
    default:
      return [c, 0, x];
  }
}

function toHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const floor = l - c / 2;
  const [r, g, b] = channels(h, c, x);
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round((v + floor) * 255)));
  return `#${((1 << 24) | (byte(r) << 16) | (byte(g) << 8) | byte(b)).toString(16).slice(1)}`;
}

/** Mix a hex toward another hex. Used where two materials meet, not for shading. */
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

/**
 * Which way round the wheel a hue travels as it darkens.
 *
 * Everything from the yellows through green and cyan to blue turns upward,
 * into blue and then violet: olive deepens into green, teal into cyan, denim
 * into blue-violet. Everything from the yellows back through orange, red and
 * magenta turns the other way and arrives at violet from below: brick deepens
 * into oxblood, skin into red.
 *
 * The split sits at the top of the oranges. Put it any higher and mustard
 * shades into brown, which is the single decision that made everybody look
 * like an old photograph.
 */
const WARM_ARC_END = 40;
const COOL_ARC_END = 250;

const turnDirection = (h: number): 1 | -1 => (h >= WARM_ARC_END && h < COOL_ARC_END ? 1 : -1);

const wrap = (h: number) => ((h % 360) + 360) % 360;

/** Saturation that lands a given chroma at a given lightness. */
function saturationFor(chroma: number, l: number): number {
  const room = 1 - Math.abs(2 * l - 1);
  return room < 1e-4 ? 0 : Math.min(1, chroma / room);
}

/**
 * Below this a colour has no hue to protect — a true grey, a white shirt.
 * Those borrow the light's own temperature instead: cool in shadow, warm where
 * the sun lands. Anything with a hue of its own keeps it and turns it.
 */
const ACHROMATIC_S = 0.07;
/** The blue a grey picks up from the sky when nothing else is lighting it. */
const SHADOW_TINT_HUE = 228;
/** Low sun off concrete. */
const WARM_TINT_HUE = 44;
/**
 * The chroma a derived tone never falls below, so that even a stairwell grey
 * has a temperature to it. A shadow with no colour left in it is what the eye
 * reads as grime.
 */
const MIN_SHADE_CHROMA = 0.06;
const MIN_LIT_CHROMA = 0.045;

/** Shadows stop here. Pure black on a sprite reads as a hole, not as cloth. */
const SHADE_FLOOR_L = 0.045;
const LIT_CEIL_L = 0.96;

/**
 * A light material keeps more of its lightness in shadow than a dark one does.
 * A white shirt in shade is still obviously white; a black jacket in shade is
 * nearly gone. Applying one flat fraction to both turns the whites to mud.
 */
const LIGHT_RELIEF = 0.42;

/**
 * How much more saturated than the base a derived tone may become. HSL packs
 * less chroma into a colour the further it is from mid grey, so carrying a
 * chroma down into a shade asks for a large saturation rise, and a mid navy
 * asked past this limit comes back as electric blue.
 */
const MAX_SAT_GAIN = 1.35;

type Tuning = {
  /** Fraction of its lightness the shade tone gives up, before light relief. */
  drop: number;
  /** Fraction of the remaining distance to full light the lit tone covers. */
  climb: number;
  shadeTurn: number;
  litTurn: number;
  /** Chroma multipliers. Above 1 the shadow gets richer, not dirtier. */
  shadeChroma: number;
  litChroma: number;
  /** Overrides the wheel rule. Skin shadows go red-ward whatever the hue. */
  turnDir?: 1 | -1;
};

type Ramp = { lit: string; base: string; shade: string };

/**
 * The three tones of one material.
 *
 * A shade gives up a fraction of the base's lightness; a lit tone covers a
 * fraction of what is left between the base and full light. The two forms are
 * deliberately different: a black jacket needs a real grey on its top plane to
 * have any form at all, while a cream one only wants a whisper.
 *
 * What carries across the ramp is chroma, not saturation. Mixing toward a dark
 * throws chroma away, which is exactly what turned every garment the same
 * brown; carrying it means a shadow is the same dye at a lower light.
 */
function ramp(hex: string, t: Tuning): Ramp {
  const hsl = toHsl(hex);
  if (!hsl) return { lit: hex, base: hex, shade: hex };
  const { h, s, l } = hsl;
  const chroma = s * (1 - Math.abs(2 * l - 1));
  const achromatic = s < ACHROMATIC_S;
  const dir = t.turnDir ?? turnDirection(h);

  const shadeL = Math.max(SHADE_FLOOR_L, l * (1 - t.drop * (1 - LIGHT_RELIEF * l)));
  const litL = Math.min(LIT_CEIL_L, l + (LIT_CEIL_L - l) * t.climb);

  const shadeH = achromatic ? SHADOW_TINT_HUE : wrap(h + dir * t.shadeTurn);
  const litH = achromatic ? WARM_TINT_HUE : wrap(h - dir * t.litTurn);

  const carry = (target: number, toneL: number, floor: number) =>
    Math.min(
      1,
      Math.max(
        Math.min(saturationFor(target, toneL), s * MAX_SAT_GAIN),
        saturationFor(floor, toneL),
      ),
    );

  return {
    lit: toHex({ h: litH, s: carry(chroma * t.litChroma, litL, MIN_LIT_CHROMA), l: litL }),
    base: hex,
    shade: toHex({
      h: shadeH,
      s: carry(chroma * t.shadeChroma, shadeL, MIN_SHADE_CHROMA),
      l: shadeL,
    }),
  };
}

/** Cloth: the biggest flat areas on a sprite, so the step has to read at a glance. */
const CLOTH: Tuning = {
  drop: 0.46,
  climb: 0.2,
  shadeTurn: 14,
  litTurn: 11,
  shadeChroma: 1.08,
  litChroma: 0.92,
};

/** Shoes sit in the ground's own shadow and take the deepest step of anything. */
const LEATHER: Tuning = {
  drop: 0.55,
  climb: 0.22,
  shadeTurn: 14,
  litTurn: 12,
  shadeChroma: 1.0,
  litChroma: 0.85,
};

/**
 * Skin. Half a face is shade pixels, so the step stays gentler than cloth or
 * a cheekbone turns into a bruise. It always turns red-ward: what is under
 * skin is blood, and a grey shadow on a face reads as a corpse.
 */
const SKIN: Tuning = {
  drop: 0.4,
  climb: 0.26,
  shadeTurn: 13,
  litTurn: 12,
  shadeChroma: 1.12,
  litChroma: 0.84,
  turnDir: -1,
};

/** Hair is a small dark mass; without a hard crown-to-side step it is a helmet. */
const HAIR: Tuning = {
  drop: 0.45,
  climb: 0.16,
  shadeTurn: 15,
  litTurn: 10,
  shadeChroma: 1.06,
  litChroma: 0.88,
};

/** Props are objects, not cloth: a hard light side and a near-black underside. */
const PROP: Tuning = {
  drop: 0.6,
  climb: 0.24,
  shadeTurn: 16,
  litTurn: 13,
  shadeChroma: 1.0,
  litChroma: 0.86,
};

// ---------------------------------------------------------------------------
// the named tables
// ---------------------------------------------------------------------------

/**
 * Named skins. A spec says `skin: "olive"`, never a hex. The undertone drifts
 * as they go down the list — pale is rosy, olive genuinely yellow-green rather
 * than orange, deep cool rather than muddy — so two neighbours standing next
 * to each other are not the same face at two brightnesses.
 */
export const NPC_SKINS = {
  pale: "#f0d8c8",
  fair: "#e5c29d",
  olive: "#cdab7e",
  tan: "#b8895c",
  brown: "#8f603c",
  deep: "#5d3b28",
  /** Wind-burnt: a caretaker, a man who drinks outside the shop. */
  ruddy: "#dda78c",
  /** Yellowed, indoor, twenty a day. */
  sallow: "#cdbc94",
} as const;

export const NPC_HAIRS = {
  /** Blue-black. Warm black is the tell of a sepia palette. */
  black: "#1f212b",
  brown: "#4b3524",
  chestnut: "#6d4327",
  blond: "#c3a35d",
  ginger: "#ae5628",
  grey: "#8a8a90",
  white: "#d9d8d6",
  /** Dishwater blond that has started to go. */
  ash: "#a89f96",
  /** A home peroxide job with the roots still showing. */
  bleach: "#e0cf9a",
} as const;

/**
 * Cloth, for tops, bottoms, hats, shoes and accents alike. Named after the
 * thing rather than the hue where the thing is more specific than the hue:
 * a tracksuit navy is not a blue, it is a tracksuit.
 */
export const NPC_FABRICS = {
  /** Tracksuit navy, three stripes down the leg. */
  navy: "#243a63",
  /** Faded, not new — the blue that has been through a hundred washes. */
  denim: "#5c7391",
  sky: "#87a9c8",
  /** Oxidised copper, the green of a church roof. */
  teal: "#2e7d74",
  /** Bottle green. */
  forest: "#2d5236",
  /** Army surplus. */
  olive: "#5b6235",
  mustard: "#c69a33",
  rust: "#a4522a",
  /** Oxblood. */
  maroon: "#6d2a2d",
  red: "#b23129",
  plum: "#682f5d",
  pink: "#c98a92",
  cream: "#dcd3b8",
  white: "#e9e8e6",
  /** Ash grey, the colour of everything on a stairwell. */
  grey: "#888c92",
  charcoal: "#383d46",
  /** Blue-black, the way dyed cotton actually sits in daylight. */
  black: "#262a33",
  brown: "#66452a",
  /** Roadworks yellow. Stays loud in shadow, which is the whole point of it. */
  hiVis: "#d6e23f",
  green: "#4a8a4a",
  /** The block itself. */
  brick: "#9c5240",
  khaki: "#8b8058",
  slate: "#4e5966",
  sand: "#c9b489",
  wine: "#5e2434",
  copper: "#b0703a",
  lilac: "#9b8fb5",
  moss: "#5f7042",
  steel: "#6f7d8c",
} as const;

export type SkinName = keyof typeof NPC_SKINS;
export type HairName = keyof typeof NPC_HAIRS;
export type FabricName = keyof typeof NPC_FABRICS;

const fabric = (name: FabricName | string) => (NPC_FABRICS as Record<string, string>)[name] ?? name;

/** What the palette needs to know about a person. A subset of `NpcLook`. */
export type PaletteLook = {
  skin?: SkinName;
  hair?: HairName;
  eyes?: FabricName | string;
  topColour?: FabricName;
  bottomColour?: FabricName;
  shoeColour?: FabricName;
  accentColour?: FabricName;
  hatColour?: FabricName;
  propColour?: FabricName;
};

/** The contact shadow: under a brim, under a chin, between two legs. */
const OCCLUSION = "#0d0f17";
/** Smoke, and breath on a January morning. Cool, because it is never lit. */
const SMOKE = "#b6bac4";
const EMBER = "#f08236";
const DEFAULT_EYE = "#2b3239";

export function npcPalette(look: PaletteLook = {}): SpritePalette {
  const skin = ramp(NPC_SKINS[look.skin ?? "fair"], SKIN);
  const hair = ramp(NPC_HAIRS[look.hair ?? "brown"], HAIR);
  const top = ramp(fabric(look.topColour ?? "grey"), CLOTH);
  const bottom = ramp(fabric(look.bottomColour ?? "charcoal"), CLOTH);
  const shoes = ramp(fabric(look.shoeColour ?? "black"), LEATHER);
  const accent = ramp(fabric(look.accentColour ?? "cream"), CLOTH);
  const hat = ramp(fabric(look.hatColour ?? "navy"), CLOTH);
  const prop = ramp(fabric(look.propColour ?? "cream"), PROP);
  // Stubble is hair thin enough to see skin through, so it is authored as the
  // two mixed rather than as a colour of its own.
  const beard = ramp(mix(hair.base, skin.base, 0.35), HAIR);
  return {
    s: skin.base,
    S: skin.shade,
    y: skin.lit,
    h: hair.base,
    H: hair.shade,
    i: hair.lit,
    e: fabric(look.eyes ?? DEFAULT_EYE),
    f: beard.base,
    F: beard.shade,
    t: top.base,
    T: top.shade,
    l: top.lit,
    a: accent.base,
    A: accent.shade,
    g: accent.lit,
    p: bottom.base,
    q: bottom.shade,
    m: bottom.lit,
    b: shoes.base,
    B: shoes.shade,
    k: hat.base,
    K: hat.shade,
    j: hat.lit,
    c: prop.base,
    n: prop.shade,
    d: OCCLUSION,
    w: SMOKE,
    o: EMBER,
  };
}
