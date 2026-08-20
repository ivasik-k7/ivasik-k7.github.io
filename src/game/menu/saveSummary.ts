import { loadGame } from "@/engine";
import type { WorldState } from "@/lib/worldState";

/**
 * What the title screen knows about the save.
 *
 * The engine's save slot already carries everything worth showing — where the
 * player was standing and when they stopped — so Continue does not need a
 * parallel store, only a reader that turns a slot into one line of prose.
 */

export const SAVE_KEY = "osiedle.save.v1";
export const SAVE_VERSION = 1;

export type SaveSummary = {
  scene: string;
  x: number;
  savedAt: string;
  /** the line shown under CONTINUE */
  line: string;
};

/** The names the game uses out loud, not the scene ids. */
/**
 * Scene ids as a person would say them. Exported because the pause menu names
 * the room you are standing in and the title screen names the room you left,
 * and two lists would drift apart within a week.
 */
export const PLACE_NAME: Record<string, string> = {
  studio: "the flat",
  study: "the study",
  bath: "the bathroom",
  balcony: "the balcony",
  corridor: "the landing",
  elevator: "the lift",
  outside: "the yard",
  zabka: "Żabka",
  parking: "parking −1",
  gym: "the gym",
  district: "the osiedle",
};

function ago(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "a moment ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function readSave(): SaveSummary | null {
  const slot = loadGame<WorldState>(SAVE_KEY, SAVE_VERSION);
  if (!slot) return null;
  const place = PLACE_NAME[slot.scene] ?? slot.scene;
  const when = ago(slot.savedAt);
  return {
    scene: slot.scene,
    x: slot.x,
    savedAt: slot.savedAt,
    line: when ? `${place} · ${when}` : place,
  };
}
