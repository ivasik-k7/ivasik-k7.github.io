/**
 * The engine's one non-negotiable contract: every scene is drawn on a
 * 180-logical-pixel-tall canvas with the floor line at y=150. Width varies
 * per scene; the viewport scales by an integer factor so pixels stay crisp
 * and the player keeps the same proportions in every room.
 */
export const SCENE_HEIGHT = 180;
export const FLOOR_Y = 150;

/** Player can't walk closer than this to a scene edge. */
export const EDGE_MARGIN = 20;

/** Default interaction radius when an object doesn't specify one. */
export const DEFAULT_RANGE = 26;

/** A slow, unhurried pace — game px / second. */
export const DEFAULT_WALK_SPEED = 72;

/** Integer viewport scale bounds. */
export const MIN_SCALE = 2;
export const MAX_SCALE = 6;

/** Scene-travel fade timings, tuned on the original game. */
export const TRAVEL_FADE_OUT_MS = 200;
export const TRAVEL_SWITCH_AT_MS = 220;
export const TRAVEL_FADE_IN_DELAY_MS = 60;
