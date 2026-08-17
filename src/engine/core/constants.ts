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

/* --- targeting -----------------------------------------------------------------
 * Detection is a scored competition, not a plain distance check: objects the
 * player faces read as "in front of me", important objects (NPCs, doors) can
 * out-rank clutter, and the current target keeps focus until something is
 * clearly better — so the prompt never flickers between two neighbours.
 */

/** Distance multiplier for objects on the side the player faces. */
export const FACING_AHEAD_MULT = 0.82;
/** Distance multiplier for objects behind the player's back. */
export const FACING_BEHIND_MULT = 1.18;
/** Each `priority` point on an object counts as being this many gp closer. */
export const PRIORITY_GP = 12;
/** The current target keeps focus while its score is within this of the best. */
export const STICKY_MARGIN = 7;
/** Default height (gp from scene top) of the floating target marker — clears the player's head. */
export const MARKER_Y = 70;
