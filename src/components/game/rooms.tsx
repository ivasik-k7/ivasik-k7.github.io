import type { ReactNode } from "react";
import { DOG_PALETTE, DOG_SLEEPING, PixelMap } from "@/components/game/sprites";
import type { RoomId } from "@/lib/apartment";
import type { DayPhase, TvChannel, WorldState } from "@/lib/worldState";

// Scale reference: the player is 64 gp ≈ 1.7 m, so 1 m ≈ 37 gp.
// Ceiling at y=48 (≈2.7 m), floor line at y=150, doors 76 gp tall.
const CEIL_Y = 48;
const FLOOR = 150;

const C = {
  ceiling: "#cfc8b8",
  ceilingShadow: "#b5ad9c",
  baseboard: "#5d4a37",
  parquet: "#9a7648",
  parquetLine: "#86653c",
  parquetSeam: "#7a5c36",
  doorFrame: "#8a7052",
  doorwayDark: "#1a1520",
  wood: "#8a623f",
  woodDark: "#5d4128",
  woodLight: "#a1794f",
  polishedWood: "#6b4226",
  skyTop: "#4a3b63",
  skyMid: "#b96b8c",
  skyLow: "#f2a65a",
  cityFar: "#3a3050",
  cityWindow: "#ffd98a",
  tulle: "#f4f0e4",
  radiator: "#c9c4b4",
  radiatorDark: "#a8a394",
  enamelWhite: "#e2ddd0",
  enamelShadow: "#bdb8a8",
  metal: "#9aa0a8",
  metalDark: "#6d7278",
  brass: "#c9a24b",
  rugRed: "#8a3a34",
  rugGold: "#c9a24b",
  rugDark: "#6b2c28",
  carpetBase: "#7c3040",
  carpetGold: "#c9a24b",
  carpetTeal: "#3a5a54",
  sofaCloth: "#8a5a4a",
  sofaClothDark: "#734a3c",
  blanket: "#4a5a7a",
  blanketDark: "#3c4a66",
  linen: "#e8e2d2",
  crt: "#c9b995",
  screenGreen: "#1f3326",
  screenText: "#7ee08c",
  screenOff: "#1a1d24",
  tvWood: "#6b4a2f",
  paper: "#e3d9c2",
  jarGreen: "#7a8a4a",
  jarRed: "#a34a3a",
  jarLid: "#b8b3a4",
  kurtkaRed: "#a33a30",
  bulbOff: "#8f8468",
  star: "#d8daf0",
  tileFace: "#cdd8d4",
  tileGrout: "#b5c0b8",
  pipe: "#565a60",
  pipeJoint: "#43464c",
  shadow: "#00000022",
};

/** Sky gradient stops per phase of day — shared by windows, balcony and door glass. */
const SKY: Record<DayPhase, { top: string; mid: string; low: string }> = {
  morning: { top: "#8ba3c4", mid: "#c9cfd8", low: "#e8cf9a" },
  day: { top: "#7fa8cc", mid: "#a8c8e0", low: "#cfe2ee" },
  dusk: { top: "#4a3b63", mid: "#b96b8c", low: "#f2a65a" },
  night: { top: "#1a1830", mid: "#232040", low: "#2c2a4a" },
};

function px(x: number, y: number, w: number, h: number, fill: string, key?: string): ReactNode {
  return <rect key={key ?? `${x}:${y}:${w}:${h}`} x={x} y={y} width={w} height={h} fill={fill} />;
}

/** Ceiling strip, patterned wallpaper, baseboard, parquet floor. */
function RoomShell({
  width,
  wall,
  stripe,
  motif,
}: {
  width: number;
  wall: string;
  stripe: string;
  motif?: string;
}) {
  const pattern: ReactNode[] = [];
  for (let x = 10; x < width; x += 26) {
    pattern.push(px(x, CEIL_Y, 2, 142 - CEIL_Y + 48 - 48, stripe, `s${x}`));
    if (motif) {
      pattern.push(px(x + 11, 64, 3, 3, motif, `m1${x}`));
      pattern.push(px(x + 9, 90, 3, 3, motif, `m2${x}`));
      pattern.push(px(x + 13, 116, 3, 3, motif, `m3${x}`));
    }
  }
  const planks: ReactNode[] = [];
  for (let x = 0; x < width; x += 30) {
    planks.push(px(x + 15, FLOOR, 1, 14, C.parquetLine, `p1${x}`));
    planks.push(px(x, FLOOR + 14, 1, 16, C.parquetLine, `p2${x}`));
  }
  return (
    <g>
      {px(0, 0, width, CEIL_Y, C.ceiling)}
      {px(0, CEIL_Y - 3, width, 3, C.ceilingShadow)}
      {px(0, CEIL_Y, width, 142 - CEIL_Y, wall)}
      {pattern}
      {px(0, 142, width, 8, C.baseboard)}
      {px(0, FLOOR, width, 30, C.parquet)}
      {px(0, FLOOR + 14, width, 1, C.parquetSeam)}
      {planks}
      {px(0, FLOOR, width, 3, C.shadow)}
    </g>
  );
}

/** Open passage to another room. Center = x + 18. */
function Doorway({ x }: { x: number }) {
  return (
    <g>
      {px(x - 3, 70, 42, 80, C.doorFrame)}
      {px(x, 74, 36, 76, C.doorwayDark)}
      {px(x, 74, 36, 3, "#000000aa")}
    </g>
  );
}

/** Small light-switch plate, centered on the interaction x. */
function SwitchPlate({ cx }: { cx: number }) {
  return (
    <g>
      {px(cx - 4, 96, 8, 11, C.enamelWhite)}
      {px(cx - 2, 99, 4, 5, C.metalDark)}
    </g>
  );
}

/**
 * Courtyard window whose sky follows the phase of day; when `open`, the right
 * sash is swung inward on the mullion hinge and the tulle sways.
 */
function PhaseWindow({
  x,
  idPrefix,
  width = 48,
  phase,
  open = false,
}: {
  x: number;
  idPrefix: string;
  width?: number;
  phase: DayPhase;
  open?: boolean;
}) {
  const gid = `${idPrefix}-sky`;
  const w = width;
  const mx = x + Math.floor(w / 2);
  const sky = SKY[phase];
  const lit: ReactNode[] = [];
  if (phase === "morning") {
    lit.push(px(x + 25, 92, 3, 3, C.cityWindow, "lw2"));
  }
  if (phase === "dusk" || phase === "night") {
    lit.push(px(x + 7, 98, 3, 3, C.cityWindow, "lw1"));
    lit.push(px(x + 25, 92, 3, 3, C.cityWindow, "lw2"));
    lit.push(px(x + w - 11, 100, 3, 3, C.cityWindow, "lw3"));
  }
  if (phase === "night") {
    lit.push(px(x + 11, 106, 3, 3, C.cityWindow, "lw4"));
    lit.push(px(x + 25, 104, 3, 3, C.cityWindow, "lw5"));
    lit.push(px(x + w - 11, 108, 3, 3, C.cityWindow, "lw6"));
  }
  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky.top} />
          <stop offset="55%" stopColor={sky.mid} />
          <stop offset="100%" stopColor={sky.low} />
        </linearGradient>
      </defs>
      {px(x - 4, 64, w + 8, 58, C.baseboard)}
      {px(x, 68, w, 50, `url(#${gid})`)}
      {phase === "night" ? (
        <g>
          {px(x + 6, 74, 2, 2, C.star)}
          {px(x + w - 9, 71, 2, 2, C.star)}
          {px(x + 17, 79, 1, 1, "#b8bcd8")}
        </g>
      ) : null}
      {/* five-storey block across the courtyard */}
      {px(x + 4, 92, 14, 26, C.cityFar)}
      {px(x + 22, 86, 10, 32, C.cityFar)}
      {px(x + w - 14, 96, 10, 22, C.cityFar)}
      {lit}
      {/* frame cross + fortochka; the horizontal bar stops at the open gap */}
      {px(mx - 1, 68, 3, 50, C.baseboard)}
      {open ? px(x, 84, mx - x, 3, C.baseboard) : px(x, 84, w, 3, C.baseboard)}
      {open ? null : px(mx + 4, 70, 10, 1, C.baseboard)}
      {open ? (
        <g>
          {/* sash swung inward — foreshortened, near edge drawn taller */}
          <rect x={mx - 13} y={64} width={10} height={49} fill={sky.mid} opacity={0.5} />
          {px(mx - 16, 61, 3, 55, C.baseboard)}
          {px(mx - 3, 64, 3, 52, C.baseboard)}
          {px(mx - 16, 61, 16, 3, C.baseboard)}
          {px(mx - 16, 113, 16, 3, C.baseboard)}
          {px(mx - 15, 85, 14, 2, C.baseboard)}
        </g>
      ) : null}
      {/* tulle curtains */}
      <rect
        className={open ? "tulle-sway" : undefined}
        x={x}
        y={68}
        width={12}
        height={50}
        fill={C.tulle}
        opacity={0.4}
      />
      <rect
        className={open ? "tulle-sway" : undefined}
        x={x + w - 12}
        y={68}
        width={12}
        height={50}
        fill={C.tulle}
        opacity={0.4}
      />
      {px(x - 6, 62, w + 12, 3, C.woodDark)}
      {/* sill + radiator */}
      {px(x - 6, 118, w + 12, 4, C.enamelWhite)}
      <Radiator x={x + 2} w={w - 4} />
    </g>
  );
}

function Radiator({ x, w }: { x: number; w: number }) {
  const ribs: ReactNode[] = [];
  for (let rx = x; rx < x + w - 3; rx += 7) {
    ribs.push(px(rx, 126, 4, 22, C.radiator, `r${rx}`));
  }
  return (
    <g>
      {px(x, 124, w, 2, C.radiatorDark)}
      {ribs}
      {px(x, 146, w, 2, C.radiatorDark)}
    </g>
  );
}

function PendantLamp({ x, on }: { x: number; on: boolean }) {
  return (
    <g>
      {px(x - 1, CEIL_Y, 2, 12, "#4a4438")}
      {px(x - 8, CEIL_Y + 12, 16, 8, "#b06a3a")}
      {px(x - 5, CEIL_Y + 20, 10, 3, on ? C.cityWindow : C.bulbOff)}
    </g>
  );
}

// ---------------------------------------------------------------------------
// ПРИХОЖАЯ — padded front door, meter, mirror, coats, phone on a stand,
// three doorways: kitchen, living room and the bathroom at the far end.
// ---------------------------------------------------------------------------
export function HallwayRoom({ lightOn }: { lightOn: boolean }) {
  const buttons: ReactNode[] = [];
  for (let by = 84; by < 140; by += 14) {
    for (let bx = 22; bx < 48; bx += 12) {
      buttons.push(px(bx + ((by / 14) % 2) * 6, by, 2, 2, "#3d2a1a", `b${bx}:${by}`));
    }
  }
  const wainscot: ReactNode[] = [];
  for (let sx = 40; sx < 420; sx += 40) {
    wainscot.push(px(sx, 106, 1, 36, "#5a3d26", `w${sx}`));
  }
  return (
    <g shapeRendering="crispEdges">
      <RoomShell width={420} wall="#a89a78" stripe="#9a8c6a" />
      {/* wood wainscot */}
      {px(0, 104, 420, 38, "#6b4a2f")}
      {px(0, 104, 420, 2, "#7d5a3a")}
      {wainscot}
      {/* runner rug */}
      {px(56, 149, 190, 9, C.rugRed)}
      {px(56, 150, 190, 1, C.rugGold)}
      {px(56, 156, 190, 1, C.rugGold)}
      {/* front door: brown leatherette with button tufting */}
      {px(12, 70, 44, 80, C.doorFrame)}
      {px(16, 74, 36, 76, "#6b4a2f")}
      {px(18, 76, 32, 72, "#7d573a")}
      {buttons}
      {px(46, 108, 4, 5, C.brass)}
      {px(22, 90, 3, 8, C.metalDark)}
      {/* antresol boxes above the door */}
      {px(12, 50, 44, 18, C.woodDark)}
      {px(16, 54, 16, 12, "#a8906a")}
      {px(34, 56, 14, 10, "#8a7452")}
      {/* electric meter with its slowly spinning disc */}
      {px(56, 58, 20, 22, C.enamelWhite)}
      {px(58, 60, 16, 8, "#2b2a30")}
      {px(59, 62, 14, 4, C.paper)}
      <g className="meter-disc" style={{ transformOrigin: "66px 73px" }}>
        {px(63, 71, 6, 4, "#8a3a34")}
      </g>
      {/* mirror */}
      {px(84, 62, 26, 72, C.woodDark)}
      {px(87, 65, 20, 66, "#a8c4c8")}
      {px(89, 68, 4, 56, "#c4dade")}
      {/* coat hooks with jackets */}
      {px(114, 72, 36, 4, C.woodDark)}
      {px(118, 76, 12, 38, "#3a3b4a")}
      {px(120, 74, 8, 4, "#2e2f3c")}
      {px(134, 76, 11, 32, "#5a4a38")}
      {px(146, 76, 2, 8, "#8a8f96")}
      {/* shoe bench with slippers */}
      {px(146, 136, 28, 4, C.wood)}
      {px(148, 140, 3, 10, C.woodDark)}
      {px(169, 140, 3, 10, C.woodDark)}
      {px(150, 143, 9, 5, "#5a3d33")}
      {px(161, 143, 9, 5, "#33415a")}
      {px(150, 130, 7, 5, "#8a3a34")}
      {px(159, 130, 7, 5, "#8a3a34")}
      {/* telephone stand with a red rotary phone */}
      {px(182, 118, 30, 4, C.polishedWood)}
      {px(184, 122, 4, 28, C.woodDark)}
      {px(206, 122, 4, 28, C.woodDark)}
      {px(186, 132, 18, 3, C.wood)}
      {px(188, 104, 20, 14, "#a33a30")}
      {px(186, 100, 24, 5, "#8a2f26")}
      {px(193, 109, 9, 8, "#7d241c")}
      {px(195, 111, 5, 5, C.enamelWhite)}
      <SwitchPlate cx={228} />
      <PendantLamp x={170} on={lightOn} />
      <Doorway x={246} />
      <Doorway x={294} />
      <Doorway x={354} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// КУХНЯ — gas stove and kettle, kolonka, round-shouldered fridge, oilcloth
// table, radio shelf, window to the courtyard, jars on the cupboard.
// ---------------------------------------------------------------------------
export function KitchenRoom({
  phase,
  lightOn,
  kettleOn,
  radioOn,
  fridgeOpen,
  windowOpen,
}: {
  phase: DayPhase;
  lightOn: boolean;
  kettleOn: boolean;
  radioOn: boolean;
  fridgeOpen: boolean;
  windowOpen: boolean;
}) {
  const tiles: ReactNode[] = [];
  for (let ty = 78; ty < 142; ty += 9) {
    for (let tx = 52; tx < 148; tx += 12) {
      tiles.push(px(tx, ty, 11, 8, "#cdd8d0", `t${tx}:${ty}`));
    }
  }
  const cloth: ReactNode[] = [];
  for (let cx = 206; cx < 244; cx += 8) {
    cloth.push(px(cx, 124, 3, 3, "#a34a3a", `c${cx}`));
  }
  return (
    <g shapeRendering="crispEdges">
      <RoomShell width={340} wall="#b8c0a4" stripe="#a9b194" />
      <Doorway x={6} />
      <SwitchPlate cx={52} />
      {/* tiled splash zone */}
      {px(50, 76, 100, 66, C.tileGrout)}
      {tiles}
      {/* gas stove with enamel kettle */}
      {px(62, 118, 44, 32, C.enamelWhite)}
      {px(62, 118, 44, 3, C.enamelShadow)}
      {px(66, 128, 36, 16, C.enamelShadow)}
      {px(68, 130, 32, 12, "#2b2a30")}
      {px(66, 115, 12, 3, "#2b2118")}
      {px(88, 115, 12, 3, "#2b2118")}
      {px(74, 148, 4, 2, "#2b2a30")}
      {px(94, 148, 4, 2, "#2b2a30")}
      {/* kettle */}
      {px(76, 102, 20, 13, C.enamelWhite)}
      {px(78, 100, 16, 3, C.enamelShadow)}
      {px(84, 96, 4, 4, "#2b2a30")}
      {px(96, 104, 5, 4, C.enamelShadow)}
      {px(72, 106, 4, 6, C.enamelShadow)}
      {kettleOn ? px(82, 108, 8, 2, "#e07a30") : null}
      {/* sink + kolonka above it */}
      {px(110, 118, 38, 32, C.enamelWhite)}
      {px(114, 122, 30, 24, C.enamelShadow)}
      {px(116, 114, 26, 4, C.metal)}
      {px(126, 106, 4, 8, C.metal)}
      {px(116, 64, 26, 36, C.enamelWhite)}
      {px(116, 64, 26, 3, C.enamelShadow)}
      {px(120, 70, 18, 12, "#2b2a30")}
      {px(122, 72, 6, 8, "#e07a30")}
      {px(128, 100, 3, 14, C.metalDark)}
      {/* fridge — round shoulders; opens to show the food inside */}
      {px(158, 96, 36, 54, C.enamelWhite)}
      {px(160, 92, 32, 4, C.enamelWhite)}
      {px(164, 90, 24, 2, C.enamelWhite)}
      {fridgeOpen ? (
        <g>
          {/* cream interior with wire shelves */}
          {px(160, 98, 32, 50, "#f0e9d6")}
          {px(160, 113, 32, 2, C.enamelShadow)}
          {px(160, 128, 32, 2, C.enamelShadow)}
          {px(160, 141, 32, 2, C.enamelShadow)}
          {/* pot of soup */}
          {px(164, 104, 13, 9, C.metal)}
          {px(163, 102, 15, 2, C.metalDark)}
          {/* butter */}
          {px(181, 108, 8, 5, "#e8d590")}
          {/* sausage */}
          {px(163, 120, 16, 5, "#d8848e")}
          {/* jar */}
          {px(182, 118, 8, 10, C.jarGreen)}
          {px(182, 116, 8, 2, C.jarLid)}
          {/* door swung open to the left, foreshortened */}
          {px(139, 92, 17, 58, C.enamelWhite)}
          {px(139, 92, 3, 58, C.enamelShadow)}
          {px(144, 104, 9, 2, C.enamelShadow)}
          {px(144, 130, 9, 2, C.enamelShadow)}
          {px(146, 96, 6, 8, C.jarGreen)}
        </g>
      ) : (
        <g>
          {px(158, 116, 36, 2, C.enamelShadow)}
          {px(188, 100, 3, 12, C.metal)}
          {px(188, 122, 3, 16, C.metal)}
        </g>
      )}
      {px(158, 148, 36, 2, C.enamelShadow)}
      {/* kitchen table with sunflower oilcloth + stool */}
      {px(202, 122, 46, 5, "#d8d0b0")}
      {cloth}
      {px(206, 127, 4, 23, C.woodDark)}
      {px(240, 127, 4, 23, C.woodDark)}
      {px(214, 112, 14, 10, "#8a7452")}
      {px(216, 108, 10, 4, C.paper)}
      {px(252, 133, 18, 4, C.wood)}
      {px(254, 137, 3, 13, C.woodDark)}
      {px(265, 137, 3, 13, C.woodDark)}
      {/* radio on a small shelf */}
      {px(244, 90, 26, 3, C.wood)}
      {px(248, 76, 20, 14, "#6b4a2f")}
      {px(250, 79, 9, 8, "#c9b995")}
      {px(262, 79, 4, 8, C.brass)}
      {radioOn ? px(251, 81, 7, 2, "#e07a30") : null}
      {/* window */}
      <PhaseWindow x={254} idPrefix="kt" width={44} phase={phase} open={windowOpen} />
      {/* wall cupboard with three-litre jars on top */}
      {px(304, 62, 34, 30, C.wood)}
      {px(307, 65, 13, 24, C.woodDark)}
      {px(322, 65, 13, 24, C.woodDark)}
      {px(313, 74, 2, 6, C.brass)}
      {px(328, 74, 2, 6, C.brass)}
      {px(306, 48, 9, 14, C.jarGreen)}
      {px(317, 46, 9, 16, C.jarRed)}
      {px(328, 50, 8, 12, C.jarGreen)}
      {px(306, 46, 9, 3, C.jarLid)}
      {px(317, 44, 9, 3, C.jarLid)}
      {px(328, 48, 8, 3, C.jarLid)}
      <PendantLamp x={180} on={lightOn} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// ЗАЛ — TV on legs, sofa under the wall carpet, Gross on the rug, the stenka
// with books, crystal and photographs, balcony door.
// ---------------------------------------------------------------------------
export function LivingRoom({
  phase,
  tv,
  lightOn,
}: {
  phase: DayPhase;
  tv: TvChannel;
  lightOn: boolean;
}) {
  const carpetDiamonds: ReactNode[] = [];
  for (let dx = 152; dx < 268; dx += 24) {
    carpetDiamonds.push(px(dx, 76, 8, 8, C.carpetGold, `d1${dx}`));
    carpetDiamonds.push(px(dx + 2, 78, 4, 4, C.carpetTeal, `d2${dx}`));
    carpetDiamonds.push(px(dx + 10, 96, 6, 6, C.carpetTeal, `d3${dx}`));
  }
  const books: ReactNode[] = [
    [368, 84, "#7c3f3a"],
    [373, 84, "#33415a"],
    [378, 86, "#5a8a5a"],
    [383, 84, "#a1794f"],
    [389, 85, "#8a5f7a"],
    [394, 84, "#c9a24b"],
    [368, 108, "#3a3b4a"],
    [374, 108, "#8a5f2c"],
    [380, 110, "#7c3f3a"],
    [386, 108, "#4e6b4e"],
    [392, 109, "#33415a"],
  ].map(([bx, by, color]) =>
    px(bx as number, by as number, 4, 16, color as string, `bk${bx}:${by}`),
  );
  const sky = SKY[phase];
  return (
    <g shapeRendering="crispEdges">
      <RoomShell width={600} wall="#b39a76" stripe="#a3885f" motif="#9a7f56" />
      <Doorway x={6} />
      <SwitchPlate cx={56} />
      {/* TV on splayed legs, doily and crystal vase on top */}
      {px(78, 104, 48, 34, C.tvWood)}
      {tv === "off" ? (
        <g>
          {px(84, 110, 32, 24, C.screenOff)}
          {px(86, 112, 8, 6, "#262a33")}
        </g>
      ) : null}
      {tv === "film" ? (
        <g>
          {px(84, 110, 32, 24, "#e0d2ae")}
          {px(84, 110, 32, 3, "#c9ba94")}
          {px(84, 131, 32, 3, "#c9ba94")}
          {px(91, 121, 7, 13, "#3c332c")}
          {px(93, 117, 4, 4, "#3c332c")}
          {px(104, 123, 8, 11, "#3c332c")}
          {px(106, 119, 4, 4, "#3c332c")}
        </g>
      ) : null}
      {tv === "football" ? (
        <g>
          {px(84, 110, 32, 24, "#3f7a3f")}
          {px(84, 115, 32, 2, "#478447")}
          {px(84, 124, 32, 2, "#478447")}
          {px(99, 110, 2, 24, "#e6e6dc")}
          {px(88, 121, 2, 2, "#e6e6dc")}
          {px(94, 127, 2, 2, "#e6e6dc")}
          {px(103, 129, 2, 2, "#e6e6dc")}
          {px(107, 117, 2, 2, "#d84a3a")}
          {px(111, 125, 2, 2, "#d84a3a")}
        </g>
      ) : null}
      {tv === "static" ? (
        <rect className="tv-static" x={84} y={110} width={32} height={24} fill="#9aa0a2" />
      ) : null}
      {px(118, 112, 5, 5, C.metalDark)}
      {px(118, 120, 5, 5, C.metalDark)}
      {px(82, 138, 4, 12, C.woodDark)}
      {px(118, 138, 4, 12, C.woodDark)}
      {px(86, 100, 32, 4, C.linen)}
      {px(96, 88, 10, 12, "#a8c4c8")}
      {px(98, 84, 6, 5, "#88a8ac")}
      {/* wall carpet */}
      {px(140, 60, 140, 62, C.carpetBase)}
      {px(140, 60, 140, 4, C.carpetGold)}
      {px(140, 118, 140, 4, C.carpetGold)}
      {px(140, 60, 4, 62, C.carpetGold)}
      {px(276, 60, 4, 62, C.carpetGold)}
      {carpetDiamonds}
      {px(146, 66, 128, 2, C.rugDark)}
      {px(146, 114, 128, 2, C.rugDark)}
      {/* sofa with wooden armrests */}
      {px(148, 96, 104, 30, C.sofaCloth)}
      {px(152, 100, 46, 22, C.sofaClothDark)}
      {px(202, 100, 46, 22, C.sofaClothDark)}
      {px(148, 126, 104, 18, C.sofaClothDark)}
      {px(140, 112, 10, 34, C.polishedWood)}
      {px(250, 112, 10, 34, C.polishedWood)}
      {px(146, 146, 6, 4, C.woodDark)}
      {px(248, 146, 6, 4, C.woodDark)}
      {/* rug + Gross */}
      {px(234, 149, 82, 9, C.rugRed)}
      {px(238, 151, 74, 1, C.rugGold)}
      {px(238, 155, 74, 1, C.rugGold)}
      <g className="dog-breathe" style={{ transformOrigin: "270px 150px" }}>
        <g transform="translate(252 132)">
          <PixelMap map={DOG_SLEEPING} palette={DOG_PALETTE} />
        </g>
      </g>
      {/* stenka: closed cabinet / books / crystal behind glass / photos */}
      {px(330, 58, 140, 92, C.polishedWood)}
      {px(334, 62, 30, 84, C.wood)}
      {px(336, 64, 26, 38, C.woodDark)}
      {px(336, 106, 26, 38, C.woodDark)}
      {px(358, 80, 3, 8, C.brass)}
      {px(358, 120, 3, 8, C.brass)}
      {px(366, 80, 34, 66, C.woodDark)}
      {px(366, 102, 34, 3, C.wood)}
      {px(366, 126, 34, 20, "#4a3624")}
      {books}
      {/* crystal section */}
      {px(402, 64, 32, 60, "#2e2a26")}
      {px(404, 66, 28, 56, "#4a5a5e")}
      <rect x={404} y={66} width={28} height={56} fill="#a8c4c8" opacity={0.35} />
      {px(408, 74, 8, 12, "#cfe0e4")}
      {px(420, 78, 6, 8, "#cfe0e4")}
      {px(406, 98, 6, 10, "#cfe0e4")}
      {px(416, 96, 10, 12, "#cfe0e4")}
      {px(404, 90, 28, 2, C.polishedWood)}
      {/* photo shelf */}
      {px(438, 64, 30, 82, C.wood)}
      {px(440, 92, 26, 2, C.woodDark)}
      {px(440, 120, 26, 2, C.woodDark)}
      {px(442, 70, 10, 14, C.woodDark)}
      {px(444, 72, 6, 10, C.paper)}
      {px(456, 74, 9, 12, C.brass)}
      {px(458, 76, 5, 8, C.paper)}
      {px(444, 98, 8, 12, C.woodDark)}
      {px(446, 100, 4, 8, C.paper)}
      {px(454, 100, 10, 10, C.woodDark)}
      {px(456, 102, 6, 6, C.paper)}
      {/* chandelier */}
      {px(298, CEIL_Y, 3, 10, "#4a4438")}
      {px(288, CEIL_Y + 10, 24, 3, C.brass)}
      {px(286, CEIL_Y + 13, 6, 5, lightOn ? C.cityWindow : C.bulbOff)}
      {px(296, CEIL_Y + 13, 6, 5, lightOn ? C.cityWindow : C.bulbOff)}
      {px(306, CEIL_Y + 13, 6, 5, lightOn ? C.cityWindow : C.bulbOff)}
      {/* balcony door — glazed, the glass follows the sky outside */}
      {px(496, 62, 48, 88, C.doorFrame)}
      {px(500, 66, 40, 84, C.woodDark)}
      {px(503, 69, 34, 44, sky.top)}
      {px(505, 71, 30, 40, sky.mid)}
      {phase === "morning" ? px(506, 74, 10, 8, "#e8cf9a") : null}
      {phase === "dusk" ? px(506, 74, 10, 8, C.skyLow) : null}
      {phase === "night" ? (
        <g>
          {px(508, 73, 2, 2, C.star)}
          {px(530, 71, 2, 2, C.star)}
        </g>
      ) : null}
      {px(520, 78, 12, 20, C.cityFar)}
      {phase === "morning" || phase === "dusk" ? px(523, 82, 3, 3, C.cityWindow) : null}
      {phase === "night" ? (
        <g>
          {px(523, 82, 3, 3, C.cityWindow)}
          {px(526, 90, 3, 3, C.cityWindow)}
          {px(523, 94, 3, 3, C.cityWindow)}
        </g>
      ) : null}
      <rect x={503} y={69} width={34} height={44} fill={C.tulle} opacity={0.3} />
      {px(503, 118, 34, 28, "#4a3624")}
      {px(534, 108, 4, 8, C.brass)}
      <Doorway x={552} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// СПАЛЬНЯ — bed, wardrobe, window, the training corner (barbell, giria,
// sambo kurtka and medals), desk with the computer.
// ---------------------------------------------------------------------------
export function StudyRoom({
  phase,
  lightOn,
  wardrobeOpen,
  windowOpen,
}: {
  phase: DayPhase;
  lightOn: boolean;
  wardrobeOpen: boolean;
  windowOpen: boolean;
}) {
  return (
    <g shapeRendering="crispEdges">
      <RoomShell width={500} wall="#a89cae" stripe="#9a8ea0" motif="#8d8194" />
      <Doorway x={6} />
      <SwitchPlate cx={58} />
      {/* small rug above the bed */}
      {px(62, 62, 54, 40, C.carpetBase)}
      {px(62, 62, 54, 3, C.carpetGold)}
      {px(62, 99, 54, 3, C.carpetGold)}
      {px(74, 74, 8, 8, C.carpetGold)}
      {px(94, 82, 8, 8, C.carpetTeal)}
      {/* Christ painting in a thin gilt frame */}
      {px(122, 58, 28, 38, C.brass)}
      {px(125, 61, 22, 32, "#2e2a3a")}
      {px(131, 64, 10, 2, "#e8d5a0")}
      {px(129, 66, 2, 5, "#e8d5a0")}
      {px(141, 66, 2, 5, "#e8d5a0")}
      {px(132, 65, 8, 2, "#4a3222")}
      {px(133, 67, 6, 6, "#d8a583")}
      {px(133, 72, 6, 2, "#4a3222")}
      {px(128, 75, 16, 16, "#ddd6c4")}
      {px(128, 75, 5, 16, "#8a3a34")}
      {px(141, 78, 3, 5, "#d8a583")}
      {/* bed */}
      {px(54, 96, 8, 54, C.polishedWood)}
      {px(130, 110, 8, 40, C.polishedWood)}
      {px(60, 128, 72, 16, C.wood)}
      {px(62, 144, 5, 6, C.woodDark)}
      {px(126, 144, 5, 6, C.woodDark)}
      {px(62, 120, 70, 10, C.linen)}
      {px(64, 112, 18, 9, "#f0ece0")}
      {px(84, 114, 48, 14, C.blanket)}
      {px(84, 122, 48, 2, C.blanketDark)}
      {px(84, 114, 48, 2, "#e8e2d2")}
      {/* wardrobe */}
      {px(150, 60, 40, 90, C.polishedWood)}
      {wardrobeOpen ? (
        <g>
          {/* dark interior with a rail of clothes and folded linens below */}
          {px(154, 64, 32, 82, "#4a3624")}
          {px(156, 70, 28, 3, C.metal)}
          {px(160, 70, 7, 2, C.metalDark)}
          {px(159, 73, 9, 24, "#8a3a34")}
          {px(172, 70, 7, 2, C.metalDark)}
          {px(171, 73, 8, 20, "#33415a")}
          {px(154, 112, 32, 3, C.wood)}
          {px(157, 103, 13, 9, C.linen)}
          {px(157, 107, 13, 1, "#cfc8b4")}
          {px(172, 105, 11, 7, "#d8d0c0")}
          {px(172, 108, 11, 1, "#c2baa8")}
          {/* doors swung open, foreshortened at either side */}
          {px(143, 58, 8, 92, C.wood)}
          {px(143, 58, 2, 92, C.woodDark)}
          {px(148, 100, 2, 8, C.brass)}
          {px(189, 58, 8, 92, C.wood)}
          {px(195, 58, 2, 92, C.woodDark)}
          {px(190, 100, 2, 8, C.brass)}
        </g>
      ) : (
        <g>
          {px(153, 64, 16, 82, C.wood)}
          {px(171, 64, 16, 82, C.wood)}
          {px(166, 100, 2, 10, C.brass)}
          {px(172, 100, 2, 10, C.brass)}
          {px(153, 64, 34, 2, C.woodDark)}
        </g>
      )}
      {/* window */}
      <PhaseWindow x={214} idPrefix="st" width={44} phase={phase} open={windowOpen} />
      {/* training corner: barbell, giria, kurtka on a hook, medals */}
      {px(282, 133, 5, 17, "#3f3f47")}
      {px(313, 133, 5, 17, "#3f3f47")}
      {px(278, 139, 44, 3, C.metal)}
      {px(287, 138, 3, 5, C.metalDark)}
      {px(310, 138, 3, 5, C.metalDark)}
      {px(337, 141, 14, 9, "#43434b")}
      {px(340, 136, 8, 5, "#43434b")}
      {px(342, 137, 4, 3, "#a89cae")}
      {px(339, 143, 4, 3, "#5c5c66")}
      {/* kurtka on a wall hook, belt over the shoulder */}
      {px(382, 68, 20, 4, C.woodDark)}
      {px(384, 72, 16, 40, C.kurtkaRed)}
      {px(386, 74, 12, 4, "#7d241c")}
      {px(388, 84, 3, 26, "#2e4568")}
      {px(380, 112, 24, 3, C.shadow)}
      {/* medals frame */}
      {px(406, 66, 18, 24, C.woodDark)}
      {px(408, 68, 14, 20, C.paper)}
      {px(410, 72, 4, 4, C.brass)}
      {px(416, 72, 4, 4, C.metal)}
      {px(413, 80, 4, 4, C.brass)}
      {/* desk with CRT computer */}
      {px(424, 116, 68, 5, C.woodLight)}
      {px(428, 121, 5, 29, C.woodDark)}
      {px(482, 121, 5, 29, C.woodDark)}
      {px(466, 121, 21, 22, C.wood)}
      {px(469, 125, 15, 7, C.woodDark)}
      {/* CRT */}
      {px(434, 86, 34, 30, C.crt)}
      {px(438, 90, 26, 19, C.screenGreen)}
      {px(440, 93, 15, 2, C.screenText)}
      {px(440, 97, 21, 2, "#7ee08caa")}
      {px(440, 101, 9, 2, "#7ee08c77")}
      <g className="crt-cursor">{px(440, 105, 3, 2, C.screenText)}</g>
      {px(440, 110, 22, 4, "#a89873")}
      {/* desk lamp */}
      {px(474, 98, 3, 18, C.metalDark)}
      {px(469, 94, 13, 5, "#5a6b8a")}
      {lightOn ? px(469, 99, 13, 3, C.cityWindow) : null}
      {/* chair */}
      {px(404, 108, 4, 42, C.woodDark)}
      {px(404, 130, 26, 5, C.wood)}
      {px(424, 135, 4, 15, C.woodDark)}
      {px(406, 135, 4, 15, C.woodDark)}
      <PendantLamp x={330} on={lightOn} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// САНУЗЕЛ — pale tiled walls, sink under a mirror cabinet, toilet with an
// overhead cistern and pull chain, clawfoot tub behind a half-drawn curtain,
// the Vyatka washing machine, frosted window, water pipes along the wall.
// ---------------------------------------------------------------------------
export function BathRoom({ lightOn, washerOn }: { lightOn: boolean; washerOn: boolean }) {
  const tiles: ReactNode[] = [];
  for (let ty = CEIL_Y + 2; ty < 134; ty += 9) {
    for (let tx = 2; tx < 298; tx += 12) {
      tiles.push(px(tx, ty, 11, 8, C.tileFace, `t${tx}:${ty}`));
    }
  }
  const curtainRings: ReactNode[] = [];
  for (let rx = 186; rx < 240; rx += 8) {
    curtainRings.push(px(rx, 59, 2, 3, C.metalDark, `cr${rx}`));
  }
  return (
    <g shapeRendering="crispEdges">
      <RoomShell width={300} wall={C.tileGrout} stripe={C.tileGrout} />
      {tiles}
      {/* water pipes: riser in the corner + supply run across the wall */}
      {px(96, 84, 192, 3, C.pipe)}
      {px(99, 87, 3, 21, C.pipe)}
      {px(284, CEIL_Y, 4, FLOOR - CEIL_Y, C.pipe)}
      {px(283, 66, 6, 3, C.pipeJoint)}
      {px(283, 84, 6, 3, C.pipeJoint)}
      {px(283, 120, 6, 3, C.pipeJoint)}
      <Doorway x={6} />
      <SwitchPlate cx={54} />
      {/* bare ceiling bulb */}
      {px(177, CEIL_Y, 2, 8, "#4a4438")}
      {px(174, CEIL_Y + 8, 8, 8, lightOn ? C.cityWindow : C.bulbOff)}
      {lightOn ? px(172, CEIL_Y + 16, 12, 2, "#ffd98a55") : null}
      {/* frosted window high on the wall — pale glass, no sky view */}
      {px(114, 50, 34, 32, "#a8b2ac")}
      {px(117, 53, 28, 26, "#ccd6d8")}
      {px(130, 53, 2, 26, "#e2eaea")}
      {px(117, 65, 28, 2, "#e2eaea")}
      {/* sink on a pedestal, mirror cabinet above */}
      {px(86, 62, 30, 36, C.enamelWhite)}
      {px(90, 66, 18, 28, "#a8c4c8")}
      {px(92, 69, 4, 20, "#c4dade")}
      {px(110, 66, 4, 28, C.enamelShadow)}
      {px(84, 98, 34, 2, C.enamelShadow)}
      {/* tap fed from the supply pipe */}
      {px(96, 106, 7, 3, C.metal)}
      {px(98, 109, 3, 5, C.metal)}
      {/* cup with toothbrushes on the basin edge */}
      {px(108, 106, 1, 6, "#a33a30")}
      {px(111, 105, 1, 7, "#33415a")}
      {px(107, 111, 6, 7, C.enamelWhite)}
      {/* basin + pedestal */}
      {px(88, 118, 26, 7, C.enamelWhite)}
      {px(92, 120, 18, 3, C.enamelShadow)}
      {px(95, 125, 12, 25, C.enamelWhite)}
      {px(95, 125, 12, 2, C.enamelShadow)}
      {/* toilet with overhead cistern and pull chain */}
      {px(146, 56, 24, 14, C.enamelWhite)}
      {px(146, 56, 24, 3, C.enamelShadow)}
      {px(156, 70, 3, 52, C.metal)}
      {px(167, 70, 2, 26, C.metalDark)}
      {px(165, 96, 5, 4, C.brass)}
      {px(146, 122, 22, 5, C.enamelWhite)}
      {px(146, 122, 22, 2, C.enamelShadow)}
      {px(149, 127, 16, 11, C.enamelWhite)}
      {px(151, 129, 12, 2, C.enamelShadow)}
      {px(153, 138, 8, 12, C.enamelWhite)}
      {/* stack of newspapers beside the toilet */}
      {px(172, 141, 14, 3, C.paper)}
      {px(173, 144, 12, 3, "#d8ceb6")}
      {px(172, 147, 14, 3, C.paper)}
      {/* towel on a hook */}
      {px(178, 90, 3, 3, C.metalDark)}
      {px(173, 93, 11, 20, "#5a8a5a")}
      {px(173, 108, 11, 2, C.linen)}
      {/* bathtub on little feet, wall spout, curtain rod above */}
      {px(238, 106, 4, 3, C.metal)}
      {px(239, 109, 2, 6, C.metal)}
      {px(186, 114, 54, 4, C.enamelWhite)}
      {px(188, 118, 50, 26, C.enamelWhite)}
      {px(190, 118, 46, 3, C.enamelShadow)}
      {px(188, 140, 50, 2, C.enamelShadow)}
      {px(191, 144, 5, 6, C.metalDark)}
      {px(230, 144, 5, 6, C.metalDark)}
      {px(182, 56, 60, 3, C.metal)}
      {curtainRings}
      {/* half-drawn shower curtain */}
      <rect x={184} y={59} width={24} height={56} fill="#bcd0d4" opacity={0.6} />
      <rect x={190} y={59} width={2} height={56} fill="#9ab4ba" opacity={0.7} />
      <rect x={199} y={59} width={2} height={56} fill="#9ab4ba" opacity={0.7} />
      {/* Vyatka washing machine — porthole, dial, indicator lamp */}
      <g
        className={washerOn ? "washer-rumble" : undefined}
        style={{ transformOrigin: "265px 131px" }}
      >
        {px(248, 112, 34, 38, C.enamelWhite)}
        {px(248, 112, 34, 3, C.enamelShadow)}
        {px(250, 116, 30, 6, "#d6d0c0")}
        {px(272, 116, 6, 6, C.metalDark)}
        {px(274, 117, 2, 2, C.brass)}
        {px(252, 118, 3, 3, washerOn ? "#e07a30" : "#8a8578")}
        <circle cx={263} cy={134} r={10} fill={C.metalDark} />
        <circle cx={263} cy={134} r={7} fill="#39424c" />
        {px(259, 129, 3, 3, "#7d8a96")}
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// БАЛКОН — outside: the phase-of-day sky, the courtyard blocks, skis, jars,
// a bicycle. The railing itself is drawn by BalconyForeground, over the player.
// ---------------------------------------------------------------------------
export function BalconyRoom({ phase }: { phase: DayPhase }) {
  const sky = SKY[phase];
  const litThreshold: Record<DayPhase, number> = { morning: 6, day: 0, dusk: 12, night: 22 };
  const blocks: ReactNode[] = [];
  const litWindows: ReactNode[] = [];
  const farBlocks: Array<[number, number, number]> = [
    [58, 96, 40],
    [104, 84, 34],
    [144, 102, 46],
    [196, 78, 38],
    [240, 94, 44],
    [290, 88, 20],
  ];
  farBlocks.forEach(([bx, by, bw], i) => {
    blocks.push(px(bx, by, bw, 150 - by, C.cityFar, `blk${bx}`));
    for (let wy = by + 6; wy < 144; wy += 12) {
      if ((wy + bx + i * 7) % 36 < litThreshold[phase]) {
        litWindows.push(px(bx + 4 + ((wy + i) % 3) * 8, wy, 3, 4, C.cityWindow, `w${bx}:${wy}`));
      }
    }
  });
  return (
    <g shapeRendering="crispEdges">
      <defs>
        <linearGradient id="bc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky.top} />
          <stop offset="60%" stopColor={sky.mid} />
          <stop offset="100%" stopColor={sky.low} />
        </linearGradient>
      </defs>
      {px(0, 0, 310, 180, "url(#bc-sky)")}
      {phase === "night" ? (
        <g>
          {px(84, 24, 2, 2, C.star)}
          {px(196, 36, 2, 2, C.star)}
          {px(262, 18, 2, 2, C.star)}
          {px(140, 52, 1, 1, "#b8bcd8")}
          {/* crescent moon */}
          {px(238, 22, 8, 8, "#e8e6d8")}
          {px(236, 24, 4, 4, "#e8e6d8")}
          {px(241, 24, 6, 4, SKY.night.top)}
        </g>
      ) : null}
      {phase === "dusk" ? (
        <g>
          {/* the sun going down behind the blocks */}
          {px(122, 130, 20, 8, "#ffcf7a")}
          {px(126, 124, 12, 6, "#ffd98a")}
          {px(112, 136, 40, 2, "#f2a65acc")}
        </g>
      ) : null}
      {blocks}
      {litWindows}
      {/* upper balcony slab */}
      {px(0, 0, 310, 12, "#8a8578")}
      {px(0, 12, 310, 3, "#00000033")}
      {/* building wall on the left, door back inside */}
      {px(0, 12, 48, 168, "#9a917f")}
      {px(44, 12, 4, 168, "#7f776a")}
      {px(0, 60, 48, 2, "#847c6d")}
      <Doorway x={6} />
      {/* caged wall lamp — lit once the light goes */}
      {px(34, 38, 14, 8, C.metalDark)}
      {px(37, 46, 8, 4, phase === "dusk" || phase === "night" ? C.cityWindow : C.bulbOff)}
      {/* clothesline: sheet, striped towel, socks, and a milk-carton bird feeder */}
      {px(48, 34, 240, 1, "#d8d8d0")}
      {px(96, 34, 3, 5, "#a34a3a")}
      {px(150, 35, 24, 18, "#c4d0d8")}
      {px(178, 34, 3, 5, "#5a8a5a")}
      {px(196, 35, 20, 14, "#e8e4d8")}
      {px(196, 39, 20, 2, "#5a7a9a")}
      {px(196, 44, 20, 2, "#5a7a9a")}
      {px(222, 34, 3, 4, "#a34a3a")}
      {px(222, 38, 5, 8, "#4a5a7a")}
      {px(232, 38, 5, 8, "#3d573d")}
      {px(252, 35, 1, 8, "#d8d8d0")}
      {px(247, 43, 11, 13, C.paper)}
      {px(250, 47, 5, 5, C.doorwayDark)}
      {px(246, 41, 13, 3, "#8a7052")}
      {/* concrete floor with a folded rug scrap */}
      {px(0, 150, 310, 30, "#8a8578")}
      {px(0, 150, 310, 3, "#726b5e")}
      {px(120, 158, 60, 1, "#726b5e")}
      {px(118, 149, 50, 7, C.rugRed)}
      {px(122, 151, 42, 1, C.rugGold)}
      {px(140, 149, 2, 7, C.rugDark)}
      {/* stool with a tin-can ashtray */}
      {px(56, 136, 22, 4, C.wood)}
      {px(58, 140, 3, 10, C.woodDark)}
      {px(73, 140, 3, 10, C.woodDark)}
      {px(62, 128, 10, 8, C.metal)}
      {px(62, 128, 10, 2, C.metalDark)}
      {px(64, 125, 2, 3, "#d8d8d0")}
      {px(68, 126, 2, 2, "#8f9089")}
      {/* skis against the end */}
      {px(184, 66, 3, 84, "#7c5a3a")}
      {px(190, 70, 3, 80, "#8a6844")}
      {px(183, 62, 5, 6, "#5d4128")}
      {px(189, 66, 5, 6, "#6b4e30")}
      {/* crate of empty jars */}
      {px(216, 128, 32, 22, C.wood)}
      {px(216, 134, 32, 2, C.woodDark)}
      {px(216, 142, 32, 2, C.woodDark)}
      {px(219, 114, 8, 14, "#a8c4c8aa")}
      {px(230, 112, 8, 16, "#a8c4c8aa")}
      {px(240, 116, 7, 12, "#a8c4c8aa")}
      {px(219, 112, 8, 3, C.jarLid)}
      {px(230, 110, 8, 3, C.jarLid)}
      {/* bicycle */}
      <circle cx={266} cy={138} r={11} fill="none" stroke="#3a3a40" strokeWidth={2.5} />
      <circle cx={296} cy={138} r={11} fill="none" stroke="#3a3a40" strokeWidth={2.5} />
      {px(264, 124, 34, 3, "#7c3f3a")}
      {px(268, 112, 3, 14, "#7c3f3a")}
      {px(264, 110, 10, 3, "#3a3a40")}
      {px(292, 114, 3, 12, "#7c3f3a")}
      {px(288, 112, 10, 3, "#3a3a40")}
    </g>
  );
}

/** The parapet, drawn in front of the player. */
export function BalconyForeground() {
  const slats: ReactNode[] = [];
  for (let x = 52; x < 304; x += 14) {
    slats.push(px(x, 118, 8, 32, "#7a8a94", `sl${x}`));
    slats.push(px(x + 6, 118, 2, 32, "#5f6d76", `sd${x}`));
  }
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 310 180"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0"
    >
      <g shapeRendering="crispEdges">
        {px(46, 112, 264, 5, "#4a4a50")}
        {slats}
        {px(46, 148, 264, 2, "#4a4a50")}
        {/* tomato seedlings in a wooden box on the parapet */}
        {px(190, 102, 40, 10, C.wood)}
        {px(190, 102, 40, 2, C.woodLight)}
        {px(208, 102, 2, 10, C.woodDark)}
        {px(194, 96, 2, 6, "#3d573d")}
        {px(193, 93, 4, 4, "#4e6b4e")}
        {px(202, 94, 2, 8, "#3d573d")}
        {px(200, 90, 5, 5, "#4e6b4e")}
        {px(212, 97, 2, 5, "#3d573d")}
        {px(211, 94, 4, 4, "#4e6b4e")}
        {px(220, 95, 2, 7, "#3d573d")}
        {px(218, 91, 5, 5, "#4e6b4e")}
        {px(221, 92, 2, 2, "#a34a3a")}
      </g>
    </svg>
  );
}

export function RoomScene({
  room,
  width,
  world,
  phase,
}: {
  room: RoomId;
  width: number;
  world: WorldState;
  phase: DayPhase;
}) {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} 180`}
      preserveAspectRatio="none"
    >
      {room === "hallway" ? <HallwayRoom lightOn={world.lights.hallway} /> : null}
      {room === "kitchen" ? (
        <KitchenRoom
          phase={phase}
          lightOn={world.lights.kitchen}
          kettleOn={world.kettleOn}
          radioOn={world.radioOn}
          fridgeOpen={world.fridgeOpen}
          windowOpen={world.windows["window-kitchen"].open}
        />
      ) : null}
      {room === "living" ? (
        <LivingRoom phase={phase} tv={world.tv} lightOn={world.lights.living} />
      ) : null}
      {room === "study" ? (
        <StudyRoom
          phase={phase}
          lightOn={world.lights.study}
          wardrobeOpen={world.wardrobeOpen}
          windowOpen={world.windows["window-yard"].open}
        />
      ) : null}
      {room === "bath" ? <BathRoom lightOn={world.lights.bath} washerOn={world.washerOn} /> : null}
      {room === "balcony" ? <BalconyRoom phase={phase} /> : null}
    </svg>
  );
}
