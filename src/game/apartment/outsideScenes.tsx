import type { SceneDef } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { CORRIDOR_SCENE } from "./corridorScene";
import { DISTRICT_SCENE } from "./districtScene";
import { ELEVATOR_SCENE } from "./elevatorScene";
import { GYM_SCENE } from "./gymScene";
import { PARKING_SCENE } from "./parkingScene";
import { STREET_SCENE } from "./streetScene";
import { ZABKA_SCENE } from "./zabkaScene";

/**
 * The world beyond the front door, one scene per file:
 * corridor (the landing), the lift, the street, parking level −1, Żabka.
 */
export const OUTSIDE_SCENES: Record<string, SceneDef<WorldState>> = {
  district: DISTRICT_SCENE,
  gym: GYM_SCENE,
  corridor: CORRIDOR_SCENE,
  elevator: ELEVATOR_SCENE,
  outside: STREET_SCENE,
  parking: PARKING_SCENE,
  zabka: ZABKA_SCENE,
};
