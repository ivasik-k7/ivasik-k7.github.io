import { ACTIONS, PLAYER_PALETTE } from "@/components/game/sprites";
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

// Contact — the frame where a foot lands. The 16 cells between the shoe
// centres are not a drawing choice: the runtime advances one walk frame per
// 16 logical px, so a four-frame cycle covers 64 px of ground and each of its
// two steps covers 32 px. Feet 16 cells apart at cell 2 is exactly 32 px, so
// the planted foot stays where it was put instead of skating forward under
// him. It also lands at 0.42 of his height, which is where a walking step of
// a man this size actually lands.
//
// The trailing leg is drawn a tone down (q fill, Q edge) because at a contact
// one leg is behind the other and the whole point of the pose is which. That
// makes the set asymmetric in colour and symmetric in silhouette, so the
// opposite contact is the same map with the leg rows mirrored — the far leg
// becomes the near one, the body does not move, and the face never flips.
const LEGS_CONTACT: SpriteMap = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......Qqqqq..ppppq......",
  "......Qqqqq..ppppq......",
  ".....Qqqqq....ppppq.....",
  ".....Qqqqq....ppppq.....",
  ".....Qqqq......pppq.....",
  "....Qqqq........pppq....",
  "....Qqqq........pppq....",
  "....Qqqq........pppq....",
  "...Qqqq..........pppq...",
  "...Qqqq..........pppq...",
  "...Qqq............ppq...",
  "...Qqq............ppq...",
  "...Sqq............pps...",
  "...BBB............bbb...",
  "..BBBB............bbbb..",
  "..BBBB............BBBB..",
];

// Pass — the halfway frame, where one leg carries and the other swings past
// it. The carrying leg sits dead centre (columns 10-13, symmetric about 11.5)
// so mirroring the leg rows leaves the supporting foot exactly where it was
// and swaps only which leg is doing the work. The swinging foot is three rows
// clear of the floor; a foot that never leaves the ground is a shuffle.
const LEGS_PASS: SpriteMap = [
  "......qppppppppppq......",
  "......qppppppppppq......",
  "......Qqqqqpppppq.......",
  "......Qqqqqpppppq.......",
  ".......Qqqqppppq........",
  ".......Qqqqppppq........",
  ".......Qqqppppq.........",
  ".......Qqqppppq.........",
  ".......Qqqpppq..........",
  ".......Qqqpppq..........",
  ".......Qqqpppq..........",
  ".......Qqqpppq..........",
  ".......Sqqpppq..........",
  ".......BBBpppq..........",
  "......BBBBppps..........",
  "..........bbbb..........",
  "..........bbbb..........",
  "..........BBBB..........",
];

// Half depth — the pose between standing and LEGS_BENT. Without it every
// squat, deadlift and pick-up in the game is a two-frame strobe between two
// heights 300 cells apart; with it they are three, and the knee reads as
// bending rather than as the body teleporting down. The empty top row is the
// height the bend absorbs, filled by dropBody(1).
//
// The shoes land on exactly the columns LEGS_STAND leaves them on, because
// nobody moves their feet to squat. LEGS_BENT does slide them three cells
// outward on each side, which is a defect of its own; keeping the halfway
// pose honest at least means the entry into a bend costs nothing.
const LEGS_HALF: SpriteMap = [
  "........................",
  "......qppppppppppq......",
  "......qppppppppppq......",
  ".....qppppppppppppq.....",
  ".....qpppp....ppppq.....",
  ".....qpppp....ppppq.....",
  ".....qppp......pppq.....",
  ".....qppp......pppq.....",
  ".....qppp......pppq.....",
  "......qpp......ppq......",
  "......qpp......ppq......",
  "......qpp......ppq......",
  "......qpp......ppq......",
  "......qpp......ppq......",
  "......spp......pps......",
  "......bbb......bbb......",
  "......bbbb....bbbb......",
  "......BBBB....BBBB......",
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

// Falling water, two streaks either side of him, alternating rows per frame.
// The streaks used to run straight down the middle in opaque `c`, patched last,
// so they erased the torso and the figure read as a white barcode. There is no
// translucent zone in this palette, so the fix is placement: the columns are
// picked to miss the body and only graze the shoulders.
const waterRows = (off: number): string[] =>
  Array.from({ length: 32 }, (_, i) =>
    (i + off) % 2 === 0 ? "c..c..............c..c" : "......................",
  );

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
  // Halfway through the swing, at the pass. Not vertical: an arm at the pass
  // is already travelling, and drawing it plumb is what makes a walk look like
  // a mannequin being slid along. Both are a row shorter than armDown because
  // an arm swinging out of the plane is foreshortened.
  armMidFwd: {
    r: 8,
    c: 19,
    rows: [
      "ttt.",
      "ttt.",
      "tss.",
      "sys.",
      "sys.",
      ".sss",
      ".ss.",
      ".sss",
      ".sss",
      "..ss",
      "..ss",
      "..sS",
      "..SS",
    ],
  } as Patch,
  armMidBack: {
    r: 8,
    c: 18,
    rows: [
      ".ttt",
      ".ttt",
      ".tss",
      ".sys",
      ".sys",
      "sss.",
      ".ss.",
      "sss.",
      "sss.",
      "ss..",
      "ss..",
      "sS..",
      "SS..",
    ],
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
  // A hand up at the shoulder, palm turned out — the shape a person makes
  // while explaining something. Small: at 24 columns a gesture is four pixels.
  armTalkUp: {
    r: 7,
    c: 17,
    rows: ["..ss", ".sss", ".ss.", "tss.", "ttt.", "tt..", "tt.."],
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
      "...............nnR.",
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
    c: 20,
    rows: [".v.", "..v", ".v.", "..v", ".v.", ".v.", "..v", ".v.", "..v", ".v."],
  } as Patch,
  wispB: {
    r: 9,
    c: 20,
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
    c: 16,
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
  // Barbell across the frame: bar R with plates P. 22 columns, not 24 — the
  // builder pads every frame to the widest one and the runtime centres that
  // box on the player's x, so a frame that fills the box leaves no room and
  // the next wide prop would shift the whole character off his own feet.
  barRack: {
    r: 10,
    c: 1,
    rows: ["PP.RRRRRRRRRRRRRRRR.PP", "PP..................PP"],
  } as Patch,
  barUp: {
    r: 1,
    c: 1,
    rows: ["PP.RRRRRRRRRRRRRRRR.PP", "PP..................PP"],
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
  // The opposite half of the walk is the same legs with the rows mirrored:
  // the trailing leg becomes the leading one and the shading swaps with it,
  // while the head, torso and arms — which are stacked and patched after —
  // stay facing the way they were.
  .part("legsPassAlt", mirrorRows(LEGS_PASS, 0, LEGS_PASS.length - 1))
  .part("legsContact", LEGS_CONTACT)
  .part("legsContactAlt", mirrorRows(LEGS_CONTACT, 0, LEGS_CONTACT.length - 1))
  .part("legsHalf", LEGS_HALF)
  .part("legsBent", LEGS_BENT)
  .part("legsSit", LEGS_SIT)
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
// The same blink at the out-breath height. `blink` is derived from `stand`, so
// a blink landing in the exhale half of the breath used to lift the whole body
// back up a pixel for as long as the lids were shut. The eyes close; the ribs
// do not jump.
b.variant("blinkLow", "idleB", (m) => replaceColor(m, "e", "s"));
b.variant("lookBack", "stand", (m) => mirrorRows(m, 0, 6));
b.frame("leanIdle", (f) =>
  f.stack("head", "torso", "legsIdleShift").patch(P.farArm).patch(P.armSwingBack),
);
b.frame("stretchA", (f) => base("legsStand")(f).patch(P.armUpBoth));
b.frame("stretchB", (f) => base("legsTiptoe")(f).patch(P.armUpBoth));

// Walking: contact, pass, opposite contact, opposite pass — two steps, which is
// what a cycle is. The old one was contact, stand, pass, stand: half of it was
// the idle pose, so he covered one step per cycle and came back to attention
// twice on the way.
//
// The contacts sit a pixel lower than the passes. A body is at its lowest when
// a foot lands and at its highest riding over the straight support leg, and
// that pixel is most of the difference between walking and sliding.
//
// The arms are the legs' opposite and reverse with them: near leg forward means
// near arm back, and the mid-swing arms carry the change through the passes so
// the swing never stops. Previously the arms hung still for three frames in
// four and swung forward on the fourth.
b.frame("contactA", (f) =>
  f
    .stack("head", "torso", "legsContact")
    .patch(P.farArmFwd)
    .patch(P.armSwingBack)
    .map((m) => dropBody(m, 1)),
);
b.frame("passA", (f) => base("legsPass")(f).patch(P.armMidFwd));
b.frame("contactB", (f) =>
  f
    .stack("head", "torso", "legsContactAlt")
    .patch(P.farArmBack)
    .patch(P.armSwingFwd)
    .map((m) => dropBody(m, 1)),
);
b.frame("passB", (f) => base("legsPassAlt")(f).patch(P.armMidBack));

// The pose between standing and the deep bend — a knee on its way down rather
// than a body that has teleported to a new height.
b.frame("crouchHalf", (f) =>
  base("legsHalf")(f)
    .patch(P.armDown)
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
// Standing over the bell, and the dip toward it. Without these the swing began
// with him upright and empty-handed one frame and bent double over a kettlebell
// that had materialised on the floor the next.
b.frame("swingStand", (f) => f.stack("head", "torso", "legsStand").patch(P.giriaFloor));
b.frame("swingDip", (f) =>
  f
    .stack("head", "torso", "legsHalf")
    .map((m) => bowHead(dropBody(m, 1), 1, 1))
    .patch(P.giriaFloor),
);

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
// Taking the bar off the low rack: hands already on it, knees still bent. The
// press used to conjure a loaded barbell into the hands of a standing man.
b.frame("pressLift", (f) =>
  f
    .stack("head", "torso", "legsHalf")
    .patch(P.armsRack)
    .patch(P.barRack)
    .map((m) => dropBody(m, 1)),
);

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
// Mid-level, on the way in or out of the stance. The loop used to run straight
// from the splayed standing guard to the deep one twice a second.
b.frame("samboD", (f) =>
  base("legsHalf")(f)
    .patch(P.armGuardHigh)
    .map((m) => dropBody(m, 1)),
);

// phone home, tea, prayer, balcony lean
b.frame("phoneA", (f) => base("legsStand")(f).patch(P.armPhone));
b.variant("phoneB", "phoneA", (m) => bowHead(m));
b.frame("drinkA", (f) => base("legsStand")(f).patch(P.armMug));
b.frame("drinkB", (f) => base("legsStand")(f).patch(P.armMugUp));
b.variant("drinkD", "drinkB", (m) => raiseChin(m));
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
// The reach for the cistern. It used to be backArmsFold over a bowed head,
// which is byte-for-byte the prayer pose — funny, but it meant editing one
// silently edited the other. The raised arm is the same one that reaches the
// shower tap, which is the right shape and costs nothing.
b.frame("peeFlush", (f) =>
  f
    .stack("backHead", "backTorso", "legsStand")
    .patch(P.showerTapArm)
    .map((m) => bowHead(m, 1)),
);
b.frame("reachHalf", (f) => base("legsStand")(f).patch(P.armReachHalf));
// Talking. He faces whoever he is talking to already, so what is missing is
// the hand and the nod, not a head turn: one raised palm, and the same pose
// with the chin dropped a pixel.
b.frame("talkA", (f) => base("legsStand")(f).patch(P.armTalkUp));
b.variant("talkB", "talkA", (m) => bowHead(m));
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

// The cycle lives here, next to the frames it names. It used to be imported
// from the legacy sprite file, three rooms away from the poses, which is how
// it came to contain the standing idle twice without anyone noticing.
b.walkCycle("contactA", "passA", "contactB", "passB");
/**
 * Every action used to begin and end on a hard cut: the first frame appeared
 * the moment the key was pressed and the last one was replaced by the standing
 * idle on the tick after it. `sit` ended seated and the next frame was a man on
 * his feet; `swing` went from standing empty-handed to bent double over a
 * kettlebell that had appeared on the floor.
 *
 * `enter` and `exit` are the way in and the way out, played once around the
 * loop. `abort` replaces `exit` when the player walks away — shorter, because
 * making somebody watch a four-frame stand-up after they have already pressed
 * a direction is worse than the pop was.
 *
 * One constraint on `enter` in particular: handlers.ts times sound and toasts
 * to these animations in absolute milliseconds, so anything played before the
 * loop shifts that schedule. `pee`, `shower`, `strum`, `call` and `pray` open
 * on a pose that already works as an entry and are left alone; only their exits
 * and aborts are new.
 */
const ACTION_OVERRIDES: Record<string, ActionDef> = {
  ...ACTIONS,
  use: { frames: ["reachHalf", "reach", "reach", "reachHalf"], frameMs: 150, loops: 1 },
  // down through a half squat and a crouch, and back up through the forward
  // hunch that is how a person actually gets off a sofa
  sit: {
    enter: ["crouchHalf", "crouch"],
    frames: ["sit", "sit", "sitBack", "sitBack", "sitCross", "sitCross", "sitBack"],
    exit: ["sitSlouch", "crouchB", "crouchHalf"],
    abort: ["sitSlouch", "crouchB"],
    frameMs: 480,
    loops: 1,
    interruptible: true,
  },
  // Not interruptible: the bed handler opens the sleep panel on a timer that
  // nothing cancels, so walking away would still put it in your face.
  lay: {
    enter: ["crouchHalf", "crouch"],
    frames: ["sit", "bedSitUp", "bedLie", "bedLieB", "bedSide", "bedSide", "bedLieB", "bedLie"],
    exit: ["bedSitUp", "sit", "sitSlouch", "crouchB", "crouchHalf"],
    frameMs: 560,
    loops: 1,
  },
  pet: {
    enter: ["crouchHalf"],
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
    exit: ["crouchHalf"],
    abort: ["crouchHalf"],
    frameMs: 270,
    loops: 1,
    interruptible: true,
  },
  drink: {
    enter: ["reachHalf"],
    frames: ["drinkA", "drinkB", "drinkD", "drinkD", "drinkB", "drinkC", "drinkA"],
    exit: ["reachHalf"],
    abort: ["reachHalf"],
    frameMs: 420,
    loops: 2,
    interruptible: true,
  },
  // Żabka counter rituals — the mug zone doubles as a paper cup and a bun
  coffee: {
    enter: ["reachHalf"],
    frames: ["drinkA", "drinkB", "drinkD", "drinkB", "drinkD", "drinkC", "drinkA"],
    exit: ["reachHalf"],
    abort: ["reachHalf"],
    frameMs: 460,
    loops: 2,
    interruptible: true,
  },
  // Alchemia's machines — all built from frames the rig already owns
  run: {
    frames: ["contactA", "passA", "contactB", "passB"],
    frameMs: 150,
    loops: 8,
    interruptible: true,
  },
  cycle: {
    enter: ["crouchHalf"],
    frames: ["crouch", "crouchB", "crouch", "crouchB"],
    exit: ["crouchHalf"],
    abort: ["crouchHalf"],
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
  // Three depths, not two. Standing straight to a full bent-knee crouch is a
  // 300-cell change, and at 340 ms that reads as a strobe rather than a squat.
  squat: {
    frames: ["crouchHalf", "crouch", "crouch", "crouchHalf", "stand"],
    abort: ["crouchHalf"],
    frameMs: 240,
    loops: 4,
    interruptible: true,
  },
  deadlift: {
    enter: ["crouchHalf"],
    frames: ["crouchB", "crouch", "crouchHalf", "stand", "stand", "crouchHalf", "crouch"],
    exit: ["crouchHalf"],
    abort: ["crouchHalf"],
    frameMs: 300,
    loops: 3,
    interruptible: true,
  },
  hotdog: {
    enter: ["reachHalf"],
    frames: ["drinkA", "drinkC", "drinkA", "drinkC", "drinkA", "drinkB", "drinkC", "drinkA"],
    exit: ["reachHalf"],
    abort: ["reachHalf"],
    frameMs: 380,
    loops: 1,
    interruptible: true,
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
    abort: ["phoneA"],
    frameMs: 900,
    loops: 2,
    interruptible: true,
  },
  // the bell is on the floor before he bends to it, and back on the floor
  // before he straightens up
  swing: {
    enter: ["swingStand", "swingDip"],
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
    exit: ["swingDip", "swingStand"],
    abort: ["swingDip", "swingStand"],
    frameMs: 280,
    loops: 1,
    interruptible: true,
  },
  press: {
    enter: ["crouchHalf", "pressLift"],
    frames: ["pressRack", "pressDip", "pressUp", "pressUp", "pressDip", "pressRack"],
    exit: ["pressLift", "crouchHalf"],
    abort: ["pressLift", "crouchHalf"],
    frameMs: 360,
    loops: 2,
    interruptible: true,
  },
  // samboD is the mid-level guard; without it the loop jumped between a
  // standing stance and a deep one four times a second, including at the seam
  sambo: {
    enter: ["samboD"],
    frames: ["samboA", "samboD", "samboC", "samboB", "samboC", "samboD"],
    exit: ["samboD"],
    abort: ["samboD"],
    frameMs: 260,
    loops: 2,
    interruptible: true,
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
    abort: ["backStand", "lookBack"],
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
    abort: ["smokeA"],
    frameMs: 400,
    loops: 2,
    interruptible: true,
  },
  // the full wash: undress over the head, tap on, hair, ribs, rinse with the
  // chin up, tap off, towel, dressed again. Water alternates per frame.
  // Walking out mid-wash used to put him in a black tee two frames after he
  // was naked under the spray; the abort reaches for the towel first.
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
    abort: ["towelOut", "undress", "backStand", "lookBack"],
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
    abort: ["backStand", "lookBack"],
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
    abort: ["gtrDown", "reachHalf"],
    frameMs: 320,
    loops: 1,
    interruptible: true,
  },
  // Nothing starts this yet — the dialogue system does not drive the player's
  // animation at all, so during every conversation in the game he stands
  // breathing. The frames are here so that when something does, there is
  // something to play other than a phone held to his ear, which is what `talk`
  // used to be.
  talk: {
    frames: ["stand", "talkA", "talkB", "talkA", "idleB", "talkA", "talkB", "stand"],
    frameMs: 340,
    loops: 1,
    interruptible: true,
  },
};
for (const [id, def] of Object.entries(ACTION_OVERRIDES)) {
  b.action(id, def);
}

/** The one true resident of Słoneczna 14 / m. 14. */
export const PLAYER: PlayerConfig = b.build();
