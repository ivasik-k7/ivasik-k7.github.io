import type { ActionDef, PlayerConfig, SpriteMap, SpritePalette } from "../core/types";
import {
  type CharacterBuilder,
  createCharacter,
  type Patch,
  replaceColor,
} from "./characterBuilder";
import {
  type Anatomy,
  ARM,
  type ArmPose,
  anatomy,
  arm,
  type Build,
  band,
  CENTRE,
  type Cell,
  HEAD_ROWS,
  type Height,
  handAt,
  LEG_ROWS,
  row,
  shell,
  stamp,
  stroke,
  TORSO_ROWS,
  TRIM,
  W,
} from "./npcBody";
import {
  type FaceTraits,
  faceFor,
  faceGeometry,
  featureCells,
  headFront,
  headProfile,
  mouthCells,
  type NpcBrow,
  type NpcEars,
  type NpcEyeShape,
  type NpcFace,
  type NpcHeadShape,
  type NpcMouth,
  type NpcNose,
  skullOf,
} from "./npcFace";
import { hairCells, hatCells, type NpcHairStyle, type NpcHat } from "./npcHair";
import { type FabricName, type HairName, npcPalette, type SkinName } from "./npcPalette";

export type {
  FaceTraits,
  NpcBrow,
  NpcEars,
  NpcEyeShape,
  NpcFace,
  NpcHeadShape,
  NpcMouth,
  NpcNose,
} from "./npcFace";
export type { NpcHairStyle, NpcHat } from "./npcHair";
export {
  type FabricName,
  type HairName,
  NPC_FABRICS,
  NPC_HAIRS,
  NPC_SKINS,
  type NpcZone,
  npcPalette,
  type SkinName,
} from "./npcPalette";

/**
 * NPC Builder — everybody in the game who is not the player.
 *
 * The player is one hand-tuned rig because he is on screen for hours. Everyone
 * else needs to be cheap to invent, consistent with each other, and still
 * alive: Pani Natalia mopping the landing, Pan Marek by the Octavia, the
 * babcia on the bench, the trainer who has opinions about your hips. This file
 * is what makes a new one cost twelve lines instead of two hundred.
 *
 * Three ideas hold it together:
 *
 *   1. NOTHING IS HAND-TYPED. Every part is emitted by a row helper, so a map
 *      is always exactly 24 columns and 38 rows and no pixel is ever off by
 *      one. Adding a hairstyle or a prop is adding a small function, not
 *      counting dots in a string literal.
 *
 *   2. APPEARANCE IS PALETTE, NOT ART. Skin, hair, top, bottom, shoes, accent
 *      and props are palette zones with named ramps — `top: "teal"` rather
 *      than a hex. One body, one set of poses, an unlimited cast. Shade tones
 *      are derived, so a new colour is one line.
 *
 *   3. TWO PROJECTIONS, ONE CONTRACT. Front for standing, talking, working —
 *      which is what NPCs do — and profile for walking. Both are drawn on the
 *      same 24x38 grid with the same row contract as the player (head 0-6,
 *      torso 7-19, legs 20-37), so an NPC and the player stand on the same
 *      floor line and share pose vocabulary.
 *
 * The result is a PlayerConfig, so an NPC can be handed to the runtime's actor
 * system, rendered statically in a scene, or driven by NpcActor — plus the
 * metadata that makes them a person: name, idle behaviour, and what they do
 * when you talk to them.
 */

// ---------------------------------------------------------------------------
// palette zones
// ---------------------------------------------------------------------------

/**
 * The zones every NPC frame is painted in. Shared letters with the player's
 * rig where they mean the same thing, so poses can be lifted between them.
 *
 *   s S y   skin, shade, highlight        h H   hair, shade
 *   e       eye                           f F   beard, shade
 *   t T     top garment, shade            a A   accent (apron, kerchief, vest)
 *   p q     trousers/skirt, shade         b B   shoes, soles
 *   k K     hat, shade                    c n   prop light, prop dark
 *   o       something warm (an ember, a lit screen)
 */
// ---------------------------------------------------------------------------
// the body: head, torso, legs
// ---------------------------------------------------------------------------

export type NpcBuild = Build;
export type NpcHeight = Height;

/**
 * The torso: trapezius out of the neck, the shoulders at their widest for four
 * rows, then the taper to the waist. Fifteen rows, ending above the hips —
 * the legs own the hips, so nothing overlaps.
 */
/**
 * Form shadow: a second shade column inboard of the lit edge, the shadow the
 * chin throws on the chest, and a dark seam where each arm meets the body.
 * Three cheap passes, and a flat rectangle becomes a torso with a front and
 * two sides.
 */
/**
 * Three planes, not two. The old pass added a shaded flank to a flat rectangle
 * of cloth, which gives a body an edge but no front — the reason a torso read
 * as a coloured card with a dark stripe down one side.
 *
 * The light in every scene comes from the left, so a chest has a lit plane
 * turning toward it, a base plane facing the viewer and a flank falling away
 * on the right. `l`, `t`, `T`: the same cloth, three times, and that is what a
 * garment made of cloth looks like.
 *
 * Then the occlusion, which is what actually sells it: the shadow the jaw
 * throws down the chest, and the dark seam where each arm meets the body. Both
 * are painted in `d`, a fixed cool near-black, because a shadow is the absence
 * of light rather than a darker version of a jumper.
 */
function shadeTorso(map: SpriteMap, build: NpcBuild): string[] {
  const { sh } = anatomy(build);
  const litFrom = CENTRE - sh + 1;
  const litTo = CENTRE - sh + 2;
  const flankFrom = CENTRE + sh - 3;
  const flankTo = CENTRE + sh - 2;
  return map.map((r, y) => {
    const cells = [...r];
    const swap = (x: number, from: string, to: string) => {
      if (cells[x] === from) cells[x] = to;
    };
    for (let x = litFrom; x <= litTo; x++) swap(x, "t", "l");
    for (let x = flankFrom; x <= flankTo; x++) swap(x, "t", "T");
    // the shadow the chin throws onto the chest, over the first two rows
    if (y <= 1) for (let x = CENTRE - 2; x <= CENTRE + 1; x++) swap(x, "t", "d");
    // and the seam where the sleeve meets the shoulder, in the garment's own
    // shade rather than in occlusion black — a hard black pixel on the edge of
    // a jacket reads as a hole punched in it
    if (y <= 1) {
      swap(CENTRE - sh, "t", "T");
      swap(CENTRE + sh - 1, "t", "T");
    }
    return cells.join("");
  });
}

function torsoFront(build: NpcBuild): SpriteMap {
  const { sh, wa } = anatomy(build);
  const rows: string[] = [];
  rows.push(shell(CENTRE, sh - 2, "t", "T"));
  for (let i = 0; i < 5; i++) rows.push(shell(CENTRE, sh, "t", "T"));
  rows.push(shell(CENTRE, sh - 1, "t", "T"));
  rows.push(shell(CENTRE, sh - 1, "t", "T"));
  for (let i = 0; i < 3; i++) rows.push(shell(CENTRE, wa + 1, "t", "T"));
  for (let i = 0; i < 4; i++) rows.push(shell(CENTRE, wa, "t", "T"));
  return rows.slice(0, TORSO_ROWS);
}

function torsoProfile(build: NpcBuild): SpriteMap {
  const { sh, wa } = anatomy(build);
  const half = Math.max(3, sh - 2);
  const hip = Math.max(3, wa - 1);
  const rows: string[] = [];
  rows.push(shell(CENTRE, half - 1, "t", "T"));
  for (let i = 0; i < 8; i++) rows.push(shell(CENTRE, half, "t", "T"));
  for (let i = 0; i < 3; i++) rows.push(shell(CENTRE, hip + 1, "t", "T"));
  for (let i = 0; i < 3; i++) rows.push(shell(CENTRE, hip, "t", "T"));
  return rows.slice(0, TORSO_ROWS);
}

/** Hips, thighs, shins, ankles, shoes — sixteen rows, feet on the floor line. */
function legs(build: NpcBuild, opts: { gap?: number; stride?: number } = {}): SpriteMap {
  const { wa, legW } = anatomy(build);
  const stride = opts.stride ?? 0;
  const spread = opts.gap ?? 0;
  const L = CENTRE - wa - spread;
  const R = CENTRE + wa - legW + spread;
  const rows: string[] = [];
  rows.push(shell(CENTRE, wa, "p", "q"));
  rows.push(shell(CENTRE, wa, "p", "q"));
  // the near leg catches the light down its outer edge; the far one is a
  // whole leg in shadow, which is what makes two legs read as two legs
  const near = (w: number) => `m${"p".repeat(Math.max(0, w - 2))}q`;
  for (let i = 0; i < 5; i++) rows.push(row([L, near(legW)], band(R, legW, "q")));
  for (let i = 0; i < 6; i++) {
    const lean = Math.round((stride * (i + 1)) / 6);
    rows.push(row([L - lean, near(legW)], band(R + lean, legW, "q")));
  }
  rows.push(row(band(L - stride, legW, "s"), band(R + stride, legW, "s")));
  rows.push(row(band(L - stride - 1, legW + 1, "b"), band(R + stride, legW + 1, "b")));
  rows.push(row(band(L - stride - 1, legW + 1, "B"), band(R + stride, legW + 1, "B")));
  return rows.slice(0, LEG_ROWS);
}

/**
 * Where the two legs are on a given row of the legs part — which depends on the
 * stride, because a striding leg leans further out the closer you get to the
 * foot. Every trouser seam, boot shaft and turn-up asks this rather than
 * assuming the legs are where they were when the person stood still.
 */
function legColumns(build: NpcBuild, r: number, opts: { gap?: number; stride?: number } = {}) {
  const { wa, legW } = anatomy(build);
  const stride = opts.stride ?? 0;
  const spread = opts.gap ?? 0;
  const shin = r >= 7 && r <= 12 ? Math.round((stride * (r - 6)) / 6) : r >= 13 ? stride : 0;
  return {
    legW,
    L: CENTRE - wa - spread - shin,
    R: CENTRE + wa - legW + spread + shin,
  };
}

/**
 * Legs seen edge-on, for the walk. A profile body is narrow, so the two legs
 * sit almost on top of each other at the hip and separate only at the feet:
 * the near one swings forward, the far one trails behind in shade. Pairing
 * front-view legs with a profile torso was what made the old walk read as a
 * person sliding sideways.
 */
function legsProfile(
  build: NpcBuild,
  opts: { stride?: number; bareFrom?: number } = {},
): SpriteMap {
  const { wa, legW } = anatomy(build);
  const stride = opts.stride ?? 0;
  const hip = Math.max(3, wa - 1);
  const x = CENTRE - Math.floor(legW / 2);
  /** below the hem there is leg, not cloth — a runner in shorts has shins */
  const bare = opts.bareFrom ?? Number.POSITIVE_INFINITY;
  const near = (r: number) => (r >= bare ? "s" : "p");
  const far = (r: number) => (r >= bare ? "S" : "q");
  const rows: string[] = [];
  rows.push(shell(CENTRE, hip, "p", "q"));
  rows.push(shell(CENTRE, hip, "p", "q"));
  // thighs: still together
  for (let i = 0; i < 4; i++) {
    const lean = Math.round((stride * (i + 1)) / 8);
    const r = i + 2;
    rows.push(row(band(x - lean, legW, far(r)), band(x + lean, legW, near(r))));
  }
  // shins: the swing opens up
  for (let i = 0; i < 7; i++) {
    const lean = Math.round((stride * (i + 5)) / 8);
    const r = i + 6;
    rows.push(row(band(x - lean, legW, far(r)), band(x + lean, legW, near(r))));
  }
  const toe = Math.round(stride);
  rows.push(row(band(x - toe, legW, "S"), band(x + toe, legW, "s")));
  rows.push(row(band(x - toe - 1, legW + 1, "B"), band(x + toe, legW + 2, "b")));
  rows.push(row(band(x - toe - 1, legW + 1, "B"), band(x + toe, legW + 2, "B")));
  return rows.slice(0, LEG_ROWS);
}

/**
 * How many rows a seated body occupies below the hips. A bench seat in this
 * country is 0.45 m off the ground; at 38 px to the metre and two scene px to
 * the row that is nine rows, thigh to sole. The old block was sixteen — a bar
 * stool — which is why everybody on a bench looked like they were hovering
 * over it with their knees somewhere under the pavement.
 *
 * The whole seated figure is therefore shorter than the standing one, and
 * `NpcActor` grounds a sprite by the frame it is actually showing rather than
 * by the character's standing height. Sit down and your head comes down 0.4 m,
 * which is what sitting down is.
 */
export const SIT_ROWS = 9;

/** Sitting: thighs forward off the hips, shins down, soles flat on the ground. */
function legsSit(build: NpcBuild): SpriteMap {
  const { wa, legW } = anatomy(build);
  /** the thigh runs forward from the hip; the knee is where it stops */
  const knee = CENTRE + wa + 1;
  const shinX = knee - legW + 1;
  const rows: string[] = [];
  const thigh = knee - (CENTRE - wa) + 1;
  // the seat: hips spread on the plank, then the thigh out to the knee
  rows.push(row(band(CENTRE - wa, thigh, "p")));
  rows.push(row(band(CENTRE - wa, thigh, "p")));
  rows.push(row(band(CENTRE - wa, thigh, "q")));
  // both shins drop from the knee — four rows is 0.21 m, a real lower leg. The
  // far one is a shade back and a pixel clear, so the pair reads as two legs
  // rather than as the pedestal of a statue.
  const farX = shinX - legW - 1;
  for (let i = 0; i < 4; i++) {
    rows.push(row(band(farX, legW, "q"), band(shinX, legW, i === 3 ? "q" : "p")));
  }
  rows.push(row(band(farX, legW, "S"), band(shinX, legW, "s")));
  rows.push(row(band(farX - 1, legW + 1, "B"), band(shinX, legW + 1, "B")));
  return rows.slice(0, SIT_ROWS);
}

// ---------------------------------------------------------------------------
// hair, hats, faces
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// clothes — structure, not just colour
// ---------------------------------------------------------------------------

export type NpcTop =
  | "tshirt"
  | "shirt"
  | "jumper"
  | "hoodie"
  | "jacket"
  | "coat"
  | "dress"
  | "tracksuit"
  | "overalls"
  | "tank";

export type NpcBottom = "trousers" | "jeans" | "skirt" | "shorts" | "workpants" | "tracksuit";

export type NpcShoes = "shoes" | "boots" | "trainers" | "sandals" | "heels";

/** Sleeve length by garment — it decides where cloth stops and skin starts. */
const SLEEVE: Record<NpcTop, "short" | "long" | "bare"> = {
  tshirt: "short",
  shirt: "long",
  jumper: "long",
  hoodie: "long",
  jacket: "long",
  coat: "long",
  dress: "short",
  tracksuit: "long",
  overalls: "short",
  tank: "bare",
};

/**
 * What a garment adds on top of a plain body: a collar, a placket of buttons,
 * a hem, a hood behind the neck. Drawn in torso-local rows.
 */
function topDetail(kind: NpcTop, build: NpcBuild): Patch[] {
  const { sh, wa } = anatomy(build);
  const out: Patch[] = [];
  /** A collar: a band across the trapezius, opening into a V at the throat. */
  const collar = (zone: string): Patch => ({
    r: 0,
    c: CENTRE - 3,
    rows: [zone.repeat(6), `.${zone}ss${zone}.`],
  });
  switch (kind) {
    case "shirt":
      out.push(collar("T"));
      // the placket, and three buttons down it
      out.push({ r: 1, c: CENTRE - 1, rows: ["T.", "T.", "T.", "T.", "T.", "T.", "T.", "T."] });
      out.push({ r: 2, c: CENTRE, rows: ["c"] }, { r: 5, c: CENTRE, rows: ["c"] });
      out.push({ r: 8, c: CENTRE, rows: ["c"] });
      break;
    case "jumper":
      out.push(collar("T"));
      // a ribbed hem at the waist
      out.push({ r: 13, c: CENTRE - wa, rows: ["T".repeat(wa * 2)] });
      break;
    case "hoodie":
      // the hood, bunched behind the neck, and a kangaroo pocket
      out.push({ r: 0, c: CENTRE - 4, rows: ["TTTTTTTT", ".TTTTTT."] });
      out.push({ r: 9, c: CENTRE - 3, rows: ["TTTTTT", "T....T"] });
      break;
    case "jacket":
      out.push(collar("T"));
      out.push({ r: 1, c: CENTRE - 3, rows: ["TT..TT", "TT..TT", ".T..T."] });
      out.push({ r: 1, c: CENTRE, rows: ["T", "T", "T", "T", "T", "T", "T", "T", "T", "T"] });
      break;
    case "coat":
      out.push({ r: 0, c: CENTRE - 4, rows: ["TTTTTTTT"] });
      out.push({ r: 1, c: CENTRE, rows: Array.from({ length: 13 }, () => "T") });
      out.push({ r: 3, c: CENTRE + 1, rows: ["c"] }, { r: 7, c: CENTRE + 1, rows: ["c"] });
      break;
    case "dress":
      // the skirt flares past the waist
      out.push({ r: 11, c: CENTRE - wa - 1, rows: ["a".repeat(wa * 2 + 2)] });
      out.push({ r: 12, c: CENTRE - wa - 1, rows: ["a".repeat(wa * 2 + 2)] });
      out.push({ r: 13, c: CENTRE - wa - 2, rows: ["a".repeat(wa * 2 + 4)] });
      out.push({ r: 14, c: CENTRE - wa - 2, rows: ["A".repeat(wa * 2 + 4)] });
      break;
    case "tracksuit":
      // two stripes down the sleeves' seams
      out.push({ r: 1, c: CENTRE - sh, rows: Array.from({ length: 6 }, () => "a") });
      out.push({ r: 1, c: CENTRE + sh - 1, rows: Array.from({ length: 6 }, () => "a") });
      out.push(collar("T"));
      break;
    case "overalls":
      // bib and straps over a bare shoulder
      out.push({ r: 0, c: CENTRE - 3, rows: ["a....a", "a....a"] });
      out.push({ r: 5, c: CENTRE - wa, rows: ["a".repeat(wa * 2)] });
      out.push({ r: 6, c: CENTRE - wa, rows: ["a".repeat(wa * 2)] });
      out.push({ r: 7, c: CENTRE - 2, rows: ["A".repeat(4)] });
      break;
    case "tank":
      out.push({ r: 0, c: CENTRE - 4, rows: ["ss....ss", "ss....ss"] });
      break;
    default:
      out.push(collar("T"));
  }
  return out;
}

/** What the legs wear: a hem, a seam, the shape of a skirt. */
function bottomDetail(
  kind: NpcBottom,
  build: NpcBuild,
  stance: { gap?: number; stride?: number } = {},
): Patch[] {
  const { wa } = anatomy(build);
  const out: Patch[] = [];
  const at = (r: number) => legColumns(build, r, stance);
  switch (kind) {
    case "jeans":
      // a seam down the near leg and a turn-up at the ankle
      // a seam down the near leg and a turn-up at the ankle, both following it
      for (let r = 2; r <= 10; r++) out.push({ r, c: at(r).L + 1, rows: ["q"] });
      out.push({ r: 12, c: at(12).L, rows: ["q".repeat(at(12).legW)] });
      break;
    case "skirt":
      out.push({ r: 0, c: CENTRE - wa - 1, rows: ["p".repeat(wa * 2 + 2)] });
      out.push({ r: 1, c: CENTRE - wa - 1, rows: ["p".repeat(wa * 2 + 2)] });
      out.push({ r: 2, c: CENTRE - wa - 2, rows: ["p".repeat(wa * 2 + 4)] });
      out.push({ r: 3, c: CENTRE - wa - 2, rows: ["q".repeat(wa * 2 + 4)] });
      break;
    case "shorts":
      // the trouser stops at mid-thigh; below it is leg
      out.push({ r: 4, c: at(4).L, rows: ["q".repeat(at(4).legW)] });
      out.push({ r: 4, c: at(4).R, rows: ["q".repeat(at(4).legW)] });
      for (let r = 5; r < 11; r++) {
        const { L, R, legW: w } = at(r);
        out.push({ r, c: L, rows: ["s".repeat(w)] });
        out.push({ r, c: R, rows: ["S".repeat(w)] });
      }
      break;
    case "workpants":
      // a pocket on the thigh, because that is what work trousers are
      for (let r = 4; r <= 6; r++) out.push({ r, c: at(r).L, rows: ["qq"] });
      break;
    case "tracksuit":
      for (let r = 0; r <= 11; r++) out.push({ r, c: at(r).L, rows: ["a"] });
      break;
    default:
      break;
  }
  return out;
}

/** Footwear, drawn over the last three rows of the legs. */
function shoeDetail(
  kind: NpcShoes,
  build: NpcBuild,
  stance: { gap?: number; stride?: number } = {},
): Patch[] {
  /** the shoe rows, and where the feet actually are on each of them */
  const foot = (r: number) => {
    const { L, R, legW } = legColumns(build, r, stance);
    return { L: L - 1, R, w: legW + 1, legW };
  };
  switch (kind) {
    case "boots":
      // the shaft climbs the last three rows of the shin
      return [11, 12, 13].flatMap((r) => {
        const f = foot(r);
        return [
          { r, c: f.L + 1, rows: ["b".repeat(f.legW)] },
          { r, c: f.R, rows: ["b".repeat(f.legW)] },
        ];
      });
    case "trainers": {
      // a pale sole, which is the whole point of a trainer
      const f = foot(15);
      return [
        { r: 15, c: f.L, rows: ["c".repeat(f.w)] },
        { r: 15, c: f.R, rows: ["c".repeat(f.w)] },
      ];
    }
    case "heels": {
      const f = foot(15);
      return [
        { r: 15, c: f.L, rows: [`${"B".repeat(f.w - 1)}.`] },
        { r: 15, c: f.R, rows: [`.${"B".repeat(f.w - 1)}`] },
      ];
    }
    case "sandals": {
      const f = foot(13);
      return [
        { r: 13, c: f.L + 1, rows: ["s".repeat(f.legW)] },
        { r: 13, c: f.R, rows: ["s".repeat(f.legW)] },
      ];
    }
    default:
      return [];
  }
}

export type NpcAccent =
  | "none"
  | "apron"
  | "vest"
  | "scarf"
  | "tie"
  | "shawl"
  | "lanyard"
  | "backpack"
  | "belt";

function accentPatchFor(kind: Exclude<NpcAccent, "none">, build: NpcBuild): Patch[] {
  const { sh, wa } = anatomy(build);
  const bodyW = sh * 2;
  const waistW = wa * 2;
  switch (kind) {
    case "apron":
      return [
        { r: 3, c: CENTRE - 2, rows: ["aaaa"] },
        {
          r: 8,
          c: CENTRE - wa,
          rows: Array.from({ length: 7 }, (_, i) =>
            i === 6 ? "A".repeat(waistW) : "a".repeat(waistW),
          ),
        },
      ];
    case "vest":
      // a tabard: across the chest, open down the middle, with the two
      // reflective bands that make hi-vis read as hi-vis at any size
      return [
        {
          r: 1,
          c: CENTRE - sh + 1,
          rows: Array.from({ length: 10 }, () => "a".repeat(Math.max(2, bodyW - 2))),
        },
        { r: 1, c: CENTRE, rows: Array.from({ length: 10 }, () => "A") },
        { r: 4, c: CENTRE - sh + 1, rows: ["c".repeat(Math.max(2, bodyW - 2))] },
        { r: 8, c: CENTRE - sh + 1, rows: ["c".repeat(Math.max(2, bodyW - 2))] },
      ];
    case "scarf":
      return [
        { r: 0, c: CENTRE - wa, rows: ["a".repeat(waistW), `.${"a".repeat(waistW - 2)}.`] },
        { r: 2, c: CENTRE + 1, rows: ["aa", "aa", "aA"] },
      ];
    case "tie":
      return [{ r: 1, c: CENTRE - 1, rows: ["aa", "aa", "aa", "aa", "aa", "AA"] }];
    case "shawl":
      return [
        {
          r: 0,
          c: CENTRE - sh,
          rows: ["a".repeat(bodyW), "a".repeat(bodyW), `.${"a".repeat(bodyW - 2)}.`],
        },
        { r: 3, c: CENTRE - 2, rows: ["Aaaa"] },
      ];
    case "lanyard":
      return [
        { r: 0, c: CENTRE - 2, rows: ["a...a", ".a.a.", "..a.."] },
        { r: 3, c: CENTRE - 1, rows: ["cc", "cc"] },
      ];
    case "backpack":
      return [
        {
          r: 1,
          c: CENTRE - sh,
          rows: Array.from({ length: 8 }, () => `a${".".repeat(bodyW - 2)}a`),
        },
        { r: 1, c: CENTRE + sh, rows: Array.from({ length: 8 }, () => "a") },
        { r: 9, c: CENTRE + sh, rows: ["A"] },
      ];
    case "belt":
      return [
        { r: 12, c: CENTRE - wa, rows: ["a".repeat(waistW)] },
        { r: 12, c: CENTRE, rows: ["c"] },
      ];
  }
}

export type NpcTexture = "none" | "stripe" | "pinstripe" | "check" | "knit" | "worn" | "flecked";

/**
 * Texture, applied by flipping lit pixels to their shade *inside* the garment.
 *
 * Drawing a stripe as a patch would paint over the silhouette; instead this
 * walks the map and only touches pixels that are already the zone it is
 * texturing, so a check stops at the seam and a hem stays a hem. Every pattern
 * is a pure function of x and y, so a person looks the same on every frame
 * rather than shimmering as they move.
 */
function texturize(map: SpriteMap, kind: NpcTexture, from: string, to: string): string[] {
  if (kind === "none") return [...map];
  const hit = (x: number, y: number) => {
    switch (kind) {
      case "stripe":
        return y % 3 === 0;
      case "pinstripe":
        return x % 3 === 0;
      case "check":
        return x % 4 === 0 && y % 2 === 0;
      case "knit":
        // every fourth pixel on alternating rows: a weave you feel rather than count
        return y % 2 === 0 && (x + y) % 4 === 0;
      case "worn":
        // deterministic scatter: the same threads are always the worn ones
        return (x * 7 + y * 13) % 11 === 0;
      case "flecked":
        return (x * 5 + y * 3) % 7 === 0;
      default:
        return false;
    }
  };
  return map.map((r, y) => [...r].map((ch, x) => (ch === from && hit(x, y) ? to : ch)).join(""));
}

// ---------------------------------------------------------------------------
// props — placed in the hand the pose puts them in
// ---------------------------------------------------------------------------

export type NpcProp =
  | "none"
  | "mop"
  | "broom"
  | "bag"
  | "shopping"
  | "phone"
  | "cigarette"
  | "newspaper"
  | "cane"
  | "coffee"
  | "clipboard"
  | "umbrella"
  | "flowers"
  | "keys"
  | "bottle";

/**
 * A prop is drawn from the hand that holds it, so it follows the pose rather
 * than floating where a patch happened to be written. Floor tools run down to
 * the floor line; carried things hang; held things sit at the hand.
 */
function propCells(
  kind: Exclude<NpcProp, "none">,
  a: Anatomy,
  hand: { x: number; y: number },
): Cell[] {
  const floor = a.floorY;
  switch (kind) {
    case "mop":
      return [
        ...stroke(hand.x, hand.y - 6, hand.x, floor - 2, "n", 1),
        { x: hand.x - 1, y: floor - 1, z: "c" },
        { x: hand.x, y: floor - 1, z: "c" },
        { x: hand.x + 1, y: floor - 1, z: "c" },
        { x: hand.x - 1, y: floor, z: "c" },
        { x: hand.x, y: floor, z: "n" },
        { x: hand.x + 1, y: floor, z: "c" },
      ];
    case "broom":
      return [
        ...stroke(hand.x, hand.y - 6, hand.x, floor - 1, "n", 1),
        { x: hand.x - 1, y: floor, z: "n" },
        { x: hand.x, y: floor, z: "c" },
        { x: hand.x + 1, y: floor, z: "n" },
      ];
    case "cane":
      return stroke(hand.x, hand.y, hand.x + 1, floor, "n", 1);
    case "umbrella":
      return [
        ...stroke(hand.x, hand.y - 2, hand.x, floor, "n", 1),
        { x: hand.x - 2, y: hand.y - 3, z: "c" },
        { x: hand.x - 1, y: hand.y - 3, z: "c" },
        { x: hand.x, y: hand.y - 3, z: "c" },
        { x: hand.x + 1, y: hand.y - 3, z: "c" },
        { x: hand.x + 2, y: hand.y - 3, z: "c" },
      ];
    case "bag":
      return [
        { x: hand.x, y: hand.y + 1, z: "n" },
        { x: hand.x + 2, y: hand.y + 1, z: "n" },
        ...[2, 3, 4, 5].flatMap((dy) =>
          [0, 1, 2].map((dx) => ({ x: hand.x + dx, y: hand.y + dy, z: dy === 5 ? "n" : "c" })),
        ),
      ];
    case "shopping":
      return [
        { x: hand.x, y: hand.y + 1, z: "n" },
        { x: hand.x + 2, y: hand.y + 1, z: "n" },
        ...[2, 3, 4, 5, 6].flatMap((dy) =>
          [0, 1, 2].map((dx) => ({
            x: hand.x + dx,
            y: hand.y + dy,
            z: dy === 3 && dx === 1 ? "n" : "c",
          })),
        ),
      ];
    case "phone":
      return [
        { x: hand.x, y: hand.y - 1, z: "n" },
        { x: hand.x + 1, y: hand.y - 1, z: "n" },
        { x: hand.x, y: hand.y, z: "c" },
        { x: hand.x + 1, y: hand.y, z: "c" },
      ];
    case "coffee":
      return [
        { x: hand.x, y: hand.y - 2, z: "c" },
        { x: hand.x + 1, y: hand.y - 2, z: "c" },
        { x: hand.x, y: hand.y - 1, z: "c" },
        { x: hand.x + 1, y: hand.y - 1, z: "n" },
      ];
    case "bottle":
      return [
        { x: hand.x, y: hand.y - 4, z: "n" },
        { x: hand.x, y: hand.y - 3, z: "c" },
        { x: hand.x, y: hand.y - 2, z: "c" },
        { x: hand.x + 1, y: hand.y - 2, z: "c" },
        { x: hand.x, y: hand.y - 1, z: "c" },
        { x: hand.x + 1, y: hand.y - 1, z: "c" },
      ];
    case "newspaper":
    case "clipboard":
      return [0, 1, 2, 3].flatMap((dy) =>
        [0, 1, 2].map((dx) => ({
          x: hand.x + dx - 1,
          y: hand.y + dy - 2,
          z: (dy === 1 && dx === 1) || (kind === "clipboard" && dy === 0) ? "n" : "c",
        })),
      );
    case "cigarette":
      return [
        { x: hand.x + 1, y: hand.y, z: "c" },
        { x: hand.x + 2, y: hand.y, z: "o" },
      ];
    case "keys":
      return [
        { x: hand.x, y: hand.y + 1, z: "n" },
        { x: hand.x, y: hand.y + 2, z: "c" },
        { x: hand.x + 1, y: hand.y + 2, z: "c" },
      ];
    case "flowers":
      return [
        ...stroke(hand.x, hand.y - 4, hand.x, hand.y, "n", 1),
        { x: hand.x - 1, y: hand.y - 5, z: "a" },
        { x: hand.x, y: hand.y - 6, z: "a" },
        { x: hand.x + 1, y: hand.y - 5, z: "a" },
        { x: hand.x, y: hand.y - 5, z: "c" },
      ];
  }
}

/** Which hand pose a prop wants, so the arm and the object agree. */
const PROP_ARM: Partial<Record<NpcProp, ArmPose>> = {
  mop: ARM.workLow,
  broom: ARM.workLow,
  cane: ARM.carry,
  umbrella: ARM.carry,
  bag: ARM.carry,
  shopping: ARM.carry,
  phone: ARM.toFace,
  coffee: ARM.hold,
  bottle: ARM.hold,
  newspaper: ARM.hold,
  clipboard: ARM.hold,
  cigarette: ARM.toFace,
  keys: ARM.rest,
  flowers: ARM.hold,
};

// ---------------------------------------------------------------------------
// the spec
// ---------------------------------------------------------------------------

export interface NpcLook {
  skin?: SkinName;
  hair?: HairName;
  hairStyle?: NpcHairStyle;
  /** eye colour — a named fabric or a hex, because eyes are not cloth */
  eyes?: FabricName | string;
  /** the skull: crown, cheek, jaw and chin. Left out, it comes from the id. */
  head?: NpcHeadShape;
  brow?: NpcBrow;
  eyeShape?: NpcEyeShape;
  nose?: NpcNose;
  mouth?: NpcMouth;
  ears?: NpcEars;
  /** anything worn or grown on the face; one, or as many as you like */
  face?: NpcFace | readonly NpcFace[];
  hat?: NpcHat;
  hatColour?: FabricName;
  /** the garment, which decides sleeves, collar, hem and silhouette */
  top?: NpcTop;
  topColour?: FabricName;
  bottom?: NpcBottom;
  bottomColour?: FabricName;
  shoes?: NpcShoes;
  shoeColour?: FabricName;
  /** the weave of the cloth: stripe, check, knit, worn */
  texture?: NpcTexture;
  accent?: NpcAccent;
  accentColour?: FabricName;
  prop?: NpcProp;
  propColour?: FabricName;
}

export interface NpcReactions {
  onTalk?: string;
  onNotice?: string;
  idle?: string;
}

export interface NpcSpec {
  id: string;
  name: string;
  build?: NpcBuild;
  height?: NpcHeight;
  look?: NpcLook;
  doing?:
    | "standing"
    | "working"
    | "sitting"
    | "leaning"
    | "smoking"
    | "waiting"
    | "walking"
    | "serving"
    | "running"
    | "lifting"
    | "washing"
    | "phoning";
  reactions?: NpcReactions;
  lines?: readonly string[];
  palette?: SpritePalette;
  cell?: number;
  walkSpeed?: number;
}

export interface NpcConfig extends PlayerConfig {
  id: string;
  name: string;
  idleAction: string;
  reactions: Required<NpcReactions>;
  lines: readonly string[];
  look: NpcLook;
}

// ---------------------------------------------------------------------------
// palette
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// the builder
// ---------------------------------------------------------------------------

type Frames = Parameters<Parameters<CharacterBuilder["frame"]>[1]>[0];

function applyPatches(map: SpriteMap, patches: readonly (Patch | null | undefined)[]): string[] {
  let out = [...map];
  for (const p of patches) if (p) out = patchInto(out, p);
  return out;
}

function patchInto(map: SpriteMap, patch: Patch): string[] {
  const out = map.map((r) => r.split(""));
  patch.rows.forEach((prow, dr) => {
    [...prow].forEach((ch, dc) => {
      if (ch === "." || ch === " ") return;
      const rr = patch.r + dr;
      const cc = patch.c + dc;
      if (out[rr] && cc >= 0 && cc < out[rr].length) out[rr][cc] = ch;
    });
  });
  return out.map((r) => r.join(""));
}

/** Drop the head into the shoulders — bending over something. */
function bow(map: SpriteMap, depth = 1): string[] {
  const empty = ".".repeat(W);
  return [
    ...Array.from({ length: depth }, () => empty),
    ...map.slice(0, HEAD_ROWS - depth),
    ...map.slice(HEAD_ROWS),
  ];
}

/** Lift the chin. */
function raiseChin(map: SpriteMap): string[] {
  return [...map.slice(1, HEAD_ROWS), ".".repeat(W), ...map.slice(HEAD_ROWS)];
}

/** The one-pixel settle: everything above the hips drops, the legs stay put. */
function breathe(map: SpriteMap, depth = 1): string[] {
  const empty = ".".repeat(W);
  const hips = HEAD_ROWS + TORSO_ROWS;
  return [
    ...Array.from({ length: depth }, () => empty),
    ...map.slice(0, hips - depth),
    ...map.slice(hips),
  ];
}

/**
 * The upper body rises a pixel over the hips — the top of a walk's pass frame,
 * where both feet are under the body and the whole person is at their tallest.
 * The inverse of the breath, and between them a cycle gets its bounce.
 */
function rise(map: SpriteMap): string[] {
  const hips = HEAD_ROWS + TORSO_ROWS;
  return [...map.slice(1, hips), map[hips - 1], ...map.slice(hips)];
}

/** Shift the whole figure sideways — a lean, a sway, a stagger. */
function sway(map: SpriteMap, dx: number): string[] {
  if (dx === 0) return [...map];
  return map.map((r) =>
    dx > 0 ? ".".repeat(dx) + r.slice(0, W - dx) : r.slice(-dx) + ".".repeat(-dx),
  );
}

/** Turn the head only. */
function mirrorHead(map: SpriteMap): string[] {
  return map.map((r, i) => (i <= HEAD_ROWS - 1 ? [...r].reverse().join("") : r));
}

/** Take rows out of the shins and give them back above the head. */
function shorten(map: SpriteMap, n: number): string[] {
  if (n <= 0) return [...map];
  const empty = ".".repeat(W);
  const painted = (r: string) => /[^.]/.test(r);
  // A seated frame is shorter than a standing one — the builder pads it out
  // with blank rows underneath — and it is grounded on its lowest painted
  // pixel. Everybody's hips end up on the same plank whatever their legs are
  // like, so a short person seated is short in the *trunk*: the rows come out
  // of the waist, the head comes down with them and the seat does not move.
  if (map.length && !painted(map[map.length - 1])) {
    const take = Math.min(n, 2);
    const seated = [...map];
    seated.splice(HEAD_ROWS + 8, take);
    return [...seated, ...Array.from({ length: take }, () => empty)];
  }
  const cut = HEAD_ROWS + TORSO_ROWS + 8;
  const out = [...map];
  out.splice(cut, n);
  return [...Array.from({ length: n }, () => empty), ...out];
}

/**
 * Build one person.
 *
 * The order matters: the body is assembled from parts, the garment details are
 * patched onto it, and only then do the arms go on — because an arm is drawn
 * over the sleeve it comes out of, and a hand is drawn over whatever it holds.
 */
/**
 * Colours that belong to an action rather than to a wardrobe. These are
 * applied over the top of `npcPalette`, deliberately: the palette carries a
 * flat `w` for breath on a cold morning, and smoke needs to be translucent or
 * it hides the face it drifts across. Smoke is not a
 * garment and water is not a prop, so neither has any business in the palette
 * a character spec chooses from — but both have to be somewhere, and a frame
 * can only paint zones the palette knows about.
 *
 * All three are translucent. A plume of smoke that hides the face behind it is
 * a cloud; one you can read a face through is smoke.
 */
const FX_ZONES = {
  /**
   * Smoke, in two tones — a pale core and a *darker* rim, not a paler one.
   * A plume made only of translucent white vanishes against a sunlit wall and
   * a plume made only of grey vanishes against a stairwell at night; scenes in
   * this game are both. Giving it a light core and a dark edge means one of
   * the two always has contrast, whatever it is drifting across.
   */
  w: "#f2eee6e6",
  W: "#5f584ec0",
  /** water on a floor, and what runs off a mop when it comes out of a bucket */
  v: "#9fc4d0cc",
} as const;

export function createNpc(spec: NpcSpec): NpcConfig {
  const build = spec.build ?? "regular";
  const height = spec.height ?? "average";
  const look = spec.look ?? {};
  const doing = spec.doing ?? "standing";
  const palette = { ...npcPalette(look), ...FX_ZONES, ...(spec.palette ?? {}) };
  const a = anatomy(build);
  const sleeve = SLEEVE[look.top ?? "tshirt"];

  const b = createCharacter({ palette, cell: spec.cell ?? 2, walkSpeed: spec.walkSpeed ?? 46 });

  // --- the dressed body ----------------------------------------------------
  /**
   * The face. Anything the spec leaves out is seeded from the id, so a crowd
   * is a crowd of individuals whether or not anybody sat down and described
   * them — and the same id always produces the same person.
   */
  const traits: FaceTraits = faceFor(spec.id, {
    shape: look.head,
    brow: look.brow,
    eyes: look.eyeShape,
    nose: look.nose,
    mouth: look.mouth,
    ears: look.ears,
  });
  const skull = skullOf(traits.shape);
  const features: NpcFace[] = look.face
    ? Array.isArray(look.face)
      ? [...look.face]
      : [look.face as NpcFace]
    : [];

  const geo = faceGeometry(traits);
  const hair = hairCells(look.hairStyle ?? "short", geo);
  const hat = look.hat && look.hat !== "none" ? hatCells(look.hat, geo) : [];
  const accentPatches =
    look.accent && look.accent !== "none" ? accentPatchFor(look.accent, build) : [];

  /**
   * Hair and hats are authored for a skull four columns from the centre. On a
   * long or gaunt head they would hang past the temples like a wig on a peg,
   * so anything on the cranium rows is cut back to the skull it is sitting on
   * plus the one column of overhang that makes hair look like hair.
   */
  /**
   * Hair and hats overhang the skull, and how far they may overhang is not the
   * same all the way down. On the cranium rows an afro or a fedora brim needs
   * two columns of room; below the eye line anything past one column is a wig
   * hanging off the side of a face.
   */
  const clipCrown = (head: SpriteMap) => {
    const half = skull.skull;
    return head.map((line, y) => {
      const over = y <= 1 ? 2 : 1;
      const l = CENTRE - half - over;
      const r = CENTRE + half + over - 1;
      return [...line].map((c, x) => (x < l || x > r ? "." : c)).join("");
    });
  };
  const dress = (head: SpriteMap, view: "front" | "side") => {
    // hair, then the sheen on it, then the hat over both; features on top of
    // all of it, and finally the mouth back on over the features, because a
    // beard grows around a mouth and not across it
    // hair lights its own crown from the shape of the mass, so there is no
    // separate sheen patch to stamp — one used to sit at a fixed column and
    // put a wisp on top of every bald head
    let out = clipCrown(stamp(stamp(head, hair), hat));
    out = stamp(
      out,
      features.flatMap((f) => featureCells(f, traits, view)),
    );
    return features.length > 0 ? stamp(out, mouthCells(traits, view)) : out;
  };
  const texture = look.texture ?? "none";
  /** garment detail, then the weave, then the light — in that order, always. */
  const dressTorso = (torso: SpriteMap) =>
    shadeTorso(
      texturize(
        applyPatches(torso, [...topDetail(look.top ?? "tshirt", build), ...accentPatches]),
        texture,
        "t",
        "T",
      ),
      build,
    );
  const dressLegs = (l: SpriteMap, stance: { gap?: number; stride?: number } = {}) =>
    texturize(
      applyPatches(l, [
        ...bottomDetail(look.bottom ?? "trousers", build, stance),
        ...shoeDetail(look.shoes ?? "shoes", build, stance),
      ]),
      // a fine weave belongs on a jumper, not on a trouser leg
      texture === "knit" || texture === "flecked" ? "none" : texture,
      "p",
      "q",
    );

  /**
   * Garment detail and accents are authored on the front torso, which is twice
   * the width of the profile one. Applied edge-on unchanged they leave the far
   * lapel, the far strap and the far pocket floating in mid-air beside the
   * body. Clipping the dressed profile back to its own silhouette keeps the
   * half of each detail that is genuinely visible and drops the half that is
   * on the other side of the person.
   */
  const dressTorsoSide = (torso: SpriteMap) => {
    const silhouette = torso;
    return dressTorso(torso).map((r, y) =>
      [...r].map((c, x) => (silhouette[y]?.[x] === "." ? "." : c)).join(""),
    );
  };

  b.part("head", dress(headFront(traits), "front"));
  b.part("headSide", dress(headProfile(traits), "side"));
  b.part("torso", dressTorso(torsoFront(build)));
  b.part("torsoSide", dressTorsoSide(torsoProfile(build)));
  b.part("legs", dressLegs(legs(build)));
  b.part("legsApart", dressLegs(legs(build, { gap: 1 }), { gap: 1 }));
  b.part("legsStride", dressLegs(legs(build, { stride: 3 }), { stride: 3 }));
  b.part("legsPass", dressLegs(legs(build, { stride: -1 }), { stride: -1 }));
  // a seated leg is not a standing leg: skirt hems and turn-ups assume a person
  // is upright, so a sitter gets the plain garment and keeps only their shoes
  b.part("legsSit", texturize(legsSit(build), texture === "knit" ? "none" : texture, "p", "q"));
  // a walk in shorts shows shin; anything longer does not
  const bareFrom = look.bottom === "shorts" ? 6 : undefined;
  b.part(
    "legsSideStride",
    texturize(legsProfile(build, { stride: 3, bareFrom }), "none", "p", "q"),
  );
  b.part("legsSidePass", texturize(legsProfile(build, { stride: 0, bareFrom }), "none", "p", "q"));
  // weight on one foot: what a person standing about actually does
  b.part("legsWeight", dressLegs(legs(build, { stride: 1 }), { stride: 1 }));

  // --- limbs, and what they are holding -------------------------------------
  const prop = look.prop && look.prop !== "none" ? look.prop : null;
  const armOpts = { sleeve, cloth: "t", shade: "T", skin: "s" } as const;
  /**
   * The far arm is painted in the shade zones — cloth `T`, skin `S` — because it
   * is on the other side of a body. That one substitution is what stops a figure
   * reading as a paper cut-out: near limb lit, far limb dark, torso between.
   */
  const farArm = { ...armOpts, cloth: "T", shade: "T", skin: "S" } as const;
  /** the same two arms, with the seam that keeps them off the torso */
  const nearSeam = { ...armOpts, seam: "d" } as const;
  const farSeam = { ...farArm, seam: "d" } as const;

  /** Put both arms on a stacked figure, and the prop in the working hand. */
  const withArms =
    (left: ArmPose, right: ArmPose, opts: { carry?: boolean } = {}) =>
    (m: SpriteMap): string[] => {
      const cells: Cell[] = [...arm(a, -1, left, farSeam), ...arm(a, 1, right, nearSeam)];
      let out = stamp(m, cells);
      if (prop && opts.carry !== false) {
        out = stamp(out, propCells(prop, a, handAt(a, 1, right)));
        // the hand goes back on top, so it reads as holding rather than behind
        out = stamp(out, arm(a, 1, right, armOpts).slice(-6));
      }
      return out;
    };

  /** The right arm a prop wants, unless the pose insists otherwise. */
  const holding = (fallback: ArmPose) => (prop ? (PROP_ARM[prop] ?? fallback) : fallback);

  /** Seen edge-on, both arms hang on the centre line rather than at the shoulders. */
  const withSideArms =
    (near: ArmPose, far: ArmPose) =>
    (m: SpriteMap): string[] => {
      // `farArm` and not a local shade: an edge-on far arm is still a far arm,
      // and bare skin needs the darker zone as much as a sleeve does — without
      // it two bare arms in front of a chest merge into one blob of skin.
      let out = stamp(m, arm(a, 1, far, { ...farArm, at: a.shoulderSide - 1 }));
      out = stamp(out, arm(a, 1, near, { ...armOpts, at: a.shoulderSide + 1 }));
      if (prop) {
        out = stamp(out, propCells(prop, a, handAt(a, 1, near, a.shoulderSide + 1)));
        out = stamp(out, arm(a, 1, near, { ...armOpts, at: a.shoulderSide + 1 }).slice(-6));
      }
      return out;
    };

  const front = (legPart: string) => (f: Frames) => f.stack("head", "torso", legPart);
  const side = (legPart: string) => (f: Frames) => f.stack("headSide", "torsoSide", legPart);

  // --- the poses everybody has ----------------------------------------------
  b.frame("stand", (f) => front("legs")(f).map(withArms(ARM.rest, holding(ARM.rest))));
  b.variant("breathe", "stand", (m) => breathe(m));
  b.variant("blink", "stand", (m) => replaceColor(m, "e", "s"));
  b.variant("lookBack", "stand", (m) => mirrorHead(m));
  b.frame("weight", (f) =>
    front("legsWeight")(f)
      .map(withArms(ARM.rest, holding(ARM.rest)))
      .map((m) => sway(m, 1)),
  );
  b.variant("weightB", "weight", (m) => breathe(m));
  b.variant("nod", "stand", (m) => bow(m, 1));
  b.frame("talkA", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.talk)));
  b.frame("talkB", (f) => front("legs")(f).map(withArms(ARM.talkWide, ARM.rest)));
  b.variant("talkC", "talkA", (m) => breathe(m));
  // a head that turns on a stressed word — the tell that someone is listening
  b.variant("talkTilt", "talkB", (m) => mirrorHead(bow(m, 1)));
  b.frame("waveA", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.waveUp)));
  b.frame("waveB", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.waveOut)));
  b.frame("shrug", (f) => front("legs")(f).map(withArms(ARM.shrug, ARM.shrug)));
  b.frame("point", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.point)));
  b.frame("pockets", (f) => front("legs")(f).map(withArms(ARM.pocket, ARM.pocket)));
  b.frame("fold", (f) => front("legsApart")(f).map(withArms(ARM.foldOver, ARM.foldUnder)));
  b.variant("foldB", "fold", (m) => breathe(m));
  b.frame("scratchHead", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.behindHead)));
  b.variant("scratchHeadB", "scratchHead", (m) => mirrorHead(m));
  // --- the vocabulary of small human business -------------------------------
  b.frame("hail", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.hail)));
  b.frame("offer", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.offer)));
  b.frame("count", (f) =>
    front("legs")(f)
      .map(withArms(ARM.count, ARM.count))
      .map((m) => bow(m, 1)),
  );
  b.frame("toMouth", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.toMouth)));
  b.variant("toMouthUp", "toMouth", (m) => raiseChin(m));
  b.frame("checkPhone", (f) =>
    front("legs")(f)
      .map(withArms(ARM.rest, ARM.hold))
      .map((m) => bow(m, 1)),
  );
  b.variant("laughA", "stand", (m) => raiseChin(m));
  b.variant("laughB", "stand", (m) => bow(raiseChin(m), 1));
  b.variant("coughA", "toMouth", (m) => bow(m, 1));
  b.variant("coughB", "toMouth", (m) => bow(m, 2));
  b.variant("lookL", "stand", (m) => mirrorHead(m));
  b.variant("lookR", "weight", (m) => mirrorHead(m));

  // --- walking, in profile ---------------------------------------------------
  b.frame("walkA", (f) => side("legsSideStride")(f).map(withSideArms(ARM.swingFwd, ARM.swingBack)));
  b.frame("walkB", (f) => side("legsSidePass")(f).map(withSideArms(ARM.rest, ARM.rest)));
  b.frame("walkC", (f) => side("legsSideStride")(f).map(withSideArms(ARM.swingBack, ARM.swingFwd)));
  b.variant("walkD", "walkB", (m) => breathe(m));
  // the two pass frames ride a pixel higher: contact low, pass high, which is
  // the whole difference between walking and sliding
  b.variant("walkBUp", "walkB", (m) => rise(m));
  b.variant("walkDUp", "walkD", (m) => rise(m));
  b.frame("standSide", (f) =>
    side("legsSidePass")(f).map(withSideArms(holding(ARM.rest), ARM.rest)),
  );
  b.walkCycle("walkA", "walkBUp", "walkC", "walkDUp");

  // --- what this one is actually doing ---------------------------------------
  const actions: Record<string, ActionDef> = {
    /**
     * Standing about. Twenty seconds of it, because a six-second loop is a
     * loop you can see, and a person you can see looping is a prop.
     *
     * The shape of it: long stretches of nearly nothing — breath, a blink, the
     * weight going from one foot to the other — punctuated by one piece of
     * small business. Nobody stands still, and nobody does anything much
     * either. That is what waiting looks like.
     */
    idle: {
      frames: [
        "stand",
        "breathe",
        "stand",
        "blink",
        "stand",
        "breathe",
        "weight",
        "weightB",
        "weight",
        "stand",
        "lookBack",
        "stand",
        "breathe",
        "pockets",
        "pockets",
        "pockets",
        "stand",
        "blink",
        "weight",
        "weightB",
        "scratchHead",
        "scratchHeadB",
        "stand",
        "breathe",
        "stand",
        "lookL",
        "stand",
        "lookR",
        "weight",
        "stand",
        "checkPhone",
        "checkPhone",
        "checkPhone",
        "stand",
        "breathe",
        "fold",
        "foldB",
        "fold",
        "foldB",
        "stand",
        "blink",
        "breathe",
      ],
      frameMs: 620,
      loops: 1,
    },
    talk: {
      frames: [
        "talkA",
        "stand",
        "talkB",
        "talkTilt",
        "nod",
        "stand",
        "talkA",
        "talkC",
        "stand",
        "talkB",
        "nod",
        "stand",
      ],
      frameMs: 300,
      loops: 1,
      interruptible: true,
    },
    wave: { frames: ["waveA", "waveB", "waveA", "waveB", "stand"], frameMs: 260, loops: 1 },
    shrug: { frames: ["stand", "shrug", "shrug", "stand"], frameMs: 360, loops: 1 },
    notice: { frames: ["lookBack", "stand", "nod", "stand"], frameMs: 320, loops: 1 },
    point: { frames: ["stand", "point", "point", "talkA", "stand"], frameMs: 340, loops: 1 },
    walk: { frames: ["walkA", "walkBUp", "walkC", "walkDUp"], frameMs: 190, loops: 4 },

    // --- the library: everything a person does that is not standing still ---
    greet: {
      frames: ["lookBack", "stand", "hail", "waveA", "waveB", "waveA", "stand", "nod"],
      frameMs: 280,
      loops: 1,
    },
    farewell: { frames: ["waveA", "waveB", "stand", "lookBack", "stand"], frameMs: 320, loops: 1 },
    laugh: {
      frames: ["laughA", "laughB", "laughA", "laughB", "laughA", "stand", "breathe"],
      frameMs: 190,
      loops: 1,
    },
    cough: {
      frames: ["stand", "toMouth", "coughA", "coughB", "coughA", "toMouth", "stand", "breathe"],
      frameMs: 190,
      loops: 1,
    },
    phone: {
      frames: [
        "stand",
        "checkPhone",
        "checkPhone",
        "checkPhone",
        "scratchHead",
        "checkPhone",
        "stand",
      ],
      frameMs: 520,
      loops: 1,
    },
    drink: {
      frames: ["stand", "toMouth", "toMouthUp", "toMouthUp", "toMouth", "stand", "breathe"],
      frameMs: 400,
      loops: 1,
    },
    handOver: { frames: ["stand", "offer", "offer", "offer", "stand"], frameMs: 340, loops: 1 },
    count: {
      frames: ["stand", "count", "count", "count", "count", "stand"],
      frameMs: 380,
      loops: 1,
    },
    lookAround: {
      frames: ["stand", "lookL", "stand", "weight", "lookR", "weight", "stand", "breathe"],
      frameMs: 480,
      loops: 1,
    },
    scratch: {
      frames: ["stand", "scratchHead", "scratchHeadB", "scratchHead", "stand"],
      frameMs: 340,
      loops: 1,
    },
    show: {
      frames: ["stand", "point", "point", "talkA", "point", "stand"],
      frameMs: 340,
      loops: 1,
    },
  };

  if (doing === "working") {
    b.frame("workA", (f) => front("legsApart")(f).map(withArms(ARM.workHigh, ARM.workLow)));
    b.frame("workB", (f) => front("legsApart")(f).map(withArms(ARM.workLow, ARM.workHigh)));
    b.variant("workC", "workA", (m) => breathe(m));
    b.frame("wipeBrow", (f) => front("legsApart")(f).map(withArms(ARM.workLow, ARM.toFace)));
    b.variant("wipeBrowB", "wipeBrow", (m) => bow(m, 1));
    b.frame("stretchBack", (f) => front("legsApart")(f).map(withArms(ARM.back, ARM.back)));
    b.variant("stretchBackB", "stretchBack", (m) => raiseChin(m));
    b.frame("leanProp", (f) => front("legsApart")(f).map(withArms(ARM.rest, ARM.workHigh)));
    b.variant("leanPropB", "leanProp", (m) => breathe(m));
    b.frame("wring", (f) =>
      front("legsApart")(f)
        .map(withArms(ARM.workLow, ARM.workLow))
        .map((m) => bow(m, 1)),
    );
    b.variant("wringB", "wring", (m) => breathe(m));
    actions.work = {
      frames: [
        "workA",
        "workB",
        "workC",
        "workB",
        "workA",
        "workB",
        "leanProp",
        "leanPropB",
        "wipeBrow",
        "wipeBrowB",
        "workA",
        "workB",
        "workC",
        "workB",
        "stretchBack",
        "stretchBackB",
        "stretchBack",
        "stand",
      ],
      frameMs: 430,
      loops: 1,
    };
    actions.wring = {
      frames: ["stand", "wring", "wringB", "wring", "wringB", "wring", "stand"],
      frameMs: 380,
      loops: 1,
    };
    actions.rest = {
      frames: ["leanProp", "leanPropB", "leanProp", "wipeBrow", "leanProp", "leanPropB"],
      frameMs: 620,
      loops: 1,
    };
    actions.talkAtWork = {
      frames: ["leanProp", "talkA", "leanProp", "talkB", "nod", "leanProp", "talkA", "leanProp"],
      frameMs: 320,
      loops: 1,
      interruptible: true,
    };
  }

  if (doing === "serving") {
    // behind a counter: hand something over, take the money, ring it up
    b.frame("serveHand", (f) => front("legs")(f).map(withArms(ARM.rest, ARM.offer)));
    b.frame("serveTake", (f) => front("legs")(f).map(withArms(ARM.offer, ARM.rest)));
    b.frame("serveTill", (f) =>
      front("legs")(f)
        .map(withArms(ARM.rest, ARM.workHigh))
        .map((m) => bow(m, 1)),
    );
    b.variant("serveWait", "weight", (m) => breathe(m));
    // the long minutes between customers, which is most of a shift
    b.frame("serveLean", (f) =>
      front("legsWeight")(f)
        .map(withArms(ARM.foldOver, ARM.foldUnder))
        .map((m) => sway(m, 1)),
    );
    b.variant("serveLeanB", "serveLean", (m) => breathe(m));
    b.frame("serveWipe", (f) =>
      front("legs")(f)
        .map(withArms(ARM.rest, ARM.workLow))
        .map((m) => bow(m, 1)),
    );
    actions.serve = {
      frames: [
        "stand",
        "serveHand",
        "serveHand",
        "serveTill",
        "serveTake",
        "stand",
        "serveWait",
        "weight",
        "stand",
        "breathe",
        "serveLean",
        "serveLeanB",
        "serveLean",
        "stand",
        "blink",
        "serveWipe",
        "serveWipe",
        "stand",
        "lookL",
        "stand",
        "breathe",
        "scratchHead",
        "stand",
        "serveWait",
      ],
      frameMs: 460,
      loops: 1,
    };
    actions.serveTalk = {
      frames: ["talkA", "stand", "serveHand", "talkB", "nod", "stand"],
      frameMs: 320,
      loops: 1,
      interruptible: true,
    };
  }

  if (doing === "running") {
    // a treadmill: the legs go, the body stays. Faster and tighter than a walk.
    b.frame("runA", (f) =>
      side("legsSideStride")(f)
        .map(withSideArms(ARM.pumpUp, ARM.pumpDown))
        .map((m) => rise(m)),
    );
    b.frame("runB", (f) => side("legsSidePass")(f).map(withSideArms(ARM.pumpMid, ARM.pumpMid)));
    b.frame("runC", (f) =>
      side("legsSideStride")(f)
        .map(withSideArms(ARM.pumpDown, ARM.pumpUp))
        .map((m) => rise(m)),
    );
    b.variant("runD", "runB", (m) => breathe(m));
    actions.run = { frames: ["runA", "runB", "runC", "runD"], frameMs: 120, loops: 8 };
  }

  if (doing === "lifting") {
    // the iron: set, dip, drive, lock out, then stand there breathing
    b.frame("liftSet", (f) =>
      front("legsApart")(f)
        .map(withArms(ARM.workHigh, ARM.workHigh))
        .map((m) => breathe(m, 1)),
    );
    b.frame("liftDip", (f) =>
      front("legsApart")(f)
        .map(withArms(ARM.workHigh, ARM.workHigh))
        .map((m) => breathe(m, 3)),
    );
    b.frame("liftDrive", (f) => front("legsApart")(f).map(withArms(ARM.hail, ARM.hail)));
    b.variant("liftLock", "liftDrive", (m) => raiseChin(m));
    b.frame("liftRest", (f) => front("legsApart")(f).map(withArms(ARM.hip, ARM.hip)));
    b.variant("liftBreathe", "liftRest", (m) => breathe(m));
    actions.lift = {
      frames: [
        "liftSet",
        "liftDip",
        "liftDrive",
        "liftLock",
        "liftDrive",
        "liftDip",
        "liftSet",
        "liftRest",
        "liftBreathe",
        "liftRest",
      ],
      frameMs: 340,
      loops: 1,
    };
  }

  if (doing === "sitting") {
    b.frame("sit", (f) =>
      f.stack("head", "torso", "legsSit").map(withArms(ARM.rest, holding(ARM.rest))),
    );
    b.variant("sitBreathe", "sit", (m) => breathe(m));
    b.variant("sitNod", "sit", (m) => bow(m, 1));
    b.frame("sitTalk", (f) =>
      f.stack("head", "torso", "legsSit").map(withArms(ARM.rest, ARM.talk)),
    );
    b.frame("sitLean", (f) =>
      f
        .stack("head", "torso", "legsSit")
        .map(withArms(ARM.rest, ARM.rest))
        .map((m) => bow(m, 1)),
    );
    // the beat a body passes through between a bench and standing up
    b.frame("crouchUp", (f) =>
      front("legsApart")(f)
        .map(withArms(ARM.rest, ARM.rest))
        .map((m) => breathe(m, 2)),
    );
    b.frame("sitLook", (f) =>
      f.stack("head", "torso", "legsSit").map(withArms(ARM.rest, ARM.rest)).map(mirrorHead),
    );
    actions.sit = {
      frames: [
        "sit",
        "sitBreathe",
        "sit",
        "sitLook",
        "sit",
        "sitBreathe",
        "sitNod",
        "sit",
        "sit",
        "sitBreathe",
        "sitLean",
        "sitLean",
        "sit",
        "sitLook",
        "sit",
        "sitBreathe",
        "sit",
        "sitNod",
        "sit",
        "sitBreathe",
      ],
      frameMs: 700,
      loops: 1,
    };
    actions.standUp = {
      frames: ["sit", "sitLean", "crouchUp", "stand", "stand"],
      frameMs: 320,
      loops: 1,
    };
    actions.sitDown = {
      frames: ["stand", "crouchUp", "sitLean", "sit", "sit"],
      frameMs: 320,
      loops: 1,
    };
    actions.sitTalk = {
      frames: ["sitTalk", "sit", "sitTalk", "sitNod", "sit", "sitTalk"],
      frameMs: 340,
      loops: 1,
      interruptible: true,
    };
  }

  if (doing === "leaning" || doing === "waiting") {
    b.frame("lean", (f) => front("legsApart")(f).map(withArms(ARM.foldOver, ARM.foldUnder)));
    b.variant("leanBreathe", "lean", (m) => breathe(m));
    b.variant("leanLook", "lean", (m) => mirrorHead(m));
    b.frame("checkWatch", (f) => front("legsApart")(f).map(withArms(ARM.rest, ARM.toFace)));
    actions.lean = {
      frames: [
        "lean",
        "leanBreathe",
        "lean",
        "leanLook",
        "lean",
        "checkWatch",
        "checkWatch",
        "lean",
        "leanBreathe",
        "lean",
        "checkPhone",
        "checkPhone",
        "checkPhone",
        "lean",
        "leanLook",
        "lean",
        "scratchHead",
        "lean",
        "leanBreathe",
        "lean",
      ],
      frameMs: 700,
      loops: 1,
    };
  }

  if (doing === "smoking") {
    /**
     * A cigarette, drawn from the hand that is holding it. It always points in
     * toward the centre line and up, which is the one rule that works for both
     * ends of the cycle: down at the hip it angles across the thigh, and up at
     * the mouth it lands on the lips. The ember is one pixel, two while the
     * drag is on, and it is the only warm colour on the whole sprite — which
     * is why a smoker reads as a smoker at night from the other end of a
     * street.
     */
    const cig = (h: { x: number; y: number }, drag: boolean): Cell[] => {
      const dir = h.x >= CENTRE ? -1 : 1;
      const tip = { x: h.x + dir * 2, y: h.y };
      return [
        { x: h.x + dir, y: h.y, z: "c" },
        { x: tip.x, y: tip.y, z: "o" },
        // the drag: the ember doubles and throws light onto the row above it
        ...(drag ? [{ x: tip.x, y: tip.y - 1, z: "o" }] : []),
      ];
    };

    /**
     * The wisp off the end of it. It drifts *away* from the body as it rises —
     * smoke that drifts inward crosses the chest and the face and reads as
     * dirt on the sprite rather than as smoke.
     */
    const wisp = (h: { x: number; y: number }, phase: number): Cell[] => {
      const away = h.x >= CENTRE ? 1 : -1;
      const x = h.x + (h.x >= CENTRE ? -2 : 2);
      const drift = [0, 1, 1, 2];
      return [0, 1, 2].map((i) => ({
        x: x + away * drift[(i + phase) % 4],
        y: h.y - 2 - i * 2,
        z: i === 1 ? "w" : "W",
      }));
    };

    /**
     * The exhale, which is the half of smoking that reads. It leaves the mouth
     * as a small dense puff and opens out over three frames into something
     * wide and thin that drifts off the top of the head.
     */
    /**
     * The exhale. It leaves the lips, crosses the jaw and gets out past the
     * side of the head before it opens up — straight up it would spend its
     * whole life drawn on top of a face, where translucent white on skin is
     * invisible, and a plume you cannot see is not an exhale.
     *
     * Coordinates are the head rows `npcFace` lays out: the mouth is row 5,
     * and anything past column 15 is open air beside the head.
     */
    const breath = (stage: 0 | 1 | 2 | 3): Cell[] => {
      const puff = (x: number, y: number, w: number, z: string): Cell[] =>
        Array.from({ length: w }, (_, i) => ({ x: x + i, y, z }));
      if (stage === 0) return [...puff(CENTRE, 5, 3, "w"), ...puff(CENTRE + 1, 6, 2, "W")];
      if (stage === 1) {
        return [
          ...puff(CENTRE + 2, 5, 3, "w"),
          ...puff(CENTRE + 3, 4, 3, "w"),
          ...puff(CENTRE + 3, 6, 2, "W"),
          ...puff(CENTRE + 5, 3, 2, "W"),
        ];
      }
      if (stage === 2) {
        return [
          ...puff(CENTRE + 4, 4, 4, "w"),
          ...puff(CENTRE + 5, 3, 3, "w"),
          ...puff(CENTRE + 4, 5, 3, "W"),
          ...puff(CENTRE + 7, 2, 2, "W"),
        ];
      }
      return [...puff(CENTRE + 6, 2, 4, "w"), ...puff(CENTRE + 7, 1, 3, "W")];
    };

    /** One frame: the body, the arms, the cigarette in the hand, the smoke. */
    const smokeFrame = (
      pose: ArmPose,
      opts: { drag?: boolean; phase?: number; exhale?: 0 | 1 | 2 | 3 } = {},
    ) => {
      const hand = handAt(a, 1, pose);
      return (m: SpriteMap) => {
        let out = stamp(m, [...arm(a, -1, ARM.pocket, farArm), ...arm(a, 1, pose, armOpts)]);
        out = stamp(out, cig(hand, opts.drag ?? false));
        if (opts.phase !== undefined) out = stamp(out, wisp(hand, opts.phase));
        if (opts.exhale !== undefined) out = stamp(out, breath(opts.exhale));
        return out;
      };
    };

    b.frame("smokeRest", (f) => front("legsApart")(f).map(smokeFrame(ARM.rest, { phase: 0 })));
    b.frame("smokeRestB", (f) =>
      front("legsApart")(f)
        .map(smokeFrame(ARM.rest, { phase: 2 }))
        .map((m) => breathe(m)),
    );
    b.frame("smokeLift", (f) => front("legsApart")(f).map(smokeFrame(ARM.toChin)));
    /**
     * No `bow` or `raiseChin` anywhere in this cycle. Both work by adding or
     * removing a head row, which moves the mouth relative to a cigarette that
     * has already been placed on it — the head nods and the cigarette stays
     * behind in mid-air. The motion here comes from the arm and from the smoke,
     * both of which are drawn in the same pass as the thing they belong to.
     */
    b.frame("smokeDrag", (f) => front("legsApart")(f).map(smokeFrame(ARM.toMouth, { drag: true })));
    b.frame("smokeDragB", (f) => front("legsApart")(f).map(smokeFrame(ARM.atLips, { drag: true })));
    b.frame("smokeHold", (f) => front("legsApart")(f).map(smokeFrame(ARM.toChin)));
    b.frame("smokeOut1", (f) => front("legsApart")(f).map(smokeFrame(ARM.toChin, { exhale: 0 })));
    b.frame("smokeOut2", (f) => front("legsApart")(f).map(smokeFrame(ARM.rest, { exhale: 1 })));
    b.frame("smokeOut3", (f) => front("legsApart")(f).map(smokeFrame(ARM.rest, { exhale: 2 })));
    b.frame("smokeOut4", (f) =>
      front("legsApart")(f).map(smokeFrame(ARM.rest, { phase: 2, exhale: 3 })),
    );
    /** the flick: two fingers, one ash, and it is on the pavement */
    b.frame("smokeFlick", (f) =>
      front("legsApart")(f).map((m) => {
        const hand = handAt(a, 1, ARM.rest);
        let out = smokeFrame(ARM.rest, { phase: 3 })(m);
        out = stamp(out, [
          { x: hand.x - 1, y: hand.y + 3, z: "W" },
          { x: hand.x - 2, y: hand.y + 6, z: "W" },
        ]);
        return out;
      }),
    );

    actions.smoke = {
      frames: [
        "smokeRest",
        "smokeRestB",
        "smokeLift",
        "smokeDrag",
        "smokeDragB",
        "smokeDragB",
        "smokeHold",
        "smokeOut1",
        "smokeOut2",
        "smokeOut3",
        "smokeOut4",
        "smokeRest",
        "smokeRestB",
        "smokeFlick",
        "smokeRest",
        "smokeRestB",
        "smokeRest",
      ],
      frameMs: 420,
      loops: 1,
    };
    /** talking with one in your hand: it stays down, and it keeps burning */
    actions.smokeTalk = {
      frames: ["smokeRest", "smokeRestB", "smokeLift", "smokeRest", "smokeRestB", "smokeRest"],
      frameMs: 360,
      loops: 1,
      interruptible: true,
    };
  }

  if (doing === "phoning") {
    /**
     * A phone call. The whole thing hangs on one shape: a dark slab against
     * the side of the head with a hand wrapped round it. Everything else — the
     * free hand talking to nobody, the weight going from one foot to the
     * other, the nod at something said down the line — is what people
     * actually do while they are on the phone and nothing else is happening.
     */
    const handset = (h: { x: number; y: number }): Cell[] => {
      const dir = h.x >= CENTRE ? -1 : 1;
      const cells: Cell[] = [];
      // two columns and four rows against the side of the head, with the lit
      // edge of the screen along the top — the one pixel that says "phone"
      // rather than "dark rectangle"
      for (let dy = -3; dy <= 1; dy++) {
        cells.push({ x: h.x, y: h.y + dy, z: dy === -3 ? "c" : "n" });
        cells.push({ x: h.x + dir, y: h.y + dy, z: "n" });
      }
      return cells;
    };

    const call = (free: ArmPose) => (m: SpriteMap) => {
      const hand = handAt(a, 1, ARM.toEar);
      const holding = arm(a, 1, ARM.toEar, armOpts);
      let out = stamp(m, arm(a, -1, free, farArm));
      // the whole arm, then the phone over the forearm that would otherwise
      // hide it, then the fingers back on top so they wrap the handset
      out = stamp(out, holding);
      out = stamp(out, handset(hand));
      out = stamp(out, holding.slice(-4));
      return out;
    };

    b.frame("callUp", (f) => front("legs")(f).map(call(ARM.pocket)));
    b.variant("callBreathe", "callUp", (m) => breathe(m));
    b.frame("callTalkA", (f) => front("legs")(f).map(call(ARM.talk)));
    b.frame("callTalkB", (f) => front("legs")(f).map(call(ARM.talkWide)));
    b.frame("callShrug", (f) => front("legs")(f).map(call(ARM.shrug)));
    b.frame("callPace", (f) =>
      front("legsWeight")(f)
        .map(call(ARM.pocket))
        .map((m) => sway(m, 1)),
    );
    b.variant("callNod", "callUp", (m) => bow(m, 1));
    b.variant("callAway", "callUp", (m) => mirrorHead(m));
    /** it is over: the phone comes down and gets one last look */
    b.frame("callDown", (f) => front("legs")(f).map(withArms(ARM.pocket, ARM.toChin)));
    b.frame("callCheck", (f) =>
      front("legs")(f)
        .map(withArms(ARM.pocket, ARM.hold))
        .map((m) => bow(m, 1)),
    );

    actions.call = {
      frames: [
        "callUp",
        "callBreathe",
        "callTalkA",
        "callUp",
        "callNod",
        "callUp",
        "callTalkB",
        "callTalkA",
        "callUp",
        "callPace",
        "callBreathe",
        "callAway",
        "callUp",
        "callShrug",
        "callUp",
        "callNod",
        "callBreathe",
        "callUp",
      ],
      frameMs: 460,
      loops: 1,
    };
    actions.hangUp = {
      frames: ["callUp", "callNod", "callDown", "callCheck", "callCheck", "stand"],
      frameMs: 380,
      loops: 1,
    };
    actions.callTalk = {
      frames: ["callUp", "callNod", "callTalkA", "callUp", "callBreathe"],
      frameMs: 360,
      loops: 1,
      interruptible: true,
    };
  }

  if (doing === "washing") {
    /**
     * Washing a stairwell floor. Not a person holding a mop — a person moving
     * one: the head goes out to the right on the push, comes back on the pull,
     * the shoulders lean into it, and the wet it leaves behind is still there
     * two frames later. The mop is drawn from the lower hand to the floor
     * rather than hung off a fixed patch, so the handle stays in the hands
     * through the whole stroke.
     */
    const FLOOR = a.floorY;
    const mop = (headX: number, wet: number[]): Cell[] => {
      const grip = handAt(a, 1, ARM.workLow);
      const cells: Cell[] = [
        ...stroke(grip.x, grip.y - 4, headX + 1, FLOOR - 3, "n", 1),
        // the head: a flat pad, wider than the handle, sitting on the floor
        ...[-2, -1, 0, 1, 2].map((dx) => ({ x: headX + dx, y: FLOOR - 2, z: "c" })),
        ...[-3, -2, -1, 0, 1, 2, 3].map((dx) => ({ x: headX + dx, y: FLOOR - 1, z: "c" })),
        ...[-3, -2, -1, 0, 1, 2, 3].map((dx) => ({ x: headX + dx, y: FLOOR, z: "n" })),
      ];
      for (const x of wet) cells.push({ x, y: FLOOR, z: "v" });
      return cells;
    };

    /** One stroke of the mop, with the body leaning the way the arms go. */
    const wash = (headX: number, wet: number[], lean: number) => (m: SpriteMap) => {
      // handle first, then the hands back over it, so the fingers close on it
      let out = stamp(m, arm(a, 1, ARM.gripHigh, { ...farArm, at: a.shoulderL }));
      out = stamp(out, mop(headX, wet));
      out = stamp(out, arm(a, 1, ARM.gripHigh, { ...farArm, at: a.shoulderL }).slice(-6));
      out = stamp(out, arm(a, 1, ARM.gripLow, armOpts));
      return lean === 0 ? out : sway(out, lean);
    };

    b.frame("washOut", (f) => front("legsApart")(f).map(wash(20, [8, 10, 13], 1)));
    b.frame("washMidA", (f) => front("legsApart")(f).map(wash(16, [8, 10, 19, 21], 0)));
    b.frame("washIn", (f) => front("legsApart")(f).map(wash(6, [12, 15, 18, 20], -1)));
    b.frame("washMidB", (f) => front("legsApart")(f).map(wash(11, [5, 7, 18, 21], 0)));
    /** the bucket beat: bent over it, the head down in the water, drips */
    b.frame("washWring", (f) =>
      front("legsApart")(f)
        .map((m) => {
          let out = stamp(m, arm(a, 1, ARM.gripHigh, { ...farArm, at: a.shoulderL }));
          out = stamp(out, mop(13, []));
          out = stamp(out, arm(a, 1, ARM.gripLow, armOpts));
          out = stamp(out, [
            { x: 12, y: FLOOR - 5, z: "v" },
            { x: 15, y: FLOOR - 4, z: "v" },
          ]);
          return out;
        })
        .map((m) => bow(m, 1)),
    );
    b.variant("washWringB", "washWring", (m) => breathe(m));
    /** standing up out of it, one hand to the small of the back */
    b.frame("washStand", (f) =>
      front("legsApart")(f).map((m) => {
        let out = stamp(m, arm(a, -1, ARM.back, farArm));
        out = stamp(out, mop(17, [8, 11, 14]));
        return stamp(out, arm(a, 1, ARM.gripHigh, armOpts));
      }),
    );
    b.variant("washStandB", "washStand", (m) => raiseChin(m));
    b.frame("washBrow", (f) =>
      front("legsApart")(f).map((m) => {
        let out = stamp(m, arm(a, 1, ARM.gripHigh, { ...farArm, at: a.shoulderL }));
        out = stamp(out, mop(6, [10, 13, 16]));
        return stamp(out, arm(a, 1, ARM.toFace, armOpts));
      }),
    );

    const stroke1 = ["washMidA", "washOut", "washMidA", "washIn", "washMidB"];
    actions.wash = {
      frames: [
        ...stroke1,
        ...stroke1,
        "washStand",
        "washStandB",
        "washWring",
        "washWringB",
        "washWring",
        "washStand",
        ...stroke1,
        "washBrow",
        "washStandB",
      ],
      frameMs: 380,
      loops: 1,
    };
    // the corridor asks for these by name, and washing a floor is what working
    // means for anyone whose job is this one
    actions.work = actions.wash;
    actions.wring = {
      frames: ["washStand", "washWring", "washWringB", "washWring", "washWringB", "washStand"],
      frameMs: 400,
      loops: 1,
    };
    actions.rest = {
      frames: ["washStand", "washStandB", "washStand", "washBrow", "washStand", "washStandB"],
      frameMs: 620,
      loops: 1,
    };
    actions.talkAtWork = {
      frames: ["washStand", "washStandB", "talkA", "washStand", "talkC", "washStandB"],
      frameMs: 340,
      loops: 1,
      interruptible: true,
    };
  }

  for (const [id, def] of Object.entries(actions)) b.action(id, def);

  const built = b.build();
  const trim = TRIM[height];
  const frames = trim
    ? Object.fromEntries(
        Object.entries(built.frames).map(([name, map]) => [name, shorten(map, trim)]),
      )
    : built.frames;

  const idleAction =
    spec.reactions?.idle ??
    (doing === "working"
      ? "work"
      : doing === "serving"
        ? "serve"
        : doing === "running"
          ? "run"
          : doing === "lifting"
            ? "lift"
            : doing === "washing"
              ? "wash"
              : doing === "phoning"
                ? "call"
                : doing === "sitting"
                  ? "sit"
                  : doing === "leaning" || doing === "waiting"
                    ? "lean"
                    : doing === "smoking"
                      ? "smoke"
                      : "idle");

  return {
    ...built,
    frames,
    id: spec.id,
    name: spec.name,
    idleAction,
    reactions: {
      onTalk:
        spec.reactions?.onTalk ??
        (doing === "sitting"
          ? "sitTalk"
          : doing === "working" || doing === "washing"
            ? "talkAtWork"
            : doing === "serving"
              ? "serveTalk"
              : doing === "smoking"
                ? "smokeTalk"
                : doing === "phoning"
                  ? "callTalk"
                  : "talk"),
      onNotice: spec.reactions?.onNotice ?? "notice",
      idle: idleAction,
    },
    lines: spec.lines ?? [],
    look,
  };
}
