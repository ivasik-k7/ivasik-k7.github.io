import { BathRoom } from "@/components/game/rooms";
import type { SceneDef, SceneObject } from "@/engine";
import { ROOMS, type RoomId } from "@/lib/apartment";
import { type DayPhase, roomDarkness, type WorldState } from "@/lib/worldState";
import { BALCONY_SCENE } from "./balconyScene";
import { BEDROOM_SCENE } from "./bedroomScene";
import { STUDIO_SCENE } from "./studioScene";

/**
 * The original six apartment rooms, adapted to the Scene Engine.
 * Artwork and object layout are reused verbatim from the proven game;
 * only the wiring changes.
 */

/** Doors that used to lead to the removed hallway/living now lead home. */
const RETURN_TARGETS: Record<string, { scene: string; spawnX: number }> = {
  "door-living2": { scene: "studio", spawnX: 488 },
  "door-hall3": { scene: "studio", spawnX: 432 },
  "door-living3": { scene: "studio", spawnX: 580 },
};

/** apartment.ts RoomObject → engine SceneObject (door targets become scene ids). */
function toSceneObjects(room: RoomId): SceneObject[] {
  return ROOMS[room].objects.map((o) => ({
    id: o.id,
    kind: o.kind,
    x: o.x,
    range: o.range,
    to: o.to ? (RETURN_TARGETS[o.id] ?? { scene: o.to.room, spawnX: o.to.spawnX }) : undefined,
    action: o.action,
    face: o.face,
    data: o.panel,
  }));
}

const interiorDarkness =
  (light: keyof WorldState["lights"]) => (phase: string, world: WorldState) =>
    roomDarkness(phase as DayPhase, world.lights[light]);

// --- per-scene effects (steam, notes, hearts, smoke, TV glow) -------------------

// --- scene table ------------------------------------------------------------------

export const APARTMENT_SCENES: Record<string, SceneDef<WorldState>> = {
  studio: STUDIO_SCENE,
  study: BEDROOM_SCENE,
  bath: {
    id: "bath",
    width: ROOMS.bath.width,
    objects: toSceneObjects("bath"),
    Component: ({ world }) => <BathRoom lightOn={world.lights.bath} washerOn={world.washerOn} />,
    darkness: interiorDarkness("bath"),
  },
  balcony: BALCONY_SCENE,
};
