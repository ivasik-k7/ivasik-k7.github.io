import type { RuntimeSceneDef } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { CORRIDOR_SCENE } from "./corridorScene";
import { DISTRICT_SCENE } from "./districtScene";
import { ELEKTRYKOW_SCENE } from "./elektrykowScene";
import { ELEVATOR_SCENE } from "./elevatorScene";
import { GYM_SCENE } from "./gymScene";
import { PARKING_SCENE } from "./parkingScene";
import { RAVE_CLUB_SCENE } from "./raveClubScene";
import { STREET_SCENE } from "./streetScene";
import { TRAIN_SCENE } from "./trainScene";
import { TRAIN_STATION_SCENE } from "./trainStation";
import { ZABKA_SCENE } from "./zabkaScene";

/**
 * The world beyond the front door, one scene per file:
 * corridor (the landing), the lift, the street, parking level −1, Żabka, the
 * Alchemia district, the gym, the SKM platform at Przymorze-Uniwersytet,
 * Ulica Elektryków at the Stocznia, and the club in hall B.
 */
export const OUTSIDE_SCENES: Record<string, RuntimeSceneDef<WorldState>> = {
  district: DISTRICT_SCENE,
  gym: GYM_SCENE,
  corridor: CORRIDOR_SCENE,
  elevator: ELEVATOR_SCENE,
  outside: STREET_SCENE,
  parking: PARKING_SCENE,
  zabka: ZABKA_SCENE,
  station: TRAIN_STATION_SCENE,
  train: TRAIN_SCENE,
  elektrykow: ELEKTRYKOW_SCENE,
  raveclub: RAVE_CLUB_SCENE,
};
