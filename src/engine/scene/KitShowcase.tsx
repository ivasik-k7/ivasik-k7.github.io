import { useState } from "react";
import {
  cobbles,
  courses,
  flight,
  GroundPaint,
  grate,
  groundLayers,
  herringbone,
  kerbStones,
  leaves,
  manhole,
  paintLine,
  planksToward,
  plates,
  puddle,
  Stairs,
  tactile,
  tufts,
  tyreTracks,
  zebra,
} from "./groundKit";
import {
  castShadows,
  doorSpill,
  Fixture,
  fixture,
  glow,
  Neon,
  neon,
  PhaseWash,
  screenLight,
  streetLamp,
  sunFor,
  sunShaft,
  UnderShade,
  underShade,
  windowGlow,
  windowSpill,
} from "./lightKit";
import {
  Bev,
  Box,
  bevelPaths,
  boxPaths,
  Cylinder,
  chips,
  cylinderPaths,
  dampBloom,
  dth,
  Flick,
  glyphRects,
  Light,
  M,
  type Mat,
  matFrom,
  mirrorX,
  outline,
  type Ph,
  PixelText,
  phased,
  pxPath,
  type Rect,
  rustRuns,
  SharedDefs,
  saltLine,
  steppedArch,
  steppedLine,
  steppedRing,
  streaks,
} from "./pixelKit";

/**
 * /kit — every primitive in the three kits, drawn once each, at the game's
 * scale, with a phase switch. It exists so a helper can be looked at before it
 * is trusted, and so the next scene can be built by pointing at a tile and
 * saying "that one".
 *
 * Each tile is a 300×110 svg; the ground tiles carry a band from y=70 to
 * y=100 so the foreshortening reads the way it does in a scene.
 */

const TW = 300;
const TH = 110;
const TOP = 70;
const BOT = 100;

const GRANITE = matFrom("#8f8a80");
const OAK = M.oak;
const CONC = M.concrete;
const STEEL = M.steel;

function Tile({
  title,
  children,
  bg = "#1a160f",
}: {
  title: string;
  children: React.ReactNode;
  bg?: string;
}) {
  return (
    <figure className="m-0 flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${TW} ${TH}`}
        width="100%"
        shapeRendering="crispEdges"
        style={{ imageRendering: "pixelated", background: bg, display: "block" }}
        aria-label={title}
      >
        <SharedDefs />
        {children}
      </svg>
      <figcaption className="font-mono text-[11px] text-neutral-400">{title}</figcaption>
    </figure>
  );
}

/* ---- ground tiles, precomputed ------------------------------------------- */
const SLABS = courses(0, TW, TOP, BOT, { far: 6, near: 11, unit: 26, stagger: true });
const SLAB_TONE = plates(0, TW, TOP, BOT, { far: 6, near: 11, unit: 26, stagger: true, seed: 3 });
const BOARDS = courses(0, TW, TOP, BOT, { far: 6, near: 10 });
const PLANKS = planksToward(0, TW, TOP, BOT, { unit: 14 });
const HERRING = herringbone(0, TW, TOP, BOT, 12);
const COBBLES = cobbles(0, TW, TOP, BOT, { size: 7 });
const FLIGHT_DOWN = flight({ x: 150, y: 74, w: 70, steps: 6, dir: "down", going: 4 });
const FLIGHT_RIGHT = flight({ x: 60, y: BOT, w: 40, steps: 7, dir: "right", rise: 5, going: 6 });
const FLIGHT_LEFT = flight({ x: 260, y: BOT, w: 40, steps: 7, dir: "left", rise: 5, going: 6 });
const KERB = kerbStones(0, TW, BOT - 4, 4, 40);
const GRATE = grate(60, 84, 30, 6);
const MANHOLE = manhole(150, 86);
const PAINT = paintLine(0, TW, 92, 2, { dash: 22, gap: 12 });
const ZEBRA = zebra(180, 74, 100, 22, 5);
const TACTILE = tactile(20, 76, 60, 10);
const TRACKS = tyreTracks(0, TW, 80, 10);
const LEAVES = leaves(0, TW, TOP + 2, BOT - 2, 30);
const TUFTS = tufts(0, TW, TOP + 1, 14);
const PUDDLE = puddle(200, 88, 26, 4);
const COMPOSED = groundLayers({
  x0: 0,
  x1: TW,
  top: TOP,
  bottom: BOT,
  mat: GRANITE,
  kind: "tiles",
  unit: 26,
  stagger: true,
  worn: [[30, 220]],
  pattern: "px-agg",
  litter: 12,
});
const COMPOSED_COBBLE = groundLayers({
  x0: 0,
  x1: TW,
  top: TOP,
  bottom: BOT,
  mat: matFrom("#6d6a62"),
  kind: "cobbles",
  unit: 7,
  worn: [[60, 260]],
});

/* ---- volume & material tiles --------------------------------------------- */
const CRATES = boxPaths(
  [
    [40, 60, 40, 30],
    [110, 50, 30, 40],
  ],
  4,
);
const PIPES = cylinderPaths([[180, 30, 14, 70]]);
const PIPE_H = cylinderPaths([[200, 40, 90, 12]], true);
const RING = steppedRing(60, 45, 22, 22, 3, 1);
const ARCH = steppedArch(120, 60, 50, 24);
const LINE_A = steppedLine(190, 20, 290, 60, 2);
const LINE_B = steppedLine(190, 60, 290, 30);
const WHEELCHAIR = glyphRects(
  [
    "   ##    ",
    "   ##    ",
    "         ",
    "  ####   ",
    "  #  #   ",
    " ##  #   ",
    "##   ##  ",
    "#     #  ",
    "#    ##  ",
    " ##### # ",
    "  ###    ",
  ],
  40,
  30,
);
const MIRRORED = mirrorX(WHEELCHAIR, 130);
const WALL: Rect = [0, 0, TW, TOP];
const DAMP = dampBloom(90, 30, 30, 16);
const SALT = saltLine(64, 44, 52);
const STREAKS = streaks(160, 30, 80, 8, 3, 18);
const CHIPS = chips(200, 68, 90, 5);
const RUST = rustRuns([
  [40, 20],
  [70, 24],
  [260, 18],
]);

/* ---- light tiles --------------------------------------------------------- */
const TUBE = fixture(150, 8, TOP, { w: 60, spread: 90 });
const LAMP = streetLamp(70, 14, TOP, { reach: 70 });
const SPILL = windowSpill([200, 20, 40, 40], TOP, { reach: 26, skew: 10 });
const WIN_GLOW = windowGlow([200, 20, 40, 40]);
const DOOR = doorSpill(40, 30, TOP);
const GLOW = glow(250, 50, 24);
const SCREEN = screenLight(120, 60, 30);
const NEON = neon([...outline(30, 20, 70, 30, 3), ...glyphRects(["###", "# #", "###"], 110, 24)]);
const SHAFT = sunShaft(0, TW, 20, 14, 24);
const UNDER = underShade([[40, 40, 60, 10]]);
const UPRIGHTS: Rect[] = [
  [40, 30, 6, 40],
  [120, 40, 4, 30],
  [220, 26, 8, 44],
];

const PHASES: Ph[] = ["dawn", "day", "dusk", "night"];

export function KitShowcase() {
  const [ph, setPh] = useState<Ph>("day");
  const g = phased(GRANITE)[ph];
  const c = phased(CONC)[ph];
  const o = phased(OAK)[ph];
  const sun = sunFor(ph);
  const night = ph === "night";
  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-200">
      <header className="mb-4 flex items-center gap-4">
        <h1 className="font-mono text-sm tracking-widest text-neutral-300">ENGINE / KITS</h1>
        <div className="flex gap-1">
          {PHASES.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setPh(p)}
              className={`border px-2 py-0.5 font-mono text-[11px] ${p === ph ? "border-amber-400 text-amber-300" : "border-neutral-700 text-neutral-400"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </header>

      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
        groundKit
      </h2>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile title="courses — slabs in stretcher bond, foreshortening">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={g.lo} />
          <path d={SLABS.face} fill={g.base} />
          <path d={SLAB_TONE.dark} fill={g.lo} opacity={0.5} />
          <path d={SLAB_TONE.pale} fill={g.hi} opacity={0.4} />
          <path d={SLABS.hi} fill={g.hi} opacity={0.5} />
          <path d={SLABS.joints} fill={g.deep} opacity={0.5} />
        </Tile>
        <Tile title="courses — boards across, no cross joints">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={o.base} />
          <path d={BOARDS.hi} fill={o.hi} opacity={0.4} />
          <path d={BOARDS.joints} fill={o.deep} opacity={0.6} />
        </Tile>
        <Tile title="planksToward — boards running at the camera">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={o.base} />
          <path d={PLANKS.tone} fill={o.lo} opacity={0.45} />
          <path d={PLANKS.joints} fill={o.deep} opacity={0.7} />
          <path d={PLANKS.ends} fill={o.deep} opacity={0.5} />
        </Tile>
        <Tile title="herringbone — parquet">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={o.deep} />
          <path d={HERRING.a} fill={o.base} />
          <path d={HERRING.b} fill={o.mid} />
        </Tile>
        <Tile title="cobbles — setts, jittered">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={g.deep} />
          <path d={COBBLES.faces} fill={g.base} />
          <path d={COBBLES.dark} fill={g.lo} opacity={0.6} />
          <path d={COBBLES.glints} fill={g.hi} opacity={0.6} />
        </Tile>
        <Tile title="flight — down into the ground">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={g.base} />
          <path d={pxPath([[115, 74, 70, 26]])} fill="#0a0c10" />
          <Stairs set={FLIGHT_DOWN} mat={c} />
        </Tile>
        <Tile title="flight — up a wall, left and right">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={g.base} />
          <Stairs set={FLIGHT_RIGHT} mat={g} />
          <Stairs set={FLIGHT_LEFT} mat={g} />
        </Tile>
        <Tile title="kerbStones · grate · manhole · paintLine">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill="#3a3d42" />
          <path d={PAINT.paint} fill="#e8e0c8" opacity={0.7} />
          <path d={PAINT.wear} fill="#3a3d42" />
          <path d={GRATE.frame} fill={STEEL.deep} />
          <path d={GRATE.slots} fill="#000" opacity={0.6} />
          <path d={MANHOLE.disc} fill={STEEL.lo} />
          <path d={MANHOLE.ring} fill={STEEL.deep} />
          <path d={MANHOLE.picks} fill="#000" opacity={0.7} />
          <Bev set={KERB.set} mat={g} />
          <path d={KERB.joints} fill={g.deep} />
        </Tile>
        <Tile title="zebra · tactile · tyreTracks">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill="#3a3d42" />
          <path d={ZEBRA} fill="#e8e0c8" opacity={0.8} />
          <path d={TACTILE.studs} fill="#c9a24b" />
          <path d={TACTILE.glints} fill="#ffe27a" />
          <path d={TRACKS[0]} fill="#000" opacity={0.25} />
          <path d={TRACKS[1]} fill="#000" opacity={0.22} />
        </Tile>
        <Tile title="leaves · tufts · puddle">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={g.base} />
          <path d={PUDDLE.fringe} fill="#000" opacity={0.15} />
          <path d={PUDDLE.water} fill="#3a4450" opacity={0.8} />
          <path d={PUDDLE.rim} fill="#c8d4e0" opacity={0.6} />
          <path d={LEAVES} fill="#9a6f34" />
          <path d={TUFTS} fill={M.leaf.base} />
        </Tile>
        <Tile title="groundLayers — tiles, one call">
          <GroundPaint layers={COMPOSED} />
        </Tile>
        <Tile title="groundLayers — cobbles, one call">
          <GroundPaint layers={COMPOSED_COBBLE} />
        </Tile>
      </div>

      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
        pixelKit — volume, geometry, weathering
      </h2>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile title="boxPaths / Box — a top and a side">
          <path d={pxPath([[0, 90, TW, 20]])} fill={c.lo} />
          <Box set={CRATES} mat={o} />
        </Tile>
        <Tile title="cylinderPaths / Cylinder — pipes">
          <Cylinder set={PIPES} mat={STEEL} />
          <Cylinder set={PIPE_H} mat={matFrom("#a33a30")} />
        </Tile>
        <Tile title="steppedRing · steppedArch · steppedLine">
          <path d={pxPath(RING)} fill={STEEL.hi} />
          <path d={pxPath(ARCH)} fill={matFrom("#7d3c30").base} />
          <path d={pxPath([[120, 60, 50, 30]])} fill="#2e3640" />
          <path d={pxPath(LINE_A)} fill="#e8e0c8" />
          <path d={pxPath(LINE_B)} fill="#c9a24b" />
        </Tile>
        <Tile title="glyphRects · mirrorX">
          <path d={pxPath([[30, 22, 80, 30]])} fill="#1b4b96" />
          <path d={pxPath(WHEELCHAIR)} fill="#f4f4f0" />
          <path d={pxPath([[150, 22, 80, 30]])} fill="#1b4b96" />
          <path d={pxPath(MIRRORED)} fill="#f4f4f0" />
        </Tile>
        <Tile title="matFrom · phased — a ramp from one hex">
          {(["#3a7d84", "#7d3c30", "#8f8a80", "#c9a24b", "#2f6448"] as const).map((hex, i) => {
            const mat = phased(matFrom(hex))[ph];
            return (
              <g key={hex}>
                {(["hi", "base", "mid", "lo", "deep"] as (keyof Mat)[]).map((k, j) => (
                  <path key={k} d={pxPath([[10 + i * 56, 14 + j * 16, 50, 14]])} fill={mat[k]} />
                ))}
              </g>
            );
          })}
        </Tile>
        <Tile title="dampBloom · saltLine · streaks · chips · rustRuns">
          <Bev set={bevelPaths([WALL])} mat={c} />
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={c.lo} />
          <path d={pxPath(DAMP.body)} fill="#000" opacity={0.18} />
          <path d={pxPath(DAMP.heart)} fill="#000" opacity={0.14} />
          <path d={pxPath(SALT)} fill="#e8e4dc" opacity={0.6} />
          <path d={pxPath(STREAKS)} fill={dth("n", "50")} />
          <path d={pxPath(CHIPS)} fill={c.deep} />
          <path d={pxPath(RUST)} fill="#8a4a2a" />
        </Tile>
        <Tile title="patterns — brick, tile, asphalt, cobble, water, rust, corrugated">
          {[
            "px-brick",
            "px-tile",
            "px-asphalt",
            "px-cobble",
            "px-water",
            "px-rust",
            "px-corrugated",
          ].map((id, i) => (
            <g key={id}>
              <rect x={6 + i * 42} y={20} width={36} height={60} fill="#8f8a80" />
              <rect x={6 + i * 42} y={20} width={36} height={60} fill={`url(#${id})`} />
            </g>
          ))}
        </Tile>
        <Tile title="dither tints — n w c e b × 50 25 12 06">
          {(["n", "w", "c", "e", "b"] as const).map((t, i) =>
            (["50", "25", "12", "06"] as const).map((d, j) => (
              <rect
                key={`${t}${d}`}
                x={10 + i * 56}
                y={10 + j * 22}
                width={50}
                height={20}
                fill={dth(t, d)}
              />
            )),
          )}
        </Tile>
      </div>

      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
        lightKit
      </h2>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Tile title="fixture / Fixture — a tube and its pool (flicker: dying)" bg="#14110d">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={c.lo} />
          <Fixture set={TUBE} lit={night || ph === "dusk"} flicker="dying" />
        </Tile>
        <Tile title="streetLamp — pool, cone, halo" bg="#14110d">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={g.lo} />
          <path d={pxPath([[68, 14, 4, 56]])} fill={STEEL.mid} />
          <Light set={LAMP.cone} op={night ? 1 : 0.4} />
          <Light set={LAMP.pool} op={night ? 1 : 0.4} />
          <Light set={LAMP.halo} op={night ? 1 : 0.4} />
        </Tile>
        <Tile title="windowSpill · windowGlow · doorSpill" bg="#14110d">
          <Bev set={bevelPaths([WALL])} mat={c} />
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={c.lo} />
          <path d={pxPath([[200, 20, 40, 40]])} fill="#ffd98a" />
          <path d={pxPath([[40, 20, 30, 50]])} fill="#ffd98a" opacity={0.8} />
          <Light set={WIN_GLOW} />
          <Light set={SPILL} />
          <Light set={DOOR} />
        </Tile>
        <Tile title="glow · screenLight · Flick(breathe)" bg="#14110d">
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={c.lo} />
          <Light set={GLOW} />
          <Flick kind="breathe">
            <path d={pxPath([[248, 48, 4, 4]])} fill="#ffca85" />
          </Flick>
          <path d={pxPath([[120, 58, 30, 3]])} fill="#9fb8ff" />
          <Light set={SCREEN} />
        </Tile>
        <Tile title="neon / Neon — any colour, with halo and wash" bg="#0e0c14">
          <Neon set={NEON} color="#ff4fa0" flicker="neon" />
        </Tile>
        <Tile title="sunFor · castShadows · sunShaft">
          <path d={pxPath([WALL])} fill={c.base} />
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={g.base} />
          <Light set={SHAFT} op={ph === "day" ? 0.4 : ph === "night" ? 0 : 1} />
          {sun ? (
            <path d={castShadows(UPRIGHTS, sun, TOP)} fill="#171009" opacity={sun.op} />
          ) : null}
          <path d={pxPath(UPRIGHTS)} fill={STEEL.mid} />
        </Tile>
        <Tile title="underShade · rim — the dark that gives light an edge">
          <path d={pxPath([WALL])} fill={c.base} />
          <UnderShade set={UNDER} />
          <Bev set={bevelPaths([[40, 40, 60, 10]])} mat={o} />
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={g.base} />
        </Tile>
        <Tile title="PhaseWash — the hour, as one veil">
          <path d={pxPath([WALL])} fill={M.render.base} />
          <path d={pxPath([[0, TOP, TW, BOT - TOP]])} fill={CONC.base} />
          <PixelText x={12} y={14} text={ph.toUpperCase()} fill="#1a1d22" />
          <PhaseWash ph={ph} w={TW} h={TH} />
        </Tile>
      </div>
    </div>
  );
}
