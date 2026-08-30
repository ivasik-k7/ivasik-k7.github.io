import { PLAYER_PALETTE } from "@/components/game/sprites";
import {
  type BodySpec,
  type BottomKind,
  BUILDS,
  type Build,
  type CharacterSpec,
  type FootKind,
  HEIGHTS,
  type HeadKind,
  type Height,
  NECKS,
  type Neck,
  type PlayerConfig,
  POSTURES,
  type Posture,
  type SpritePalette,
  TORSO_GARMENTS,
  type TorsoKind,
} from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { playerFor as compilePlayer } from "./player";

/**
 * Appearance — who he is and what he has on, as option ids.
 *
 * Two kinds of thing live in `world.appearance` and they are resolved by two
 * different systems:
 *
 *   colours   skin · hair · beard · hat · shirt · trousers · shoes
 *             → a palette (`paletteForAppearance`), the same paper-doll
 *             recolour the wardrobe has always done;
 *   shapes    top · bottom · feet · head · build · height · neck · posture
 *             → a `CharacterSpec` (`specForAppearance`), which the rig turns
 *             into different pixels: a hoodie has a hood, boots have a
 *             shaft, a powerlifter has shoulders.
 *
 * The shape keys are new. A save written before they existed has only the
 * colour keys, and some of those colour ids used to *imply* a shape —
 * "hoodie-grey" was the grey option that also meant a hoodie. `normalize`
 * fills a missing shape from the legacy id, so an old save loads wearing what
 * it always wore, now with the geometry to match.
 *
 * Two colour slots are *derived*: a clean shave paints the beard zone in
 * skin, a shaved head paints the scalp in skin. Anything that borrows from a
 * neighbouring zone is resolved here against the look as a whole.
 */

/** What a save actually holds — shape keys may be missing. */
export type StoredAppearance = WorldState["appearance"];
/** What the game reads — every key present (see `normalizeAppearance`). */
export type Appearance = Required<StoredAppearance>;
/** Loose input: URL params, rolls, old saves. */
export type AppearanceInput = Partial<{ [K in keyof StoredAppearance]: string }>;

export type SlotGroup = "body" | "person" | "cut" | "colour";

export interface SlotOption {
  id: string;
  label: string;
  colors: SpritePalette;
}

export interface AppearanceSlot {
  key: keyof Appearance;
  label: string;
  group: SlotGroup;
  options: SlotOption[];
}

export const APPEARANCE_GROUPS: { id: SlotGroup; label: string }[] = [
  { id: "body", label: "THE BODY" },
  { id: "person", label: "WHO HE IS" },
  { id: "cut", label: "WHAT HE WEARS" },
  { id: "colour", label: "IN WHAT COLOUR" },
];

const cutOptions = (labels: Record<string, string>): SlotOption[] =>
  Object.entries(labels).map(([id, label]) => ({ id, label, colors: {} }));

export const BUILD_LABEL: Record<Build, string> = {
  slight: "Slight",
  lean: "Lean",
  athletic: "Athletic",
  heavy: "Heavy",
  powerlifter: "Powerlifter",
};
export const HEIGHT_LABEL: Record<Height, string> = {
  short: "178 cm",
  average: "188 cm",
  tall: "195 cm",
  towering: "202 cm",
};
export const NECK_LABEL: Record<Neck, string> = { thin: "Thin", normal: "Normal", thick: "Thick" };
export const POSTURE_LABEL: Record<Posture, string> = {
  upright: "Upright",
  relaxed: "Relaxed",
  slouched: "Slouched",
};
export const TOP_LABEL: Record<TorsoKind, string> = {
  tee: "T-shirt",
  tank: "Tank top",
  longsleeve: "Long sleeve",
  hoodie: "Hoodie",
  jumper: "Jumper",
  jacket: "Jacket",
  kurtka: "Sambo kurtka",
  shirt: "Shirt",
};
export const BOTTOM_LABEL: Record<BottomKind, string> = {
  trousers: "Trousers",
  joggers: "Joggers",
  shorts: "Shorts",
  tracksuit: "Tracksuit",
};
export const FEET_LABEL: Record<FootKind, string> = {
  sneakers: "Sneakers",
  boots: "Boots",
  sandals: "Sandals",
  barefoot: "Barefoot",
};
export const HEAD_LABEL: Record<HeadKind, string> = {
  none: "Nothing",
  cap: "Cap",
  beanie: "Beanie",
  hood: "Hood up",
};

export const APPEARANCE_SLOTS: AppearanceSlot[] = [
  // --- the body ---------------------------------------------------------------
  { key: "build", label: "BUILD", group: "body", options: cutOptions(BUILD_LABEL) },
  { key: "height", label: "HEIGHT", group: "body", options: cutOptions(HEIGHT_LABEL) },
  { key: "neck", label: "NECK", group: "body", options: cutOptions(NECK_LABEL) },
  { key: "posture", label: "POSTURE", group: "body", options: cutOptions(POSTURE_LABEL) },
  // --- the man ----------------------------------------------------------------
  {
    key: "skin",
    label: "SKIN",
    group: "person",
    options: [
      { id: "default", label: "Warm", colors: { s: "#e0b48c", S: "#c79a72", y: "#ead9a8" } },
      { id: "tan", label: "Tan", colors: { s: "#c99668", S: "#a87a4e", y: "#dbb488" } },
      { id: "pale", label: "Pale", colors: { s: "#ecc9a8", S: "#d2ad8a", y: "#f5e4c4" } },
      { id: "olive", label: "Olive", colors: { s: "#c4a274", S: "#a2825a", y: "#d9c096" } },
      { id: "deep", label: "Deep", colors: { s: "#9a6a44", S: "#7c5232", y: "#b88a5e" } },
      { id: "dark", label: "Dark", colors: { s: "#6e4a30", S: "#553722", y: "#8a6244" } },
    ],
  },
  {
    key: "hair",
    label: "HAIR",
    group: "person",
    options: [
      { id: "default", label: "Chestnut", colors: { h: "#3a2a1e", H: "#2b1e15" } },
      { id: "black", label: "Black", colors: { h: "#1d1a17", H: "#100e0c" } },
      { id: "blond", label: "Blond", colors: { h: "#b89a5e", H: "#96793f" } },
      { id: "copper", label: "Copper", colors: { h: "#9a5230", H: "#7a3d20" } },
      { id: "ash", label: "Ash", colors: { h: "#6f665c", H: "#544c44" } },
      { id: "silver", label: "Silver", colors: { h: "#a8a8a4", H: "#84847e" } },
      // no hexes: a shaved head is skin, resolved against today's skin below
      { id: "shaved", label: "Shaved", colors: {} },
    ],
  },
  {
    key: "beard",
    label: "BEARD",
    group: "person",
    options: [
      { id: "default", label: "Stubble", colors: { f: "#7a5c48", F: "#5f4636" } },
      { id: "full", label: "Full beard", colors: { f: "#4a3626", F: "#37281c" } },
      { id: "grey", label: "Grey beard", colors: { f: "#8a847a", F: "#6a655c" } },
      { id: "none", label: "Clean shave", colors: {} },
    ],
  },
  // --- the cut ----------------------------------------------------------------
  { key: "head", label: "ON THE HEAD", group: "cut", options: cutOptions(HEAD_LABEL) },
  { key: "top", label: "TOP", group: "cut", options: cutOptions(TOP_LABEL) },
  { key: "bottom", label: "LEGS", group: "cut", options: cutOptions(BOTTOM_LABEL) },
  { key: "feet", label: "FEET", group: "cut", options: cutOptions(FEET_LABEL) },
  // --- the colour -------------------------------------------------------------
  {
    key: "hat",
    label: "HAT",
    group: "colour",
    options: [
      { id: "navy", label: "Navy", colors: { k: "#2e4568", K: "#23344d" } },
      { id: "black", label: "Black", colors: { k: "#26262c", K: "#17171b" } },
      { id: "red", label: "Red", colors: { k: "#a33a30", K: "#7d2820" } },
      { id: "olive", label: "Olive", colors: { k: "#5f7053", K: "#48563e" } },
      { id: "grey", label: "Grey", colors: { k: "#6d7278", K: "#565a60" } },
    ],
  },
  {
    key: "shirt",
    label: "TOP",
    group: "colour",
    options: [
      { id: "default", label: "Black", colors: { t: "#1d1d24", T: "#0a0a0e" } },
      { id: "white", label: "White", colors: { t: "#e2ddd0", T: "#bdb8a8" } },
      { id: "grey", label: "Grey", colors: { t: "#6d7278", T: "#565a60" } },
      { id: "olive", label: "Olive", colors: { t: "#5f7053", T: "#48563e" } },
      { id: "navy", label: "Navy", colors: { t: "#2e4568", T: "#23344d" } },
      { id: "maroon", label: "Maroon", colors: { t: "#7c3040", T: "#5d2430" } },
      { id: "red", label: "Red", colors: { t: "#a33a30", T: "#7d2820" } },
      { id: "brown", label: "Brown", colors: { t: "#6b4a30", T: "#4f3622" } },
      { id: "cream", label: "Cream", colors: { t: "#d9c9a3", T: "#b3a480" } },
      { id: "forest", label: "Forest", colors: { t: "#3b5540", T: "#2b3f30" } },
    ],
  },
  {
    key: "trousers",
    label: "LEGS",
    group: "colour",
    options: [
      { id: "default", label: "Navy", colors: { p: "#33415e", q: "#28344c", Q: "#1e2839" } },
      { id: "black", label: "Black", colors: { p: "#26262c", q: "#1a1a1f", Q: "#121216" } },
      { id: "khaki", label: "Khaki", colors: { p: "#7a6f52", q: "#615840", Q: "#4d4632" } },
      { id: "grey", label: "Grey", colors: { p: "#6d7278", q: "#565a60", Q: "#43464c" } },
      { id: "denim", label: "Denim", colors: { p: "#4a5f86", q: "#3a4a6a", Q: "#2c3852" } },
      { id: "brown", label: "Brown", colors: { p: "#5c4531", q: "#463424", Q: "#35271a" } },
      { id: "sambo", label: "Red", colors: { p: "#a33a30", q: "#7d2820", Q: "#601c16" } },
    ],
  },
  {
    key: "shoes",
    label: "FEET",
    group: "colour",
    options: [
      { id: "default", label: "White", colors: { b: "#d8d8d0", B: "#8f9089" } },
      { id: "black", label: "Black", colors: { b: "#2e3033", B: "#1d1f22" } },
      { id: "red", label: "Red", colors: { b: "#c94040", B: "#8f2f2f" } },
      { id: "brown", label: "Brown", colors: { b: "#6b4a30", B: "#4a3220" } },
      { id: "sambovki", label: "Blue", colors: { b: "#3a5a8c", B: "#2a4268" } },
    ],
  },
];

/**
 * Saves written before the shape keys existed carried the shape in the colour
 * id: "hoodie-grey" was the grey option *and* a hoodie. Each legacy id maps to
 * the cut it implied and the modern colour it becomes, so an old save loads
 * dressed as it always was and never carries the alias forward. Only
 * consulted when the shape key is missing — a save that has `top` already
 * said what it meant.
 */
const LEGACY_SHIRT: Record<string, { top: TorsoKind; shirt: string }> = {
  "hoodie-grey": { top: "hoodie", shirt: "grey" },
  "hoodie-black": { top: "hoodie", shirt: "black" },
  sambo: { top: "kurtka", shirt: "red" },
};
const LEGACY_TROUSERS: Record<string, { bottom: BottomKind }> = {
  // the old "Grey joggers" option; the "Sambo shorts" option keeps its red
  grey: { bottom: "joggers" },
  sambo: { bottom: "shorts" },
};
const LEGACY_SHOES: Record<string, { feet: FootKind }> = {
  // the old option was labelled "Black boots"
  black: { feet: "boots" },
};

/** A colour id the slot actually offers, or the slot's first option. */
function colourId(key: keyof Appearance, id: unknown): string {
  const slot = APPEARANCE_SLOTS.find((s) => s.key === key);
  if (!slot) return "default";
  return typeof id === "string" && slot.options.some((o) => o.id === id) ? id : slot.options[0].id;
}

const pick = <T extends string>(v: unknown, all: readonly T[], fallback: T): T =>
  all.includes(v as T) ? (v as T) : fallback;

const TOPS = Object.keys(TORSO_GARMENTS) as TorsoKind[];
const BOTTOMS: BottomKind[] = ["trousers", "joggers", "shorts", "tracksuit"];
const FEET: FootKind[] = ["sneakers", "boots", "sandals", "barefoot"];
const HEADS: HeadKind[] = ["none", "cap", "beanie", "hood"];

/**
 * Every key present and valid. Old saves and URL params arrive partial; the
 * game only ever reads a normalized appearance.
 */
export function normalizeAppearance(a: AppearanceInput | StoredAppearance | undefined): Appearance {
  const src = (a ?? {}) as AppearanceInput;
  const rawShirt = typeof src.shirt === "string" ? src.shirt : "default";
  const rawTrousers = typeof src.trousers === "string" ? src.trousers : "default";
  const rawShoes = typeof src.shoes === "string" ? src.shoes : "default";
  const hatGiven = typeof src.hat === "string";
  const rawHat = hatGiven ? (src.hat as string) : "navy";
  // legacy aliases resolve to a cut and a modern colour, once, here
  const legacyShirt = src.top === undefined ? LEGACY_SHIRT[rawShirt] : undefined;
  const legacyTrousers = src.bottom === undefined ? LEGACY_TROUSERS[rawTrousers] : undefined;
  const legacyShoes = src.feet === undefined ? LEGACY_SHOES[rawShoes] : undefined;
  const top = pick(src.top, TOPS, legacyShirt?.top ?? "tee");
  // "none" was how a save said "no cap" before `head` existed
  // a save with only a hat colour was wearing that cap; one with no hat key,
  // or the old "none", had nothing on
  let head = pick(src.head, HEADS, hatGiven && rawHat !== "none" ? "cap" : "none");
  if (!hoodAllowed(top) && head === "hood") head = "none";
  return {
    skin: colourId("skin", src.skin),
    hair: colourId("hair", src.hair),
    beard: colourId("beard", src.beard),
    hat: colourId("hat", rawHat),
    shirt: colourId("shirt", legacyShirt?.shirt ?? rawShirt),
    trousers: colourId("trousers", rawTrousers),
    shoes: colourId("shoes", rawShoes),
    head,
    top,
    bottom: pick(src.bottom, BOTTOMS, legacyTrousers?.bottom ?? "trousers"),
    feet: pick(src.feet, FEET, legacyShoes?.feet ?? "sneakers"),
    build: pick(src.build, BUILDS, "athletic"),
    height: pick(src.height, HEIGHTS, "average"),
    neck: pick(src.neck, NECKS, "normal"),
    posture: pick(src.posture, POSTURES, "upright"),
  };
}

/** Whether a hood can be up over this top — one rule, used by the wardrobe and the normaliser. */
export function hoodAllowed(top: TorsoKind): boolean {
  return Boolean(TORSO_GARMENTS[top].hood);
}

function findOption(slot: AppearanceSlot, id: string): SlotOption {
  return slot.options.find((o) => o.id === id) ?? slot.options[0];
}

export function slotFor(key: keyof Appearance): AppearanceSlot {
  return APPEARANCE_SLOTS.find((s) => s.key === key) ?? APPEARANCE_SLOTS[0];
}

/**
 * How much darker a shaved scalp sits than the cheek below it. One factor
 * rather than a second hand-picked hex per skin, so a skin added tomorrow
 * arrives with its scalp already correct.
 */
const SCALP_SHADE = 0.84;
/** A hood is the same cloth as the hoodie, catching a little more light. */
const HOOD_LIFT = 1.18;

const HEX_LENGTH = 7;

/** how much lighter the front of a trouser leg is than its fill */
const TROUSER_LIGHT = 1.22;
/** how much lighter the lit shoulder of a shirt is than its fill */
const SHIRT_LIGHT = 1.45;

function scale(hex: string, factor: number): string {
  if (hex.length !== HEX_LENGTH || hex[0] !== "#") return hex;
  const n = Number.parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return hex;
  const step = (c: number) => Math.max(0, Math.min(255, Math.round(c * factor)));
  const rgb = [step((n >> 16) & 0xff), step((n >> 8) & 0xff), step(n & 0xff)];
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Resolve an appearance into the live palette. */
export function paletteForAppearance(raw: StoredAppearance | AppearanceInput): SpritePalette {
  const a = normalizeAppearance(raw);
  const out: Record<string, string> = { ...PLAYER_PALETTE };
  for (const slot of APPEARANCE_SLOTS) {
    if (slot.group === "person" || slot.group === "colour") {
      Object.assign(out, findOption(slot, a[slot.key]).colors);
    }
  }
  // the texture tones follow whatever the cloth is: a step up from the fill
  // (see engine/character/texture.ts), so black trousers get a charcoal
  // highlight and a red tee a lighter red, never the default blue
  out.r = scale(out.p, TROUSER_LIGHT);
  out.d = scale(out.t, SHIRT_LIGHT);
  // the hood zone: a hood on a hoodie, plain shirt on anything else
  const top = TORSO_GARMENTS[a.top];
  if (top.hood) {
    out.m = scale(out.t, HOOD_LIFT);
    out.M = out.t;
  } else {
    out.m = out.t;
    out.M = out.T;
  }
  // a tracksuit's stripe is the shoe-white of the estate; a kurtka's belt is c
  out.a = "#e2ddd0";
  out.A = "#bdb8a8";
  // clean shave: the beard zone borrows whatever skin is wearing today
  if (a.beard === "none") {
    out.f = out.s;
    out.F = out.S;
  }
  // shaved: so does the scalp, or the head reads as a mask laid over the face
  if (a.hair === "shaved") {
    out.h = out.S;
    out.H = scale(out.S, SCALP_SHADE);
  }
  // no cap, no beanie: the cap zone renders as nothing
  if (a.head !== "cap" && a.head !== "beanie") {
    delete out.k;
    delete out.K;
  }
  return out;
}

const paletteCache = new WeakMap<StoredAppearance, SpritePalette>();

/**
 * Cached resolver: unrelated world updates keep the same appearance object,
 * so the palette keeps its identity and the player sprite sheet stays memoized.
 */
export function paletteForAppearanceCached(a: StoredAppearance): SpritePalette {
  let p = paletteCache.get(a);
  if (!p) {
    p = paletteForAppearance(a);
    paletteCache.set(a, p);
  }
  return p;
}

/** The engine spec — the shapes — for an appearance. */
export function specForAppearance(raw: StoredAppearance | AppearanceInput): CharacterSpec {
  const a = normalizeAppearance(raw);
  const body: BodySpec = { build: a.build, height: a.height, neck: a.neck, posture: a.posture };
  return { body, garments: { torso: a.top, bottom: a.bottom, feet: a.feet, head: a.head } };
}

/** The compiled player for an appearance — frames from the spec, palette from the colours. */
export function playerForAppearance(a: StoredAppearance | AppearanceInput): PlayerConfig {
  return compilePlayer(specForAppearance(a));
}

/** Cycle a slot's option id by delta, wrapping. */
export function cycleOption(slot: AppearanceSlot, currentId: string, delta: 1 | -1): string {
  const index = slot.options.findIndex((o) => o.id === currentId);
  // an id the rail does not know starts the rail over rather than skipping a stop
  if (index === -1) return slot.options[0].id;
  return slot.options[(index + delta + slot.options.length) % slot.options.length].id;
}

/**
 * The base and shade zone each colour slot speaks through, so a swatch can be
 * lit the way the sprite is lit rather than being one flat square.
 */
const SLOT_ZONES: Partial<Record<keyof Appearance, [string, string]>> = {
  skin: ["s", "S"],
  hair: ["h", "H"],
  beard: ["f", "F"],
  hat: ["k", "K"],
  shirt: ["t", "T"],
  trousers: ["p", "q"],
  shoes: ["b", "B"],
};

export interface Swatch {
  base: string;
  shade: string;
}

/**
 * The colours an option would actually paint, resolved against the rest of the
 * look — so the Shaved swatch shows today's scalp rather than a stored guess.
 * Null for a cut (no colour of its own) or for an option that paints nothing.
 */
export function swatchFor(
  slot: AppearanceSlot,
  optionId: string,
  raw: StoredAppearance,
): Swatch | null {
  const a = normalizeAppearance(raw);
  const zones = SLOT_ZONES[slot.key];
  if (!zones) return null;
  const palette = paletteForAppearance({
    ...a,
    [slot.key]: optionId,
    head: slot.key === "hat" ? "cap" : a.head,
  });
  const base = palette[zones[0]];
  if (!base) return null;
  return { base, shade: palette[zones[1]] ?? base };
}

/** The slots an outfit owns. The others are the man, not the clothes. */
export type Wear = Pick<
  Appearance,
  "head" | "hat" | "top" | "shirt" | "bottom" | "trousers" | "feet" | "shoes"
>;

export interface Outfit {
  id: string;
  label: string;
  wear: Wear;
  /** One line, the way he would describe it to himself. */
  note: string;
}

/**
 * Whole looks, one click each. A wardrobe has a few things in it that already
 * go together, and most mornings you take one of them off the rail and leave.
 * Nothing here touches skin, hair, beard or the body underneath.
 */
export const OUTFITS: Outfit[] = [
  {
    id: "everyday",
    label: "EVERYDAY",
    wear: {
      head: "none",
      hat: "navy",
      top: "tee",
      shirt: "default",
      bottom: "trousers",
      trousers: "default",
      feet: "sneakers",
      shoes: "default",
    },
    note: "Whatever was already on the chair.",
  },
  {
    id: "kiosk",
    label: "KIOSK RUN",
    wear: {
      head: "hood",
      hat: "navy",
      top: "hoodie",
      shirt: "grey",
      bottom: "joggers",
      trousers: "grey",
      feet: "sneakers",
      shoes: "red",
    },
    note: "Down for cigarettes, back in four minutes.",
  },
  {
    id: "training",
    label: "TRAINING",
    wear: {
      head: "none",
      hat: "navy",
      top: "kurtka",
      shirt: "red",
      bottom: "shorts",
      trousers: "sambo",
      feet: "sneakers",
      shoes: "sambovki",
    },
    note: "Red kurtka, mat burn on both knees.",
  },
  {
    id: "nightshift",
    label: "NIGHT SHIFT",
    wear: {
      head: "beanie",
      hat: "black",
      top: "jacket",
      shirt: "default",
      bottom: "trousers",
      trousers: "black",
      feet: "boots",
      shoes: "black",
    },
    note: "Nobody looks twice at this after eleven.",
  },
  {
    id: "sunday",
    label: "SUNDAY",
    wear: {
      head: "none",
      hat: "navy",
      top: "shirt",
      shirt: "white",
      bottom: "trousers",
      trousers: "khaki",
      feet: "sneakers",
      shoes: "default",
    },
    note: "Clean shirt, no plans, one coffee.",
  },
  {
    id: "yard",
    label: "THE YARD",
    wear: {
      head: "cap",
      hat: "red",
      top: "longsleeve",
      shirt: "olive",
      bottom: "tracksuit",
      trousers: "khaki",
      feet: "boots",
      shoes: "black",
    },
    note: "Warm enough for the bench by the bins.",
  },
];

/** Put an outfit on without disturbing the man wearing it. */
export function applyOutfit(a: StoredAppearance, outfit: Outfit): Appearance {
  return normalizeAppearance({ ...a, ...outfit.wear });
}

/**
 * Which outfit he is standing in, if any — the panel marks it. Headwear does
 * not count: putting a cap on does not mean you changed out of your clothes.
 */
export function activeOutfit(a: StoredAppearance): string | null {
  const n = normalizeAppearance(a);
  const match = OUTFITS.find(
    (o) =>
      o.wear.top === n.top &&
      o.wear.shirt === n.shirt &&
      o.wear.bottom === n.bottom &&
      o.wear.trousers === n.trousers &&
      o.wear.feet === n.feet &&
      o.wear.shoes === n.shoes,
  );
  return match ? match.id : null;
}

/**
 * How often a head turns up on this estate. Chestnut and black are most of
 * the block; silver is a lifetime away and should stay rare.
 */
const HAIR_ODDS: Record<string, number> = {
  default: 5,
  black: 4,
  copper: 2,
  blond: 2,
  ash: 2,
  shaved: 2,
  silver: 1,
};
const BEARD_ODDS: Record<string, number> = { default: 5, none: 3, full: 2, grey: 1 };
const BUILD_ODDS: Record<string, number> = {
  slight: 1,
  lean: 3,
  athletic: 4,
  heavy: 2,
  powerlifter: 1,
};
const HEIGHT_ODDS: Record<string, number> = { short: 2, average: 4, tall: 3, towering: 1 };

/** A cap is a decision taken at the door, not part of the outfit on the rail. */
const HAT_KEPT_ODDS = 0.6;

function weightedPick(slot: AppearanceSlot, odds: Record<string, number>): string {
  let total = 0;
  for (const o of slot.options) total += odds[o.id] ?? 1;
  let roll = Math.random() * total;
  for (const o of slot.options) {
    roll -= odds[o.id] ?? 1;
    if (roll <= 0) return o.id;
  }
  return slot.options[0].id;
}

function evenPick(slot: AppearanceSlot): string {
  return slot.options[Math.floor(Math.random() * slot.options.length)].id;
}

/**
 * A roll that comes back dressed. Picking every slot independently is what
 * makes a clown, so the garments come from one outfit and only the man
 * underneath is rolled, weighted so the rare heads and bodies stay rare.
 */
export function rollAppearance(): Appearance {
  const outfit = OUTFITS[Math.floor(Math.random() * OUTFITS.length)];
  const keepHat = Math.random() < HAT_KEPT_ODDS;
  return normalizeAppearance({
    skin: evenPick(slotFor("skin")),
    hair: weightedPick(slotFor("hair"), HAIR_ODDS),
    beard: weightedPick(slotFor("beard"), BEARD_ODDS),
    build: weightedPick(slotFor("build"), BUILD_ODDS),
    height: weightedPick(slotFor("height"), HEIGHT_ODDS),
    neck: evenPick(slotFor("neck")),
    posture: "upright",
    ...outfit.wear,
    head: keepHat ? outfit.wear.head : "none",
  });
}
