import { LayeredScene, px, type SceneDef, stripes } from "@/engine";
import type { DayPhase, WorldState } from "@/lib/worldState";
import { roomDarkness } from "@/lib/worldState";

/**
 * The bedroom — sleep on one side, iron and code on the other.
 *
 * Lived-in, not staged: the duvet never quite gets straightened, the radiator
 * always has a towel on it, the chair wears yesterday's jumper. The bed faces
 * the camera, wide and honest; above it the small Jesus portrait that came off
 * a grandmother's wall, a rosary still hooked on the frame. The desk carries
 * the computer with the formal papers and a mug that goes cold every evening.
 * The girias guard their corner. Light does the emotional work: a dusty shaft
 * across the floorboards by day, one warm pool and a lot of dark by night.
 *
 * Hitboxes and the exported SceneDef are unchanged.
 */

const W = 560;
const CEIL = 46;

const B = {
  // plaster
  ceil: "#e7e3d9",
  ceilLo: "#d4cfc2",
  cornice: "#cdc8ba",
  wall: "#b6bdb1",
  wallLo: "#a7aea2",
  wallWarm: "#c2bfa9", // nicotine bloom around the sconce
  wallCold: "#9fa79c",
  wallGhost: "#c3c9bd", // where a poster hung for years
  skirt: "#4a4438",
  skirtHi: "#5d5648",
  // floor
  floor: "#a8875a",
  floorLo: "#96774e",
  floorSeam: "#87693f",
  // wood
  oak: "#b8955e",
  oakHi: "#c9a86e",
  oakLo: "#8f7450",
  walnut: "#5d4a37",
  walnutLo: "#43362a",
  // cloth
  white: "#e8e6e0",
  whiteLo: "#d6d2c6",
  linen: "#e8e2d2",
  linenLo: "#d6cfbc",
  cream: "#f2ede0",
  duvet: "#7a8f9f",
  duvetHi: "#8ba2b3",
  duvetLo: "#687c8b",
  blanket: "#8a3a34",
  blanketHi: "#a34a3a",
  wool: "#6f6a63",
  woolHi: "#847e75",
  rose: "#b98b86",
  // metal & glass
  steel: "#8a8d92",
  steelHi: "#c8ccd2",
  steelLo: "#5f6267",
  brass: "#c9a24b",
  brassLo: "#8a6d2f",
  iron: "#26282c",
  ironHi: "#3a3d43",
  glassDay: "#a8c2d4",
  glassDawn: "#c6bcd0",
  glassDusk: "#c08a67",
  glassNight: "#232a34",
  // light
  warm: "#ffd98a",
  warmLo: "#8f8468",
  green: "#7ee08c",
  shadow: "#00000030",
  shadowSoft: "#00000018",
};

/* ------------------------------------------------------------------ *
 * gradients, grain, motes
 * ------------------------------------------------------------------ */

function SceneDefs() {
  return (
    <defs>
      <linearGradient id="bd-shaft" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stopColor="#fff4d4" stopOpacity="0.38" />
        <stop offset="55%" stopColor="#ffeabb" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#ffe0a0" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="bd-lamp" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.5" />
        <stop offset="50%" stopColor="#ffc878" stopOpacity="0.16" />
        <stop offset="100%" stopColor="#ffb860" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="bd-crt" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#7ee08c" stopOpacity="0.32" />
        <stop offset="100%" stopColor="#7ee08c" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="bd-vig" cx="0.5" cy="0.44" r="0.8">
        <stop offset="52%" stopColor="#0b0d12" stopOpacity="0" />
        <stop offset="100%" stopColor="#0b0d12" stopOpacity="0.4" />
      </radialGradient>
      <linearGradient id="bd-ceilfall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5b5f52" stopOpacity="0.22" />
        <stop offset="100%" stopColor="#5b5f52" stopOpacity="0" />
      </linearGradient>
      <pattern id="bd-grain" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect x="1" y="0" width="1" height="1" fill="#fffaf0" opacity="0.06" />
        <rect x="4" y="3" width="1" height="1" fill="#000000" opacity="0.06" />
      </pattern>
    </defs>
  );
}

const MOTES = [
  { x: 122, y: 128, s: 1, dur: "8.5s", rise: 16 },
  { x: 141, y: 146, s: 1, dur: "11s", rise: 22 },
  { x: 158, y: 134, s: 2, dur: "9.5s", rise: 18 },
  { x: 173, y: 158, s: 1, dur: "12.5s", rise: 20 },
  { x: 190, y: 142, s: 1, dur: "10s", rise: 24 },
  { x: 206, y: 164, s: 1, dur: "13.5s", rise: 17 },
  { x: 133, y: 112, s: 1, dur: "9s", rise: 14 },
];

function DustMotes() {
  return (
    <g style={{ pointerEvents: "none" }}>
      {MOTES.map((m) => (
        <rect
          key={`${m.x}:${m.y}`}
          x={m.x}
          y={m.y}
          width={m.s}
          height={m.s}
          fill="#fff6da"
          opacity={0}
        >
          <animate
            attributeName="y"
            values={`${m.y};${m.y - m.rise};${m.y}`}
            dur={m.dur}
            repeatCount="indefinite"
          />
          <animate
            attributeName="x"
            values={`${m.x};${m.x + 3};${m.x - 2};${m.x}`}
            dur={m.dur}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0.85;0.2;0"
            dur={m.dur}
            repeatCount="indefinite"
          />
        </rect>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * walls
 * ------------------------------------------------------------------ */

function Plaster() {
  return (
    <g>
      {px(0, 0, W, CEIL, B.ceil)}
      <rect x={0} y={0} width={W} height={26} fill="url(#bd-ceilfall)" />
      {/* hairline crack running out from the corner */}
      {px(64, 6, 22, 1, B.ceilLo)}
      {px(86, 7, 14, 1, B.ceilLo)}
      {px(100, 8, 9, 1, "#c6c1b3")}
      {px(96, 9, 1, 5, B.ceilLo)}
      {/* cornice */}
      {px(0, CEIL - 4, W, 1, B.ceilLo)}
      {px(0, CEIL - 3, W, 1, B.ceil)}
      {px(0, CEIL - 2, W, 2, B.cornice)}
      {/* wall body + roller texture */}
      {px(0, CEIL, W, 100, B.wall)}
      {stripes(W, CEIL, 100, 60, B.wallLo, 0)}
      {/* damp bloom in the far corner, the kind you stop noticing */}
      {px(0, 48, 26, 12, B.wallCold)}
      {px(0, 48, 18, 6, "#98a095")}
      {px(4, 60, 12, 4, B.wallCold)}
      {/* ghost rectangle where something used to hang, above the desk */}
      {px(196, 62, 30, 22, B.wallGhost)}
      {px(196, 62, 30, 1, "#cbd0c4")}
      {px(208, 60, 2, 2, B.steelLo)}
      {/* warm bloom around the sconce */}
      {px(370, 60, 38, 26, B.wallWarm)}
      {px(376, 62, 26, 16, "#c8c5ae")}
      {/* skirting board */}
      {px(0, 146, W, 4, B.skirt)}
      {px(0, 146, W, 1, B.skirtHi)}
      {px(214, 146, 12, 4, "#3f3a2f")}
      <rect x={0} y={CEIL} width={W} height={104} fill="url(#bd-grain)" />
    </g>
  );
}

function Door({ opening }: { opening: string | null }) {
  const open = opening === "door-living2";
  return (
    <g>
      {px(14, 56, 52, 94, "#a9a79f")}
      {px(14, 56, 52, 2, "#c0beb6")}
      {px(16, 58, 48, 92, "#b8b6ae")}
      {open ? px(20, 62, 40, 88, "#14161a") : null}
      {open ? px(20, 62, 40, 10, "#1d2027") : null}
      <g
        style={{
          transition: "transform 380ms ease-in",
          transform: open ? "scaleX(0.16)" : "none",
          transformOrigin: "20px 62px",
        }}
      >
        {px(20, 62, 40, 88, B.white)}
        {px(20, 62, 2, 88, B.cream)}
        {px(24, 68, 32, 34, B.whiteLo)}
        {px(24, 68, 32, 1, "#c7c3b7")}
        {px(24, 106, 32, 36, B.whiteLo)}
        {px(24, 106, 32, 1, "#c7c3b7")}
        {px(52, 100, 4, 5, B.brass)}
        {px(52, 105, 4, 2, B.brassLo)}
        {/* a coat forgotten on the back of the door */}
        {px(28, 64, 12, 26, B.wool)}
        {px(28, 64, 12, 2, B.woolHi)}
        {px(30, 90, 8, 6, "#5e5952")}
      </g>
      {px(18, 148, 46, 3, B.shadow)}
      {/* hook, robe, towel */}
      {px(84, 66, 8, 2, B.steelLo)}
      {px(86, 68, 2, 3, B.steel)}
      {px(80, 70, 13, 44, B.rose)}
      {px(80, 70, 13, 2, "#c99e99")}
      {px(80, 84, 13, 1, "#a87c78")}
      {px(83, 92, 3, 22, "#a87c78")}
      {px(80, 114, 13, 4, "#a87c78")}
    </g>
  );
}

function Windowsill({
  open,
  glass,
  night,
  day,
}: {
  open: boolean;
  glass: string;
  night: boolean;
  day: boolean;
}) {
  return (
    <g>
      {/* curtain rod + valance */}
      {px(86, 48, 82, 2, B.walnut)}
      {px(86, 48, 82, 1, B.oakLo)}
      {px(84, 47, 3, 4, B.brass)}
      {px(166, 47, 3, 4, B.brass)}
      {/* frame */}
      {px(94, 52, 66, 56, "#a9a79f")}
      {px(96, 54, 62, 52, "#b8b6ae")}
      {px(96, 54, 62, 2, "#c8c6be")}
      {/* left pane */}
      {px(100, 58, 26, 44, glass)}
      {day ? px(100, 58, 26, 14, "#bcd2e0") : null}
      {night ? (
        <g>
          {/* a streetlamp and one lit window across the yard */}
          {px(104, 70, 5, 5, "#ffcf7a")}
          {px(103, 69, 7, 7, "#ffcf7a")}
          <rect x={101} y={67} width={11} height={11} fill="#ffcf7a" opacity={0.22}>
            <animate
              attributeName="opacity"
              values="0.22;0.3;0.22"
              dur="6s"
              repeatCount="indefinite"
            />
          </rect>
          {px(118, 82, 4, 3, "#e8c98a")}
          {px(108, 90, 14, 12, "#1b222b")}
          {/* rain on the glass */}
          <rect x={112} y={60} width={1} height={5} fill="#9fb6c8" opacity={0.55}>
            <animate attributeName="y" values="58;96" dur="1.6s" repeatCount="indefinite" />
          </rect>
          <rect x={121} y={60} width={1} height={4} fill="#9fb6c8" opacity={0.4}>
            <animate attributeName="y" values="60;98" dur="2.1s" repeatCount="indefinite" />
          </rect>
          <rect x={106} y={60} width={1} height={6} fill="#9fb6c8" opacity={0.3}>
            <animate attributeName="y" values="62;94" dur="1.9s" repeatCount="indefinite" />
          </rect>
        </g>
      ) : (
        <g>
          {px(104, 62, 10, 8, "#c3d4de")}
          {px(116, 74, 6, 5, "#bccfdb")}
          {px(100, 90, 26, 12, "#93b3c8")}
        </g>
      )}
      {/* right pane — the one that swings */}
      {open ? (
        <g>
          {px(128, 58, 26, 44, night ? "#151a20" : "#8fb0c4")}
          <g style={{ transform: "scaleX(0.45)", transformOrigin: "128px 58px" }}>
            {px(128, 58, 26, 44, glass)}
            {px(150, 78, 3, 8, B.steel)}
          </g>
          <rect x={126} y={58} width={4} height={44} fill="#f4f0e4" opacity={0.9}>
            <animate attributeName="width" values="4;7;4" dur="3.4s" repeatCount="indefinite" />
          </rect>
        </g>
      ) : (
        <g>
          {px(128, 58, 26, 44, glass)}
          {px(132, 60, 4, 30, night ? "#2e3742" : "#c3d4de")}
          {px(148, 78, 3, 8, B.steel)}
        </g>
      )}
      {px(125, 58, 4, 44, "#b8b6ae")}
      {px(96, 78, 62, 1, "#aaa89f")}
      {/* curtains, tied back; the right one breathes when the sash is open */}
      {px(96, 52, 9, 58, B.linen)}
      {px(96, 52, 9, 2, B.cream)}
      {px(99, 56, 2, 50, B.linenLo)}
      {px(96, 84, 9, 3, B.linenLo)}
      <g style={{ transformOrigin: "154px 52px" }} transform="translate(0,0)">
        {px(149, 52, 9, 58, B.linen)}
        {px(149, 52, 9, 2, B.cream)}
        {px(152, 56, 2, 50, B.linenLo)}
        {px(149, 84, 9, 3, B.linenLo)}
        {open ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 154 52;-4 154 52;1 154 52;0 154 52"
            dur="5.2s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>
      {/* sill */}
      {px(92, 104, 70, 4, "#d8d5cc")}
      {px(92, 104, 70, 1, "#e6e3da")}
      {px(93, 108, 68, 2, B.shadow)}
      {/* plant in a tin, leaning to the light */}
      {px(99, 96, 10, 8, "#a8613f")}
      {px(99, 96, 10, 2, "#bd7350")}
      {px(101, 104, 6, 1, "#8a4e33")}
      {px(103, 88, 2, 8, "#4f6b3f")}
      {px(99, 86, 5, 2, "#5e7d4a")}
      {px(105, 90, 6, 2, "#5e7d4a")}
      {px(100, 92, 4, 2, "#4f6b3f")}
      {px(107, 84, 4, 2, "#6b8a52")}
      {px(97, 90, 3, 2, "#7a6a3a")} {/* one leaf gone brown */}
      {/* glass ashtray, two ends in it */}
      {px(140, 99, 12, 5, "#7f8d95")}
      {px(140, 99, 12, 1, "#a6b3ba")}
      {px(142, 100, 4, 1, B.cream)}
      {px(147, 101, 3, 1, "#d9d3c2")}
      {/* radiator + towel */}
      {px(102, 112, 46, 30, "#c9c6bd")}
      {px(102, 112, 46, 2, "#d8d5cc")}
      {px(102, 140, 46, 2, "#aeaba2")}
      {[106, 112, 118, 124, 130, 136, 142].map((x) => (
        <g key={x}>
          {px(x, 114, 3, 26, "#b6b3aa")}
          {px(x, 114, 1, 26, "#d2cfc6")}
        </g>
      ))}
      {px(100, 142, 50, 3, B.shadowSoft)}
      {px(115, 108, 15, 30, B.linen)}
      {px(115, 108, 15, 2, B.cream)}
      {px(115, 122, 15, 1, B.linenLo)}
      {px(117, 136, 11, 3, B.linenLo)}
      {px(102, 144, 3, 4, B.steelLo)}
      {px(145, 144, 3, 4, B.steelLo)}
    </g>
  );
}

function DeskWall({ lightOn }: { lightOn: boolean }) {
  return (
    <g>
      {/* four polaroids taped in a crooked row */}
      {px(172, 62, 13, 15, B.cream)}
      {px(173, 63, 11, 9, "#8ba0a8")}
      {px(175, 65, 4, 4, "#5d7480")}
      {px(177, 60, 5, 3, "#e4dfcd")}
      {px(186, 64, 13, 15, B.cream)}
      {px(187, 65, 11, 9, "#a89075")}
      {px(190, 67, 5, 4, "#7d6a55")}
      {px(191, 62, 5, 3, "#e4dfcd")}
      {px(172, 79, 13, 15, B.cream)}
      {px(173, 80, 11, 9, "#9aa88b")}
      {px(176, 82, 4, 4, "#6d7a61")}
      {px(176, 77, 5, 3, "#e4dfcd")}
      {/* wall calendar, one date ringed in red */}
      {px(228, 60, 22, 26, B.cream)}
      {px(228, 60, 22, 5, "#8a3a34")}
      {px(230, 62, 8, 1, B.cream)}
      {[66, 70, 74, 78].map((y) => (
        <g key={y}>{px(230, y, 18, 1, "#b9b4a4")}</g>
      ))}
      {px(238, 73, 4, 4, "#a33a30")}
      {px(239, 74, 2, 2, B.cream)}
      {px(238, 58, 2, 3, B.steelLo)}
      {/* small shelf: three books and a cassette */}
      {px(206, 88, 44, 3, B.oakLo)}
      {px(206, 88, 44, 1, B.oak)}
      {px(208, 91, 3, 2, B.walnutLo)}
      {px(246, 91, 3, 2, B.walnutLo)}
      {px(208, 76, 5, 12, "#3f5b7a")}
      {px(213, 74, 4, 14, "#7a3a3a")}
      {px(217, 77, 6, 11, "#6b6a4a")}
      {px(223, 78, 3, 10, "#8a6d2f")}
      {px(230, 80, 12, 8, "#2f3238")}
      {px(232, 82, 8, 4, "#4a4e55")}
      {px(233, 83, 2, 2, B.steelHi)}
      {px(237, 83, 2, 2, B.steelHi)}
      {/* cord from the sconce to the switch, sagging */}
      {px(400, 66, 1, 26, "#6a6455")}
      {px(400, 92, 6, 1, "#6a6455")}
      {lightOn ? px(400, 66, 1, 6, "#8a8368") : null}
    </g>
  );
}

function BedWall({ lightOn }: { lightOn: boolean }) {
  return (
    <g>
      {/* the small portrait: gold frame, quiet gaze, rosary on the corner */}
      {px(314, 54, 30, 36, B.brassLo)}
      {px(316, 56, 26, 32, B.brass)}
      {px(318, 58, 22, 28, B.brassLo)}
      {px(320, 60, 18, 24, "#5d4a37")}
      {px(320, 60, 18, 6, "#6b563f")}
      {px(324, 63, 10, 12, "#e0b48c")}
      {px(325, 64, 8, 4, "#4a3a2b")}
      {px(326, 60, 6, 4, B.brass)}
      {px(326, 68, 2, 2, "#3a2c20")}
      {px(331, 68, 2, 2, "#3a2c20")}
      {px(324, 74, 10, 8, "#8a3a34")}
      {px(322, 76, 3, 6, "#e0b48c")}
      {px(333, 76, 3, 6, "#e0b48c")}
      {/* dried palm tucked behind the frame */}
      {px(342, 52, 2, 10, "#9a8a52")}
      {px(343, 50, 4, 2, "#a89a5e")}
      {/* rosary hanging off the lower corner */}
      {px(313, 88, 1, 10, "#7a6a45")}
      {px(312, 98, 3, 1, "#7a6a45")}
      {px(313, 99, 1, 6, "#7a6a45")}
      {px(312, 105, 3, 3, B.brass)}
      {/* reading sconce */}
      {px(392, 56, 4, 6, B.steelLo)}
      {px(386, 62, 16, 3, B.brassLo)}
      {px(387, 65, 14, 5, lightOn ? B.warm : B.warmLo)}
      {px(389, 70, 10, 2, lightOn ? "#ffe6b0" : "#7d7460")}
      {lightOn ? (
        <ellipse
          cx={394}
          cy={78}
          rx={46}
          ry={30}
          fill="url(#bd-lamp)"
          style={{ pointerEvents: "none" }}
        >
          <animate attributeName="rx" values="46;48;46" dur="7s" repeatCount="indefinite" />
        </ellipse>
      ) : null}
      {/* switch by the door */}
      {px(70, 90, 10, 14, B.white)}
      {px(70, 90, 10, 1, B.cream)}
      {px(73, 94, 4, 6, lightOn ? B.brass : "#8f8a7c")}
      {px(73, 94, 4, 1, lightOn ? "#e6c274" : "#a09b8d")}
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * floor
 * ------------------------------------------------------------------ */

function Ground() {
  return (
    <g>
      {px(0, 150, W, 30, B.floor)}
      {px(0, 150, W, 2, "#00000026")}
      {stripes(W, 150, 30, 30, B.floorLo, 15)}
      {px(0, 158, W, 1, B.floorSeam)}
      {px(0, 168, W, 1, B.floorSeam)}
      {px(0, 176, W, 1, B.floorLo)}
      {/* short board joints, so the planks read as planks */}
      {px(78, 150, 1, 8, B.floorSeam)}
      {px(212, 158, 1, 10, B.floorSeam)}
      {px(336, 150, 1, 8, B.floorSeam)}
      {px(430, 168, 1, 8, B.floorSeam)}
      {px(494, 158, 1, 10, B.floorSeam)}
      {/* worn rug: faded kilim, fringe at both ends */}
      {px(292, 152, 160, 26, "#7e6f74")}
      {px(292, 152, 160, 2, "#8d7e83")}
      {px(296, 156, 152, 2, "#a8968c")}
      {px(296, 172, 152, 2, "#6d6066")}
      {px(300, 160, 144, 8, "#8a5f56")}
      {[304, 320, 336, 352, 368, 384, 400, 416, 432].map((x) => (
        <g key={x}>
          {px(x, 161, 6, 6, "#a8968c")}
          {px(x + 2, 163, 2, 2, "#6d6066")}
        </g>
      ))}
      {px(290, 154, 2, 22, "#b6a89a")}
      {px(452, 154, 2, 22, "#b6a89a")}
      {/* dust gathering along the skirting */}
      {px(240, 151, 30, 1, "#b39268")}
      {px(462, 151, 26, 1, "#b39268")}
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * furniture
 * ------------------------------------------------------------------ */

function Desk({ lightOn, night }: { lightOn: boolean; night: boolean }) {
  const screenOn = !night || lightOn;
  return (
    <g>
      {px(168, 148, 82, 3, B.shadow)}
      {/* top + apron */}
      {px(170, 108, 78, 5, B.oak)}
      {px(170, 108, 78, 2, B.oakHi)}
      {px(170, 113, 78, 2, B.oakLo)}
      {px(174, 115, 4, 33, B.oakLo)}
      {px(240, 115, 4, 33, B.oakLo)}
      {px(226, 115, 18, 26, B.oakLo)}
      {px(228, 117, 14, 10, "#9d8158")}
      {px(228, 129, 14, 10, "#9d8158")}
      {px(233, 121, 4, 2, B.brass)}
      {px(233, 133, 4, 2, B.brass)}
      {/* CRT: beige box, green terminal, sticky note on the bezel */}
      {px(182, 76, 38, 32, "#c9b995")}
      {px(182, 76, 38, 2, "#d8c9a6")}
      {px(184, 78, 34, 26, "#b3a988")}
      {px(186, 80, 30, 22, screenOn ? "#2a4535" : "#1c2a22")}
      {px(188, 82, 26, 18, screenOn ? "#213a2b" : "#1a2620")}
      {px(190, 84, 14, 2, screenOn ? B.green : "#3d5c45")}
      {px(190, 88, 20, 1, screenOn ? B.green : "#3d5c45")}
      {px(190, 91, 10, 1, screenOn ? B.green : "#3d5c45")}
      {px(190, 94, 17, 1, screenOn ? "#5cbf6c" : "#365040")}
      {screenOn ? (
        <rect x={190} y={97} width={4} height={2} fill={B.green}>
          <animate attributeName="opacity" values="1;1;0;0" dur="1.1s" repeatCount="indefinite" />
        </rect>
      ) : null}
      {screenOn ? (
        <rect x={186} y={80} width={30} height={22} fill="#a8ffbc" opacity={0.05}>
          <animate
            attributeName="opacity"
            values="0.05;0.11;0.04;0.08"
            dur="3.7s"
            repeatCount="indefinite"
          />
        </rect>
      ) : null}
      {screenOn ? (
        <ellipse
          cx={201}
          cy={91}
          rx={34}
          ry={22}
          fill="url(#bd-crt)"
          style={{ pointerEvents: "none" }}
        />
      ) : null}
      {px(220, 84, 6, 10, "#e8d98a")} {/* sticky note */}
      {px(221, 86, 4, 1, "#a89a52")}
      {px(221, 89, 3, 1, "#a89a52")}
      {px(194, 108, 16, 2, "#b3a988")}
      {px(192, 110, 20, 3, "#a89e80")}
      {/* keyboard, mouse, mug, papers, pens */}
      {px(184, 103, 26, 4, "#c6c1ae")}
      {px(184, 103, 26, 1, "#d8d3c0")}
      {px(186, 105, 22, 1, "#8f8a7c")}
      {px(214, 104, 7, 3, B.steelHi)}
      {px(216, 103, 3, 1, "#9aa0a6")}
      {px(213, 107, 9, 1, B.shadowSoft)}
      {/* mug, chipped, always half-finished */}
      {px(172, 98, 10, 10, "#3f6b7a")}
      {px(172, 98, 10, 2, "#517e8d")}
      {px(174, 100, 6, 2, "#2c4a55")}
      {px(182, 101, 3, 5, "#3f6b7a")}
      {px(182, 102, 1, 3, "#2c4a55")}
      {/* the formal papers, squared off, one page curling */}
      {px(170, 104, 14, 4, B.cream)}
      {px(171, 103, 13, 1, B.linen)}
      {px(172, 105, 9, 1, "#b9b4a4")}
      {px(172, 107, 6, 1, "#b9b4a4")}
      {/* pen cup */}
      {px(242, 100, 7, 8, "#7f8d95")}
      {px(243, 94, 1, 6, "#2b5aa8")}
      {px(245, 93, 1, 7, "#a33a30")}
      {px(247, 95, 1, 5, "#3a3d43")}
      {/* headphones hooked on the desk edge */}
      {px(219, 113, 3, 8, B.iron)}
      {px(219, 121, 5, 3, B.ironHi)}
      {px(222, 113, 1, 6, B.steelLo)}
      {/* cable spilling down the back leg + power strip with its red eye */}
      {px(216, 100, 1, 8, "#4a4e55")}
      {px(210, 124, 1, 14, "#4a4e55")}
      {px(196, 138, 15, 1, "#4a4e55")}
      {px(184, 138, 14, 5, "#3a3d43")}
      <rect x={186} y={140} width={2} height={2} fill="#d84a3a">
        <animate attributeName="opacity" values="1;0.55;1" dur="4s" repeatCount="indefinite" />
      </rect>
      {/* wastebasket, overflowing a little */}
      {px(178, 132, 16, 16, "#6b6a5e")}
      {px(178, 132, 16, 2, "#7d7c6f")}
      {px(180, 134, 12, 1, "#55544a")}
      {px(181, 128, 6, 5, B.cream)}
      {px(187, 130, 5, 4, "#e2ddcb")}
      {px(196, 145, 5, 4, B.cream)}
      {/* chair, pushed out at an angle, jumper over the back */}
      {px(144, 148, 30, 3, B.shadow)}
      {px(148, 112, 26, 5, B.walnut)}
      {px(148, 112, 26, 2, "#6d5842")}
      {px(150, 117, 4, 31, B.walnutLo)}
      {px(168, 117, 4, 31, B.walnutLo)}
      {px(150, 132, 22, 2, B.walnutLo)}
      {px(148, 84, 6, 28, B.walnut)}
      {px(148, 84, 6, 2, "#6d5842")}
      {px(140, 88, 12, 30, B.wool)}
      {px(140, 88, 12, 2, B.woolHi)}
      {px(142, 100, 8, 1, "#5c574f")}
      {px(140, 114, 6, 8, "#5c574f")}
    </g>
  );
}

function IronCorner() {
  return (
    <g>
      {px(250, 148, 68, 3, B.shadow)}
      {/* chalk smudges on the wall where hands go */}
      {px(258, 120, 12, 3, "#c9ccc4")}
      {px(276, 126, 8, 2, "#c9ccc4")}
      {/* a single medal on a nail, ribbon faded */}
      {px(266, 94, 1, 12, "#8a3a34")}
      {px(264, 94, 5, 2, "#a34a3a")}
      {px(263, 106, 6, 6, B.brass)}
      {px(265, 108, 2, 2, B.brassLo)}
      {px(266, 92, 2, 2, B.steelLo)}
      {/* the two girias */}
      {px(254, 128, 20, 18, B.iron)}
      {px(254, 128, 20, 2, B.ironHi)}
      {px(258, 121, 12, 9, B.iron)}
      {px(259, 122, 10, 2, B.ironHi)}
      {px(260, 123, 8, 4, B.wall)}
      {px(257, 141, 14, 2, "#1b1d20")}
      {px(276, 134, 16, 14, B.iron)}
      {px(276, 134, 16, 2, B.ironHi)}
      {px(279, 128, 10, 8, B.iron)}
      {px(280, 129, 8, 2, B.ironHi)}
      {px(281, 130, 6, 3, B.wall)}
      {/* barbell leaning on the wall, one collar loose */}
      {px(296, 68, 4, 80, B.steel)}
      {px(296, 68, 1, 80, B.steelHi)}
      {px(293, 64, 10, 7, B.iron)}
      {px(293, 64, 10, 2, B.ironHi)}
      {px(292, 140, 12, 8, B.iron)}
      {px(292, 140, 12, 2, B.ironHi)}
      {px(291, 134, 3, 5, B.steelLo)}
      {/* skipping rope coiled on the boards */}
      {px(252, 160, 16, 3, "#2f3238")}
      {px(254, 163, 12, 3, "#3a3d43")}
      {px(250, 158, 4, 3, "#a33a30")}
      {px(266, 165, 4, 3, "#a33a30")}
      {/* chalk bowl */}
      {px(272, 155, 10, 6, B.walnut)}
      {px(273, 154, 8, 2, "#e4e2da")}
    </g>
  );
}

function Bed({ lightOn }: { lightOn: boolean }) {
  return (
    <g>
      {px(318, 148, 134, 3, B.shadow)}
      {/* headboard */}
      {px(322, 82, 126, 36, B.oak)}
      {px(322, 82, 126, 3, B.oakHi)}
      {px(322, 82, 3, 36, B.oakHi)}
      {px(445, 84, 3, 34, B.oakLo)}
      {px(328, 90, 114, 1, B.oakLo)}
      {px(328, 112, 114, 1, B.oakLo)}
      {/* pillows, one dented where a head was */}
      {px(330, 94, 36, 18, B.linen)}
      {px(332, 92, 32, 4, B.cream)}
      {px(336, 98, 22, 4, B.linenLo)}
      {px(330, 108, 36, 3, B.linenLo)}
      {px(372, 94, 36, 18, B.linen)}
      {px(374, 92, 32, 4, B.cream)}
      {px(372, 108, 36, 3, B.linenLo)}
      {px(378, 96, 24, 2, B.cream)}
      {/* mattress, duvet, a sheet corner escaped at the side */}
      {px(320, 114, 130, 34, B.duvet)}
      {px(320, 114, 130, 4, B.duvetHi)}
      {px(324, 122, 60, 1, B.duvetLo)}
      {px(340, 128, 90, 1, B.duvetLo)}
      {px(360, 118, 1, 22, B.duvetLo)}
      {px(396, 120, 1, 18, B.duvetLo)}
      {px(320, 138, 130, 10, B.duvetLo)}
      {px(318, 128, 4, 18, B.linen)}
      {px(318, 128, 4, 2, B.cream)}
      {/* folded red wool blanket at the foot */}
      {px(322, 140, 126, 6, B.blanket)}
      {px(322, 140, 126, 1, B.blanketHi)}
      {px(322, 145, 126, 1, "#6d2c28")}
      {px(340, 141, 2, 4, "#6d2c28")}
      {px(404, 141, 2, 4, "#6d2c28")}
      {/* paperback left face-down, spine cracked */}
      {px(340, 120, 16, 8, "#c9b995")}
      {px(340, 120, 16, 2, "#d8c9a6")}
      {px(342, 123, 12, 1, "#a89a75")}
      {px(339, 119, 2, 9, "#8a3a34")}
      {/* slippers, one kicked sideways */}
      {px(336, 166, 14, 7, "#6d5f52")}
      {px(336, 166, 14, 2, "#7f7062")}
      {px(338, 167, 8, 2, "#544a40")}
      {px(354, 168, 13, 6, "#6d5f52")}
      {px(354, 168, 13, 2, "#7f7062")}
      {/* bedside table: lamp, clock, water, pills, a photo turned face-down */}
      {px(454, 148, 38, 3, B.shadow)}
      {px(456, 116, 34, 5, B.oak)}
      {px(456, 116, 34, 2, B.oakHi)}
      {px(458, 121, 4, 27, B.oakLo)}
      {px(484, 121, 4, 27, B.oakLo)}
      {px(460, 128, 26, 12, "#a8895e")}
      {px(462, 133, 6, 2, B.brass)}
      {/* lamp */}
      {px(468, 96, 14, 10, lightOn ? "#e8c98a" : "#8f8674")}
      {px(468, 96, 14, 2, lightOn ? "#f2dda8" : "#9c937f")}
      {px(474, 106, 2, 8, B.brassLo)}
      {px(470, 114, 10, 2, B.brassLo)}
      {lightOn ? (
        <ellipse
          cx={475}
          cy={112}
          rx={38}
          ry={26}
          fill="url(#bd-lamp)"
          style={{ pointerEvents: "none" }}
        />
      ) : null}
      {/* alarm clock, colon blinking */}
      {px(456, 108, 13, 8, "#2f3238")}
      {px(457, 109, 11, 6, "#151a20")}
      {px(458, 111, 3, 3, "#d84a3a")}
      {px(465, 111, 3, 3, "#d84a3a")}
      <rect x={462} y={112} width={1} height={1} fill="#d84a3a">
        <animate attributeName="opacity" values="1;1;0;0" dur="2s" repeatCount="indefinite" />
      </rect>
      {/* glass of water, half gone */}
      {px(486, 106, 6, 10, "#b6c9d2")}
      {px(486, 110, 6, 6, "#8fb0c4")}
      {px(486, 106, 1, 10, B.steelHi)}
      {/* photo frame laid face-down */}
      {px(470, 114, 12, 3, B.walnut)}
      {px(470, 114, 12, 1, "#6d5842")}
    </g>
  );
}

function Wardrobe({ open }: { open: boolean }) {
  return (
    <g>
      {px(492, 148, 56, 3, B.shadow)}
      {/* suitcase on top, dusty */}
      {px(500, 44, 40, 12, "#7a5c3f")}
      {px(500, 44, 40, 2, "#8f6f4c")}
      {px(500, 49, 40, 1, "#5f4630")}
      {px(516, 42, 8, 3, B.walnutLo)}
      {px(506, 48, 3, 4, B.brass)}
      {px(532, 48, 3, 4, B.brass)}
      {open ? (
        <g>
          {px(494, 56, 54, 92, "#2c2620")}
          {px(496, 58, 50, 88, "#241f1a")}
          {px(498, 62, 46, 2, B.steel)}
          {/* hanging clothes, uneven */}
          {px(500, 64, 6, 34, "#4a5a7a")}
          {px(507, 64, 5, 30, "#a33a30")}
          {px(513, 64, 6, 36, B.linen)}
          {px(520, 64, 5, 28, "#3f4a3a")}
          {px(526, 64, 6, 32, B.wool)}
          {px(533, 64, 5, 26, "#7a5c3f")}
          {px(500, 64, 38, 2, "#00000040")}
          {/* shelf with folded things and a shoebox */}
          {px(496, 104, 50, 2, B.oakLo)}
          {px(500, 108, 16, 8, B.linen)}
          {px(500, 108, 16, 2, B.cream)}
          {px(518, 108, 14, 8, B.duvet)}
          {px(518, 108, 14, 2, B.duvetHi)}
          {px(534, 106, 12, 10, "#8a7a5e")}
          {px(534, 106, 12, 2, "#9d8b6c")}
          {px(500, 120, 44, 26, "#1d1915")}
          {px(504, 130, 16, 12, "#8a8f96")}
          {px(506, 132, 12, 8, "#6d7178")}
          {px(524, 134, 14, 10, "#5d4a37")}
        </g>
      ) : (
        <g>
          {px(494, 56, 54, 92, "#a8895e")}
          {px(494, 56, 54, 2, B.oak)}
          {px(494, 56, 2, 92, B.oakHi)}
          {px(546, 56, 2, 92, B.oakLo)}
          {px(520, 58, 2, 88, B.oakLo)}
          {px(498, 60, 20, 42, B.oakLo)}
          {px(499, 61, 18, 2, "#846a47")}
          {px(498, 106, 20, 38, B.oakLo)}
          {px(499, 107, 18, 2, "#846a47")}
          {/* mirror panel on the right door, catching a sliver of the room */}
          {px(524, 60, 20, 66, "#7f8d95")}
          {px(524, 60, 20, 2, "#a6b3ba")}
          {px(526, 64, 16, 26, "#8fa3ac")}
          {px(526, 92, 16, 30, "#6d7c85")}
          {px(529, 96, 6, 18, "#7f8d95")}
          {px(514, 100, 3, 9, B.brass)}
          {px(524, 100, 3, 9, B.brass)}
          {/* a tie left hanging over the door edge */}
          {px(536, 56, 3, 22, "#4a5a7a")}
          {px(535, 78, 5, 8, "#3f4d6b")}
        </g>
      )}
      {/* boots by the door, toes pointing in */}
      {px(20, 160, 16, 10, "#4a3a2b")}
      {px(20, 160, 16, 2, "#5d4a37")}
      {px(20, 168, 16, 2, "#2f251c")}
      {px(38, 162, 15, 9, "#4a3a2b")}
      {px(38, 162, 15, 2, "#5d4a37")}
      {px(38, 169, 15, 2, "#2f251c")}
      {/* one sock that never made it to the wash */}
      {px(470, 170, 10, 4, B.linenLo)}
      {px(470, 170, 10, 1, B.linen)}
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * scene
 * ------------------------------------------------------------------ */

function BedroomScene({ world, phase }: { world: WorldState; phase: string }) {
  const isNight = phase === "night";
  const isDusk = phase === "dusk";
  const isDawn = phase === "dawn";
  const night = isNight || isDusk;
  const day = !night && !isDawn;
  const lightOn = world.lights.study;
  const glass = isNight ? B.glassNight : isDusk ? B.glassDusk : isDawn ? B.glassDawn : B.glassDay;
  const win = world.windows["window-yard"];
  const opening = world.doorOpening;

  const wash = isNight
    ? { fill: "#1b2a3a", opacity: 0.16 }
    : isDusk
      ? { fill: "#c46a3a", opacity: 0.14 }
      : isDawn
        ? { fill: "#8f8ab0", opacity: 0.1 }
        : { fill: "#ffd9a0", opacity: 0.07 };

  return (
    <LayeredScene
      parallax={{ middleBackground: 1 }}
      middleBackground={
        <g>
          <SceneDefs />
          <Plaster />
          <Door opening={opening} />
          <Windowsill open={win.open} glass={glass} night={isNight} day={day} />
          <DeskWall lightOn={lightOn} />
          <BedWall lightOn={lightOn} />
        </g>
      }
      ground={
        <g>
          <Ground />
          {/* the shaft lands on the boards, and the dust lives in it */}
          {day || isDawn ? (
            <g style={{ pointerEvents: "none" }}>
              <polygon
                points="100,106 156,106 232,180 150,180"
                fill="url(#bd-shaft)"
                opacity={isDawn ? 0.55 : 1}
              />
              <DustMotes />
            </g>
          ) : null}
          {lightOn ? (
            <ellipse
              cx={396}
              cy={162}
              rx={72}
              ry={20}
              fill="url(#bd-lamp)"
              opacity={0.7}
              style={{ pointerEvents: "none" }}
            />
          ) : null}
        </g>
      }
      staticObjects={
        <g>
          <Desk lightOn={lightOn} night={isNight} />
          <IronCorner />
          <Bed lightOn={lightOn} />
          <Wardrobe open={world.wardrobeOpen} />
          {/* time-of-day wash + vignette, painted last, over everything static */}
          <g style={{ pointerEvents: "none" }}>
            <rect x={0} y={0} width={W} height={180} fill={wash.fill} opacity={wash.opacity} />
            <rect x={0} y={0} width={W} height={180} fill="url(#bd-vig)" />
          </g>
        </g>
      }
      gameplayObjects={<g>{/* hitboxes only */}</g>}
    />
  );
}

function Steam({ x, y, scale, slow }: { x: number; y: number; scale: number; slow?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x * scale, top: y * scale, opacity: slow ? 0.6 : 1 }}
    >
      <div className="steam" style={{ width: 3 * scale, height: 3 * scale }} />
      <div
        className="steam steam-2"
        style={{ width: 2 * scale, height: 2 * scale, marginLeft: 4 * scale }}
      />
    </div>
  );
}

function BedroomEffects({
  world,
  scale,
  actionUi,
}: {
  world: WorldState;
  phase: string;
  fx: import("@/engine").FxInstance[];
  scale: number;
  actionUi: string | null;
  moving: boolean;
  dialogueOpen: boolean;
}) {
  return (
    <>
      {/* the mug is always a little too hot to drink and always goes cold */}
      <Steam x={175} y={94} scale={scale} slow />
      {actionUi === "smoke" && world.windows["window-yard"].open ? (
        <Steam x={138} y={60} scale={scale} />
      ) : null}
    </>
  );
}

export const BEDROOM_SCENE: SceneDef<WorldState> = {
  id: "study",
  width: W,
  objects: [
    {
      id: "door-living2",
      kind: "flatdoor",
      x: 40,
      range: 20,
      to: { scene: "studio", spawnX: 488 },
    },
    { id: "switch-bed", kind: "lamp", x: 76, range: 12 },
    { id: "window-yard", kind: "window", x: 127, range: 16 },
    { id: "computer", kind: "computer", x: 201, range: 20 },
    { id: "giria", kind: "sport", action: "swing", x: 270, range: 14 },
    { id: "barbell", kind: "sport", action: "press", x: 296, range: 10 },
    { id: "painting", kind: "sport", action: "pray", x: 329, range: 10 },
    { id: "bed", kind: "panel", x: 385, range: 24, data: "about" },
    { id: "wardrobe", kind: "openable", x: 520, range: 18 },
  ],
  Component: ({ world, phase }) => <BedroomScene world={world} phase={phase} />,
  darkness: (phase, world) => roomDarkness(phase as DayPhase, world.lights.study),
  Effects: BedroomEffects,
};
