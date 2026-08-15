import type { ActionId } from "@/components/game/sprites";

export type RoomId = "hallway" | "kitchen" | "living" | "study" | "bath" | "balcony";

export type PanelId = "links" | "skills" | "about";

export type ObjectKind =
  | "door"
  | "lamp"
  | "tv"
  | "radio"
  | "kettle"
  | "dog"
  | "computer"
  | "sport"
  | "window"
  | "toilet"
  | "bath"
  | "washer"
  | "openable"
  | "flavor"
  | "panel";

export interface RoomObject {
  /** Unique within the whole apartment — also the i18n key suffix (`obj.<id>`, `flavor.<id>`). */
  id: string;
  kind: ObjectKind;
  /** Interaction center, in game pixels. */
  x: number;
  /** How close the player must stand, in game pixels. */
  range?: number;
  /** Doors only: where they lead. */
  to?: { room: RoomId; spawnX: number };
  /** Panels only: which overlay to open. */
  panel?: PanelId;
  /** Sport objects only: which player animation to run. */
  action?: ActionId;
  /** Force a facing direction during the interaction (e.g. sit facing the TV). */
  face?: 1 | -1;
}

export interface RoomDef {
  id: RoomId;
  width: number;
  objects: RoomObject[];
}

export const GAME_HEIGHT = 180;
export const FLOOR_Y = 150;
export const DEFAULT_RANGE = 26;
export const WALK_SPEED = 72; // game px / second — a slow, unhurried pace
export const PLAYER_START: { room: RoomId; x: number } = { room: "hallway", x: 64 };

export const ROOMS: Record<RoomId, RoomDef> = {
  hallway: {
    id: "hallway",
    width: 420,
    objects: [
      { id: "frontdoor", kind: "flavor", x: 34 },
      { id: "meter", kind: "flavor", x: 64, range: 14 },
      { id: "mirror", kind: "flavor", x: 96, range: 18 },
      { id: "coat", kind: "flavor", x: 130, range: 16 },
      { id: "slippers", kind: "flavor", x: 158, range: 14 },
      { id: "phone", kind: "panel", panel: "links", x: 196, range: 20 },
      { id: "switch", kind: "lamp", x: 228, range: 16 },
      { id: "door-kitchen", kind: "door", x: 264, range: 20, to: { room: "kitchen", spawnX: 40 } },
      { id: "door-living", kind: "door", x: 312, range: 20, to: { room: "living", spawnX: 44 } },
      { id: "door-bath", kind: "door", x: 372, range: 20, to: { room: "bath", spawnX: 44 } },
    ],
  },
  kitchen: {
    id: "kitchen",
    width: 340,
    objects: [
      { id: "door-hall", kind: "door", x: 24, to: { room: "hallway", spawnX: 264 } },
      { id: "switch-kitchen", kind: "lamp", x: 52, range: 14 },
      { id: "kettle", kind: "kettle", x: 84, range: 24 },
      { id: "kolonka", kind: "flavor", x: 128, range: 18 },
      { id: "fridge", kind: "openable", x: 176, range: 20 },
      { id: "kitchentable", kind: "flavor", x: 222, range: 18 },
      { id: "radio", kind: "radio", x: 254, range: 14 },
      { id: "window-kitchen", kind: "window", x: 280, range: 16 },
      { id: "banki", kind: "flavor", x: 318, range: 18 },
    ],
  },
  living: {
    id: "living",
    width: 600,
    objects: [
      { id: "door-hall2", kind: "door", x: 24, to: { room: "hallway", spawnX: 312 } },
      { id: "switch2", kind: "lamp", x: 56, range: 16 },
      { id: "tv", kind: "tv", x: 100, range: 24 },
      { id: "carpet", kind: "flavor", x: 178, range: 24 },
      { id: "sofa", kind: "sport", action: "sit", x: 214, range: 12, face: -1 },
      { id: "dog", kind: "dog", x: 270, range: 30 },
      { id: "stenka", kind: "panel", panel: "skills", x: 366, range: 20 },
      { id: "crystal", kind: "flavor", x: 414, range: 14 },
      { id: "photos", kind: "flavor", x: 452, range: 14 },
      { id: "balcony", kind: "door", x: 520, range: 22, to: { room: "balcony", spawnX: 48 } },
      { id: "door-study", kind: "door", x: 570, range: 22, to: { room: "study", spawnX: 44 } },
    ],
  },
  study: {
    id: "study",
    width: 500,
    objects: [
      { id: "door-living2", kind: "door", x: 24, to: { room: "living", spawnX: 542 } },
      { id: "switch-bed", kind: "lamp", x: 58, range: 12 },
      { id: "bed", kind: "panel", panel: "about", x: 96, range: 26 },
      { id: "painting", kind: "sport", action: "pray", x: 136, range: 10 },
      { id: "wardrobe", kind: "openable", x: 168, range: 22 },
      { id: "window-yard", kind: "window", x: 236, range: 20 },
      { id: "barbell", kind: "sport", action: "press", x: 300, range: 24 },
      { id: "giria", kind: "sport", action: "swing", x: 344, range: 18 },
      { id: "sambo", kind: "sport", action: "sambo", x: 392, range: 20 },
      { id: "computer", kind: "computer", x: 452, range: 28 },
    ],
  },
  bath: {
    id: "bath",
    width: 300,
    objects: [
      { id: "door-hall3", kind: "door", x: 24, to: { room: "hallway", spawnX: 372 } },
      { id: "switch-bath", kind: "lamp", x: 54, range: 12 },
      { id: "sink", kind: "sport", action: "use", x: 100, range: 20 },
      { id: "toilet", kind: "toilet", x: 156, range: 20 },
      { id: "tub", kind: "bath", x: 212, range: 24 },
      { id: "washer", kind: "washer", x: 264, range: 18 },
    ],
  },
  balcony: {
    id: "balcony",
    width: 310,
    objects: [
      { id: "door-living3", kind: "door", x: 24, to: { room: "living", spawnX: 520 } },
      { id: "ashtray", kind: "flavor", x: 66, range: 10 },
      { id: "smoke", kind: "sport", action: "smoke", x: 110, range: 24 },
      { id: "call", kind: "sport", action: "call", x: 150, range: 12 },
      { id: "skis", kind: "flavor", x: 186, range: 14 },
      { id: "seedlings", kind: "flavor", x: 207, range: 8 },
      { id: "crate", kind: "flavor", x: 232, range: 14 },
      { id: "bicycle", kind: "flavor", x: 278, range: 18 },
    ],
  },
};

export function nearestObject(room: RoomDef, x: number): RoomObject | null {
  let best: RoomObject | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const obj of room.objects) {
    const dist = Math.abs(obj.x - x);
    if (dist <= (obj.range ?? DEFAULT_RANGE) && dist < bestDist) {
      best = obj;
      bestDist = dist;
    }
  }
  return best;
}
