import { useEffect, useState } from "react";
import { LayeredScene, px, type SceneDef, stripes } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { NpcMonologue } from "./NpcMonologue";

// --- КОРИДОР / a modern Polish landing, floor 4 -------------------------------------

/**
 * The landing has no daylight of its own except the stairwell window, so that
 * window does all the work: it decides whether the tiles are cold blue or warm
 * amber, whether the blind is half down or fully down, whether it's raining.
 *
 * Everything here has a state and most of them are on the clock rather than on
 * a flag — the neighbours take the pram out in the morning and bring it back at
 * night, a strip of light shows under 13's door once it's dark, Pani Natalia
 * mops at dawn, leans on the mop by midday, wrings out at dusk, and by night
 * has gone home leaving the bucket parked against the wall.
 */

const W = 560;

/** Ceiling spot positions — the motion lights cone down from these. */
const CORRIDOR_SPOTS = [80, 230, 380, 500];

const C = {
  ceil: "#e8e6e0",
  ceilLo: "#d0cec6",
  ceilSeam: "#dcd9d1",
  wallHi: "#d6d2c8",
  wallLo: "#c9c5ba",
  wallScuff: "#bfbbb0",
  wallPatch: "#ded9cf",
  band: "#4a4d52",
  bandHi: "#5a5d62",
  skirt: "#3f4246",
  tile: "#9d9a92",
  tileLo: "#8b8880",
  tileHi: "#b5b2aa",
  tileWet: "#aab0ae",
  steel: "#aeb2b8",
  steelHi: "#c8ccd2",
  steelDark: "#6b6e73",
  graphite: "#3f4246",
  graphiteHi: "#4a4d52",
  glassDay: "#a8c2d4",
  glassDusk: "#c99a72",
  glassNight: "#232a34",
  blind: "#e8e6e0",
  blindLo: "#d0cec6",
  oak: "#a8895e",
  oakLo: "#9a7c52",
  white: "#e2e0da",
  whiteLo: "#d8d6d0",
  brass: "#c9a24b",
  red: "#b03030",
  redHi: "#c94040",
  green: "#3ddc84",
  leaf: "#4e6b4e",
  leafDry: "#8a8a4a",
  teal: "#3a7d84",
  tealLo: "#2f6a70",
  tealHi: "#459098",
  skin: "#e0b48c",
  skinShade: "#c79a72",
  warm: "#ffd98a",
  shadow: "#00000033",
  shadowSoft: "#0000001c",
};

type Ph = "dawn" | "day" | "dusk" | "night";

function toPhase(phase?: string): Ph {
  if (phase === "night") return "night";
  if (phase === "dusk") return "dusk";
  if (phase === "dawn" || phase === "morning") return "dawn";
  return "day";
}

/** Optional corridor flags, read defensively so this compiles unchanged. */
function extras(world: WorldState) {
  const c = (world.corridor ?? {}) as unknown as Record<string, boolean | undefined>;
  return {
    riserOpen: !!c.riserOpen,
    noticeRead: !!c.noticeRead,
  };
}

// ---------------------------------------------------------------------------
// a 3×5 font for door numbers and the lift indicator
// ---------------------------------------------------------------------------

const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  P: ["111", "101", "111", "100", "100"],
  "-": ["000", "000", "111", "000", "000"],
  " ": ["00", "00", "00", "00", "00"],
};

function PixelText({
  x,
  y,
  text,
  fill,
  gap = 1,
}: {
  x: number;
  y: number;
  text: string;
  fill: string;
  gap?: number;
}) {
  const out: React.ReactNode[] = [];
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const rows = GLYPHS[text[i]] ?? GLYPHS[" "];
    const w = rows[0].length;
    for (let r = 0; r < rows.length; r++) {
      for (let col = 0; col < w; col++) {
        if (rows[r][col] === "1") out.push(px(cx + col, y + r, 1, 1, fill, `g${i}${r}${col}`));
      }
    }
    cx += w + gap;
  }
  return <g>{out}</g>;
}

// ---------------------------------------------------------------------------
// ceiling + walls
// ---------------------------------------------------------------------------

function Ceiling() {
  return (
    <g>
      {px(0, 0, W, 40, C.ceil)}
      {/* suspended panel seams */}
      {[93, 186, 279, 372, 465].map((x) => px(x, 0, 1, 40, C.ceilSeam, `cs${x}`))}
      {px(0, 26, W, 1, C.ceilSeam)}
      {px(0, 40, W, 3, C.ceilLo)}
      {/* recessed spot housings */}
      {CORRIDOR_SPOTS.map((x) => (
        <g key={`spot${x}`}>
          {px(x - 6, 36, 12, 4, "#b8b6ae")}
          {px(x - 6, 36, 12, 1, "#c9c7bf")}
          {px(x - 4, 40, 8, 2, "#fff8e0")}
        </g>
      ))}
      {/* smoke detector, blinking the way they do at 3am */}
      {px(152, 34, 16, 6, "#e2e0da")}
      {px(154, 32, 12, 2, "#e8e6e0")}
      {px(156, 40, 8, 1, "#c9c7bf")}
      <rect x={158} y={37} width={2} height={2} fill="#ff5050">
        <animate attributeName="opacity" values="0;0;1;0;0" dur="8s" repeatCount="indefinite" />
      </rect>
      {/* ventilation grille */}
      {px(300, 33, 34, 8, "#c9c7bf")}
      {px(300, 33, 34, 1, "#dcd9d1")}
      {[303, 308, 313, 318, 323, 328].map((x) => px(x, 35, 2, 5, "#a8a69e", `vg${x}`))}
      {/* the cable tray nobody was supposed to see */}
      {px(410, 38, 60, 2, "#b8b6ae")}
    </g>
  );
}

function Walls({ ph }: { ph: Ph }) {
  return (
    <g>
      {/* greige upper wall with roller texture */}
      {px(0, 43, W, 60, C.wallHi)}
      {stripes(W, 43, 60, 74, "#cfcbc1", 20)}
      {/* the big painted floor numeral, cropped by the corner */}
      {px(0, 50, 5, 30, "#c2beb4")}
      {px(0, 74, 18, 5, "#c2beb4")}
      {px(13, 50, 5, 42, "#c2beb4")}
      {/* graphite accent band, with the cable trunking it hides */}
      {px(0, 103, W, 6, C.band)}
      {px(0, 103, W, 1, C.bandHi)}
      {px(0, 108, W, 1, "#33363a")}
      {/* lower wall, scuffed where trolleys and prams pass */}
      {px(0, 109, W, 35, C.wallLo)}
      {px(172, 128, 40, 6, C.wallScuff)}
      {px(430, 132, 34, 4, C.wallScuff)}
      {px(96, 136, 22, 3, C.wallScuff)}
      {/* a filled-and-not-repainted patch */}
      {px(266, 116, 12, 10, C.wallPatch)}
      {px(266, 116, 12, 1, "#e6e2d8")}
      {/* skirting with the LED channel */}
      {px(0, 144, W, 6, C.skirt)}
      {px(0, 144, W, 1, "#565a5f")}
      {px(0, 148, W, 1, "#2e3135")}
      {/* the drilled-and-abandoned anchor holes above the band */}
      {px(340, 96, 2, 2, "#a8a49a")}
      {px(352, 96, 2, 2, "#a8a49a")}
      {ph === "night" ? px(0, 43, W, 101, "#141a24", "wallnight") : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// the stairwell window — the only daylight on this floor
// ---------------------------------------------------------------------------

function StairWindow({ ph }: { ph: Ph }) {
  const night = ph === "night";
  const glass =
    ph === "night"
      ? C.glassNight
      : ph === "dusk"
        ? C.glassDusk
        : ph === "dawn"
          ? "#c6c0d0"
          : C.glassDay;
  // the blind gets pulled further down after dark
  const blindH = night ? 34 : ph === "dusk" ? 24 : 16;
  return (
    <g>
      {px(492, 44, 64, 56, "#b8b6ae")}
      {px(492, 44, 64, 2, "#c9c7bf")}
      {px(496, 48, 56, 48, glass)}
      {!night ? px(496, 48, 56, 16, "#bcd2e0") : null}
      {/* the block opposite, and its lit windows after dark */}
      {night ? (
        <g>
          {px(500, 60, 44, 36, "#1b2029")}
          {[
            [504, 66],
            [516, 72],
            [530, 64],
            [522, 84],
          ].map(([wx, wy], i) => (
            <rect key={`${wx}${wy}`} x={wx} y={wy} width={5} height={5} fill={C.warm}>
              <animate
                attributeName="opacity"
                values="1;1;0.2;1"
                dur={`${45 + i * 13}s`}
                repeatCount="indefinite"
              />
            </rect>
          ))}
          {/* rain on the glass */}
          {[502, 517, 534, 545].map((rx, i) => (
            <rect key={rx} x={rx} y={50} width={1} height={5} fill="#9fb6c8" opacity={0.5}>
              <animate
                attributeName="y"
                values="48;92"
                dur={`${1.5 + i * 0.3}s`}
                repeatCount="indefinite"
              />
            </rect>
          ))}
        </g>
      ) : (
        <g>
          {px(500, 62, 44, 34, "#8fa8b8")}
          {px(504, 70, 12, 10, "#7d97a8")}
          {px(524, 66, 14, 12, "#7d97a8")}
        </g>
      )}
      {/* mullion + roller blind */}
      {px(522, 48, 2, 48, "#b8b6ae")}
      {px(496, 48, 56, blindH, C.blind)}
      {px(496, 48 + blindH - 2, 56, 2, C.blindLo)}
      {[52, 56, 60]
        .filter((y) => y < 48 + blindH - 2)
        .map((y) => px(496, y, 56, 1, "#dcd9d1", `bl${y}`))}
      {px(522, 48 + blindH, 2, 5, "#c9c7bf")}
      {/* sill, and the dust that gathers on every sill */}
      {px(490, 96, 68, 4, "#d0cec6")}
      {px(490, 96, 68, 1, "#e2e0da")}
      {px(491, 100, 66, 3, C.shadowSoft)}
      {px(494, 94, 8, 2, "#c2beb4")}
    </g>
  );
}

/** The cat that used to own the stairwell and now owns the sill. */
function SillCat({ ph }: { ph: Ph }) {
  const asleep = ph === "night" || ph === "dusk";
  const coat = "#4a4440";
  const coatHi = "#5a534e";
  if (asleep) {
    return (
      <g>
        {px(502, 88, 24, 8, coat)}
        {px(502, 88, 24, 2, coatHi)}
        {px(520, 84, 9, 8, coat)}
        {px(521, 82, 3, 3, coat)}
        {px(526, 82, 3, 3, coat)}
        {px(522, 87, 2, 1, "#c9a24b")}
        {px(526, 87, 2, 1, "#c9a24b")}
        <rect x={498} y={93} width={7} height={3} fill={coat}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 505 94;-9 505 94;3 505 94;0 505 94"
            dur="8.4s"
            repeatCount="indefinite"
          />
        </rect>
        <rect x={506} y={86} width={12} height={4} fill={coatHi} opacity={0.9}>
          <animate attributeName="y" values="86;85;86" dur="4.8s" repeatCount="indefinite" />
        </rect>
      </g>
    );
  }
  // sitting up, watching whatever is happening in the yard
  return (
    <g>
      {px(506, 84, 11, 12, coat)}
      {px(506, 84, 11, 2, coatHi)}
      {px(505, 76, 12, 9, coat)}
      {px(505, 73, 4, 4, coat)}
      {px(512, 73, 4, 4, coat)}
      {px(506, 78, 2, 2, "#8fa86a")}
      {px(513, 78, 2, 2, "#8fa86a")}
      {px(509, 81, 2, 1, "#b98b86")}
      {px(504, 93, 5, 3, coat)}
      <g>
        {px(517, 88, 3, 8, coat)}
        {px(517, 93, 7, 3, coat)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 518 90;-6 518 90;4 518 90;-3 518 90;0 518 90"
          dur="6.2s"
          repeatCount="indefinite"
        />
      </g>
      {/* ear flick */}
      <rect x={512} y={73} width={4} height={4} fill={coat}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 514 77;0 514 77;-20 514 77;0 514 77;0 514 77"
          dur="9.5s"
          repeatCount="indefinite"
        />
      </rect>
    </g>
  );
}

// ---------------------------------------------------------------------------
// doors
// ---------------------------------------------------------------------------

/** Your door: anthracite steel, vertical bar handle, number 14. */
function FlatDoor({ ph }: { ph: Ph }) {
  return (
    <g>
      {px(20, 62, 50, 88, C.steel)}
      {px(20, 62, 50, 2, C.steelHi)}
      {px(24, 66, 42, 84, C.graphite)}
      {px(26, 68, 38, 80, C.graphiteHi)}
      {px(26, 68, 38, 1, "#5a5d62")}
      {/* three shallow panels the catalogue called "modern" */}
      {px(30, 74, 30, 22, "#454850")}
      {px(30, 100, 30, 22, "#454850")}
      {px(30, 126, 30, 16, "#454850")}
      {/* bar handle, lock, spyhole, and the number */}
      {px(56, 92, 3, 30, "#b8b6ae")}
      {px(56, 92, 3, 2, "#d4d2ca")}
      {px(52, 124, 4, 3, "#8a8d92")}
      {px(34, 84, 3, 3, "#2e3033")}
      {px(34, 84, 3, 1, "#8a8d92")}
      <PixelText x={40} y={73} text="14" fill={C.white} />
      {/* the sticker asking for no adverts, half scraped off */}
      {px(46, 128, 12, 8, "#d8d6d0")}
      {px(48, 130, 8, 1, "#8a8d92")}
      {px(48, 133, 6, 1, "#8a8d92")}
      {/* warm line under your own door in the evening */}
      {ph === "night" || ph === "dusk" ? px(26, 147, 38, 2, "#ffcf7a") : null}
    </g>
  );
}

/** Neighbour 13: white laminate, brass knob, and a life behind it. */
function Door13({ ph }: { ph: Ph }) {
  const lightsOn = ph === "dusk" || ph === "night";
  return (
    <g>
      {px(118, 64, 46, 86, C.steel)}
      {px(122, 68, 38, 82, C.white)}
      {px(122, 68, 38, 2, "#eceae4")}
      {px(126, 74, 30, 30, C.whiteLo)}
      {px(126, 74, 30, 1, "#c9c7bf")}
      {px(126, 108, 30, 32, C.whiteLo)}
      {px(126, 108, 30, 1, "#c9c7bf")}
      {px(152, 104, 4, 5, C.brass)}
      {px(152, 108, 4, 2, "#a8863a")}
      {px(130, 82, 3, 3, "#2e3033")}
      <PixelText x={138} y={70} text="13" fill="#8a8d92" />
      {/* a wreath that has outlasted three seasons */}
      {px(134, 84, 14, 14, "#4e6b4e")}
      {px(136, 86, 10, 10, C.whiteLo)}
      {px(133, 88, 3, 6, "#57755a")}
      {px(146, 88, 3, 6, "#57755a")}
      {px(139, 82, 5, 4, "#a33a30")}
      {/* light under the door, and somebody crossing it now and then */}
      {lightsOn ? (
        <g>
          {px(122, 147, 38, 2, "#ffcf7a")}
          <rect x={128} y={147} width={9} height={2} fill="#5d4a30">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;0 0;22 0;0 0;0 0"
              keyTimes="0;0.7;0.78;0.86;1"
              dur="26s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : null}
    </g>
  );
}

/** Neighbour 15: oak veneer, quiet people, a newspaper at dawn. */
function Door15({ ph }: { ph: Ph }) {
  return (
    <g>
      {px(316, 64, 46, 86, C.steel)}
      {px(320, 68, 38, 82, C.oak)}
      {px(320, 68, 38, 2, "#bb9c6c")}
      {px(324, 74, 30, 66, C.oakLo)}
      {px(324, 74, 30, 1, "#b08f5e")}
      {px(324, 106, 30, 1, "#8a6f48")}
      {px(350, 104, 4, 5, C.graphiteHi)}
      {px(328, 82, 3, 3, "#2e3033")}
      <PixelText x={336} y={70} text="15" fill="#6b5a3c" />
      {/* the sticker they actually mean */}
      {px(334, 118, 16, 9, C.white)}
      {px(336, 120, 12, 1, "#a33a30")}
      {px(336, 123, 9, 1, "#8a8d92")}
      {/* the morning paper, leaning */}
      {ph === "dawn" ? (
        <g>
          {px(340, 136, 12, 14, "#d8d6d0")}
          {px(340, 136, 12, 2, "#eceae4")}
          {px(342, 140, 8, 1, "#8a8d92")}
          {px(342, 143, 6, 1, "#8a8d92")}
        </g>
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// the lift
// ---------------------------------------------------------------------------

function Lift({ open }: { open: boolean }) {
  return (
    <g>
      {/* portal */}
      {px(426, 54, 56, 96, C.steelDark)}
      {px(426, 54, 56, 2, "#8a8d92")}
      {px(430, 58, 48, 92, "#2b2e32")}
      {/* the car behind the doors: mirror, handrail, panel, light */}
      {open ? (
        <g>
          {px(432, 60, 44, 88, "#4a4d52")}
          {px(432, 60, 44, 6, "#fff8e0")}
          {px(434, 66, 40, 60, "#7d8a92")}
          {px(436, 68, 36, 56, "#8e9aa2")}
          {/* your own blurred reflection, standing where you stand */}
          {px(446, 78, 14, 46, "#6d7a84")}
          {px(448, 70, 10, 9, "#7d8a92")}
          {px(434, 100, 40, 2, "#b8bcc2")}
          {/* button panel */}
          {px(466, 82, 8, 26, "#3a3d42")}
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={468}
              y={85 + i * 5}
              width={4}
              height={3}
              fill={i === 0 ? C.warm : "#8a8d92"}
            />
          ))}
          {px(434, 126, 40, 22, "#3a3d42")}
          {px(434, 126, 40, 1, "#5a5d62")}
          {/* the free newspaper somebody left on the floor */}
          {px(452, 140, 14, 6, "#d8d6d0")}
        </g>
      ) : null}
      {/* leaves */}
      <g
        style={{
          transition: "transform 650ms ease-in-out",
          transform: open ? "translateX(-20px)" : "none",
        }}
      >
        {px(432, 60, 22, 88, C.steel)}
        {px(434, 62, 2, 84, C.steelHi)}
        {px(448, 62, 1, 84, "#9a9ea4")}
        {px(432, 104, 22, 1, "#9a9ea4")}
      </g>
      <g
        style={{
          transition: "transform 650ms ease-in-out",
          transform: open ? "translateX(20px)" : "none",
        }}
      >
        {px(454, 60, 22, 88, C.steel)}
        {px(472, 62, 2, 84, C.steelHi)}
        {px(457, 62, 1, 84, "#9a9ea4")}
        {px(454, 104, 22, 1, "#9a9ea4")}
      </g>
      {open ? px(453, 60, 2, 88, "#14161a") : null}
      {/* threshold */}
      {px(430, 148, 48, 2, "#8a8d92")}
      {/* indicator: floor digits cycling when the car is elsewhere */}
      {px(440, 42, 28, 11, "#14161a")}
      {px(440, 42, 28, 1, "#3a3d42")}
      {open ? (
        <g>
          <PixelText x={446} y={45} text="4" fill={C.green} />
          {px(454, 45, 3, 1, C.green)}
          {px(455, 46, 1, 3, C.green)}
        </g>
      ) : (
        <g>
          {["1", "2", "3", "4"].map((d, i) => (
            <g key={d} opacity={0}>
              <PixelText x={446} y={45} text={d} fill={C.brass} />
              <animate
                attributeName="opacity"
                values="0;1;1;0;0"
                keyTimes={`0;${0.02 + i * 0.22};${0.18 + i * 0.22};${0.2 + i * 0.22};1`}
                dur="11s"
                repeatCount="indefinite"
              />
            </g>
          ))}
          {/* the up arrow, blinking while it climbs */}
          <g>
            {px(458, 45, 5, 1, C.brass)}
            {px(459, 46, 3, 1, C.brass)}
            {px(460, 47, 1, 1, C.brass)}
            <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
          </g>
        </g>
      )}
      {/* call button and its plate */}
      {px(484, 92, 8, 14, C.steel)}
      {px(484, 92, 8, 1, C.steelHi)}
      {px(485, 95, 6, 6, open ? C.green : "#e8e6e0")}
      {px(486, 96, 4, 4, open ? "#7bf0ae" : "#d0cec6")}
      {px(486, 103, 4, 1, "#8a8d92")}
    </g>
  );
}

/** The A4 notice taped up by the lift, corner lifting in the draft. */
function LiftNotice() {
  return (
    <g>
      {px(414, 70, 16, 22, "#e8e6e0")}
      {px(414, 70, 16, 1, "#f4f2ec")}
      {px(416, 73, 12, 2, "#a33a30")}
      {[78, 81, 84].map((y) => px(416, y, 11, 1, "#8a8d92", `nl${y}`))}
      {px(416, 87, 7, 1, "#8a8d92")}
      {px(413, 69, 6, 3, "#d8e4ec99")}
      {/* the bottom corner has come unstuck */}
      <g>
        {px(426, 88, 4, 4, "#dcd9d1")}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 426 88;0 426 88;-14 426 88;2 426 88;0 426 88"
          dur="13s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// wall fittings
// ---------------------------------------------------------------------------

function Intercom() {
  return (
    <g>
      {px(88, 72, 18, 28, "#2e3033")}
      {px(88, 72, 18, 1, "#4a4d52")}
      {px(90, 75, 14, 14, "#141a24")}
      {/* standby, with the occasional look at whoever is downstairs */}
      <g>
        {px(91, 76, 12, 12, "#1b3a5c")}
        {px(93, 79, 4, 9, "#2b5aa8")}
        {px(98, 82, 3, 6, "#24406e")}
        <animate
          attributeName="opacity"
          values="0;0;1;1;0;0"
          keyTimes="0;0.62;0.66;0.78;0.82;1"
          dur="42s"
          repeatCount="indefinite"
        />
      </g>
      <rect x={102} y={86} width={2} height={2} fill={C.green}>
        <animate attributeName="opacity" values="1;0.25;1" dur="3.4s" repeatCount="indefinite" />
      </rect>
      {/* speaker grille, key button, and the tiny lens above */}
      {[91, 94, 97, 100].map((x) => px(x, 91, 2, 4, "#4a4d52", `ig${x}`))}
      {px(100, 91, 4, 4, "#8a8d92")}
      {px(95, 69, 4, 3, "#4a4d52")}
      {px(96, 70, 2, 1, "#8fb0c4")}
    </g>
  );
}

function LightSwitch() {
  return (
    <g>
      {px(108, 88, 10, 13, "#e2e0da")}
      {px(108, 88, 10, 1, "#f0eee8")}
      {px(110, 91, 6, 7, "#d0cec6")}
      <rect x={111} y={92} width={4} height={2} fill="#ff8a3a" opacity={0.9}>
        <animate
          attributeName="opacity"
          values="0.9;0.35;0.9"
          dur="2.8s"
          repeatCount="indefinite"
        />
      </rect>
      {/* and the socket under it that everybody uses for the vacuum */}
      {px(107, 128, 12, 12, "#e2e0da")}
      {px(109, 131, 8, 6, "#d0cec6")}
      {px(110, 133, 2, 2, "#8a8d92")}
      {px(114, 133, 2, 2, "#8a8d92")}
    </g>
  );
}

/** The electrical riser: meters, breakers, and a padlock nobody uses. */
function Riser({ open }: { open: boolean }) {
  return (
    <g>
      {px(204, 64, 34, 56, "#b8b6ae")}
      {px(204, 64, 34, 2, "#c9c7bf")}
      {open ? (
        <g>
          {/* door swung, breakers exposed, meter counting away */}
          {px(206, 66, 30, 52, "#3a3d42")}
          {px(208, 70, 26, 14, "#2b2e32")}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              {px(209 + i * 4, 72, 3, 10, "#d8d6d0", `br${i}`)}
              {px(209 + i * 4, i % 2 ? 72 : 78, 3, 4, i % 2 ? "#a33a30" : "#4a4d52", `bs${i}`)}
            </g>
          ))}
          {px(208, 88, 26, 16, "#c9c7bf")}
          {px(210, 91, 22, 8, "#2b2e32")}
          <PixelText x={212} y={93} text="4152" fill="#d8d6d0" />
          <rect x={230} y={100} width={2} height={2} fill="#ff5050">
            <animate attributeName="opacity" values="1;0;0;1" dur="1.9s" repeatCount="indefinite" />
          </rect>
          {px(208, 106, 26, 10, "#4a4d52")}
          {px(210, 108, 8, 6, "#8a8d92")}
          {/* the door itself, swung flat against the wall */}
          {px(196, 64, 8, 56, "#c2beb4")}
          {px(196, 64, 2, 56, "#d0cec6")}
        </g>
      ) : (
        <g>
          {px(206, 66, 30, 52, "#c2beb4")}
          {px(206, 66, 30, 1, "#d0cec6")}
          {px(206, 92, 30, 1, "#a8a49a")}
          {/* the little window over the meter */}
          {px(212, 74, 18, 10, "#2b2e32")}
          {px(213, 75, 16, 8, "#3a4148")}
          <PixelText x={215} y={77} text="4152" fill="#8fa86a" />
          {/* hasp, padlock, warning triangle */}
          {px(232, 88, 4, 8, "#8a8d92")}
          {px(231, 92, 6, 5, "#6b6e73")}
          {px(210, 100, 14, 12, "#e8c445")}
          {px(212, 103, 10, 7, "#e8c445")}
          {px(216, 104, 2, 5, "#2e3033")}
          {px(216, 110, 2, 1, "#2e3033")}
          {/* stickers: an electrician's, a takeaway's */}
          {px(226, 102, 9, 6, "#d8d6d0")}
          {px(227, 104, 7, 1, "#a33a30")}
        </g>
      )}
    </g>
  );
}

function FramedPrint() {
  return (
    <g>
      {px(238, 58, 30, 40, "#2e3033")}
      {px(238, 58, 30, 1, "#4a4d52")}
      {px(241, 61, 24, 34, "#e8e6e0")}
      {px(243, 63, 20, 30, "#f0eee8")}
      {/* a cheap abstract: a horizon, a sun, three strokes */}
      {px(245, 70, 16, 12, "#7a8f9f")}
      {px(245, 70, 16, 4, "#8ea3b2")}
      {px(255, 66, 5, 5, "#c9a24b")}
      {px(245, 84, 16, 3, "#b8b6ae")}
      {px(247, 88, 9, 1, "#c9c7bf")}
      {/* glass catching the ceiling spot, and one corner hanging low */}
      <polygon points="241,95 253,61 261,61 249,95" fill="#ffffff" opacity={0.09} />
      {px(238, 56, 30, 2, "#4a4d52")}
    </g>
  );
}

/** The monstera. Droops and yellows if you forget it. */
function Monstera({ watered }: { watered: boolean }) {
  const dark = watered ? "#3f6b46" : "#5a6b46";
  const mid = watered ? "#4e7a52" : "#6b7a4a";
  const hi = watered ? "#63915f" : "#7a8552";
  return (
    <g>
      {px(278, 146, 26, 4, C.shadow)}
      {/* concrete pot, dry ring or damp saucer */}
      {px(280, 130, 20, 18, "#8b8880")}
      {px(280, 130, 20, 2, "#9a978f")}
      {px(282, 128, 16, 3, "#7a776f")}
      {px(282, 132, 16, 4, watered ? "#4a3f33" : "#7a6a55")}
      {!watered ? px(285, 133, 3, 1, "#8a7a62") : null}
      {!watered ? px(291, 134, 4, 1, "#8a7a62") : null}
      {watered ? px(278, 146, 24, 3, "#7d8a8e") : null}
      {/* stems */}
      {px(288, 104, 3, 26, dark)}
      {px(292, 110, 2, 20, dark)}
      {px(285, 112, 2, 18, dark)}
      {/* leaves — heavy and lifted when watered, folded down when not */}
      <g
        transform={watered ? "translate(0,0)" : "translate(0,6)"}
        style={{ transition: "transform 600ms ease" }}
      >
        <g>
          {px(276, 94, 14, 13, mid)}
          {px(276, 94, 14, 2, hi)}
          {px(280, 98, 3, 7, "#2f4a35")}
          {px(285, 100, 3, 5, "#2f4a35")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={
              watered
                ? "0 288 106;1.5 288 106;-1 288 106;0 288 106"
                : "6 288 106;7 288 106;5 288 106;6 288 106"
            }
            dur="9s"
            repeatCount="indefinite"
          />
        </g>
        <g>
          {px(291, 88, 15, 15, watered ? hi : mid)}
          {px(291, 88, 15, 2, watered ? "#74a26e" : hi)}
          {px(296, 92, 3, 8, "#2f4a35")}
          {px(301, 94, 3, 6, "#2f4a35")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={
              watered
                ? "0 292 104;-2 292 104;1 292 104;0 292 104"
                : "5 292 104;4 292 104;6 292 104;5 292 104"
            }
            dur="11s"
            repeatCount="indefinite"
          />
        </g>
        {px(282, 84, 10, 10, watered ? hi : "#8a8a52")}
        {px(282, 84, 10, 1, watered ? "#74a26e" : "#9a9a5e")}
      </g>
      {watered ? (
        <g>
          {px(296, 94, 2, 2, "#bfe0f5")}
          {px(285, 100, 2, 2, "#bfe0f5")}
          {/* a new shoot, tightly rolled */}
          {px(295, 100, 3, 8, "#74a26e")}
        </g>
      ) : (
        <g>
          {/* the leaf that gave up, on the tiles */}
          {px(302, 152, 9, 4, C.leafDry)}
          {px(303, 151, 5, 1, "#9a9a5e")}
          {px(276, 118, 6, 6, "#8a8a52")}
        </g>
      )}
    </g>
  );
}

/** Fire point: extinguisher behind glass, blanket, and the P.POŻ label. */
function ExtCabinet({ open }: { open: boolean }) {
  return (
    <g>
      {px(388, 70, 30, 44, C.red)}
      {px(388, 70, 30, 2, "#c74a44")}
      {px(388, 112, 30, 2, "#8a2424")}
      {open ? (
        <g>
          {px(390, 72, 26, 40, "#7d2820")}
          {/* the bottle, its hose, and the pin still in */}
          {px(396, 80, 10, 28, C.redHi)}
          {px(396, 80, 10, 2, "#d85a50")}
          {px(398, 76, 6, 5, "#2e3033")}
          {px(404, 78, 5, 2, "#8a8d92")}
          {px(407, 80, 2, 10, "#2e3033")}
          {px(397, 92, 8, 4, "#e8e6e0")}
          {/* the folded blanket beside it */}
          {px(408, 96, 8, 12, "#c9463c")}
          {px(408, 96, 8, 2, "#d85a50")}
          {/* the glass door, swung wide */}
          {px(378, 70, 10, 44, "#d8e4ec88")}
          {px(378, 70, 2, 44, "#e8f0f5")}
          {px(378, 70, 10, 1, "#f0f6fa")}
        </g>
      ) : (
        <g>
          {px(391, 73, 24, 38, "#d8e4ec66")}
          {px(391, 73, 24, 2, "#e8f0f5")}
          {/* the bottle, dimmed behind the glass */}
          {px(396, 80, 9, 26, "#b83a34")}
          {px(398, 76, 6, 5, "#28292c")}
          {px(408, 92, 3, 7, "#e8e6e0")}
          {/* reflection band and the latch */}
          <polygon points="393,111 405,73 411,73 399,111" fill="#ffffff" opacity={0.12} />
          {px(412, 90, 3, 7, "#e8e6e0")}
        </g>
      )}
      {/* the sign above it never goes out */}
      {px(392, 62, 22, 8, "#a33a30")}
      <PixelText x={396} y={64} text="P" fill="#f0eee8" />
      {px(402, 64, 12, 1, "#f0eee8")}
      {px(402, 67, 8, 1, "#f0eee8")}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Pani Natalia
// ---------------------------------------------------------------------------

type Mode = "mop" | "rest" | "wring" | "away";

function modeFor(ph: Ph): Mode {
  if (ph === "dawn") return "mop";
  if (ph === "day") return "rest";
  if (ph === "dusk") return "wring";
  return "away";
}

/** Her kit, which stays on the landing even when she doesn't. */
function CleaningKit({ parked }: { parked: boolean }) {
  const bx = parked ? 366 : 394;
  return (
    <g>
      {/* bucket with the wringer basket clipped in */}
      {px(bx, 132, 16, 18, "#e8c445")}
      {px(bx - 1, 131, 18, 3, "#d4af38")}
      {px(bx, 135, 2, 13, "#f0d060")}
      {px(bx + 3, 135, 10, 3, "#8b8880")}
      {px(bx + 4, 135, 4, 1, "#b5b2aa")}
      {px(bx + 2, 128, 12, 4, "#c9c7bf")}
      {px(bx - 1, 148, 18, 2, C.shadowSoft)}
      {/* the water moves when she's just been at it */}
      {!parked ? (
        <rect x={bx + 3} y={135} width={10} height={2} fill="#a8b0ae">
          <animate attributeName="y" values="135;136;135" dur="3.2s" repeatCount="indefinite" />
        </rect>
      ) : null}
      {parked ? (
        <g>
          {/* mop stood in the bucket, handle against the wall */}
          {px(bx + 6, 84, 3, 50, "#a8895e")}
          {px(bx + 6, 84, 1, 50, "#c2a276")}
          {px(bx + 2, 126, 11, 6, "#c9c5ba")}
        </g>
      ) : null}
    </g>
  );
}

function WetFloorSign({ x }: { x: number }) {
  return (
    <g>
      {px(x, 128, 16, 22, "#e8c445")}
      {px(x, 128, 16, 2, "#f2d86a")}
      {px(x + 14, 130, 4, 20, "#c9a52e")}
      {px(x + 5, 132, 5, 10, "#2e3033")}
      {px(x + 4, 144, 8, 2, "#2e3033")}
      {px(x - 1, 149, 20, 2, C.shadowSoft)}
    </g>
  );
}

function Natalia({ x, mode }: { x: number; mode: Mode }) {
  if (mode === "away") return null;
  const bend = mode === "wring";
  const headY = bend ? 88 : 84;
  return (
    <g>
      {/* contact shadows */}
      {px(x + 2, 148, 24, 3, C.shadow)}
      {px(x + 20, 149, 14, 2, "#00000028")}
      <g transform={bend ? `translate(0,4) rotate(6 ${x + 13} 148)` : undefined}>
        {/* kerchief, knotted at the nape */}
        {px(x + 7, headY, 12, 4, "#8cc0e0")}
        {px(x + 5, headY + 3, 16, 5, "#7ab0d4")}
        {px(x + 17, headY + 3, 4, 5, "#68a0c6")}
        {px(x + 20, headY + 8, 3, 3, "#68a0c6")}
        {px(x + 6, headY + 2, 3, 2, "#c9c4b6")}
        {/* face */}
        {px(x + 7, headY + 8, 12, 9, C.skin)}
        {px(x + 7, headY + 14, 12, 3, C.skinShade)}
        {px(x + 9, headY + 10, 2, 2, "#3d2a1a")}
        {px(x + 14, headY + 10, 2, 2, "#3d2a1a")}
        {px(x + 11, headY + 15, 4, 1, "#b08668")}
        {px(x + 10, headY + 17, 6, 2, C.skinShade)}
        {/* teal tunic and apron */}
        {px(x + 4, 103, 18, 24, C.teal)}
        {px(x + 4, 103, 18, 2, C.tealHi)}
        {px(x + 17, 105, 5, 22, C.tealLo)}
        {px(x + 8, 116, 8, 7, C.tealLo)}
        {px(x + 8, 116, 8, 1, C.tealHi)}
        {px(x + 4, 110, 18, 1, "#2b6067")}
        {/* left arm */}
        {mode === "rest" ? (
          <g>
            {px(x + 1, 105, 4, 12, C.teal)}
            {px(x + 1, 115, 5, 4, C.skin)}
          </g>
        ) : (
          <g>
            {px(x + 1, 105, 4, 15, C.teal)}
            {px(x + 1, 118, 4, 5, C.skin)}
          </g>
        )}
        {/* skirt band, legs, boots */}
        {px(x + 5, 127, 16, 6, C.graphite)}
        {px(x + 7, 133, 5, 12, C.graphiteHi)}
        {px(x + 14, 133, 5, 12, C.graphiteHi)}
        {px(x + 7, 133, 12, 2, C.graphite)}
        {px(x + 5, 145, 8, 5, "#2e3033")}
        {px(x + 14, 145, 8, 5, "#2e3033")}
        {px(x + 5, 145, 17, 1, "#3f434a")}
      </g>
      {/* the arm and the mop, which is the part that actually moves */}
      <g>
        {px(x + 21, 105, 4, 11, C.tealLo)}
        {px(x + 22, 114, 4, 5, C.skin)}
        {px(x + 24, 80, 3, 66, "#a8895e")}
        {px(x + 24, 80, 1, 66, "#c2a276")}
        {px(x + 20, 146, 12, 4, "#c9c5ba")}
        {px(x + 20, 148, 12, 2, "#aeaba0")}
        {mode === "mop" ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${x + 24} 110;7 ${x + 24} 110;-6 ${x + 24} 110;0 ${x + 24} 110`}
            dur="3.4s"
            repeatCount="indefinite"
          />
        ) : null}
        {mode === "wring" ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`14 ${x + 24} 110;18 ${x + 24} 110;12 ${x + 24} 110;14 ${x + 24} 110`}
            dur="2.2s"
            repeatCount="indefinite"
          />
        ) : null}
        {mode === "rest" ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`-4 ${x + 24} 110;-3 ${x + 24} 110;-4 ${x + 24} 110`}
            dur="9s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// floor
// ---------------------------------------------------------------------------

function Floor({ ph, mode }: { ph: Ph; mode: Mode }) {
  const wet = mode === "mop" || mode === "wring";
  return (
    <g>
      {px(0, 150, W, 30, C.tile)}
      {px(0, 150, W, 2, "#00000026")}
      {stripes(W, 150, 30, 70, C.tileLo, 35)}
      {px(0, 165, W, 1, C.tileLo)}
      {/* tile joints running across, so the format reads large */}
      {px(0, 158, W, 1, "#94918a")}
      {px(0, 174, W, 1, "#94918a")}
      {/* the mopped arc, still drying */}
      {wet ? (
        <g>
          {px(330, 152, 110, 26, C.tileWet)}
          <rect x={340} y={156} width={40} height={1} fill="#c9ccc8" opacity={0.7}>
            <animate attributeName="x" values="336;396;336" dur="7s" repeatCount="indefinite" />
          </rect>
          {px(346, 168, 60, 1, "#a8aca8")}
        </g>
      ) : (
        <g>
          {px(60, 156, 90, 1, C.tileHi)}
          {px(300, 160, 70, 1, C.tileHi)}
        </g>
      )}
      {/* the wheel tracks the pram leaves when it goes out */}
      {ph === "day" ? (
        <g>
          {px(176, 154, 2, 18, "#8f8c85")}
          {px(196, 154, 2, 18, "#8f8c85")}
        </g>
      ) : null}
      {/* daylight, or the streetlamp, landing through the stairwell window */}
      {ph === "night" ? (
        px(486, 152, 60, 20, "#2b3a4a")
      ) : (
        <g>
          {px(482, 152, 66, 22, ph === "dusk" ? "#b89474" : "#b0b6ba")}
          {px(494, 152, 30, 22, ph === "dusk" ? "#c9a582" : "#bcc2c6")}
        </g>
      )}
      {/* doormats: yours coarse, theirs newer */}
      {px(26, 150, 40, 4, "#5a5d62")}
      {px(26, 150, 40, 1, "#6b6e73")}
      {[30, 36, 42, 48, 54, 60].map((x) => px(x, 151, 2, 3, "#4a4d52", `dm${x}`))}
      {px(124, 150, 34, 3, "#6b6e73")}
      {px(322, 150, 34, 3, "#6b6e73")}
      {px(322, 150, 34, 1, "#7c7f84")}
    </g>
  );
}

// ---------------------------------------------------------------------------
// the scene
// ---------------------------------------------------------------------------

function CorridorScene({ world, phase }: { world: WorldState; phase?: string }) {
  const c = world.corridor;
  const x = extras(world);
  const ph = toPhase(phase);
  const mode = modeFor(ph);
  return (
    <LayeredScene
      parallax={{ middleBackground: 1 }}
      middleBackground={
        <g>
          <Ceiling />
          <Walls ph={ph} />
          <StairWindow ph={ph} />
        </g>
      }
      ground={<Floor ph={ph} mode={mode} />}
      staticObjects={
        <g>
          <Intercom />
          <LightSwitch />
          <Riser open={x.riserOpen} />
          <FramedPrint />
          <Monstera watered={c.plantWatered} />
          <ExtCabinet open={c.extOpen} />
          <LiftNotice />
          <SillCat ph={ph} />
          {/* the neighbours' pram — out with them during the day */}
          {ph !== "day" ? (
            <g>
              {px(172, 114, 34, 22, "#5a6a7a")}
              {px(172, 114, 34, 2, "#6b7c8c")}
              {px(176, 110, 22, 6, "#4a5866")}
              {px(178, 106, 14, 5, "#3f4b57")}
              {px(174, 136, 9, 9, "#2e3033")}
              {px(194, 136, 9, 9, "#2e3033")}
              {px(176, 138, 5, 5, "#8a8d92")}
              {px(196, 138, 5, 5, "#8a8d92")}
              {px(170, 146, 38, 3, C.shadowSoft)}
              {/* the rain cover, bundled on top */}
              {px(180, 108, 12, 5, "#c9c5ba")}
              {px(180, 108, 12, 1, "#d8d6d0")}
            </g>
          ) : null}
          {/* their shoes, which live outside the door */}
          {px(163, 142, 9, 8, "#5d4a37")}
          {px(163, 142, 9, 2, "#6d5842")}
          {px(163, 148, 9, 2, "#3f3229")}
          {px(162, 134, 8, 7, "#4a4d52")}
          {px(162, 134, 8, 2, "#5a5d62")}
          <Natalia x={362} mode={mode} />
          <CleaningKit parked={mode === "away"} />
          {mode === "mop" ? <WetFloorSign x={424} /> : null}
          {/* the parcel on your mat — or the tape it left behind */}
          {c.parcelTaken ? (
            <g>
              {px(70, 149, 12, 2, "#d8d6d0")}
              {px(76, 148, 5, 3, "#c9a24b")}
            </g>
          ) : (
            <g>
              {px(66, 132, 22, 18, "#c9a24b")}
              {px(66, 132, 22, 3, "#d9b45c")}
              {px(74, 132, 5, 18, "#8a6d2f")}
              {px(66, 138, 22, 1, "#b8913f")}
              {px(68, 140, 8, 6, "#e8e6e0")}
              {px(69, 142, 6, 1, "#8a8d92")}
              {px(82, 134, 4, 4, "#c94040")}
              {px(64, 148, 26, 2, C.shadowSoft)}
            </g>
          )}
        </g>
      }
      gameplayObjects={
        <g>
          <FlatDoor ph={ph} />
          <Door13 ph={ph} />
          <Door15 ph={ph} />
          <Lift open={c.liftOpen} />
          {/* stairs down behind the steel-and-glass balustrade */}
          {px(494, 104, 62, 46, "#26282c")}
          {px(494, 112, 52, 4, "#9d9a92")}
          {px(494, 112, 52, 1, "#b5b2aa")}
          {px(500, 124, 46, 4, "#8b8880")}
          {px(500, 124, 46, 1, "#a5a29a")}
          {px(506, 136, 40, 4, "#7a776f")}
          {px(506, 136, 40, 1, "#948f88")}
          {px(492, 100, 3, 50, C.steel)}
          {px(492, 100, 64, 2, C.steel)}
          {px(492, 100, 64, 1, C.steelHi)}
          {px(495, 102, 58, 22, "#d8e4ec4d")}
          {px(520, 102, 1, 22, "#d8e4ec66")}
          {/* the handrail bracket and the anti-slip nosing */}
          {px(508, 118, 3, 4, C.steelDark)}
          {px(494, 115, 52, 1, "#5a5d62")}
          {px(500, 127, 46, 1, "#5a5d62")}
        </g>
      }
    />
  );
}

const NATALIA_MONOLOGUES = [
  "Ой, знову хтось наслідив... тільки ж помила.",
  "Дома яблука вже попадали, мабуть. А я тут підлоги тру.",
  "Спина болить... а Олежко знову дзвонив, грошей просить.",
  "«Pani Natalio, dziękujemy»... А додому коли, хто скаже?",
  "Мама казала — на пів року. Четвертий рік пішов.",
  "Тринадцята квартира знову без капців ходить. Ну добре.",
] as const;

/**
 * Corridor lighting: modern blocks meter their light too. Idle, the LED
 * skirting strip and the exit sign hold the dark; move and the ceiling spots
 * cone down warm and polite, one after another, for twenty seconds.
 */
function CorridorEffects({
  phase,
  moving,
  scale,
  dialogueOpen,
}: {
  world: WorldState;
  phase: string;
  fx: import("@/engine").FxInstance[];
  scale: number;
  actionUi: string | null;
  moving: boolean;
  dialogueOpen: boolean;
}) {
  const ph = toPhase(phase);
  const mode = modeFor(ph);
  const [lit, setLit] = useState(true);
  useEffect(() => {
    if (moving) {
      setLit(true);
      return;
    }
    const timer = window.setTimeout(() => setLit(false), 20_000);
    return () => window.clearTimeout(timer);
  }, [moving]);

  // with the blind up and the sun out, the landing never goes fully dark
  const floorDark = ph === "night" ? (lit ? 0.3 : 0.66) : lit ? 0.2 : 0.46;

  return (
    <>
      {mode !== "away" ? (
        <NpcMonologue
          x={375}
          headY={mode === "wring" ? 86 : 82}
          scale={scale}
          speaker="Pani Natalia"
          lines={NATALIA_MONOLOGUES}
          muted={dialogueOpen}
        />
      ) : null}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} 180`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <defs>
          <linearGradient id="spotcone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff3cf" stopOpacity="0.5" />
            <stop offset="75%" stopColor="#ffecb0" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#ffe6a8" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="daycone" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor="#eaf2f8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#eaf2f8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          width={W}
          height="180"
          fill="#070a10"
          opacity={floorDark}
          style={{ transition: "opacity 800ms ease" }}
        />
        {/* the window keeps its own light regardless of the motion sensor */}
        {ph !== "night" ? (
          <polygon
            points="496,48 552,48 566,180 466,180"
            fill="url(#daycone)"
            opacity={ph === "dusk" ? 0.7 : 1}
          />
        ) : null}
        {/* the spots come up one after another, the way they always do */}
        {CORRIDOR_SPOTS.map((x, i) => (
          <g
            key={x}
            opacity={lit ? 1 : 0}
            style={{ transition: `opacity ${420 + i * 130}ms ease` }}
          >
            <rect x={x - 5} y={40} width={10} height={3} fill="#fff8e0" opacity={0.95} />
            <polygon
              points={`${x - 7},43 ${x + 7},43 ${x + 44},150 ${x - 44},150`}
              fill="url(#spotcone)"
            />
            <ellipse cx={x} cy={151} rx={46} ry={5} fill="#ffe6a8" opacity={0.1} />
            {/* wet tiles throw it back up at you */}
            {(mode === "mop" || mode === "wring") && x === 380 ? (
              <ellipse cx={x} cy={158} rx={40} ry={7} fill="#fff0c8" opacity={0.14} />
            ) : null}
            {/* dust, turning over in the cone */}
            {[0, 1, 2].map((k) => (
              <rect
                key={k}
                x={x - 14 + k * 13}
                y={70 + k * 18}
                width={1}
                height={1}
                fill="#fff6da"
                opacity={0.7}
              >
                <animate
                  attributeName="y"
                  values={`${70 + k * 18};${52 + k * 18};${70 + k * 18}`}
                  dur={`${9 + k * 3}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.8;0.2;0"
                  dur={`${9 + k * 3}s`}
                  repeatCount="indefinite"
                />
              </rect>
            ))}
          </g>
        ))}
        {/* the LED strip along the skirting is always on, quietly */}
        <rect x={0} y={144} width={W} height={2} fill="#ffd98a" opacity={lit ? 0.35 : 0.22} />
        {/* one fly, doing laps under the second spot, only when it's warm */}
        {ph === "day" || ph === "dusk" ? (
          <g>
            <rect x={230} y={60} width={1} height={1} fill="#2e3033" opacity={0.8} />
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0;18 12;-6 26;14 8;-14 18;0 0"
              dur="7.5s"
              repeatCount="indefinite"
            />
          </g>
        ) : null}
        {/* emergency wayfinding never sleeps */}
        <rect x={486} y={38} width={26} height={8} fill="#0d3d24" opacity={0.95} />
        <rect x={489} y={40} width={20} height={4} fill={C.green}>
          <animate attributeName="opacity" values="1;1;0.75;1" dur="17s" repeatCount="indefinite" />
        </rect>
      </svg>
    </>
  );
}

export const CORRIDOR_SCENE: SceneDef<WorldState> = {
  id: "corridor",
  width: W,
  objects: [
    {
      id: "door-flat",
      kind: "creakdoor",
      x: 45,
      range: 22,
      to: { scene: "studio", spawnX: 40 },
    },
    { id: "parcel", kind: "parcel", x: 77, range: 12 },
    { id: "intercom", kind: "flavor", x: 97, range: 10 },
    { id: "switch", kind: "flavor", x: 113, range: 7 },
    { id: "neighbor-a", kind: "flavor", x: 141, range: 16 },
    { id: "shoes", kind: "flavor", x: 166, range: 6 },
    { id: "pram", kind: "flavor", x: 189, range: 14 },
    { id: "riser", kind: "flavor", x: 220, range: 14 },
    { id: "print", kind: "flavor", x: 253, range: 14 },
    { id: "plant", kind: "plant", x: 290, range: 16 },
    { id: "neighbor-b", kind: "flavor", x: 339, range: 14 },
    { id: "pani-natalia", kind: "npc", x: 375, range: 18 },
    { id: "ext-cabinet", kind: "extcabinet", x: 403, range: 14 },
    { id: "notice", kind: "flavor", x: 421, range: 7 },
    {
      id: "lift-doors",
      kind: "liftdoors",
      x: 454,
      range: 22,
      to: { scene: "elevator", spawnX: 100 },
    },
    { id: "stairwell-cat", kind: "flavor", x: 512, range: 12 },
    {
      id: "stairs-down",
      kind: "stairs",
      x: 532,
      range: 16,
      to: { scene: "outside", spawnX: 110 },
    },
  ],
  Component: ({ world, phase }) => <CorridorScene world={world} phase={phase} />,
  darkness: () => 0,
  Effects: CorridorEffects,
};
