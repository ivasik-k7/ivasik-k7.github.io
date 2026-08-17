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
 */

export interface SlotOption {
  id: string;
  label: string;
  colors: SpritePalette;
}

export interface AppearanceSlot {
  key: keyof WorldState["appearance"];
  label: string;
  options: SlotOption[];
}

export const APPEARANCE_SLOTS: AppearanceSlot[] = [
  {
    key: "hair",
    label: "HAIR",
    options: [
      { id: "default", label: "Chestnut", colors: { h: "#3a2a1e", H: "#2b1e15" } },
      { id: "black", label: "Black", colors: { h: "#1d1a17", H: "#100e0c" } },
      { id: "blond", label: "Blond", colors: { h: "#b89a5e", H: "#96793f" } },
      { id: "copper", label: "Copper", colors: { h: "#9a5230", H: "#7a3d20" } },
      { id: "silver", label: "Silver", colors: { h: "#a8a8a4", H: "#84847e" } },
      { id: "shaved", label: "Shaved", colors: { h: "#c79a72", H: "#a8815c" } },
    ],
  },
  {
    key: "skin",
    label: "SKIN",
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
    key: "beard",
    label: "BEARD",
    options: [
      { id: "default", label: "Stubble", colors: { f: "#7a5c48", F: "#5f4636" } },
      { id: "full", label: "Full beard", colors: { f: "#4a3626", F: "#37281c" } },
      { id: "none", label: "Clean shave", colors: {} },
    ],
  },
  {
    key: "hat",
    label: "HAT",
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
