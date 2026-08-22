import type { RuntimeSceneDef } from "@/engine";
import type { WorldState } from "@/lib/worldState";

/**
 * The apartment, one scene per file — and one code-split chunk per scene.
 * Each entry is a loader the engine resolves on first travel there, its
 * chunk warming behind the travel fade. The legacy lib/apartment object
 * table and components/game/rooms.tsx art are fully retired — every room
 * owns its artwork, objects and light.
 */
export const APARTMENT_SCENES: Record<string, () => Promise<RuntimeSceneDef<WorldState>>> = {
  studio: () => import("./studioScene").then((m) => m.STUDIO_SCENE),
  study: () => import("./bedroomScene").then((m) => m.BEDROOM_SCENE),
  bath: () => import("./bathScene").then((m) => m.BATH_SCENE),
  balcony: () => import("./balconyScene").then((m) => m.BALCONY_SCENE),
};
