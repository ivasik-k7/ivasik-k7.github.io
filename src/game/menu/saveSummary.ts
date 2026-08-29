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
  /** where you were, and when you stopped — the line shown under CONTINUE */
  line: string;
  /**
   * A second, quieter line: what you had on you and what you had been doing.
   *
   * This is the whole of the save-slot presentation. There is one slot, so a
   * grid of cards with thumbnails would be a grid of one; what actually helps
   * is being reminded which afternoon this was, and the two numbers that say
   * so are the money in your pocket and how many times you have stopped to
   * pet the dog.
   */
  detail?: string;
};

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
  station: "the platform",
  train: "the SKM",
  elektrykow: "Ulica Elektryków",
  raveclub: "Turbina",
  forum: "Targ Sienny",
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

/** "34 zł" and "Gross petted 6 times", when there is anything to say. */
function detailFor(world: WorldState | undefined): string | undefined {
  if (!world) return undefined;
  const bits: string[] = [];
  if (typeof world.money === "number") bits.push(`${Math.round(world.money)} zł`);
  const items = Array.isArray(world.inventory)
    ? world.inventory.reduce((n, it) => n + (it.quantity ?? 0), 0)
    : 0;
  if (items > 0) bits.push(items === 1 ? "one thing in your bag" : `${items} things in your bag`);
  const pets = world.dogPets ?? 0;
  if (pets > 0) bits.push(pets === 1 ? "Gross petted once" : `Gross petted ${pets} times`);
  return bits.length ? bits.join(" · ") : undefined;
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
    detail: detailFor(slot.world),
  };
}
