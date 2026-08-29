import { ambience, lofiPlayer, setPrefs, setSfxLevel } from "@/engine";
import { setLanguage } from "@/i18n";

/**
 * Player settings — persisted, and only the ones the game can actually honour.
 *
 * The rule is that nothing appears here unless something obeys it. That was the
 * intention the first time too, and three of the rows failed it anyway: QUALITY,
 * MOTION and TEXT SPEED each wrote a value that no code read. They are honest
 * now because the engine grew somewhere to put them — `engine/core/prefs.ts`,
 * which the governor, the reduced-motion hook and the speech panels all read
 * from. `applySettings` is the one place that pushes this file's values into
 * that store and into the mixer.
 *
 * Still absent, because the engine genuinely has no such thing: resolution,
 * texture quality, key rebinding, difficulty.
 */

export type Settings = {
  /** everything, after the three channels */
  master: number;
  music: number;
  ambience: number;
  sfx: number;
  /** the syllable mumble under dialogue lines */
  voice: boolean;
  /** cap the adaptive governor: "auto" lets it choose, the rest pin a tier */
  quality: "auto" | "low" | "medium" | "high";
  /** honour the OS setting, or force still regardless of it */
  reducedMotion: "system" | "reduce";
  /** the typewriter speed in the dialogue and monologue panels */
  textSpeed: "slow" | "normal" | "fast" | "instant";
  fullscreen: boolean;
  /** the interface language; English until somebody says otherwise */
  language: "en" | "uk" | "pl";
};

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.5,
  ambience: 0.6,
  sfx: 0.8,
  voice: true,
  quality: "auto",
  reducedMotion: "system",
  textSpeed: "normal",
  fullscreen: false,
  language: "en",
};

const KEY = "osiedle.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    // spread over the defaults so a settings file written by an older build
    // gains new keys rather than arriving with holes in it
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // private mode: the session still honours them, they just do not persist
  }
}

/**
 * Push settings at the systems that own them. Called on load and on every
 * change, so the menu never has to know how any of them work.
 *
 * Fullscreen is not here. It can only be entered from inside a user gesture, so
 * it is requested at the point the row is toggled and reconciled from the
 * browser's own `fullscreenchange` event — calling it from here would throw on
 * every load.
 */
export function applySettings(s: Settings): void {
  setLanguage(s.language);
  lofiPlayer.setMasterVolume(s.master);
  lofiPlayer.setVolume(s.music);
  ambience.setLevel(s.ambience);
  setSfxLevel(s.sfx);
  setPrefs({
    voice: s.voice,
    quality: s.quality,
    motion: s.reducedMotion,
    textSpeed: s.textSpeed,
  });
  if (typeof document !== "undefined") {
    // index.css has a reduced-motion block; give it the override too
    document.documentElement.dataset.reducedMotion = s.reducedMotion;
  }
}
