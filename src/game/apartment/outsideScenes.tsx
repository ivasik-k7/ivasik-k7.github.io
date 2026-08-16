import type { SceneDef } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { CORRIDOR_SCENE } from "./corridorScene";
import { ELEVATOR_SCENE } from "./elevatorScene";
import { PARKING_SCENE } from "./parkingScene";
import { STREET_SCENE } from "./streetScene";
import { ZABKA_SCENE } from "./zabkaScene";

/**
 * The world beyond the front door, one scene per file:
 * corridor (the landing), the lift, the street, parking level −1, Żabka.
 */
export const OUTSIDE_SCENES: Record<string, SceneDef<WorldState>> = {
  corridor: CORRIDOR_SCENE,
  elevator: ELEVATOR_SCENE,
  outside: STREET_SCENE,
  parking: PARKING_SCENE,
  zabka: ZABKA_SCENE,
};
