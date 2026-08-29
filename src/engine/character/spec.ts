/**
 * spec.ts — what a character *is*, as data.
 *
 * Everything the wardrobe, the bench and a save file need to say about a
 * person, flat and serialisable. The player's spec lives in
 * `WorldState.appearance`; the option ids in it are resolved by the game's
 * catalogue (`appearance.ts`), the body and garment *kinds* are resolved here
 * by the engine, which is the split that lets the engine know what a hoodie
 * is without knowing what colour this one happens to be.
 *
 * v1 saves carry the seven wardrobe slots and nothing else. Every body field
 * is therefore optional in storage and mandatory after `normalizeBody()` —
 * a save written before the body was configurable loads as the body it was
 * drawn with.
 */

/** Shoulder-to-hip mass. Widens the torso and thighs together. */
export type Build = "slight" | "lean" | "athletic" | "heavy" | "powerlifter";
/** Height, in extra shin rows over the drawn figure (negative = shorter). */
export type Height = "short" | "average" | "tall" | "towering";
export type Neck = "thin" | "normal" | "thick";
export type Posture = "upright" | "relaxed" | "slouched";

export interface BodySpec {
  build: Build;
  height: Height;
  neck: Neck;
  /** Resting stance: how the idle breath and the head sit on the frame. */
  posture: Posture;
}

export const DEFAULT_BODY: BodySpec = {
  build: "athletic",
  height: "average",
  neck: "normal",
  posture: "upright",
};

export const BUILDS: readonly Build[] = ["slight", "lean", "athletic", "heavy", "powerlifter"];
export const HEIGHTS: readonly Height[] = ["short", "average", "tall", "towering"];
export const NECKS: readonly Neck[] = ["thin", "normal", "thick"];
export const POSTURES: readonly Posture[] = ["upright", "relaxed", "slouched"];

/**
 * The grid consequences of a body, all relative to the drawn default (which
 * is `athletic / average / normal`): columns added to each shoulder, to each
 * thigh and each hip side, rows added to every shin, and the neck's width.
 */
export interface BodyMorph {
  shoulder: number;
  thigh: number;
  hip: number;
  shin: number;
  neck: number;
}

const BUILD_MORPH: Record<Build, Pick<BodyMorph, "shoulder" | "thigh" | "hip">> = {
  slight: { shoulder: -1, thigh: -1, hip: 0 },
  lean: { shoulder: -1, thigh: 0, hip: 0 },
  athletic: { shoulder: 0, thigh: 0, hip: 0 },
  heavy: { shoulder: 0, thigh: 1, hip: 1 },
  powerlifter: { shoulder: 1, thigh: 1, hip: 1 },
};

const HEIGHT_SHIN: Record<Height, number> = { short: -2, average: 0, tall: 2, towering: 4 };
const NECK_WIDTH: Record<Neck, number> = { thin: 5, normal: 6, thick: 7 };

export function bodyMorph(body: BodySpec): BodyMorph {
  return {
    ...BUILD_MORPH[body.build],
    shin: HEIGHT_SHIN[body.height],
    neck: NECK_WIDTH[body.neck],
  };
}

export function normalizeBody(partial: Partial<BodySpec> | undefined): BodySpec {
  const b = partial ?? {};
  return {
    build: BUILDS.includes(b.build as Build) ? (b.build as Build) : DEFAULT_BODY.build,
    height: HEIGHTS.includes(b.height as Height) ? (b.height as Height) : DEFAULT_BODY.height,
    neck: NECKS.includes(b.neck as Neck) ? (b.neck as Neck) : DEFAULT_BODY.neck,
    posture: POSTURES.includes(b.posture as Posture)
      ? (b.posture as Posture)
      : DEFAULT_BODY.posture,
  };
}

// ---------------------------------------------------------------------------
// garments — the kinds the engine knows how to draw
// ---------------------------------------------------------------------------

/** How far down the arm the cloth goes. */
export type Sleeve = "short" | "long" | "none";

/**
 * A top. `sleeve` is the one property every arm pose has to agree with; the
 * rest is detail stamped on the torso. `hood` says whether the hood zone is
 * a hood (drawn in its own colour) or just more shirt.
 */
export interface TorsoGarment {
  sleeve: Sleeve;
  hood?: boolean;
  /** an open front: a seam and lapels down the chest */
  open?: boolean;
  /** a belt at the waist (the sambo kurtka) */
  belt?: boolean;
  /** a ribbed hem at the waist (jumpers) */
  ribbed?: boolean;
  /** a collar at the neck */
  collar?: boolean;
}

export type TorsoKind =
  | "tee"
  | "tank"
  | "longsleeve"
  | "hoodie"
  | "jumper"
  | "jacket"
  | "kurtka"
  | "shirt";

export const TORSO_GARMENTS: Record<TorsoKind, TorsoGarment> = {
  tee: { sleeve: "short" },
  tank: { sleeve: "none" },
  longsleeve: { sleeve: "long" },
  hoodie: { sleeve: "long", hood: true },
  jumper: { sleeve: "long", ribbed: true, collar: true },
  jacket: { sleeve: "long", open: true, collar: true },
  kurtka: { sleeve: "long", belt: true, collar: true },
  shirt: { sleeve: "long", collar: true, open: true },
};

export type BottomKind = "trousers" | "joggers" | "shorts" | "tracksuit";

export interface BottomGarment {
  /** the leg is bare from the knee down */
  shorts?: boolean;
  /** an elastic cuff at the ankle */
  cuff?: boolean;
  /** a stripe down the outside seam */
  stripe?: boolean;
}

export const BOTTOM_GARMENTS: Record<BottomKind, BottomGarment> = {
  trousers: {},
  joggers: { cuff: true },
  shorts: { shorts: true },
  tracksuit: { cuff: true, stripe: true },
};

export type FootKind = "sneakers" | "boots" | "sandals" | "barefoot";

export interface Footwear {
  /** the shaft climbs this many shin rows */
  shaft?: number;
  /** no shoe at all — the foot is skin */
  bare?: boolean;
}

export const FOOTWEAR: Record<FootKind, Footwear> = {
  sneakers: {},
  boots: { shaft: 2 },
  sandals: {},
  barefoot: { bare: true },
};

export type HeadKind = "none" | "cap" | "beanie" | "hood";

export interface Headwear {
  /** the cap zone is worn */
  cap?: boolean;
  /** the hood is up over the hair */
  hood?: boolean;
  /** a beanie: the cap zone plus the hair rows down to the brow */
  beanie?: boolean;
}

export const HEADWEAR: Record<HeadKind, Headwear> = {
  none: {},
  cap: { cap: true },
  beanie: { beanie: true },
  hood: { hood: true },
};

/** What a whole outfit's *shapes* are, colours aside. */
export interface GarmentSpec {
  torso: TorsoKind;
  bottom: BottomKind;
  feet: FootKind;
  head: HeadKind;
}

export const DEFAULT_GARMENTS: GarmentSpec = {
  torso: "tee",
  bottom: "trousers",
  feet: "sneakers",
  head: "none",
};

/** The engine-side character: a body and the shapes it wears. */
export interface CharacterSpec {
  body: BodySpec;
  garments: GarmentSpec;
}

/** A stable key for caches — the spec, nothing else. */
export function specKey(spec: CharacterSpec): string {
  const b = spec.body;
  const g = spec.garments;
  return `${b.build}|${b.height}|${b.neck}|${b.posture}|${g.torso}|${g.bottom}|${g.feet}|${g.head}`;
}
