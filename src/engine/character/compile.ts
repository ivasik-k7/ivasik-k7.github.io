import type { PlayerConfig, SpriteMap } from "../core/types";
import { replaceColor } from "../sprite/characterBuilder";
import { type CharacterSpec, specKey } from "./spec";

/**
 * compile.ts — spec in, PlayerConfig out, once per distinct spec.
 *
 * The game supplies the *recipe* — which parts, which poses, which actions —
 * because those are the character. The engine supplies what every recipe
 * needs and none should write twice: a cache keyed on the spec so a wardrobe
 * change costs one build and a walk past the mirror costs nothing, and the
 * face layer.
 *
 * The face layer is the one piece of the plan's "layers" that can be added
 * without touching how frames are authored: for every frame that has an eye
 * in it, a twin with the eye closed. The runtime picks the twin whenever the
 * face brain says the lids are down, whatever the body is doing — so he
 * blinks mid-stride, mid-sentence and mid-swing, instead of only while
 * standing at attention, which is the single cheapest thing that makes a
 * sprite read as awake.
 */

export const BLINK_SUFFIX = "~blink";

/**
 * The moods a face can hold, each a twin of every frame with an eye in it,
 * drawn by moving two or three cells around the eye. See `moodTwin` for what
 * each one does to the face; `faceBrain` decides which one is on.
 */
export const MOODS = ["smile", "sad", "tense", "surprise"] as const;
export type Mood = (typeof MOODS)[number];

export type Recipe = (spec: CharacterSpec) => PlayerConfig;

export interface CompileOptions {
  /** add the eyes-closed twin for every frame with an eye (default true) */
  blink?: boolean;
  /** the eye zone and what it closes to */
  eye?: readonly [open: string, closed: string];
  /** add the mood twins (default true) */
  moods?: boolean;
}

function hasZone(map: SpriteMap, zone: string): boolean {
  return map.some((row) => row.includes(zone));
}

/** The eyes-closed twin's name for a frame, or the frame itself if it has none. */
export function blinkFrame(cfg: Pick<PlayerConfig, "derived" | "frames">, frame: string): string {
  const twin = cfg.derived?.[frame]?.blink;
  return twin && cfg.frames[twin] ? twin : frame;
}

/** True for a frame the compiler derived rather than the recipe authored. */
export function isDerivedFrame(cfg: Pick<PlayerConfig, "derived">, name: string): boolean {
  const d = cfg.derived;
  if (!d) return false;
  for (const k in d) {
    const e = d[k];
    if (e.blink === name) return true;
    if (e.moods) for (const m in e.moods) if (e.moods[m] === name) return true;
  }
  return false;
}

/**
 * The face layer: for every authored frame with an eye, a twin with the eye
 * closed, recorded in `derived` so nothing downstream has to parse a name.
 * A twin that would equal an authored frame (the recipe drew its own blink)
 * points at that frame instead of duplicating it.
 */
export function addFaceLayer(
  cfg: PlayerConfig,
  eye: readonly [string, string] = ["e", "s"],
): PlayerConfig {
  const frames: Record<string, SpriteMap> = { ...cfg.frames };
  const derived: Record<string, { blink?: string }> = { ...(cfg.derived ?? {}) };
  const byPixels = new Map<string, string>();
  for (const [name, map] of Object.entries(cfg.frames)) byPixels.set(map.join("\n"), name);
  for (const [name, map] of Object.entries(cfg.frames)) {
    if (derived[name]?.blink) continue;
    if (!hasZone(map, eye[0])) continue;
    const closed = replaceColor(map, eye[0], eye[1]);
    const existing = byPixels.get(closed.join("\n"));
    if (existing) {
      derived[name] = { ...derived[name], blink: existing };
      continue;
    }
    const twin = name + BLINK_SUFFIX;
    frames[twin] = closed;
    byPixels.set(closed.join("\n"), twin);
    derived[name] = { ...derived[name], blink: twin };
  }
  return { ...cfg, frames, derived };
}

/** Where the eye is, and which way the face points (+1: nose to the right). */
function findEye(map: SpriteMap, eye: string): { x: number; y: number; d: 1 | -1 } | null {
  for (let y = 0; y < map.length; y++) {
    const x = map[y].indexOf(eye);
    if (x < 0) continue;
    // the nose side has skin next to the eye and then air; the back of the
    // head has hair or more skin
    const skin = (ch: string | undefined) => ch === "s" || ch === "S" || ch === "y";
    const right = skin(map[y][x + 1]) && !skin(map[y][x + 2]) && map[y][x + 2] !== "e";
    return { x, y, d: right ? 1 : -1 };
  }
  return null;
}

const put = (rows: string[], x: number, y: number, ch: string, onlyOver?: RegExp): boolean => {
  const row = rows[y];
  if (!row || x < 0 || x >= row.length) return false;
  if (onlyOver && !onlyOver.test(row[x])) return false;
  rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
  return true;
};

const SKIN = /[sSy]/;

/**
 * A frame's face in a mood. The face is seven rows and the mouth is not
 * drawn, so a mood is two or three cells placed relative to the eye:
 *
 *  smile    — the corner of the mouth (behind the eye, a row down) goes dark,
 *             and the cheek in front of it catches the light;
 *  sad      — the corner drops a row, and there is shade under the nose;
 *  tense    — the brow comes down over the back of the eye, the mouth tight;
 *  surprise — the eye opens a row taller, and the mouth opens under it.
 *
 * Cells are only written over skin, so a bowed head under a hood or a face
 * turned away keeps whatever it had. Returns null when the frame has no face
 * or nothing could be placed.
 */
export function moodTwin(map: SpriteMap, mood: Mood, eye = "e"): string[] | null {
  const at = findEye(map, eye);
  if (!at) return null;
  const rows = [...map];
  const { x, y, d } = at;
  let n = 0;
  switch (mood) {
    case "smile":
      if (put(rows, x, y + 1, "F", SKIN)) n++;
      if (put(rows, x - d, y + 1, "y", SKIN)) n++;
      break;
    case "sad":
      if (put(rows, x, y + 2, "F", SKIN)) n++;
      if (put(rows, x + d, y + 1, "S", SKIN)) n++;
      break;
    case "tense":
      if (put(rows, x - d, y, "H", SKIN)) n++;
      if (put(rows, x, y + 1, "S", SKIN)) n++;
      break;
    case "surprise":
      if (put(rows, x, y + 1, eye, SKIN)) n++;
      if (put(rows, x, y + 2, "F", SKIN)) n++;
      break;
  }
  return n > 0 ? rows : null;
}

/**
 * The mood layer: for every authored frame with an eye, a twin per mood,
 * recorded in `derived[frame].moods`. Run before the face (blink) layer, so
 * every mood twin gets its own eyes-closed twin too.
 */
export function addMoodLayer(cfg: PlayerConfig, eye = "e"): PlayerConfig {
  const frames: Record<string, SpriteMap> = { ...cfg.frames };
  const derived: Record<string, { blink?: string; moods?: Record<string, string> }> = {
    ...(cfg.derived ?? {}),
  };
  for (const [name, map] of Object.entries(cfg.frames)) {
    if (isDerivedFrame(cfg, name)) continue;
    if (!hasZone(map, eye)) continue;
    for (const mood of MOODS) {
      const twin = moodTwin(map, mood, eye);
      if (!twin) continue;
      const tname = `${name}~${mood}`;
      frames[tname] = twin;
      const entry = derived[name] ?? {};
      entry.moods = { ...(entry.moods ?? {}), [mood]: tname };
      derived[name] = entry;
    }
  }
  return { ...cfg, frames, derived };
}

/** The frame in a mood, or the frame itself when it has no face to hold one. */
export function moodFrame(
  cfg: Pick<PlayerConfig, "derived" | "frames">,
  frame: string,
  mood: Mood | null,
): string {
  if (!mood) return frame;
  const twin = cfg.derived?.[frame]?.moods?.[mood];
  return twin && cfg.frames[twin] ? twin : frame;
}

/** How many compiled looks one recipe keeps; a wardrobe session cycles through dozens. */
const CACHE_PER_RECIPE = 24;

let caches = new WeakMap<Recipe, Map<string, PlayerConfig>>();

/**
 * Build (or fetch) the PlayerConfig for a spec. Cached per recipe (two
 * recipes given the same spec are two different characters), keyed on the
 * spec and the face options, evicting least-recently-used entries so a long
 * session in the wardrobe cannot grow memory without bound.
 */
export function compileCharacter(
  spec: CharacterSpec,
  recipe: Recipe,
  opts: CompileOptions = {},
): PlayerConfig {
  let cache = caches.get(recipe);
  if (!cache) {
    cache = new Map();
    caches.set(recipe, cache);
  }
  const eye = opts.eye ?? ["e", "s"];
  const key = `${specKey(spec)}#${opts.blink === false ? "" : `${eye[0]}${eye[1]}`}`;
  const hit = cache.get(key);
  if (hit) {
    // refresh recency
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  let cfg = recipe(spec);
  if (opts.moods !== false) cfg = addMoodLayer(cfg, eye[0]);
  if (opts.blink !== false) cfg = addFaceLayer(cfg, eye);
  cache.set(key, cfg);
  if (cache.size > CACHE_PER_RECIPE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return cfg;
}

/** Drop every compiled character for a recipe (tests, hot reload). */
export function clearCharacterCache(recipe?: Recipe): void {
  if (recipe) caches.delete(recipe);
  else caches = new WeakMap();
}

/** How many looks a recipe currently holds — for the bench. */
export function characterCacheSize(recipe: Recipe): number {
  return caches.get(recipe)?.size ?? 0;
}
