import type { SpriteMap } from "../core/types";
import { CENTRE, type Cell, HEAD_ROWS, W } from "./npcBody";

/**
 * npcFace — the head, and why two people are not the same person.
 *
 * The old head was one fixed 8×7 shape with an optional beard patched on top.
 * Change the hair and the skin and you got the same man in a different wig,
 * which is exactly what a street full of them looked like.
 *
 * A head here is built from five independent traits — skull, brow, eyes, nose,
 * mouth — plus ears and any number of features (glasses, stubble, crow's feet)
 * laid over the top. Seven rows is not much room, so every trait is spent
 * where it actually reads at 2× zoom:
 *
 *   – the SKULL decides the silhouette: crown, cheek, jaw and chin widths, and
 *     a silhouette is what you recognise from across the street.
 *   – the BROW is one row of hair-coloured pixels and carries most of the
 *     expression. Heavy brows and thin brows are different people.
 *   – the EYES move a column, gain a lid or sink into shadow.
 *   – the NOSE barely registers front-on and completely defines the profile,
 *     so it is authored twice and the profile version does the work.
 *   – the MOUTH is two to four pixels; width and corner height is all of it.
 *
 * Every trait defaults to something derived from the character's id, so a cast
 * of twenty is a cast of twenty faces before anybody writes a single one down.
 */

export type NpcHeadShape = "oval" | "round" | "square" | "long" | "gaunt" | "heart";
export type NpcBrow = "thin" | "flat" | "heavy" | "arched" | "worried" | "raised";
export type NpcEyeShape = "normal" | "wide" | "round" | "narrow" | "deep" | "bright";
export type NpcNose = "small" | "straight" | "broad" | "hook" | "button" | "long";
export type NpcMouth = "neutral" | "wide" | "thin" | "smile" | "frown" | "set";
export type NpcEars = "flat" | "out";

export type FaceTraits = {
  shape: NpcHeadShape;
  brow: NpcBrow;
  eyes: NpcEyeShape;
  nose: NpcNose;
  mouth: NpcMouth;
  ears: NpcEars;
};

type Skull = {
  /** half-width of the cranium, rows 0–2 */
  skull: number;
  /** half-width at the cheekbones, rows 3–4 */
  cheek: number;
  /** half-width at the jaw, row 5 */
  jaw: number;
  /** half-width at the chin, row 6 */
  chin: number;
  /** a flat crown reads as a squarer head even when the jaw is the same */
  crown: "round" | "flat";
  /** how far the chin comes forward in profile */
  chinOut: number;
};

const SKULLS: Record<NpcHeadShape, Skull> = {
  oval: { skull: 4, cheek: 4, jaw: 3, chin: 2, crown: "round", chinOut: 0 },
  round: { skull: 4, cheek: 4, jaw: 4, chin: 3, crown: "round", chinOut: 0 },
  square: { skull: 4, cheek: 4, jaw: 4, chin: 3, crown: "flat", chinOut: 1 },
  long: { skull: 3, cheek: 3, jaw: 3, chin: 2, crown: "round", chinOut: 0 },
  gaunt: { skull: 3, cheek: 3, jaw: 2, chin: 2, crown: "flat", chinOut: 1 },
  heart: { skull: 4, cheek: 4, jaw: 3, chin: 1, crown: "round", chinOut: 0 },
};

/** Columns a head occupies, so hair and hats can be cut to fit it. */
export function skullOf(shape: NpcHeadShape): Skull {
  return SKULLS[shape];
}

// ---------------------------------------------------------------------------
// a little painter — seven rows of the 24-wide grid
// ---------------------------------------------------------------------------

type Grid = string[][];

const grid = (): Grid => Array.from({ length: HEAD_ROWS }, () => new Array<string>(W).fill("."));
const done = (g: Grid): SpriteMap => g.map((r) => r.join(""));

function put(g: Grid, x: number, y: number, z: string) {
  if (y >= 0 && y < g.length && x >= 0 && x < W) g[y][x] = z;
}

function span(g: Grid, x0: number, x1: number, y: number, z: string) {
  for (let x = x0; x <= x1; x++) put(g, x, y, z);
}

/** Left and right edge columns for a half-width, inclusive. */
const lft = (half: number) => CENTRE - half;
const rgt = (half: number) => CENTRE + half - 1;

// ---------------------------------------------------------------------------
// where the features land
// ---------------------------------------------------------------------------

export type FaceGeometry = {
  skull: Skull;
  /** the two eye columns, front-on */
  eyeL: number;
  eyeR: number;
  /** rows, for anything that wants to sit on one */
  browRow: 1;
  eyeRow: 2;
  noseRow: 4;
  mouthRow: 5;
  chinRow: 6;
  /** back of the skull and the face plane, in profile */
  backX: number;
  faceX: number;
  /** how far the nose sticks out past the face plane */
  noseOut: number;
};

/**
 * Eyes do not move. Six columns of face leaves exactly one pair of columns
 * that is not touching the temple, so spreading them apart or bringing them
 * together only ever made a worse face. What varies is the eye itself: the
 * lid over it, the socket around it, the light in it.
 */
const EYE_COL = 2;

const NOSE_OUT: Record<NpcNose, number> = {
  small: 1,
  button: 1,
  straight: 1,
  long: 1,
  broad: 2,
  hook: 2,
};

export function faceGeometry(t: FaceTraits): FaceGeometry {
  const skull = SKULLS[t.shape];
  return {
    skull,
    eyeL: CENTRE - EYE_COL,
    eyeR: CENTRE + EYE_COL - 1,
    browRow: 1,
    eyeRow: 2,
    noseRow: 4,
    mouthRow: 5,
    chinRow: 6,
    backX: lft(skull.skull),
    faceX: rgt(skull.skull),
    noseOut: NOSE_OUT[t.nose],
  };
}

// ---------------------------------------------------------------------------
// the head, front on
// ---------------------------------------------------------------------------

/**
 * Crown, forehead, eyes, cheeks, jaw, chin. The light comes from the left in
 * every scene in this game, so the near cheek carries the highlight and the
 * far edge carries the shade — that one asymmetry is what stops a face
 * reading as a mask.
 */
export function headFront(t: FaceTraits): SpriteMap {
  const g = grid();
  const geo = faceGeometry(t);
  const s = geo.skull;

  // row 0 — the cranium, in hair
  const crownIn = s.crown === "round" ? 1 : 0;
  span(g, lft(s.skull) + crownIn, rgt(s.skull) - crownIn, 0, "h");

  // row 1 — forehead, with hair down each temple
  span(g, lft(s.skull), rgt(s.skull), 1, "s");
  put(g, lft(s.skull), 1, "h");
  put(g, rgt(s.skull), 1, "h");

  // row 2 — the eye line, with hair down each temple. The eyes are fixed two
  // columns off the centre, which leaves a column of skin between each eye and
  // the hair beside it; without that column the pupil and the temple merge and
  // the face loses the only two pixels anybody actually looks at.
  span(g, lft(s.skull), rgt(s.skull), 2, "s");
  put(g, lft(s.skull), 2, "h");
  put(g, rgt(s.skull), 2, "h");

  // row 3 — cheekbones, and the light on the near one
  span(g, lft(s.cheek), rgt(s.cheek), 3, "s");
  put(g, lft(s.cheek) + 1, 3, "y");
  put(g, rgt(s.cheek), 3, "S");

  // row 4 — mid-face, narrowing toward the jaw
  span(g, lft(s.cheek), rgt(s.cheek), 4, "s");
  put(g, lft(s.cheek), 4, "S");
  put(g, rgt(s.cheek), 4, "S");

  // row 5 — the jaw, turning away from the light on the far side. Two shaded
  // columns rather than one: a face is a box, and the plane below the
  // cheekbone catches noticeably less than the plane in front of it.
  span(g, lft(s.jaw), rgt(s.jaw), 5, "s");
  put(g, lft(s.jaw), 5, "S");
  put(g, rgt(s.jaw), 5, "S");
  put(g, rgt(s.jaw) - 1, 5, "S");

  // row 6 — the chin
  span(g, lft(s.chin), rgt(s.chin), 6, "S");
  if (s.chin >= 2) span(g, lft(s.chin) + 1, rgt(s.chin) - 1, 6, "s");

  // Ears, if they stick out. Both in shade, never in lit skin: a lit pixel out
  // past the widest row of the skull reads as the face being wider than the
  // head rather than as an ear, and at this size that looks like a mistake
  // instead of like a person.
  if (t.ears === "out") {
    put(g, lft(s.cheek) - 1, 3, "S");
    put(g, rgt(s.cheek) + 1, 3, "S");
  }

  drawBrow(g, t, geo);
  drawEyes(g, t, geo);
  drawNose(g, t, geo);
  drawMouth(g, t, geo);
  return done(g);
}

function drawBrow(g: Grid, t: FaceTraits, geo: FaceGeometry) {
  const shapes: Record<NpcBrow, { out: number; inn: number; z: string }> = {
    thin: { out: 0, inn: 0, z: "H" },
    flat: { out: 0, inn: 1, z: "H" },
    heavy: { out: 1, inn: 1, z: "h" },
    arched: { out: 1, inn: 0, z: "H" },
    worried: { out: 0, inn: 1, z: "h" },
    raised: { out: 0, inn: 0, z: "H" },
  };
  const { out, inn, z } = shapes[t.brow];
  span(g, geo.eyeL - out, geo.eyeL + inn, geo.browRow, z);
  span(g, geo.eyeR - inn, geo.eyeR + out, geo.browRow, z);
  // a raised brow needs somewhere to have gone: light on the forehead above it
  if (t.brow === "raised") {
    put(g, geo.eyeL, 0, "y");
    put(g, geo.eyeR, 0, "y");
  }
  // worried brows tip inward, so the inner ends drop onto the eye row
  if (t.brow === "worried") {
    put(g, geo.eyeL + inn, geo.eyeRow, "H");
    put(g, geo.eyeR - inn, geo.eyeRow, "H");
  }
}

function drawEyes(g: Grid, t: FaceTraits, geo: FaceGeometry) {
  put(g, geo.eyeL, geo.eyeRow, "e");
  put(g, geo.eyeR, geo.eyeRow, "e");
  /** the temples are hair; anything outward of them has nowhere to go */
  const outL = geo.eyeL - 1;
  const outR = geo.eyeR + 1;
  const room = outL > lft(geo.skull.skull) && outR < rgt(geo.skull.skull);
  switch (t.eyes) {
    case "narrow":
      // a heavy lid, sitting on the eye
      put(g, geo.eyeL, geo.eyeRow - 1, "S");
      put(g, geo.eyeR, geo.eyeRow - 1, "S");
      break;
    case "deep":
      // set back in the skull: shadow above and below, socket all round
      put(g, geo.eyeL, geo.eyeRow - 1, "S");
      put(g, geo.eyeR, geo.eyeRow - 1, "S");
      put(g, geo.eyeL, geo.eyeRow + 1, "S");
      put(g, geo.eyeR, geo.eyeRow + 1, "S");
      break;
    case "round":
      // a big eye reads as the pupil plus the shadow it sits in
      put(g, geo.eyeL, geo.eyeRow + 1, "S");
      put(g, geo.eyeR, geo.eyeRow + 1, "S");
      break;
    case "wide":
      // open, with the white of the eye showing outward of the pupil
      if (room) {
        put(g, outL, geo.eyeRow, "y");
        put(g, outR, geo.eyeRow, "y");
      }
      break;
    case "bright":
      // a catchlight on the lid above each pupil
      put(g, geo.eyeL, geo.eyeRow - 1, "y");
      put(g, geo.eyeR, geo.eyeRow - 1, "y");
      break;
    default:
      break;
  }
}

function drawNose(g: Grid, t: FaceTraits, geo: FaceGeometry) {
  const x = CENTRE - 1;
  switch (t.nose) {
    case "small":
      put(g, x, geo.noseRow, "S");
      break;
    case "straight":
      put(g, x, geo.noseRow - 1, "S");
      put(g, x, geo.noseRow, "S");
      break;
    case "broad":
      span(g, x, x + 1, geo.noseRow, "S");
      put(g, x, geo.noseRow - 1, "S");
      break;
    case "hook":
      put(g, x, geo.noseRow - 1, "S");
      put(g, x, geo.noseRow, "S");
      put(g, x + 1, geo.noseRow, "S");
      break;
    case "button":
      put(g, x, geo.noseRow - 1, "y");
      put(g, x, geo.noseRow, "S");
      break;
    case "long":
      put(g, x, geo.noseRow - 2, "S");
      put(g, x, geo.noseRow - 1, "S");
      put(g, x, geo.noseRow, "S");
      break;
  }
}

/**
 * The mouth as cells, so it can be re-laid after a beard or a scarf has been
 * painted over the jaw. A beard that swallows the mouth is a balaclava.
 */
export function mouthCells(t: FaceTraits, view: "front" | "side"): Cell[] {
  const geo = faceGeometry(t);
  const g = grid();
  if (view === "front") drawMouth(g, t, geo);
  else drawProfileMouth(g, t, geo);
  const cells: Cell[] = [];
  g.forEach((line, y) => {
    line.forEach((z, x) => {
      if (z !== ".") cells.push({ x, y, z });
    });
  });
  return cells;
}

function drawMouth(g: Grid, t: FaceTraits, geo: FaceGeometry) {
  const r = geo.mouthRow;
  switch (t.mouth) {
    case "neutral":
      span(g, CENTRE - 1, CENTRE, r, "S");
      break;
    case "wide":
      span(g, CENTRE - 2, CENTRE + 1, r, "S");
      break;
    case "thin":
      span(g, CENTRE - 2, CENTRE, r, "S");
      break;
    case "set":
      span(g, CENTRE - 2, CENTRE + 1, r, "S");
      put(g, CENTRE - 1, r + 1, "S");
      put(g, CENTRE, r + 1, "S");
      break;
    case "smile":
      span(g, CENTRE - 1, CENTRE, r, "S");
      put(g, CENTRE - 2, r - 1, "S");
      put(g, CENTRE + 1, r - 1, "S");
      break;
    case "frown":
      span(g, CENTRE - 1, CENTRE, r, "S");
      put(g, CENTRE - 2, r + 1, "S");
      put(g, CENTRE + 1, r + 1, "S");
      break;
  }
}

// ---------------------------------------------------------------------------
// the head, in profile, facing right
// ---------------------------------------------------------------------------

/**
 * Edge-on, a face is a nose and a chin. Front-on the nose is three shaded
 * pixels nobody reads; here it is the whole silhouette, so the profile is
 * where a hooked nose or a weak chin actually becomes a person.
 */
export function headProfile(t: FaceTraits): SpriteMap {
  const g = grid();
  const geo = faceGeometry(t);
  const s = geo.skull;
  const back = geo.backX;
  const face = geo.faceX;

  // row 0 — crown, all hair
  span(g, back, face, 0, "h");
  // row 1 — hair over the back half, forehead in front
  span(g, back, face, 1, "s");
  span(g, back, back + s.skull - 1, 1, "h");
  // row 2 — the eye, with the brow ridge in front of it
  span(g, back, face, 2, "s");
  span(g, back, back + s.skull - 2, 2, "h");
  // row 3 — cheek, and the nose leaving the face
  span(g, back + 1, face, 3, "s");
  // row 4 — under the cheekbone
  span(g, back + 1, face, 4, "s");
  put(g, back + 1, 4, "H");
  put(g, face, 4, "S");
  // row 5 — the mouth line and the jaw
  span(g, back + 2, face, 5, "S");
  // row 6 — the jaw and chin
  span(g, back + 2, back + s.jaw + 1, 6, "S");
  span(g, back + 3, back + s.chin + 1, 6, "s");

  drawProfileNose(g, t, geo);
  drawProfileMouth(g, t, geo);
  // the chin comes forward on a square head and falls away on a soft one
  if (s.chinOut > 0) put(g, face - 1 + s.chinOut, 6, "S");

  // the eye, set one column back from the face plane
  const eyeX = face - 2;
  put(g, eyeX, geo.eyeRow, "e");
  if (t.eyes === "deep") put(g, eyeX - 1, geo.eyeRow, "S");
  if (t.eyes === "bright") put(g, eyeX - 1, geo.eyeRow, "y");
  if (t.eyes === "narrow") put(g, eyeX, geo.eyeRow - 1, "S");

  // the brow, which in profile is a ridge over the eye
  const brow = t.brow === "heavy" || t.brow === "worried" ? "h" : "H";
  put(g, eyeX, geo.browRow, brow);
  if (t.brow === "heavy" || t.brow === "arched") put(g, eyeX + 1, geo.browRow, brow);
  if (t.brow === "raised") put(g, eyeX, 0, "y");
  return done(g);
}

function drawProfileNose(g: Grid, t: FaceTraits, geo: FaceGeometry) {
  const face = geo.faceX;
  switch (t.nose) {
    case "small":
      put(g, face + 1, 3, "s");
      break;
    case "button":
      put(g, face + 1, 3, "s");
      put(g, face + 1, 4, "S");
      break;
    case "straight":
      put(g, face + 1, 3, "s");
      put(g, face + 1, 4, "s");
      put(g, face + 1, 5, "S");
      break;
    case "long":
      put(g, face + 1, 2, "s");
      put(g, face + 1, 3, "s");
      put(g, face + 1, 4, "s");
      put(g, face + 1, 5, "S");
      break;
    case "broad":
      put(g, face + 1, 3, "s");
      put(g, face + 2, 3, "s");
      put(g, face + 1, 4, "s");
      put(g, face + 2, 4, "S");
      break;
    case "hook":
      // the bridge leaves the brow early and the tip drops back under itself
      put(g, face + 1, 2, "s");
      put(g, face + 2, 3, "s");
      put(g, face + 1, 4, "s");
      put(g, face + 2, 4, "S");
      break;
  }
}

function drawProfileMouth(g: Grid, t: FaceTraits, geo: FaceGeometry) {
  const face = geo.faceX;
  const r = geo.mouthRow;
  // lips read as one or two pixels at the front of the face: a wide or a set
  // mouth reaches back along the jaw, a small one does not
  put(g, face, r, "S");
  if (t.mouth === "wide" || t.mouth === "set") put(g, face - 1, r, "S");
  if (t.mouth === "smile") put(g, face - 1, r - 1, "S");
  if (t.mouth === "frown") put(g, face - 1, r + 1, "S");
}

// ---------------------------------------------------------------------------
// features laid over a face
// ---------------------------------------------------------------------------

export type NpcFace =
  | "beard"
  | "moustache"
  | "stubble"
  | "goatee"
  | "sideburns"
  | "glasses"
  | "sunglasses"
  | "old"
  | "freckles"
  | "scar"
  | "blusher"
  | "tired";

/**
 * A feature is cells, not a fixed patch: a beard has to find the jaw it is
 * growing on, and a jaw moves when the skull does. Front and profile are
 * authored separately because a pair of glasses seen edge-on is an arm and a
 * lens, not two lenses.
 */
export function featureCells(kind: NpcFace, t: FaceTraits, view: "front" | "side"): Cell[] {
  const geo = faceGeometry(t);
  const s = geo.skull;
  const cells: Cell[] = [];
  const at = (x: number, y: number, z: string) => cells.push({ x, y, z });

  if (view === "front") {
    switch (kind) {
      case "beard":
        for (let x = lft(s.jaw); x <= rgt(s.jaw); x++) at(x, 5, "f");
        for (let x = lft(s.chin); x <= rgt(s.chin); x++) at(x, 6, "f");
        at(lft(s.cheek), 4, "F");
        at(rgt(s.cheek), 4, "F");
        // the mouth stays visible or the beard reads as a scarf
        at(CENTRE - 1, 5, "F");
        at(CENTRE, 5, "F");
        break;
      case "goatee":
        for (let x = CENTRE - 2; x <= CENTRE + 1; x++) at(x, 6, "f");
        at(CENTRE - 1, 5, "F");
        at(CENTRE, 5, "F");
        break;
      case "moustache":
        for (let x = CENTRE - 2; x <= CENTRE + 1; x++) at(x, 5, "f");
        break;
      case "stubble":
        // every other column, and the jaw line rather than the whole lower
        // face — solid coverage on two rows is a beard, whatever it is called
        for (let x = lft(s.jaw); x <= rgt(s.jaw); x += 2) at(x, 5, "F");
        for (let x = lft(s.chin); x <= rgt(s.chin); x++) at(x, 6, "F");
        break;
      case "sideburns":
        at(lft(s.cheek), 3, "f");
        at(rgt(s.cheek), 3, "f");
        at(lft(s.cheek), 4, "F");
        at(rgt(s.cheek), 4, "F");
        break;
      case "glasses":
        at(geo.eyeL - 1, geo.eyeRow, "c");
        at(geo.eyeL + 1, geo.eyeRow, "c");
        at(geo.eyeR - 1, geo.eyeRow, "c");
        at(geo.eyeR + 1, geo.eyeRow, "c");
        at(CENTRE - 1, geo.eyeRow, "c");
        break;
      case "sunglasses":
        for (let x = geo.eyeL - 1; x <= geo.eyeR + 1; x++) at(x, geo.eyeRow, "n");
        break;
      case "old":
        // crow's feet, and the fold from the nose to the corner of the mouth
        at(lft(s.skull) + 1, geo.eyeRow + 1, "S");
        at(rgt(s.skull) - 1, geo.eyeRow + 1, "S");
        at(CENTRE - 2, geo.noseRow, "S");
        at(CENTRE + 1, geo.noseRow, "S");
        break;
      case "tired":
        at(geo.eyeL, geo.eyeRow + 1, "S");
        at(geo.eyeR, geo.eyeRow + 1, "S");
        break;
      case "freckles":
        at(lft(s.cheek) + 1, geo.noseRow, "S");
        at(rgt(s.cheek) - 1, geo.noseRow, "S");
        at(CENTRE - 2, geo.noseRow - 1, "S");
        break;
      case "blusher":
        at(lft(s.cheek) + 1, geo.noseRow, "y");
        at(rgt(s.cheek) - 1, geo.noseRow, "y");
        break;
      case "scar":
        at(rgt(s.skull) - 1, geo.browRow, "S");
        at(rgt(s.skull) - 1, geo.eyeRow + 1, "S");
        break;
    }
    return cells;
  }

  const face = geo.faceX;
  switch (kind) {
    case "beard":
      at(face, 5, "f");
      at(face - 1, 5, "f");
      for (let x = geo.backX + 2; x <= face; x++) at(x, 6, "f");
      at(face - 1, 4, "F");
      break;
    case "goatee":
      at(face - 1, 6, "f");
      at(face, 6, "f");
      break;
    case "moustache":
      at(face - 1, 5, "f");
      at(face, 5, "f");
      break;
    case "stubble":
      at(face, 5, "F");
      for (let x = geo.backX + 2; x <= face; x++) at(x, 6, "F");
      break;
    case "sideburns":
      at(geo.backX + s.skull - 1, 3, "f");
      at(geo.backX + s.skull - 1, 4, "F");
      break;
    case "glasses":
      at(face - 3, geo.eyeRow, "c");
      at(face - 1, geo.eyeRow, "c");
      at(geo.backX + 2, geo.eyeRow, "c");
      break;
    case "sunglasses":
      for (let x = face - 3; x <= face; x++) at(x, geo.eyeRow, "n");
      break;
    case "old":
      at(face - 3, geo.eyeRow + 1, "S");
      at(face - 1, geo.noseRow, "S");
      break;
    case "tired":
      at(face - 2, geo.eyeRow + 1, "S");
      break;
    case "freckles":
      at(face - 2, geo.noseRow, "S");
      break;
    case "blusher":
      at(face - 2, geo.noseRow, "y");
      break;
    case "scar":
      at(face - 2, geo.browRow, "S");
      break;
  }
  return cells;
}

// ---------------------------------------------------------------------------
// a face nobody wrote down
// ---------------------------------------------------------------------------

const SHAPES: NpcHeadShape[] = ["oval", "round", "square", "long", "gaunt", "heart"];
const BROWS: NpcBrow[] = ["thin", "flat", "heavy", "arched", "worried", "raised"];
const EYES: NpcEyeShape[] = ["normal", "wide", "round", "narrow", "deep", "bright"];
const NOSES: NpcNose[] = ["small", "straight", "broad", "hook", "button", "long"];
const MOUTHS: NpcMouth[] = ["neutral", "wide", "thin", "smile", "frown", "set"];

/** Stable, boring, and different for every string. */
function hash(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000;
}

const pick = <T>(list: T[], seed: string, salt: number) => list[hash(seed, salt) % list.length];

/**
 * The face a character gets when nobody has chosen one. Seeded on the id, so
 * Pan Marek has the same nose every time the game starts and no two of the
 * crowd have the same face by accident.
 */
export function faceFor(id: string, given: Partial<FaceTraits> = {}): FaceTraits {
  return {
    shape: given.shape ?? pick(SHAPES, id, 1),
    brow: given.brow ?? pick(BROWS, id, 2),
    eyes: given.eyes ?? pick(EYES, id, 3),
    nose: given.nose ?? pick(NOSES, id, 4),
    mouth: given.mouth ?? pick(MOUTHS, id, 5),
    ears: given.ears ?? (hash(id, 6) < 300 ? "out" : "flat"),
  };
}
