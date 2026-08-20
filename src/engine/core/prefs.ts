import type { QualityTier } from "./runtime-types";

/**
 * Player preferences that the engine itself has to honour.
 *
 * This exists because a settings screen can only be as honest as the systems
 * underneath it. Three of the rows on the first version of that screen wrote a
 * value to localStorage, set an attribute on `<html>`, and were read by nothing
 * at all: MOTION did not reach the idle bob or the typewriter, TEXT SPEED did
 * not reach the speech panels, and QUALITY did not reach the governor that
 * decides what to draw. The screen's own comment said that shipping controls
 * which do nothing "would be the clearest possible signal that the menu is a
 * mock-up", which was right, and then it did exactly that.
 *
 * So the preferences live here, in the engine, next to the code that obeys
 * them. The menu is one writer. Everything that cares subscribes.
 *
 * Deliberately not React state and not context: the consumers are a rAF loop,
 * a quality governor, a handful of hooks and a couple of plain functions, and
 * three of those are not components. A tiny store with `useSyncExternalStore`
 * semantics reaches all of them.
 */

export type QualityPref = "auto" | QualityTier;
export type MotionPref = "system" | "reduce";
export type TextSpeedPref = "slow" | "normal" | "fast" | "instant";

export interface EnginePrefs {
  /** the syllable mumble under dialogue lines — some players find it grating */
  voice: boolean;
  /** "auto" leaves the governor alone; anything else pins the tier */
  quality: QualityPref;
  /** "system" follows the OS; "reduce" forces stillness regardless */
  motion: MotionPref;
  textSpeed: TextSpeedPref;
}

export const DEFAULT_PREFS: EnginePrefs = {
  voice: true,
  quality: "auto",
  motion: "system",
  textSpeed: "normal",
};

/** Milliseconds per character in the speech panels. 0 means no typing at all. */
export const TEXT_MS: Record<TextSpeedPref, number> = {
  slow: 34,
  normal: 18,
  fast: 9,
  instant: 0,
};

let prefs: EnginePrefs = { ...DEFAULT_PREFS };
const listeners = new Set<() => void>();

/** A value that changes identity only when something actually changed. */
export function getPrefs(): EnginePrefs {
  return prefs;
}

export function setPrefs(next: Partial<EnginePrefs>): void {
  const merged = { ...prefs, ...next };
  if (
    merged.quality === prefs.quality &&
    merged.motion === prefs.motion &&
    merged.textSpeed === prefs.textSpeed &&
    merged.voice === prefs.voice
  ) {
    return;
  }
  prefs = merged;
  for (const fn of listeners) fn();
}

export function subscribePrefs(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** How fast text types, in ms per character. */
export function textCharMs(): number {
  return TEXT_MS[prefs.textSpeed];
}

/**
 * The tier the governor is allowed to settle on, or null for "decide yourself".
 * A pin is a ceiling *and* a floor: a player who chooses LOW is asking for the
 * cheap version even on a fast machine, usually because of a battery.
 */
export function qualityPin(): QualityTier | null {
  return prefs.quality === "auto" ? null : prefs.quality;
}

export function motionPref(): MotionPref {
  return prefs.motion;
}

export function voiceEnabled(): boolean {
  return prefs.voice;
}
