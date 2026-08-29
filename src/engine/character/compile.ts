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

export type Recipe = (spec: CharacterSpec) => PlayerConfig;

export interface CompileOptions {
  /** add the eyes-closed twin for every frame with an eye (default true) */
  blink?: boolean;
  /** the eye zone and what it closes to */
  eye?: readonly [open: string, closed: string];
}

function hasZone(map: SpriteMap, zone: string): boolean {
  return map.some((row) => row.includes(zone));
}

/** The eyes-closed twin's name for a frame, or the frame itself if it has none. */
export function blinkFrame(frames: Record<string, SpriteMap>, frame: string): string {
  const twin = frame + BLINK_SUFFIX;
  return frames[twin] ? twin : frame;
}

/** True for a frame the compiler derived rather than the recipe authored. */
export function isDerivedFrame(name: string): boolean {
  return name.endsWith(BLINK_SUFFIX);
}

export function addFaceLayer(
  cfg: PlayerConfig,
  eye: readonly [string, string] = ["e", "s"],
): PlayerConfig {
  const frames: Record<string, SpriteMap> = { ...cfg.frames };
  for (const [name, map] of Object.entries(cfg.frames)) {
    if (isDerivedFrame(name)) continue;
    if (!hasZone(map, eye[0])) continue;
    const twin = name + BLINK_SUFFIX;
    if (frames[twin]) continue;
    frames[twin] = replaceColor(map, eye[0], eye[1]);
  }
  return { ...cfg, frames };
}

const cache = new Map<string, PlayerConfig>();

/** Build (or fetch) the PlayerConfig for a spec. */
export function compileCharacter(
  spec: CharacterSpec,
  recipe: Recipe,
  opts: CompileOptions = {},
): PlayerConfig {
  const key = `${specKey(spec)}#${opts.blink === false ? "" : "b"}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let cfg = recipe(spec);
  if (opts.blink !== false) cfg = addFaceLayer(cfg, opts.eye);
  cache.set(key, cfg);
  return cfg;
}

/** Drop every compiled character (tests, hot reload). */
export function clearCharacterCache(): void {
  cache.clear();
}
