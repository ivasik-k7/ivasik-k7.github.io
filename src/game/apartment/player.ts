import { ACTIONS, PLAYER_PALETTE, WALK_CYCLE } from "@/components/game/sprites";
import {
  type ActionDef,
  createCharacter,
  mirrorRows,
  type Patch,
  type PlayerConfig,
  replaceColor,
  type SpriteMap,
} from "@/engine";

/**
 * The player, modelled from scratch as a part rig:
 *   head (rows 0–6) · torso with hips (7–19) · legs (20–37),
 * with arms and held props applied as patches on top. Every animation frame is
 * "reposition some parts" — swap a legs set, shift the head, patch an arm — so
 * the whole set stays consistent, and the wardrobe palette (hair/skin/beard/
 * shirt/trousers/shoes) recolors every frame automatically.
 *
 * Build: 195 cm, 96 kg, trains with iron. That reads in the silhouette rather
 * than in detail, and it reads through three numbers:
 *
 *   head 10 px wide · shoulders 18 px · waist 14 px · hips 12 px
 *
 * Shoulders at 1.8 heads is the line between "big" and "cartoon"; the taper
 * from 18 to 14 over four rows is the V, and the hips coming back out to 12
 * stops him looking like a triangle balanced on a point. Thighs are 5 px each
 * at the top — a lifter carries it there — closing to 3 px at the calf so the
 * legs don't read as tree trunks.
 *
 * Symmetry is enforced structurally: every leg set is built as
 * `lead + left leg + gap + right leg + trail` with the left and right runs the
 * same length, so a standing pose is exactly mirror-balanced and a striding one
 * is balanced around its own centre of mass. The torso is drawn edge-in — one
 * shade column (T) on the back edge, one on the front — so the body mass stays
 * centred no matter how wide the row is.
 *
 * Right-facing profile, 24 columns; the face front is the high columns.
 * Palette keys are the shared wardrobe zones from sprites.tsx:
 *   k/K cap · h/H hair · m hood · s/S skin · e eye · f beard
 *   t/T shirt · p/q/Q trousers · b/B shoes · c prop · o ember
 *   g/G kettlebell · R bar · P plates
 */

// --- parts -----------------------------------------------------------------------

// Head: 1/7 of height like the street NPCs. Row 0 is the cap crown (zone k,
// invisible without a hat); the hood (zone m) folds behind the neck. The profile
// is built on four landmarks — brow at row 3, nose tip pushing one column proud
// at row 4, mouth line at row 5, and a neck at row 6 that is six columns thick,
// because on a man this size the neck is the giveaway before the shoulders are.
const HEAD: SpriteMap = [
  "........................",
  "..........kkkkkkK.......",
  ".........KhhhhhhK.......",
  ".........mHhhhHhh.......",
  ".........mHsysses.......",
  ".........mSssssss.......",
  "..........Sssffs........",
];

// Torso: traps out of the neck, delts at their widest for four rows, then the
// taper. The hood bump (m) sits on the upper back and the kangaroo pocket rides
// forward of centre. No arms — arms are patches, so every pose can move them.
const TORSO: SpriteMap = [
  "......TmmmtttttttT......",
  "...TmmttttttttttttttT...",
  "...TmtttttttttttttttT...",
  "...TttttttttttttttttT...",
  "...TttttttttttttttttT...",
  "....TttttttttttttttT....",
  "....TttttttttttttttT....",
  ".....TttttttttttttT.....",
  ".....TttttttmmmmttT.....",
  ".....TttttttmmmmttT.....",
  "......TttttttttttT......",
  "......TttttttttttT......",
  "......qppppppppppq......",
];

// Legs sets — 18 rows each (hips → thighs → shins → shoes).
// Every set keeps the hips at columns 6–17 so the torso never floats.

const LEGS_STAND: SpriteMap = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......spp....pps.......",
  ".......bbb....bbb.......",
  "......bbbb....bbbb......",
  "......BBBB....BBBB......",
];

const LEGS_STRIDE: SpriteMap = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  ".....qpppp..ppppq.......",
  ".....qpppp...ppppq......",
  "....qpppp....ppppq......",
  "....qppp......pppq......",
  "....qppp......pppq......",
  "...qppp........pppq.....",
  "...qppp........pppq.....",
  "...qppp........pppq.....",
  "..qppp..........pppq....",
  "..qppp..........pppq....",
  "..qpp............ppq....",
  "..qpp............ppq....",
  "..spp............pps....",
  "..bbb............bbb....",
  ".bbbb............bbbb...",
  ".BBBB............BBBB...",
];

const LEGS_PASS: SpriteMap = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qppQQpppppq.......",
  "......qppQQpppppq.......",
  ".......qpQQppppq........",
  ".......qpQQppppq........",
  ".......qpQQpppq.........",
  ".......qpQQpppq.........",
  ".......qpQ.pppq.........",
  ".......qpQ.pppq.........",
  ".......qpQ.ppq..........",
  ".......qpQ.ppq..........",
  "........qQ.ppq..........",
  "........qQ.ppq..........",
  "........sQ.pps..........",
  "........bb.bbb..........",
  ".......bbb.bbbb.........",
  ".......BBB.BBBB.........",
];

const LEGS_STRIDE_LOW: SpriteMap = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  ".....qpppp...ppppq......",
  ".....qppp.....pppq......",
  "....qppp......pppq......",
  "....qppp.......pppq.....",
  "....qppp.......pppq.....",
  "...qppp.........pppq....",
  "...qppp.........pppq....",
  "...qpp...........ppq....",
  "...qpp...........ppq....",
  "...qpp...........ppq....",
  "...qpp...........ppq....",
  "...spp...........pps....",
  "...bbb...........bbb....",
  "..bbbb...........bbbb...",
  "..BBBB...........BBBB...",
];

// Knees driven out over the toes, hips back — the squat a lifter actually does.
const LEGS_BENT: SpriteMap = [
  "........................",
  "........................",
  "......qppppppppppq......",
  ".....qppppppppppppq.....",
  ".....qppppppppppppq.....",
  ".....qpppppppppppq......",
  ".....qppppp..ppppq......",
  "....qppppp....ppppq.....",
  "....qpppp......pppq.....",
  "....qppp.......pppq.....",
  "....qppp.......pppq.....",
  "....qppp.......pppq.....",
  "....qpp.........ppq.....",
  "....qpp.........ppq.....",
  "....spp.........pps.....",
  "....bbb.........bbb.....",
  "...bbbb.........bbbb....",
  "...BBBB.........BBBB....",
];

const LEGS_SIT: SpriteMap = [
  "........................",
  "........................",
  "........................",
  "........................",
  "......qppppppppppq......",
  "......qpppppppppppppq...",
  "......qppppppppppppppq..",
  "......qppppppppppppppq..",
  "................qppppq..",
  "................qppppq..",
  "................qppppq..",
  "................qpppq...",
  "................qpppq...",
  "................qpppq...",
  "................spps....",
  "................bbbb....",
  "...............bbbbbb...",
  "...............BBBBBB...",
];

const LEGS_TIPTOE: SpriteMap = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......qpp....ppq.......",
  ".......spp....pps.......",
  ".......bbb....bbb.......",
  ".......bb......bb.......",
];

// Kneeling before the icon: knees down front, shins folded back, six empty
// rows on top so dropBody(6) can lower the torso into them.
const LEGS_KNEEL: SpriteMap = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......ppp....ppp.......",
  "....qqppp...qppp........",
  "..ppppp...ppppp.........",
  "..bbb.....bbb...........",
  "..BBB.....BBB...........",
];

// --- the back view -----------------------------------------------------------
// Prayer happens toward the icon on the FAR wall — into the scene's depth —
// so the correct projection is the character seen from behind: hair with no
// face, the hood hanging between the shoulder blades, symmetric silhouette.
// Same row contract as the profile (head 0-6, torso 7-19, legs 20-37) and the
// same palette zones, so the wardrobe recolors all of it for free.

const BACK_HEAD: SpriteMap = [
  "........................",
  ".........KkkkkkkK.......",
  ".........HhhhhhhH.......",
  ".........hhhhhhhh.......",
  ".........hhhhhhhh.......",
  ".........HhhhhhhH.......",
  "..........Ssssss........",
];

const BACK_TORSO: SpriteMap = [
  "......TtttmmmmtttT......",
  "...TtttttmmmmmmtttttT...",
  "...TtttttmMMMMmtttttT...",
  "...TttttttMMMMttttttT...",
  "...TttttttttttttttttT...",
  "....TttttttttttttttT....",
  "....TttttttttttttttT....",
  ".....TttttttttttttT.....",
  ".....TttttttttttttT.....",
  "......TttttttttttT......",
  "......TttttttttttT......",
  "......TttttttttttT......",
  "......qppppppppppq......",
];

// upright on the knees (not sitting on the heels): thighs vertical, knees on
// the floor line, the shins lying flat toward the camera — so the soles of
// the shoes peek out on both sides behind the knees
const BACK_LEGS_KNEEL: SpriteMap = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  "......bqppp..pppqb......",
  ".....bBqppp..pppqBb.....",
  ".....BBqppp..pppqBB.....",
  ".......qppp..pppq.......",
];

// Bare back for the shower: same silhouette as BACK_TORSO, skin ramp — traps
// highlighted with y, a spine shadow of S down the middle. The legs are the
// LEGS_STAND shape in skin with bare feet. At 24px from behind this is
// exactly as tasteful as Ringo's bath ever was.
const BACK_TORSO_BARE: SpriteMap = [
  "......SssssssssssS......",
  "...SsyyssssssssssyysS...",
  "...SsyyssssssssssyysS...",
  "...SsssssssSSsssssssS...",
  "...SsssssssSSsssssssS...",
  "....SssssssSSssssssS....",
  "....SssssssSSssssssS....",
  ".....SsssssSSsssssS.....",
  ".....SssssssssssssS.....",
  "......SssssssssssS......",
  "......SssssssssssS......",
  "......SssssssssssS......",
  "......SssssssssssS......",
];

const BACK_LEGS_BARE: SpriteMap = [
  "......SssssssssssS......",
  "......SssssssssssS......",
  "......Sssss..ssssS......",
  "......Sssss..ssssS......",
  "......Sssss..ssssS......",
  "......Sssss..ssssS......",
  ".......Ssss..sssS.......",
  ".......Ssss..sssS.......",
  ".......Ssss..sssS.......",
  ".......Ssss..sssS.......",
  ".......Sss....ssS.......",
  ".......Sss....ssS.......",
  ".......Sss....ssS.......",
  ".......Sss....ssS.......",
  ".......sss....sss.......",
  ".......sss....sss.......",
  "......ssss....ssss......",
  "......SSSS....SSSS......",
];

/** falling water, one streak column every 4px, alternating rows per frame */
const waterRows = (off: number): string[] =>
  Array.from({ length: 32 }, (_, i) => ((i + off) % 2 === 0 ? "c...c...c" : "........."));

// Weight on the back leg, front knee unlocked, front foot half a step out —
// how a person actually stands when nobody is watching.
const LEGS_IDLE_SHIFT: SpriteMap = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  "......qpppp..ppppq......",
  ".......qppp..pppq.......",
  ".......qppp..pppq.......",
  ".......qppp..pppqq......",
  ".......qppp..qpppq......",
  ".......qpp....qppq......",
  ".......qpp....qppq......",
  ".......qpp.....ppq......",
  ".......qpp.....ppq......",
  ".......spp.....pps......",
  ".......bbb.....bbb......",
  "......bbbb.....bbbb.....",
  "......BBBB.....BBBB.....",
];

// --- arm & prop patches --------------------------------------------------------------
// The near arm lives on the face side (high cols) and hangs proud of the lat —
// a man this width can't get his arms flat against his ribs. The far arm is a
// shaded hint on the back edge so the body still reads as three-dimensional.

const P = {
  farArm: {
    r: 8,
    c: 2,
    rows: ["Tt", "Tt", "TS", "SS", "SS", "SS", ".S", ".S", "SS", "SS", ".S", ".S", ".S", ".S"],
  } as Patch,
  armDown: {
    r: 8,
    c: 19,
    rows: [
      "ttt",
      "ttt",
      "tss",
      "sys",
      "sys",
      "sss",
      ".ss",
      ".ss",
      "sss",
      "sss",
      ".ss",
      ".ss",
      ".sS",
      ".SS",
    ],
  } as Patch,
  farArmFwd: {
    r: 8,
    c: 3,
    rows: ["Tt", "Tt", "TS", "SS", ".S", ".S", "SS", "SS", ".S", ".S"],
  } as Patch,
  farArmBack: {
    r: 8,
    c: 1,
    rows: [".Tt", ".Tt", "TS.", "SS.", "S..", "S..", "S..", "S..", "S..", "S.."],
  } as Patch,
  armSwingFwd: {
    r: 8,
    c: 20,
    rows: ["tt.", "tt.", "ss.", "ss.", "ss.", ".ss", ".ss", ".ss", ".ss", ".sS"],
  } as Patch,
  armSwingBack: {
    r: 8,
    c: 15,
    rows: [
      "...ttt",
      "...ttt",
      "..tss.",
      "..sss.",
      ".sss..",
      ".ss...",
      "ss....",
      "ss....",
      "sS....",
      "S.....",
    ],
  } as Patch,
  armReach: {
    r: 6,
    c: 18,
    rows: ["...ss", "..sss", ".sss.", "ttt..", "ttt.."],
  } as Patch,
  armUpBoth: {
    r: 2,
    c: 4,
    rows: [
      "s...............s",
      "s...............s",
      "S...............s",
      "S...............s",
      "t...............t",
      "tt.............tt",
    ],
  } as Patch,
  armPhone: {
    r: 5,
    c: 17,
    rows: ["...cc", "..sss", ".sss.", "tss..", "tt..."],
  } as Patch,
  armMug: { r: 10, c: 18, rows: [".ccc", ".sss", "sss.", "tt.."] } as Patch,
  armMugUp: {
    r: 6,
    c: 16,
    rows: ["..ccc", "..sss", "..ss.", ".ss..", "tt..."],
  } as Patch,
  // forearms converging to clasped hands at the waist
  handsFold: {
    r: 12,
    c: 3,
    rows: [
      "SS..............ss",
      "SSS............sss",
      ".SSs........ssss..",
      "..sssssssssss.....",
      "...ssssssss.......",
    ],
  } as Patch,
  armGuardHigh: {
    r: 6,
    c: 16,
    rows: ["..sss", ".sss.", "tss..", "ttt..", "tt..."],
  } as Patch,
  armGuardLow: {
    r: 10,
    c: 17,
    rows: ["ssss", "sss.", "tt..", "t..."],
  } as Patch,
  cigLean: { r: 9, c: 19, rows: ["ttt", "tss", "sss", ".sc", "..o"] } as Patch,
  // the smoke cycle: cig at the hip, halfway up, and at the lips
  armCigDown: {
    r: 8,
    c: 19,
    rows: [
      "ttt",
      "ttt",
      "tss",
      "sys",
      "sys",
      "sss",
      ".ss",
      ".ss",
      "sss",
      "sss",
      ".ss",
      ".ss",
      ".sc",
      "..o",
    ],
  } as Patch,
  armCigHalf: {
    r: 7,
    c: 17,
    rows: ["....", "ss..", "ssco", "ts..", "tt..", "tt.."],
  } as Patch,
  // the guitar, slung across the body: honeyed top (w/W), dark neck rising
  // forward to the headstock, soundhole toward the bridge. Drawn over the
  // shirt; the fretting hand and the strumming arm patch on top of it.
  guitarBody: {
    r: 7,
    c: 5,
    rows: [
      "................nnR",
      "...............WWn.",
      "..............WW...",
      ".............WW....",
      "............WW.....",
      "...........WW......",
      ".WwwwwwwwwWW.......",
      "Wwwwwwwwwwwww......",
      "WwwwnnwwwwwRw......",
      "Wwwwwwwwwwwww......",
      "WWwwwwwwwwwwW......",
      ".WWWWWWWWWWWW......",
    ],
  } as Patch,
  // fretting hand gripping the neck just under the headstock (patched LAST,
  // over both the neck and the strumming arm, so the fingers stay visible)
  gtrFret: { r: 8, c: 20, rows: ["ss", "sS"] } as Patch,
  // one position lower — the chord change
  gtrFretLow: { r: 10, c: 18, rows: ["ss", "sS"] } as Patch,
  // strumming arm at the top of the stroke, hand over the upper bout
  gtrStrumUp: {
    r: 8,
    c: 10,
    rows: [
      "........ttt",
      "........tt.",
      ".........s.",
      "........s..",
      ".....sss...",
      ".ssss......",
    ],
  } as Patch,
  // and swept through to the lower bout
  gtrStrumDown: {
    r: 8,
    c: 10,
    rows: [
      "........ttt",
      "........tt.",
      ".........s.",
      "........s..",
      "........s..",
      ".......s...",
      ".....ss....",
      "..sss......",
      ".ss........",
    ],
  } as Patch,
  // back view: both arms hanging at the silhouette edges
  backArms: {
    r: 8,
    c: 2,
    rows: [
      "tt................tt",
      "tt................tt",
      "ts................st",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".S................S.",
    ],
  } as Patch,
  // back view: elbows tuck in, forearms vanish forward — hands folded in prayer
  backArmsFold: {
    r: 8,
    c: 2,
    rows: [
      "tt................tt",
      "tt................tt",
      "ts................st",
      ".ss..............ss.",
      "..ss............ss..",
      "...s............s...",
    ],
  } as Patch,
  // shower: bare arms hanging at the silhouette
  bareArmsDown: {
    r: 8,
    c: 2,
    rows: [
      "ss................ss",
      "ss................ss",
      "ss................ss",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".s................s.",
      ".S................S.",
    ],
  } as Patch,
  // right arm up to the shower tap, left hanging
  showerTapArm: {
    r: 3,
    c: 2,
    rows: [
      "...............ss...",
      "...............ss...",
      "................ss..",
      ".................s..",
      ".................s..",
      "ss................s.",
      "ss..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".S..................",
    ],
  } as Patch,
  // both hands on the head — on the clothed torso this reads as a shirt
  // coming off over the head; on the bare one, as washing the hair
  washHairBoth: {
    r: 2,
    c: 4,
    rows: [
      "....ss....ss....",
      "...ss......ss...",
      "..ss........ss..",
      ".ss..........ss.",
      "ss............ss",
      "s..............s",
    ],
  } as Patch,
  // hands scrubbing the ribs, elbows wide
  scrubTorso: {
    r: 8,
    c: 3,
    rows: [
      "s................s",
      "ss..............ss",
      ".ss............ss.",
      "..ss..........ss..",
      "...ss........ss...",
    ],
  } as Patch,
  // the towel, wrapped where a towel goes
  towelWrap: {
    r: 19,
    c: 6,
    rows: ["cccccccccccc", "cccccccccccc", ".cccccccccc."],
  } as Patch,
  // the clothes, where clothes actually land
  clothesPile: {
    r: 34,
    c: 1,
    rows: ["..ttt", "ttttp", "tpppp"],
  } as Patch,
  waterA: { r: 2, c: 8, rows: waterRows(0) } as Patch,
  waterB: { r: 2, c: 8, rows: waterRows(1) } as Patch,
  // pee stance: elbows out a little, forearms angling forward and down,
  // hands vanishing in front — everything stays off-screen except posture
  peeArms: {
    r: 8,
    c: 2,
    rows: [
      "tt................tt",
      "tt................tt",
      "ts................st",
      ".ss..............ss.",
      "..s..............s..",
      "..ss............ss..",
      "...s............s...",
    ],
  } as Patch,
  // back view, sign of the cross: right hand up beside the head (forehead)
  backCrossHigh: {
    r: 3,
    c: 2,
    rows: [
      "...............ss...",
      "...............ss...",
      "................ss..",
      "................ss..",
      ".................s..",
      "tt................tt",
      "tt................tt",
      "ts..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".S..................",
    ],
  } as Patch,
  // ...elbow winging out high — the hand crosses to the far shoulder
  backCrossL: {
    r: 8,
    c: 2,
    rows: [
      "tt................tt",
      "tt...............sss",
      "ts................ss",
      ".s..................",
      ".s..................",
      ".s..................",
      ".s..................",
      ".S..................",
    ],
  } as Patch,
  // ...and low — the hand at the near shoulder
  backCrossR: {
    r: 8,
    c: 2,
    rows: [
      "tt................tt",
      "tt................tt",
      "ts................ss",
      ".s...............sss",
      ".s................s.",
      ".s..................",
      ".s..................",
      ".S..................",
    ],
  } as Patch,
  // sign of the cross — four stations of the right hand
  crossForehead: {
    r: 2,
    c: 15,
    rows: ["..ss", ".sss", ".ss.", ".ss.", "ss..", "ss..", "ts..", "tt.."],
  } as Patch,
  crossChest: {
    r: 8,
    c: 12,
    rows: ["....tt", "...tss", "..sss.", ".ss...", "ss...."],
  } as Patch,
  crossFar: {
    r: 8,
    c: 4,
    rows: [".............tt", ".........sssss.", "....sssss......", "..sss.........."],
  } as Patch,
  crossNear: {
    r: 8,
    c: 13,
    rows: ["..sst", ".sss.", "ss..."],
  } as Patch,
  armReachHalf: {
    r: 7,
    c: 18,
    rows: ["..ss", ".sss", "tss.", "tt..", "tt.."],
  } as Patch,
  // petting the dog — final-space arms that actually reach his back
  armPetA: {
    r: 12,
    c: 16,
    rows: [
      "tt...",
      "ts...",
      "ss...",
      ".ss..",
      ".ss..",
      ".ss..",
      "..ss.",
      "..ss.",
      "..ss.",
      "..ss.",
      "...ss",
      "...ss",
      "...ss",
      "...ss",
      "...ss",
      "...ss",
      "...sS",
      "...SS",
    ],
  } as Patch,
  armPetB: {
    r: 12,
    c: 14,
    rows: [
      "..tt.",
      "..ts.",
      ".ss..",
      ".ss..",
      "ss...",
      "ss...",
      "ss...",
      ".ss..",
      ".ss..",
      ".ss..",
      ".ss..",
      "..ss.",
      "..ss.",
      "..ss.",
      "..ss.",
      "..sS.",
      "..SS.",
    ],
  } as Patch,
  // scratch behind the ear: short fast wiggle near the dog's head
  armScratchA: {
    r: 12,
    c: 15,
    rows: [
      "tt..",
      "ts..",
      "ss..",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      "..ss",
      "..sS",
      "..s.",
    ],
  } as Patch,
  armScratchB: {
    r: 12,
    c: 15,
    rows: [
      "tt..",
      "ts..",
      "ss..",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      ".ss.",
      "..ss",
      "..ss",
      "..Ss",
      "...s",
    ],
  } as Patch,
  // kettlebell passing the knees on its arc
  giriaMid: {
    r: 9,
    c: 6,
    rows: [
      "t............t",
      "s............s",
      ".s..........s.",
      ".s..........s.",
      "..s........s..",
      "..s........s..",
      "...sGGGGGGs...",
      "...gggggggg...",
      "....gggggg....",
    ],
  } as Patch,
  // kettlebell stations in FINAL frame space (patched after pose transforms)
  giriaFloor: {
    r: 11,
    c: 6,
    rows: [
      "s..........s",
      "s..........s",
      ".s........s.",
      ".s........s.",
      ".s........s.",
      "..s......s..",
      "..s......s..",
      "..s......s..",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...sGGGGs...",
      "....gggg....",
      "...gggggg...",
      "...gggggg...",
      "....gggg....",
    ],
  } as Patch,
  giriaBack: {
    r: 11,
    c: 2,
    rows: [
      "........s......s",
      ".......s......s.",
      "......s.....s...",
      ".....s.....s....",
      "....s.....s.....",
      "...s.....s......",
      "...s....s.......",
      "..s....s........",
      "..s...s.........",
      ".s...s..........",
      ".s..s...........",
      ".sGGs...........",
      "gggg............",
      "gggggg..........",
      "gggggg..........",
      ".gggg...........",
    ],
  } as Patch,
  giriaHang: {
    r: 11,
    c: 6,
    rows: [
      "s..........s",
      "s..........s",
      ".s........s.",
      ".s........s.",
      "..s......s..",
      "..s......s..",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...s....s...",
      "...sGGGGs...",
      "....gggg....",
      "...gggggg...",
      "...gggggg...",
      "....gggg....",
    ],
  } as Patch,
  giriaChest: {
    r: 9,
    c: 6,
    rows: ["ssssssssssssGGGG", "ssssssssssssgggg", "............gggg", ".............gg."],
  } as Patch,
  armCigLips: {
    r: 5,
    c: 16,
    rows: ["sco", "ss.", "ss.", "ts.", "tt.", "tt."],
  } as Patch,
  // the coal lights the face on the draw: a halo around the ember, one warm
  // pixel on the brow and the lip — quantized light, one tier, no gradients
  emberFace: {
    r: 4,
    c: 16,
    rows: ["y.xx", "y..x", "..x."],
  } as Patch,
  // the deep drag: the halo widens while the core burns white (smokeD swaps o→c)
  emberFlare: {
    r: 4,
    c: 16,
    rows: ["yyxx", "y.xx", ".xx."],
  } as Patch,
  // the cigarette smokes itself at the hip — a thin curl, two phases so it
  // wavers between frames the way the water alternates in the shower
  wispA: {
    r: 9,
    c: 21,
    rows: [".v.", "..v", ".v.", "..v", ".v.", ".v.", "..v", ".v.", "..v", ".v."],
  } as Patch,
  wispB: {
    r: 9,
    c: 21,
    rows: ["..v", ".v.", "..v", ".v.", "..v", "..v", ".v.", "..v", ".v.", "..v"],
  } as Patch,
  // the exhale: dense at the lips, then dispersed and climbing
  puffA: {
    r: 1,
    c: 16,
    rows: ["..vv...", ".vvvv..", "..vvv..", "...vv..", "....v.."],
  } as Patch,
  puffB: {
    r: 0,
    c: 17,
    rows: [".v.v.v.", "v.vvv.v", ".v.v.v.", "...v...", "......."],
  } as Patch,
  // kettlebell, two-handed: arms straight down to the bell between the knees,
  // then swung out to chest height on the way up
  giriaLow: {
    r: 9,
    c: 4,
    rows: [
      "t..............t",
      "s..............s",
      "s..............s",
      ".s............s.",
      ".s............s.",
      "..s..........s..",
      "..s..........s..",
      "..s..........s..",
      "..s..........s..",
      "...sGGGGGGGGs...",
      "....gggggggg....",
      "....gggggggg....",
      ".....gggggg.....",
    ],
  } as Patch,
  giriaHigh: {
    r: 6,
    c: 14,
    rows: ["....ss..", "...sGGs.", "..sgggg.", "tssgggg.", "tt.gg..."],
  } as Patch,
  // barbell across the frame: bar R with plates P, full 24 columns
  barRack: {
    r: 10,
    c: 0,
    rows: ["PP..RRRRRRRRRRRRRRRR..PP", "PP....................PP"],
  } as Patch,
  barUp: {
    r: 1,
    c: 0,
    rows: ["PP..RRRRRRRRRRRRRRRR..PP", "PP....................PP"],
  } as Patch,
  armsRack: {
    r: 10,
    c: 4,
    rows: ["s..............s", "s..............s", "t..............t", "t..............t"],
  } as Patch,
  armsUp: {
    r: 2,
    c: 5,
    rows: [
      "s............s",
      "s............s",
      "s............s",
      "S............s",
      "t............t",
      "tt..........tt",
    ],
  } as Patch,
};

// Lying under the duvet: head on the pillow at the left, the navy duvet
// (palette u/U) mounded over the body, feet bump at the right. Two frames —
// the second one is the exhale.
// Sleeping, in the bed's own projection: the bedroom bed is drawn face-on
// (we look down onto the mattress), so the sleeper reads top-down too — a
// frontal face on the pillow at the left, eyes closed, one arm over a duvet
// ridge in the scene's slate colour (zones u/U), feet lump at the right.
const LYING_A: SpriteMap = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "..hhhh...........uuu....",
  ".hhhhhh..uuuuuuuuuuuu...",
  ".hssssh.uuuuuuuuuuuuuu..",
  ".hsSsShuuuuuuuuuuuuuuuu.",
  ".hsssshuuussssuuuuuuuuU.",
  "..ssss.uuuuuuuuuuuuuuuU.",
  "......Uuuuuuuuuuuuuuuu..",
  "......Uuuuuuuuuuuuuuuu..",
  ".....UUuuuuuuuuuuuuuuU..",
  ".....UUUUUUUUUUUUUUUUU..",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
];
// the breath: the chest side of the ridge lifts one pixel
const LYING_B: SpriteMap = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "..hhhh...uuuuu...uuu....",
  ".hhhhhh.uuuuuuuuuuuuu...",
  ".hssssh.uuuuuuuuuuuuuu..",
  ".hsSsShuuuuuuuuuuuuuuuu.",
  ".hsssshuuussssuuuuuuuuU.",
  "..ssss.uuuuuuuuuuuuuuuU.",
  "......Uuuuuuuuuuuuuuuu..",
  "......Uuuuuuuuuuuuuuuu..",
  ".....UUuuuuuuuuuuuuuuU..",
  ".....UUUUUUUUUUUUUUUUU..",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
];
// rolled to the side: more hair than face, knees drawn up under the ridge
const LYING_SIDE: SpriteMap = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "..hhhh......uuu..uuu....",
  ".hhhhhh..uuuuuuuuuuuu...",
  ".hhhssh.uuuuuuuuuuuuuu..",
  ".hhssShuuuuuuuuuuuuuuuu.",
  ".hhssshuuuuuuuuuuuuuuuU.",
  "..sss..uuuuuuuuuuuuuuuU.",
  "......Uuuuuuuuuuuuuuuu..",
  "......Uuuuuuuuuuuuuuuu..",
  ".....UUuuuuuuuuuuuuuuU..",
  ".....UUUUUUUUUUUUUUUUU..",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
];
// awake but not up: frontal, eyes open, duvet still over the lap
const LYING_SIT: SpriteMap = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "...hhhh.................",
  "..hhhhhh................",
  "..hssssh................",
  "..hseseh................",
  "..hssssh................",
  "...ssss.................",
  "..tttttt................",
  ".tttttttt...............",
  ".tttttttt...............",
  ".stttttts...............",
  ".stttttts...............",
  ".stttttts...............",
  "..s....s................",
  "..uuuuuuuuuuuuuuuuuuuu..",
  ".uuuuuuuuuuuuuuuuuuuuU..",
  ".uuuuuuuuuuuuuuuuuuuuU..",
  ".UUUUUUUUUUUUUUUUUUUUU..",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
];

// --- helpers ---------------------------------------------------------------------------

/** Shift only the head rows down one pixel — the idle breath / the bow. */
function bowHead(map: SpriteMap, depth = 1, top = 0): string[] {
  const width = map[0]?.length ?? 24;
  const empty = ".".repeat(width);
  const before = map.slice(0, top);
  const head = map.slice(top, top + 7);
  const after = map.slice(top + 7);
  return [
    ...before,
    ...Array.from({ length: depth }, () => empty),
    ...head.slice(0, head.length - depth),
    ...after,
  ];
}

/**
 * Lower the head+torso block into the legs by `depth` rows — bent knees and
 * sofas actually absorb height. Legs pixels win where the two overlap.
 */
function dropBody(map: SpriteMap, depth: number): string[] {
  const width = map[0]?.length ?? 24;
  const empty = ".".repeat(width);
  const body = map.slice(0, 20 - depth);
  const legs = map.slice(20);
  const dropped = [...Array.from({ length: depth }, () => empty), ...body];
  const overlapTop = map.slice(20 - depth, 20);
  const merged = legs.map((legRow, i) => {
    if (i >= depth) return legRow;
    const bodyRow = overlapTop[i] ?? empty;
    return legRow
      .split("")
      .map((ch, c) => (ch === "." || ch === " " ? (bodyRow[c] ?? ".") : ch))
      .join("");
  });
  return [...dropped, ...merged];
}

/** Tip the head back one pixel inside its window — a sip, a look up. */
function raiseChin(map: SpriteMap, top = 0): string[] {
  const width = map[0]?.length ?? 24;
  const empty = ".".repeat(width);
  const before = map.slice(0, top);
  const head = map.slice(top, top + 7);
  const after = map.slice(top + 7);
  return [...before, ...head.slice(1), empty, ...after];
}

// --- the character -------------------------------------------------------------------

const b = createCharacter({ palette: PLAYER_PALETTE, cell: 2, walkSpeed: 72 });

b.part("head", HEAD)
  .part("torso", TORSO)
  .part("legsStand", LEGS_STAND)
  .part("legsStride", LEGS_STRIDE)
  .part("legsPass", LEGS_PASS)
  .part("legsStrideLow", LEGS_STRIDE_LOW)
  .part("legsBent", LEGS_BENT)
  .part("legsSit", LEGS_SIT)
  .part("legsKneel", LEGS_KNEEL)
  .part("backHead", BACK_HEAD)
  .part("backTorso", BACK_TORSO)
  .part("backLegsKneel", BACK_LEGS_KNEEL)
  .part("backTorsoBare", BACK_TORSO_BARE)
  .part("backLegsBare", BACK_LEGS_BARE)
  .part("legsIdleShift", LEGS_IDLE_SHIFT)
  .part("legsTiptoe", LEGS_TIPTOE);

const base = (legs: string) => (f: Parameters<Parameters<typeof b.frame>[1]>[0]) =>
  f.stack("head", "torso", legs).patch(P.farArm);

// idle & life
b.frame("stand", (f) => base("legsStand")(f).patch(P.armDown));
b.variant("idleB", "stand", (m) => dropBody(m, 1));
b.variant("blink", "stand", (m) => replaceColor(m, "e", "s"));
b.variant("lookBack", "stand", (m) => mirrorRows(m, 0, 6));
b.frame("leanIdle", (f) =>
  f.stack("head", "torso", "legsIdleShift").patch(P.farArm).patch(P.armSwingBack),
);
b.frame("stretchA", (f) => base("legsStand")(f).patch(P.armUpBoth));
b.frame("stretchB", (f) => base("legsTiptoe")(f).patch(P.armUpBoth));
b.frame("squat", (f) =>
  base("legsBent")(f)
    .patch(P.armDown)
    .map((m) => dropBody(m, 2)),
);

// walking
b.frame("stride", (f) =>
  f.stack("head", "torso", "legsStride").patch(P.farArmFwd).patch(P.armSwingBack),
);
b.frame("pass", (f) => base("legsPass")(f).patch(P.armDown));
b.frame("strideLow", (f) =>
  f
    .stack("head", "torso", "legsStrideLow")
    .patch(P.farArmBack)
    .patch(P.armSwingFwd)
    .map((m) => dropBody(m, 1)),
);

// interactions
b.frame("reach", (f) =>
  base("legsStand")(f)
    .map((m) => bowHead(m))
    .patch(P.armReach),
);
b.frame("sit", (f) =>
  f
    .stack("head", "torso", "legsSit")
    .patch(P.farArm)
    .patch(P.armDown)
    .map((m) => dropBody(m, 4)),
);
b.variant("sitBack", "sit", (m) => bowHead(dropBody(m, 1), 1, 5));
b.frame("sitSlouch", (f) =>
  f
    .stack("head", "torso", "legsSit")
    .patch(P.farArm)
    .map((m) => bowHead(dropBody(m, 5), 2, 5))
    .patch({ r: 14, c: 15, rows: ["tt.", "ss.", "ss.", ".ss", ".ss", ".sS"] }),
);
b.frame("sitCross", (f) =>
  f
    .stack("head", "torso", "legsSit")
    .patch(P.farArm)
    .patch(P.armDown)
    .map((m) => dropBody(m, 4))
    .patch({ r: 27, c: 6, rows: ["....ppppp", "pppppp...", "bb......."] }),
);
b.frame("bedLie", (f) => f.raw(LYING_A));
b.frame("bedLieB", (f) => f.raw(LYING_B));
b.frame("bedSide", (f) => f.raw(LYING_SIDE));
b.frame("bedSitUp", (f) => f.raw(LYING_SIT));

b.frame("crouch", (f) =>
  base("legsBent")(f)
    .patch(P.armDown)
    .map((m) => dropBody(m, 2)),
);
b.variant("crouchB", "crouch", (m) => bowHead(m, 1, 2));

// sport: giria — the whole arc of a russian swing
b.frame("swingSetup", (f) =>
  f
    .stack("head", "torso", "legsBent")
    .map((m) => bowHead(dropBody(m, 2), 2, 2))
    .patch(P.giriaFloor),
);
b.frame("swingHike", (f) =>
  f
    .stack("head", "torso", "legsBent")
    .map((m) => bowHead(dropBody(m, 2), 2, 2))
    .patch(P.giriaBack),
);
b.frame("swingDown", (f) =>
  f
    .stack("head", "torso", "legsBent")
    .patch(P.giriaLow)
    .map((m) => bowHead(dropBody(m, 2), 1, 2)),
);
b.frame("swingUp", (f) => f.stack("head", "torso", "legsStand").patch(P.giriaChest));

// sport: barbell press
b.frame("pressRack", (f) =>
  f.stack("head", "torso", "legsStand").patch(P.armsRack).patch(P.barRack),
);
b.frame("pressDip", (f) =>
  f
    .stack("head", "torso", "legsBent")
    .patch(P.armsRack)
    .patch(P.barRack)
    .map((m) => dropBody(m, 2)),
);
b.frame("pressUp", (f) => f.stack("head", "torso", "legsStand").patch(P.armsUp).patch(P.barUp));

// sport: sambo shadow work
b.frame("samboA", (f) => base("legsStride")(f).patch(P.armGuardHigh));
b.frame("samboB", (f) =>
  base("legsBent")(f)
    .patch(P.armGuardLow)
    .map((m) => dropBody(m, 2)),
);
b.frame("samboC", (f) =>
  base("legsBent")(f)
    .patch(P.armGuardHigh)
    .map((m) => dropBody(m, 2)),
);

// phone home, tea, prayer, balcony lean
b.frame("phoneA", (f) => base("legsStand")(f).patch(P.armPhone));
b.variant("phoneB", "phoneA", (m) => bowHead(m));
b.frame("drinkA", (f) => base("legsStand")(f).patch(P.armMug));
b.frame("drinkB", (f) => base("legsStand")(f).patch(P.armMugUp));
b.variant("drinkD", "drinkB", (m) => raiseChin(m));
b.frame("crossA", (f) => base("legsStand")(f).patch(P.crossForehead));
b.frame("crossB", (f) => base("legsStand")(f).patch(P.crossChest));
b.frame("crossC", (f) => base("legsStand")(f).patch(P.crossFar));
b.frame("crossD", (f) => base("legsStand")(f).patch(P.crossNear));
b.frame("kneel", (f) =>
  f
    .stack("head", "torso", "legsKneel")
    .patch(P.farArm)
    .patch(P.handsFold)
    .map((m) => dropBody(m, 6)),
);
b.variant("kneelBow", "kneel", (m) => bowHead(m, 1, 6));
b.variant("kneelDeep", "kneel", (m) => bowHead(m, 2, 6));

// prayer, seen from behind — he faces the icon on the far wall
b.frame("backStand", (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.backArms));
b.frame("backPray", (f) =>
  f
    .stack("backHead", "backTorso", "legsStand")
    .patch(P.backArmsFold)
    .map((m) => bowHead(m, 1)),
);
b.frame("backCrossHead", (f) =>
  f.stack("backHead", "backTorso", "legsStand").patch(P.backCrossHigh),
);
b.frame("backCrossL", (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.backCrossL));
b.frame("backCrossR", (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.backCrossR));
b.frame("backKneel", (f) =>
  f
    .stack("backHead", "backTorso", "backLegsKneel")
    .patch(P.backArmsFold)
    .map((m) => dropBody(m, 6)),
);
b.variant("backKneelBow", "backKneel", (m) => bowHead(m, 1, 6));
b.variant("backKneelDeep", "backKneel", (m) => bowHead(m, 2, 6));

// the shower, from behind: shirt over the head, clothes on the floor, tap on,
// water falling in alternating streaks, hair — ribs — rinse — towel — dressed
b.frame("undress", (f) =>
  f
    .stack("backHead", "backTorso", "legsStand")
    .patch(P.washHairBoth)
    .map((m) => bowHead(m, 1)),
);
const bareHead = (m: SpriteMap) => replaceColor(replaceColor(m, "k", "h"), "K", "H");
b.frame("showerIdle", (f) =>
  f
    .stack("backHead", "backTorsoBare", "backLegsBare")
    .map(bareHead)
    .patch(P.bareArmsDown)
    .patch(P.clothesPile),
);
b.frame("showerTap", (f) =>
  f
    .stack("backHead", "backTorsoBare", "backLegsBare")
    .map(bareHead)
    .patch(P.showerTapArm)
    .patch(P.clothesPile),
);
b.frame("washHairA", (f) =>
  f
    .stack("backHead", "backTorsoBare", "backLegsBare")
    .map(bareHead)
    .patch(P.washHairBoth)
    .patch(P.clothesPile)
    .map((m) => bowHead(m, 1))
    .patch(P.waterA),
);
b.frame("washHairB", (f) =>
  f
    .stack("backHead", "backTorsoBare", "backLegsBare")
    .map(bareHead)
    .patch(P.washHairBoth)
    .patch(P.clothesPile)
    .patch(P.waterB),
);
b.frame("scrubA", (f) =>
  f
    .stack("backHead", "backTorsoBare", "backLegsBare")
    .map(bareHead)
    .patch(P.scrubTorso)
    .patch(P.clothesPile)
    .patch(P.waterA),
);
b.variant("scrubB", "scrubA", (m) => bowHead(m, 1));
b.frame("rinse", (f) =>
  f
    .stack("backHead", "backTorsoBare", "backLegsBare")
    .map(bareHead)
    .patch(P.bareArmsDown)
    .patch(P.clothesPile)
    .map((m) => raiseChin(m))
    .patch(P.waterB),
);
b.frame("towelOut", (f) =>
  f
    .stack("backHead", "backTorsoBare", "backLegsBare")
    .map(bareHead)
    .patch(P.bareArmsDown)
    .patch(P.towelWrap),
);

// the other business, also from behind: stance, patience, the ceiling stare,
// a shift of weight, the flush — posture does all the storytelling
b.frame("peeStand", (f) => f.stack("backHead", "backTorso", "legsStand").patch(P.peeArms));
b.variant("peeBow", "peeStand", (m) => bowHead(m, 1));
b.variant("peeUp", "peeStand", (m) => raiseChin(m));
b.frame("peeShift", (f) => f.stack("backHead", "backTorso", "legsIdleShift").patch(P.peeArms));
b.frame("peeFlush", (f) =>
  f
    .stack("backHead", "backTorso", "legsStand")
    .patch(P.backArmsFold)
    .map((m) => bowHead(m, 1)),
);
b.frame("leanA", (f) => base("legsStand")(f).patch(P.cigLean));
b.variant("leanB", "leanA", (m) => bowHead(m));

b.frame("reachHalf", (f) => base("legsStand")(f).patch(P.armReachHalf));
b.frame("petA", (f) =>
  f
    .stack("head", "torso", "legsBent")
    .patch(P.farArm)
    .map((m) => bowHead(dropBody(m, 2), 1, 2))
    .patch(P.armPetA),
);
b.frame("petB", (f) =>
  f
    .stack("head", "torso", "legsBent")
    .patch(P.farArm)
    .map((m) => bowHead(dropBody(m, 2), 1, 2))
    .patch(P.armPetB),
);
b.frame("scratchA", (f) =>
  f
    .stack("head", "torso", "legsBent")
    .patch(P.farArm)
    .map((m) => bowHead(dropBody(m, 2), 1, 2))
    .patch(P.armScratchA),
);
b.frame("scratchB", (f) =>
  f
    .stack("head", "torso", "legsBent")
    .patch(P.farArm)
    .map((m) => bowHead(dropBody(m, 2), 2, 2))
    .patch(P.armScratchB),
);
b.frame("ruffle", (f) =>
  f
    .stack("head", "torso", "legsBent")
    .map((m) => bowHead(dropBody(m, 2), 2, 2))
    .patch(P.armPetA)
    .patch({
      r: 14,
      c: 6,
      rows: [
        "s..",
        "s..",
        ".s.",
        ".s.",
        ".s.",
        ".ss",
        ".ss",
        "..s",
        "..s",
        "..s",
        "..s",
        "..s",
        "..s",
        "..s",
        "..S",
      ],
    }),
);
b.frame("swingMid", (f) =>
  f
    .stack("head", "torso", "legsBent")
    .patch(P.giriaMid)
    .map((m) => dropBody(m, 1)),
);
b.variant("drinkC", "drinkA", (m) => bowHead(m));
b.variant("phoneC", "phoneA", (m) => mirrorRows(m, 0, 6));
b.frame("phoneD", (f) =>
  f.stack("head", "torso", "legsIdleShift").patch(P.farArm).patch(P.armPhone),
);

// the guitar off the wall: settle it, strum, groove, chord change, let it ring.
// No hanging far arm in these stacks — the far hand is the one on the neck.
b.frame("gtrDown", (f) =>
  f.stack("head", "torso", "legsStand").patch(P.guitarBody).patch(P.gtrStrumDown).patch(P.gtrFret),
);
b.frame("gtrUp", (f) =>
  f.stack("head", "torso", "legsStand").patch(P.guitarBody).patch(P.gtrStrumUp).patch(P.gtrFret),
);
b.frame("gtrChord", (f) =>
  f.stack("head", "torso", "legsStand").patch(P.guitarBody).patch(P.gtrStrumUp).patch(P.gtrFretLow),
);
b.frame("gtrShift", (f) =>
  f
    .stack("head", "torso", "legsIdleShift")
    .patch(P.guitarBody)
    .patch(P.gtrStrumDown)
    .patch(P.gtrFret),
);
b.variant("gtrNodA", "gtrDown", (m) => bowHead(m));
b.variant("gtrNodB", "gtrUp", (m) => bowHead(m));
b.variant("gtrRing", "gtrUp", (m) => raiseChin(m));

// smoking, the full ritual: the cigarette curls at the hip (two wisp phases),
// the coal lights the face on the draw and flares white on the deep one, the
// exhale goes up with the chin, the weight shifts, the head drops to the street
b.frame("smokeA", (f) => base("legsStand")(f).patch(P.armCigDown).patch(P.wispA));
b.frame("smokeA2", (f) => base("legsStand")(f).patch(P.armCigDown).patch(P.wispB));
b.frame("smokeB", (f) => base("legsStand")(f).patch(P.armCigHalf));
b.frame("smokeC", (f) => base("legsStand")(f).patch(P.armCigLips).patch(P.emberFace));
b.frame("smokeD", (f) =>
  base("legsStand")(f)
    .patch(P.armCigLips)
    .patch(P.emberFlare)
    .map((m) => replaceColor(m, "o", "c")),
);
b.variant("smokeE", "smokeA", (m) => bowHead(m));
b.frame("smokeF", (f) =>
  base("legsStand")(f)
    .patch(P.armCigHalf)
    .map((m) => raiseChin(m))
    .patch(P.puffA),
);
b.frame("smokeF2", (f) =>
  base("legsStand")(f)
    .patch(P.armCigHalf)
    .map((m) => raiseChin(m))
    .patch(P.puffB),
);
b.frame("smokeH", (f) =>
  f.stack("head", "torso", "legsIdleShift").patch(P.farArm).patch(P.armCigDown).patch(P.wispB),
);

b.walkCycle(...WALK_CYCLE);
const ACTION_OVERRIDES: Record<string, ActionDef> = {
  ...ACTIONS,
  use: { frames: ["reachHalf", "reach", "reach", "reachHalf"], frameMs: 150, loops: 1 },
  sit: {
    frames: [
      "crouch",
      "sit",
      "sit",
      "sitBack",
      "sitBack",
      "sitCross",
      "sitCross",
      "sitBack",
      "sit",
    ],
    frameMs: 520,
    loops: 1,
  },
  lay: {
    frames: [
      "crouch",
      "sit",
      "bedSitUp",
      "bedLie",
      "bedLieB",
      "bedLie",
      "bedLieB",
      "bedSide",
      "bedSide",
      "bedLie",
      "bedLieB",
      "bedLie",
      "bedSitUp",
      "sit",
    ],
    frameMs: 560,
    loops: 1,
  },
  pet: {
    frames: [
      "crouch",
      "petA",
      "petB",
      "petA",
      "petB",
      "scratchA",
      "scratchB",
      "scratchA",
      "scratchB",
      "scratchA",
      "petA",
      "ruffle",
      "ruffle",
      "petB",
      "crouchB",
    ],
    frameMs: 270,
    loops: 1,
    interruptible: true,
  },
  drink: {
    frames: ["drinkA", "drinkB", "drinkD", "drinkD", "drinkB", "drinkC", "drinkA"],
    frameMs: 420,
    loops: 2,
  },
  // Żabka counter rituals — the mug zone doubles as a paper cup and a bun
  coffee: {
    frames: ["drinkA", "drinkB", "drinkD", "drinkB", "drinkD", "drinkC", "drinkA"],
    frameMs: 460,
    loops: 2,
  },
  // Alchemia's machines — all built from frames the rig already owns
  run: {
    frames: ["strideLow", "pass", "stride", "pass"],
    frameMs: 150,
    loops: 8,
    interruptible: true,
  },
  cycle: {
    frames: ["crouch", "crouchB", "crouch", "crouchB"],
    frameMs: 220,
    loops: 5,
    interruptible: true,
  },
  stretch: {
    frames: [
      "stretchA",
      "stretchB",
      "stretchB",
      "stretchA",
      "leanIdle",
      "stretchA",
      "stretchB",
      "stretchA",
    ],
    frameMs: 420,
    loops: 1,
    interruptible: true,
  },
  pull: {
    frames: ["reach", "stretchB", "reach", "stretchB", "reach"],
    frameMs: 380,
    loops: 2,
    interruptible: true,
  },
  squat: {
    frames: ["stand", "crouch", "crouch", "stand"],
    frameMs: 340,
    loops: 4,
    interruptible: true,
  },
  deadlift: {
    frames: ["crouchB", "crouch", "stand", "stand", "crouch", "crouchB"],
    frameMs: 380,
    loops: 3,
    interruptible: true,
  },
  hotdog: {
    frames: ["drinkA", "drinkC", "drinkA", "drinkC", "drinkA", "drinkB", "drinkC", "drinkA"],
    frameMs: 380,
    loops: 1,
  },
  call: {
    frames: [
      "phoneA",
      "phoneB",
      "phoneA",
      "phoneD",
      "phoneD",
      "phoneC",
      "phoneD",
      "phoneA",
      "phoneB",
      "phoneA",
    ],
    frameMs: 900,
    loops: 2,
    interruptible: true,
  },
  swing: {
    frames: [
      "swingSetup",
      "swingHike",
      "swingDown",
      "swingMid",
      "swingUp",
      "swingMid",
      "swingDown",
      "swingHike",
      "swingDown",
      "swingMid",
      "swingUp",
      "swingMid",
      "swingDown",
      "swingHike",
      "swingDown",
      "swingMid",
      "swingUp",
      "swingMid",
      "swingDown",
      "swingSetup",
    ],
    frameMs: 280,
    loops: 1,
    interruptible: true,
  },
  press: {
    frames: ["pressRack", "pressDip", "pressUp", "pressUp", "pressDip", "pressRack"],
    frameMs: 360,
    loops: 2,
  },
  sambo: {
    frames: ["samboA", "samboC", "samboB", "samboC", "samboA", "samboB"],
    frameMs: 260,
    loops: 2,
  },
  // the whole rite, in the correct projection: a glance up at the icon, then
  // he turns INTO the scene (back to the camera), crosses himself — forehead,
  // chest, shoulder to shoulder — folds his hands, goes down on both knees,
  // bows three times and holds the deepest one, rises, crosses himself again
  // and turns back out.
  pray: {
    frames: [
      "lookBack",
      "backStand",
      "backCrossHead",
      "backStand",
      "backCrossR",
      "backCrossL",
      "backStand",
      "backPray",
      "backPray",
      "backKneel",
      "backKneelBow",
      "backKneelDeep",
      "backKneelDeep",
      "backKneelDeep",
      "backKneelBow",
      "backKneel",
      "backPray",
      "backCrossHead",
      "backCrossR",
      "backCrossL",
      "backStand",
      "lookBack",
      "stand",
    ],
    frameMs: 460,
    loops: 1,
    interruptible: true,
  },
  // settle — raise — draw (coal lights the face) — deep drag (flare) — hold —
  // lower — exhale with the chin up, twice as the puff climbs — the cigarette
  // smokes itself at the hip — weight to the other foot — a look at the street
  smoke: {
    frames: [
      "smokeA",
      "smokeB",
      "smokeC",
      "smokeD",
      "smokeD",
      "smokeC",
      "smokeB",
      "smokeF",
      "smokeF2",
      "smokeA",
      "smokeA2",
      "smokeH",
      "smokeA2",
      "smokeE",
    ],
    frameMs: 400,
    loops: 2,
    interruptible: true,
  },
  // the full wash: undress over the head, tap on, hair, ribs, rinse with the
  // chin up, tap off, towel, dressed again. Water alternates per frame.
  shower: {
    frames: [
      "backStand",
      "undress",
      "undress",
      "showerIdle",
      "showerTap",
      "washHairA",
      "washHairB",
      "washHairA",
      "washHairB",
      "scrubA",
      "scrubB",
      "scrubA",
      "washHairA",
      "washHairB",
      "rinse",
      "rinse",
      "showerTap",
      "towelOut",
      "towelOut",
      "undress",
      "backStand",
      "lookBack",
    ],
    frameMs: 380,
    loops: 1,
    interruptible: true,
  },
  // stance — patience — the ceiling stare — shift — flush. Off-screen where it
  // counts, on-screen where it's funny.
  pee: {
    frames: [
      "backStand",
      "peeStand",
      "peeBow",
      "peeStand",
      "peeUp",
      "peeUp",
      "peeStand",
      "peeShift",
      "peeStand",
      "peeBow",
      "peeFlush",
      "peeFlush",
      "backStand",
      "lookBack",
    ],
    frameMs: 420,
    loops: 1,
    interruptible: true,
  },
  // the whole performance: lift it off the wall, settle, two bars with the
  // eyes on the strings, the groove taking the head, a chord change, weight
  // to the back foot, the last chord rung out with the chin up — and back
  // on its hook. SFX strums are timed to these frames in the handler.
  strum: {
    frames: [
      "reachHalf",
      "reach",
      "gtrDown",
      "gtrDown",
      "gtrUp",
      "gtrDown",
      "gtrUp",
      "gtrDown",
      "gtrNodB",
      "gtrNodA",
      "gtrNodB",
      "gtrNodA",
      "gtrChord",
      "gtrUp",
      "gtrDown",
      "gtrUp",
      "gtrShift",
      "gtrNodB",
      "gtrNodA",
      "gtrDown",
      "gtrRing",
      "gtrRing",
      "gtrDown",
      "reachHalf",
    ],
    frameMs: 320,
    loops: 1,
    interruptible: true,
  },
};
for (const [id, def] of Object.entries(ACTION_OVERRIDES)) {
  b.action(id, def);
}

/** The one true resident of Słoneczna 14 / m. 14. */
export const PLAYER: PlayerConfig = b.build();
