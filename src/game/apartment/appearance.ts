import { PLAYER_PALETTE } from "@/components/game/sprites";
import type { SpritePalette } from "@/engine";
import type { WorldState } from "@/lib/worldState";

/**
 * Appearance — the paper-doll layers of the player, expressed as palette
 * zones over the shared body frames:
 *   head   → hair (h/H) + skin (s/S/y) + eyes (e)
 *   torso  → shirt (t/T); the bare forearms stay skin
 *   legs   → trousers (p/q)
 *   feet   → shoes (b/B)
 * Every option ships its own shade pair so volume survives the recolor.
 * The wardrobe writes option ids into world.appearance; paletteFor()
 * resolves them into a live palette for the runtime.
 *
 * Two slots are *derived* rather than authored, because their colour is a
 * property of the body underneath and not a choice: a clean shave paints the
 * beard zone in skin, and a shaved head paints the scalp in skin. Anything
 * that borrows from a neighbouring zone has to be resolved here, against the
 * look as a whole — an option that hardcodes a hex is an option that only
 * looks right on one body.
 */

export type SlotGroup = "person" | "wear";

export interface SlotOption {
  id: string;
  label: string;
  colors: SpritePalette;
}

export interface AppearanceSlot {
  key: keyof WorldState["appearance"];
  label: string;
  /** Who he is, or what he put on this morning — the wardrobe reads as two lists. */
  group: SlotGroup;
  options: SlotOption[];
}

export const APPEARANCE_GROUPS: { id: SlotGroup; label: string }[] = [
  { id: "person", label: "WHO HE IS" },
  { id: "wear", label: "WHAT HE WEARS" },
];

export const APPEARANCE_SLOTS: AppearanceSlot[] = [
  {
    key: "skin",
    label: "SKIN",
    group: "person",
    options: [
      {
        id: "default",
        label: "Warm",
        colors: { s: "#e0b48c", S: "#c79a72", y: "#ead9a8" },
      },
      { id: "tan", label: "Tan", colors: { s: "#c99668", S: "#a87a4e", y: "#dbb488" } },
      { id: "pale", label: "Pale", colors: { s: "#ecc9a8", S: "#d2ad8a", y: "#f5e4c4" } },
      { id: "deep", label: "Deep", colors: { s: "#9a6a44", S: "#7c5232", y: "#b88a5e" } },
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
      { id: "none", label: "Clean shave", colors: {} },
    ],
  },
  {
    key: "hat",
    label: "HAT",
    group: "wear",
    options: [
      { id: "none", label: "No hat", colors: { k: "", K: "" } },
      { id: "navy", label: "Navy cap", colors: { k: "#2e4568", K: "#23344d" } },
      { id: "black", label: "Black cap", colors: { k: "#26262c", K: "#17171b" } },
      { id: "red", label: "Red cap", colors: { k: "#a33a30", K: "#7d2820" } },
    ],
  },
  {
    key: "shirt",
    label: "TORSO",
    group: "wear",
    options: [
      {
        id: "default",
        label: "Black tee",
        colors: { t: "#1d1d24", T: "#0a0a0e", m: "#1d1d24", M: "#0a0a0e" },
      },
      {
        id: "olive",
        label: "Olive tee",
        colors: { t: "#5f7053", T: "#48563e", m: "#5f7053", M: "#48563e" },
      },
      {
        id: "maroon",
        label: "Maroon tee",
        colors: { t: "#7c3040", T: "#5d2430", m: "#7c3040", M: "#5d2430" },
      },
      {
        id: "navy",
        label: "Navy tee",
        colors: { t: "#2e4568", T: "#23344d", m: "#2e4568", M: "#23344d" },
      },
      {
        id: "white",
        label: "White tee",
        colors: { t: "#e2ddd0", T: "#bdb8a8", m: "#e2ddd0", M: "#bdb8a8" },
      },
      {
        id: "hoodie-grey",
        label: "Grey hoodie",
        colors: { t: "#6d7278", T: "#565a60", m: "#7d828a", M: "#5d6266" },
      },
      {
        id: "hoodie-black",
        label: "Black hoodie",
        colors: { t: "#26262c", T: "#17171b", m: "#33363a", M: "#232529" },
      },
      {
        id: "sambo",
        label: "Sambo kurtka",
        colors: { t: "#a33a30", T: "#7d2820", m: "#a33a30", M: "#7d2820" },
      },
    ],
  },
  {
    key: "trousers",
    label: "LEGS",
    group: "wear",
    options: [
      { id: "default", label: "Navy", colors: { p: "#33415e", q: "#28344c", Q: "#1e2839" } },
      { id: "black", label: "Black", colors: { p: "#26262c", q: "#1a1a1f", Q: "#121216" } },
      { id: "khaki", label: "Khaki", colors: { p: "#7a6f52", q: "#615840", Q: "#4d4632" } },
      { id: "grey", label: "Grey joggers", colors: { p: "#6d7278", q: "#565a60", Q: "#43464c" } },
      { id: "sambo", label: "Sambo shorts", colors: { p: "#a33a30", q: "#7d2820", Q: "#601c16" } },
    ],
  },
  {
    key: "shoes",
    label: "FEET",
    group: "wear",
    options: [
      { id: "default", label: "White sneakers", colors: { b: "#d8d8d0", B: "#8f9089" } },
      { id: "black", label: "Black boots", colors: { b: "#2e3033", B: "#1d1f22" } },
      { id: "red", label: "Red runners", colors: { b: "#c94040", B: "#8f2f2f" } },
      { id: "sambovki", label: "Sambovki", colors: { b: "#3a5a8c", B: "#2a4268" } },
    ],
  },
];

function findOption(slot: AppearanceSlot, id: string): SlotOption {
  return slot.options.find((o) => o.id === id) ?? slot.options[0];
}

function slotFor(key: keyof WorldState["appearance"]): AppearanceSlot {
  return APPEARANCE_SLOTS.find((s) => s.key === key) ?? APPEARANCE_SLOTS[0];
}

/**
 * How much darker a shaved scalp sits than the cheek below it. One factor
 * rather than a second hand-picked hex per skin, so a skin added tomorrow
 * arrives with its scalp already correct. On the default skin it lands within
 * four units of the tone that used to be typed in by hand.
 */
const SCALP_SHADE = 0.84;

const HEX_LENGTH = 7;

function darken(hex: string, factor: number): string {
  if (hex.length !== HEX_LENGTH || hex[0] !== "#") return hex;
  const n = Number.parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return hex;
  const step = (c: number) => Math.max(0, Math.min(255, Math.round(c * factor)));
  const rgb = [step((n >> 16) & 0xff), step((n >> 8) & 0xff), step(n & 0xff)];
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Resolve the world's appearance ids into a full live palette. */
export function paletteForAppearance(a: WorldState["appearance"]): SpritePalette {
  const out: Record<string, string> = { ...PLAYER_PALETTE };
  for (const slot of APPEARANCE_SLOTS) {
    Object.assign(out, findOption(slot, a[slot.key]).colors);
  }
  // clean shave: the beard zone borrows whatever skin is wearing today
  if (a.beard === "none") {
    out.f = out.s;
    out.F = out.S;
  }
  // shaved: so does the scalp, or the head reads as a mask laid over the face
  if (a.hair === "shaved") {
    out.h = out.S;
    out.H = darken(out.S, SCALP_SHADE);
  }
  // "" means the garment isn't worn — delete the zone so it renders as nothing
  for (const key of Object.keys(out)) {
    if (out[key] === "") delete out[key];
  }
  return out;
}

const paletteCache = new WeakMap<WorldState["appearance"], SpritePalette>();

/**
 * Cached resolver: unrelated world updates keep the same appearance object,
 * so the palette keeps its identity and the player sprite sheet stays memoized.
 */
export function paletteForAppearanceCached(a: WorldState["appearance"]): SpritePalette {
  let p = paletteCache.get(a);
  if (!p) {
    p = paletteForAppearance(a);
    paletteCache.set(a, p);
  }
  return p;
}

/** Cycle a slot's option id by delta, wrapping. */
export function cycleOption(slot: AppearanceSlot, currentId: string, delta: 1 | -1): string {
  const index = slot.options.findIndex((o) => o.id === currentId);
  const at = index === -1 ? 0 : index;
  return slot.options[(at + delta + slot.options.length) % slot.options.length].id;
}

/**
 * The base and shade zone each slot speaks through, so a swatch can be lit the
 * way the sprite is lit rather than being one flat square.
 */
const SLOT_ZONES: Record<keyof WorldState["appearance"], [string, string]> = {
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
 * look — so the Shaved swatch shows today's scalp rather than a stored guess,
 * and Clean shave shows today's jaw. Null when the option means "not worn"
 * and there is nothing to show.
 */
export function swatchFor(
  slot: AppearanceSlot,
  optionId: string,
  a: WorldState["appearance"],
): Swatch | null {
  const palette = paletteForAppearance({ ...a, [slot.key]: optionId });
  const [baseKey, shadeKey] = SLOT_ZONES[slot.key];
  const base = palette[baseKey];
  if (!base) return null;
  return { base, shade: palette[shadeKey] ?? base };
}

/** The four slots an outfit owns. The other three are the man, not the clothes. */
export type Wear = Pick<WorldState["appearance"], "hat" | "shirt" | "trousers" | "shoes">;

export interface Outfit {
  id: string;
  label: string;
  wear: Wear;
  /** One line, the way he would describe it to himself. */
  note: string;
}

/**
 * Whole looks, one click each. Seven rails is a paint program; a wardrobe has
 * a few things in it that already go together, and most mornings you take one
 * of them off the rail and leave. Nothing here touches skin, hair or beard —
 * those are the man underneath, and an outfit has no opinion about him.
 */
export const OUTFITS: Outfit[] = [
  {
    id: "everyday",
    label: "EVERYDAY",
    wear: { hat: "none", shirt: "default", trousers: "default", shoes: "default" },
    note: "Whatever was already on the chair.",
  },
  {
    id: "kiosk",
    label: "KIOSK RUN",
    wear: { hat: "navy", shirt: "hoodie-grey", trousers: "grey", shoes: "red" },
    note: "Down for cigarettes, back in four minutes.",
  },
  {
    id: "training",
    label: "TRAINING",
    wear: { hat: "none", shirt: "sambo", trousers: "sambo", shoes: "sambovki" },
    note: "Red kurtka, mat burn on both knees.",
  },
  {
    id: "nightshift",
    label: "NIGHT SHIFT",
    wear: { hat: "black", shirt: "hoodie-black", trousers: "black", shoes: "black" },
    note: "Nobody looks twice at this after eleven.",
  },
  {
    id: "sunday",
    label: "SUNDAY",
    wear: { hat: "none", shirt: "white", trousers: "khaki", shoes: "default" },
    note: "Clean shirt, no plans, one coffee.",
  },
  {
    id: "yard",
    label: "THE YARD",
    wear: { hat: "red", shirt: "olive", trousers: "khaki", shoes: "black" },
    note: "Warm enough for the bench by the bins.",
  },
];

/** Put an outfit on without disturbing the man wearing it. */
export function applyOutfit(a: WorldState["appearance"], outfit: Outfit): WorldState["appearance"] {
  return { ...a, ...outfit.wear };
}

/**
 * Which outfit he is standing in, if any — the panel marks it. The hat does
 * not count: putting a cap on does not mean you changed out of your clothes,
 * and no two outfits here differ only by one.
 */
export function activeOutfit(a: WorldState["appearance"]): string | null {
  const match = OUTFITS.find(
    (o) => o.wear.shirt === a.shirt && o.wear.trousers === a.trousers && o.wear.shoes === a.shoes,
  );
  return match ? match.id : null;
}

/**
 * How often a head turns up on this estate. Chestnut and black are most of
 * the block; silver is a lifetime away and should stay rare, or every third
 * roll comes back sixty years old.
 */
const HAIR_ODDS: Record<string, number> = {
  default: 5,
  black: 4,
  copper: 2,
  blond: 2,
  shaved: 2,
  silver: 1,
};
const BEARD_ODDS: Record<string, number> = { default: 5, none: 3, full: 2 };

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
 * A roll that comes back dressed. Picking all seven slots independently is
 * what makes a clown — a red cap over silver hair, maroon on top and sambo
 * shorts below. Clothes in a wardrobe were bought together, so the garments
 * come from one outfit and only the man underneath is rolled, weighted so the
 * rare heads stay rare.
 */
export function rollAppearance(): WorldState["appearance"] {
  const outfit = OUTFITS[Math.floor(Math.random() * OUTFITS.length)];
  return {
    skin: evenPick(slotFor("skin")),
    hair: weightedPick(slotFor("hair"), HAIR_ODDS),
    beard: weightedPick(slotFor("beard"), BEARD_ODDS),
    ...outfit.wear,
    hat: Math.random() < HAT_KEPT_ODDS ? outfit.wear.hat : "none",
  };
}
