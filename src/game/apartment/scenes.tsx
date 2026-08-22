import type { RuntimeSceneDef } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { BALCONY_SCENE } from "./balconyScene";
import { BATH_SCENE } from "./bathScene";
import { BEDROOM_SCENE } from "./bedroomScene";
import { STUDIO_SCENE } from "./studioScene";

/**
 * The apartment, one scene per file. The legacy lib/apartment object table
 * and components/game/rooms.tsx art are fully retired — every room owns its
 * artwork, objects and light.
 */
export const APARTMENT_SCENES: Record<string, RuntimeSceneDef<WorldState>> = {
  studio: STUDIO_SCENE,
  study: BEDROOM_SCENE,
  bath: BATH_SCENE,
  balcony: BALCONY_SCENE,
};
