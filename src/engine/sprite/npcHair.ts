import { CENTRE, type Cell, HEAD_ROWS } from "./npcBody";
import type { FaceGeometry } from "./npcFace";

/**
 * npcHair — haircuts and hats, cut to the head they are sitting on.
 *
 * A haircut is not a shape laid on a skull, it is four decisions: where the
 * hairline sits, whether the ears are covered, what happens at the nape, and
 * whether there is any weight above the crown. Nineteen cuts that answer those
 * the same way are nineteen helmets in different colours, which is what the
 * old patch tables produced.
 *
 * Four things constrain every one of them.
 *
 *   – Seven rows, and row 0 is the crown. There is no row above it, so height
 *     is not for sale: tall hair has to be said with width and with a broken
 *     top edge instead.
 *   – Row 2 is the eye row. A fringe may reach the temples on it; it may never
 *     reach the eyes.
 *   – One column of overhang each side is all the room there is outside the
 *     skull, because the builder clips a dressed head back to the skull plus
 *     one and throws away anything wider.
 *   – One set of cells dresses both the front head and the profile, and the
 *     profile faces right. The left of the grid is therefore the *back* of the
 *     head edge-on, which is where a plait, a nape, a bun and the fall of long
 *     hair all belong. Nothing below the eye row is drawn on the right, because
 *     edge-on the right of the head is the face, and hair over a cheek and a
 *     nose reads as damage rather than as hair.
 *
 * Light comes from the left in every scene in this game. Rather than remember
 * that nineteen times over, a cut is authored as a mass and `shadeMass` reads
 * the light off the shape itself: near rim lit, far rim in shade, and every
 * edge the hair ends on dark.
 */

// ---------------------------------------------------------------------------
// zones
// ---------------------------------------------------------------------------

const HAIR = "h";
const HAIR_SHADE = "H";
const HAIR_LIT = "i";
/** hair thin enough to see the scalp through: a fade, a stubbled crown */
const STUBBLE = "f";
const STUBBLE_SHADE = "F";
const SKIN = "s";
const SKIN_SHADE = "S";
const SKIN_LIT = "y";
const HAT = "k";
const HAT_SHADE = "K";
const HAT_LIT = "j";
/** the contact shadow a brim throws down onto a brow */
const OCCLUDE = "d";
/** written back onto the head to take a pixel away again */
const BARE = ".";

// ---------------------------------------------------------------------------
// a pen that knows the skull it is drawing on
// ---------------------------------------------------------------------------

type Pen = ReturnType<typeof pen>;

/**
 * Everything a cut needs to know about the head under it, and the four strokes
 * it needs to say anything. Columns are named rather than counted: `L` and `R`
 * are the silhouette, `OL` and `OR` the one column of hair allowed outside it.
 */
function pen(geo: FaceGeometry) {
  const half = geo.skull.skull;
  const L = CENTRE - half;
  const R = CENTRE + half - 1;
  const OL = L - 1;
  const OR = R + 1;
  const cells = new Map<string, Cell>();

  const at = (x: number, y: number, z: string = HAIR) => {
    if (x < OL || x > OR || y < 0 || y >= HEAD_ROWS) return;
    cells.set(`${x}:${y}`, { x, y, z });
  };
  const span = (x0: number, x1: number, y: number, z: string = HAIR) => {
    for (let x = x0; x <= x1; x++) at(x, y, z);
  };
  const col = (x: number, y0: number, y1: number, z: string = HAIR) => {
    for (let y = y0; y <= y1; y++) at(x, y, z);
  };
  /** recolour a cell that is already there; bare pixels stay bare */
  const tint = (x: number, y: number, z: string) => {
    const key = `${x}:${y}`;
    const there = cells.get(key);
    if (there && there.z !== BARE) cells.set(key, { x, y, z });
  };

  return {
    L,
    R,
    OL,
    OR,
    /**
     * How far a close cut is inset from the silhouette at the crown. A round
     * skull keeps its rounded corners under short hair; a narrow one does not,
     * because six columns of crown cannot give two away — and because the
     * builder drops its crown highlight three columns left of centre whatever
     * the head, which on an inset narrow crown lands beside the hair instead
     * of on it.
     */
    crownIn: geo.skull.crown === "round" && half >= 4 ? 1 : 0,
    /**
     * How far a temple may come in along the brow row before it starts rubbing
     * out an eyebrow. On a narrow head the answer is: not at all.
     */
    room: Math.max(0, half - 3),
    at,
    span,
    col,
    tint,
    cells,
  };
}

/**
 * Read the light off a mass of hair.
 *
 * The far rim of anything turns away from the sun and goes dark. The near
 * shoulder of the crown catches it — two pixels of it, because one pixel of
 * light on a mass this small reads as a speck rather than as a highlight. And
 * the edge the hair actually ends on, the nape or the blunt cut under an ear or
 * the tip of a plait, sits in its own shadow. A lock only one pixel across has
 * no far side and keeps its own colour, or every ponytail would be a black
 * line.
 *
 * Only plain hair is touched. Anything a cut has already decided the tone of —
 * a stubbled fade, a shaved scalp, the banding on a plait — is left alone.
 */
function shadeMass(cells: Map<string, Cell>, eyeRow: number): Cell[] {
  const solid = (x: number, y: number) => {
    const c = cells.get(`${x}:${y}`);
    return c !== undefined && c.z !== BARE;
  };
  /** the near shoulder of the crown, which is where the sun actually lands */
  let crownEdge = Number.POSITIVE_INFINITY;
  for (const cell of cells.values()) {
    if (cell.y === 0 && cell.z !== BARE) crownEdge = Math.min(crownEdge, cell.x);
  }
  const out: Cell[] = [];
  for (const cell of cells.values()) {
    if (cell.z !== HAIR) {
      out.push(cell);
      continue;
    }
    const { x, y } = cell;
    const left = solid(x - 1, y);
    const right = solid(x + 1, y);
    let z = HAIR;
    if (left && !right) z = HAIR_SHADE;
    if (y === 0 && right && x <= crownEdge + 1) z = HAIR_LIT;
    if (!solid(x, y + 1) && y >= eyeRow) z = HAIR_SHADE;
    out.push({ x, y, z });
  }
  return out;
}

/**
 * Curl reads as broken light rather than as a shape: the same mass with a
 * shadow every third pixel along the diagonal has texture, and flat it has
 * none. This is the only difference between an afro and a swimming cap.
 */
function curl(p: Pen, y0: number, y1: number) {
  for (let y = y0; y <= y1; y++) {
    for (let x = p.OL; x <= p.OR; x++) {
      if ((x + 2 * y) % 3 === 0) p.tint(x, y, HAIR_SHADE);
    }
  }
}

/**
 * A scalp, rather than a crown of hair: the same span the bare head draws, and
 * the corners of a round skull taken back off. Edge-on the crown is hair from
 * the back of the head to the brow whatever shape the skull is, so a scalp that
 * stops short of the silhouette leaves a tuft standing at each corner.
 */
function scalp(p: Pen, z: string, lit: string, shade: string) {
  p.span(p.L + p.crownIn, p.R - p.crownIn, 0, z);
  p.at(p.L + p.crownIn, 0, lit);
  p.at(p.R - p.crownIn, 0, shade);
  if (p.crownIn) {
    p.at(p.L, 0, BARE);
    p.at(p.R, 0, BARE);
  }
}

/** Sides taken down to the skin — the step that makes a fade a fade. */
function fadedSides(p: Pen) {
  p.at(p.L, 1, STUBBLE);
  p.at(p.R, 1, STUBBLE_SHADE);
  p.at(p.L, 2, STUBBLE);
  p.at(p.R, 2, STUBBLE_SHADE);
}

/**
 * The sides of a cut that ends at the ear. Only the near temple is painted:
 * the bare head already carries hair down both temples front-on, and edge-on
 * the far temple is the face plane, where a second pixel of hair stops being a
 * sideburn and becomes a lock hanging over the nose.
 */
function shortSides(p: Pen) {
  p.at(p.L, 1);
  p.at(p.L, 2);
}

export type NpcHairStyle =
  | "short"
  | "crop"
  | "bun"
  | "long"
  | "bald"
  | "receding"
  | "ponytail"
  | "curly"
  | "bob"
  | "braid"
  | "fringe"
  | "mullet"
  | "afro"
  | "topknot"
  | "undercut"
  | "curtains"
  | "spiky"
  | "bowl"
  | "shaved";

type Cut = (p: Pen) => void;

const HAIR_STYLE: Record<NpcHairStyle, Cut> = {
  /** the plain one every other cut is read against: neat, close, ears clear */
  short: (p) => {
    p.span(p.L, p.R, 0);
    shortSides(p);
    if (p.room) p.at(p.L + 1, 1);
  },

  /**
   * A number two all over. The hairline is the bare head's own; what says crop
   * is that the sides carry on up past the ear instead of stopping at it.
   */
  crop: (p) => {
    p.span(p.L + p.crownIn, p.R - p.crownIn, 0);
    p.at(p.L, 2, STUBBLE);
    p.at(p.R, 2, STUBBLE_SHADE);
  },

  /** clipped to the scalp: no mass at all, only a shadow of one */
  shaved: (p) => {
    scalp(p, STUBBLE, STUBBLE, STUBBLE_SHADE);
    fadedSides(p);
  },

  /** bare over the top, and what is left grows low round the ears */
  bald: (p) => {
    scalp(p, SKIN, SKIN_LIT, SKIN_SHADE);
    p.at(p.L, 1, SKIN);
    p.at(p.R, 1, SKIN_SHADE);
    p.at(p.L, 2);
    p.at(p.R, 2, HAIR_SHADE);
  },

  /** the corners have gone first, as they always do, and taken the temples */
  receding: (p) => {
    scalp(p, SKIN, SKIN_LIT, SKIN_SHADE);
    p.span(p.L + p.crownIn + 1, p.R - p.crownIn - 1, 0, HAIR);
    p.at(p.L, 1, SKIN);
    p.at(p.R, 1, SKIN_SHADE);
    p.at(p.L, 2);
    p.at(p.R, 2);
  },

  /** weight kept on top, sides taken off: the whole cut is that one step */
  undercut: (p) => {
    p.span(p.OL, p.OR, 0);
    fadedSides(p);
  },

  /** the same fade, and everything left over gathered and tied on the crown */
  topknot: (p) => {
    scalp(p, STUBBLE, STUBBLE, STUBBLE_SHADE);
    fadedSides(p);
    p.span(CENTRE - 2, CENTRE + 1, 0, HAIR);
  },

  /** pushed up and apart, so the top edge is a gap and a clump, not a line */
  spiky: (p) => {
    p.span(p.OL, p.OR, 0);
    p.at(CENTRE + 1, 0, BARE);
    shortSides(p);
  },

  /** parted down the middle and swept off the forehead either side of it */
  curtains: (p) => {
    p.span(p.L, p.R, 0);
    p.tint(CENTRE, 0, HAIR_SHADE);
    p.span(p.L, CENTRE - 2, 1);
    p.span(CENTRE + 1, p.R, 1);
    p.tint(CENTRE - 2, 1, HAIR_SHADE);
    p.tint(CENTRE + 1, 1, HAIR_SHADE);
    p.at(p.L, 2);
    p.at(p.R, 2);
  },

  /** cut straight across the brow, and the eyebrows go with it */
  fringe: (p) => {
    p.span(p.L, p.R, 0);
    p.span(p.L, p.R, 1);
    p.at(p.L, 2);
    p.at(p.R, 2);
  },

  /** somebody's mother did this one: heavy fringe, ears buried, straight hem */
  bowl: (p) => {
    p.span(p.OL, p.OR, 0);
    p.span(p.OL, p.OR, 1);
    p.at(p.OL, 2);
    p.at(p.L, 2);
    p.at(p.R, 2);
    p.at(p.OR, 2);
    p.at(p.OL, 3);
    p.at(p.L, 3);
  },

  /** to the jaw and turning under, parted rather than fringed */
  bob: (p) => {
    p.span(p.L, p.R, 0);
    p.at(p.OL, 0);
    p.at(p.OR, 0);
    p.at(p.OL, 1);
    p.at(p.OR, 1);
    p.at(p.L, 1);
    p.at(p.R, 1);
    p.at(p.OL, 2);
    p.at(p.L, 2);
    p.at(p.R, 2);
    p.at(p.OR, 2);
    p.col(p.OL, 3, 4);
    p.col(p.L, 3, 5);
  },

  /** past the collar, and tucked behind the far ear so the face stays a face */
  long: (p) => {
    p.span(p.L, p.R, 0);
    p.at(p.OL, 0);
    p.at(p.OR, 0);
    p.at(p.OL, 1);
    p.at(p.OR, 1);
    p.at(p.L, 1);
    p.at(p.R, 1);
    p.at(p.OL, 2);
    p.at(p.L, 2);
    p.at(p.R, 2);
    p.at(p.OR, 2);
    p.col(p.OL, 3, 6);
    p.col(p.L, 3, 6);
  },

  /** volume everywhere and a shadow in every third pixel of it */
  curly: (p) => {
    p.span(p.OL, p.OR, 0);
    p.span(p.OL, p.L + p.room, 1);
    p.span(p.R - p.room, p.OR, 1);
    p.at(p.OL, 2);
    p.at(p.L, 2);
    p.at(p.R, 2);
    p.at(p.OR, 2);
    curl(p, 0, 2);
  },

  /** the same, grown out: wider at the ears than at the crown, and rounder */
  afro: (p) => {
    p.span(p.OL, p.OR, 0);
    p.span(p.OL, p.L + p.room, 1);
    p.span(p.R - p.room, p.OR, 1);
    p.at(p.OL, 2);
    p.at(p.L, 2);
    p.at(p.R, 2);
    p.at(p.OR, 2);
    p.at(p.OL, 3);
    curl(p, 0, 3);
  },

  /** scraped back flat, so all the interest is the knot behind the crown */
  bun: (p) => {
    p.span(p.L, p.R, 0);
    shortSides(p);
    p.at(p.OL, 0);
    p.at(p.OL, 1);
    p.at(p.OL, 2, HAIR_SHADE);
  },

  /** gathered behind the ear and hanging to the shoulder */
  ponytail: (p) => {
    p.span(p.L + p.crownIn, p.R - p.crownIn, 0);
    shortSides(p);
    p.col(p.OL, 2, 5);
    p.at(p.L, 3);
    p.at(p.L, 4);
  },

  /** the same tail, plaited: a shadow across it every other row is the trick */
  braid: (p) => {
    p.span(p.L + p.crownIn, p.R - p.crownIn, 0);
    shortSides(p);
    p.col(p.OL, 2, 6);
    p.col(p.L, 3, 6);
    p.at(p.OL, 4, HAIR_SHADE);
    p.at(p.L, 4, HAIR_SHADE);
    p.at(p.OL, 6, HAIR_SHADE);
    p.at(p.L, 6, HAIR_SHADE);
  },

  /** short and flat on top, and then it simply does not stop at the collar */
  mullet: (p) => {
    p.span(p.L + p.crownIn, p.R - p.crownIn, 0);
    shortSides(p);
    p.col(p.OL, 2, 6);
    p.at(p.L, 5);
    p.at(p.L, 6);
  },
};

// ---------------------------------------------------------------------------
// hats
// ---------------------------------------------------------------------------

export type NpcHat =
  | "none"
  | "cap"
  | "beanie"
  | "kerchief"
  | "hood"
  | "fedora"
  | "hardhat"
  | "ushanka"
  | "beret";

/**
 * A hat has to sit on the head rather than hover over it, and the tell is
 * always the same two pixels: something dark where the hat meets the skull,
 * and something lit along the top plane facing the sun. The brimmed ones get
 * the occlusion tone under them, which is darker than anything a garment can
 * be — a shadow cast on a face is not the hat in shade, it is the absence of
 * light, and mixing those two up is what makes a cap look like a sticker.
 */
const HAT_STYLE: Record<Exclude<NpcHat, "none">, Cut> = {
  /** crown, and a peak that projects forward over the brow and shades it */
  cap: (p) => {
    p.span(p.OL, p.R, 0, HAT);
    p.at(p.OL, 0, HAT_LIT);
    p.at(p.L, 0, HAT_LIT);
    p.at(p.R, 0, HAT_SHADE);
    p.span(p.L, p.OR, 1, HAT_SHADE);
    p.at(p.OL, 1, HAT);
    p.at(p.L, 2, OCCLUDE);
    p.at(p.R, 2, OCCLUDE);
  },

  /** knitted, hugging the skull, turned up at the brow and over the ears */
  beanie: (p) => {
    p.span(p.OL, p.OR, 0, HAT);
    p.at(p.OL, 0, HAT_LIT);
    p.at(p.L, 0, HAT_LIT);
    p.at(p.OR, 0, HAT_SHADE);
    p.span(p.OL, p.OR, 1, HAT);
    // the turn-up, ribbed: every other column of it drops into its own shadow
    for (let x = p.OL; x <= p.OR; x += 2) p.at(x, 1, HAT_SHADE);
    p.at(p.OL, 2, HAT);
    p.at(p.L, 2, HAT);
    p.at(p.R, 2, HAT_SHADE);
    p.at(p.OR, 2, HAT_SHADE);
  },

  /** tied under the fringe and knotted at the nape, ends hanging */
  kerchief: (p) => {
    p.span(p.OL, p.OR, 0, HAT);
    p.at(p.OL, 0, HAT_LIT);
    p.at(p.L, 0, HAT_LIT);
    p.at(p.OR, 0, HAT_SHADE);
    p.span(p.OL, p.OR, 1, HAT);
    p.at(p.OR, 1, HAT_SHADE);
    p.at(p.OL, 2, HAT_SHADE);
    p.at(p.L, 2, HAT_SHADE);
    p.at(p.R, 2, HAT_SHADE);
    p.at(p.OR, 2, HAT_SHADE);
    p.at(p.OL, 3, HAT);
    p.at(p.OL, 4, HAT_SHADE);
  },

  /** bigger than the head: walls either side of the face and a dark mouth */
  hood: (p) => {
    p.span(p.OL, p.OR, 0, HAT);
    p.at(p.OL, 0, HAT_LIT);
    p.at(p.L, 0, HAT_LIT);
    p.at(p.OR, 0, HAT_SHADE);
    p.span(p.OL, p.OR, 1, HAT);
    p.at(p.L, 1, OCCLUDE);
    p.at(p.R, 1, OCCLUDE);
    p.at(p.OL, 2, HAT);
    p.at(p.L, 2, OCCLUDE);
    p.at(p.R, 2, OCCLUDE);
    p.at(p.OR, 2, HAT_SHADE);
    p.col(p.OL, 3, 5, HAT);
    p.at(p.L, 3, HAT_SHADE);
    p.at(p.L, 4, HAT_SHADE);
  },

  /** a narrow crown standing above a brim that is wider than the head */
  fedora: (p) => {
    p.span(p.L, p.R, 0, HAT);
    p.at(p.L, 0, HAT_SHADE);
    p.at(p.L + 1, 0, HAT_LIT);
    p.at(p.R, 0, HAT_SHADE);
    p.span(p.OL, CENTRE - 1, 1, HAT);
    p.span(CENTRE, p.OR, 1, HAT_SHADE);
    p.at(p.OL, 1, HAT_LIT);
    p.at(p.L, 2, OCCLUDE);
    p.at(p.R, 2, OCCLUDE);
  },

  /** a shell with a ridge down it and a brim all the way round */
  hardhat: (p) => {
    p.span(p.L, p.R, 0, HAT);
    p.at(CENTRE - 1, 0, HAT_LIT);
    p.at(CENTRE, 0, HAT_SHADE);
    p.at(p.R, 0, HAT_SHADE);
    p.span(p.OL, CENTRE - 1, 1, HAT);
    p.span(CENTRE, p.OR, 1, HAT_SHADE);
    p.at(p.OL, 1, HAT_LIT);
    p.at(p.L, 2, OCCLUDE);
    p.at(p.R, 2, OCCLUDE);
  },

  /** fur, a deep band, and the flaps down over both ears */
  ushanka: (p) => {
    p.span(p.OL, p.OR, 0, HAT);
    for (let x = p.OL; x <= p.OR; x += 3) p.at(x, 0, HAT_LIT);
    p.at(p.OR, 0, HAT_SHADE);
    p.span(p.OL, p.OR, 1, HAT);
    p.at(p.OR, 1, HAT_SHADE);
    p.at(p.OL, 2, HAT);
    p.at(p.L, 2, HAT);
    p.at(p.R, 2, HAT_SHADE);
    p.at(p.OR, 2, HAT_SHADE);
    p.at(p.OL, 3, HAT);
    p.at(p.OL, 4, HAT_SHADE);
  },

  /** a soft disc that has slumped off the back of the head, hair showing */
  beret: (p) => {
    p.span(p.OL, p.R - 1, 0, HAT);
    p.at(p.OL, 0, HAT_LIT);
    p.at(p.R - 1, 0, HAT_SHADE);
    p.span(p.L, p.R, 1, HAT_SHADE);
    p.at(p.OL, 1, HAT);
    p.at(p.L, 1, HAT);
    p.at(p.OL, 2, HAT_SHADE);
  },
};

/** The haircut, cut to the skull under it. */
export function hairCells(style: NpcHairStyle, geo: FaceGeometry): Cell[] {
  const p = pen(geo);
  HAIR_STYLE[style](p);
  return shadeMass(p.cells, geo.eyeRow);
}

/** The hat, which sits over whatever the haircut did. */
export function hatCells(hat: Exclude<NpcHat, "none">, geo: FaceGeometry): Cell[] {
  const p = pen(geo);
  HAT_STYLE[hat](p);
  return [...p.cells.values()];
}
