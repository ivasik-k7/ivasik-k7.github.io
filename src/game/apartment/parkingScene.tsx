import { useEffect, useState } from "react";
import {
  ElevatorDoors,
  LayeredScene,
  Monologue,
  NpcActor,
  px,
  type SceneDef,
  stripes,
} from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { NPCS } from "./npcs";

// --- ПАРКІНГ / underground parking, level -1 ---------------------------------------
//
// Scale honesty: 1 m ≈ 37 gp. Cars are parked nose-out in their bays, so you meet
// them face-first from the aisle: 1.8 m of width ≈ 68 gp, roof at 1.45 m ≈ 54 gp.
// A van is 2.0 m wide and stands a head taller. Nothing here is drawn in profile.
//
// Rules of the layer: anything bolted to the wall lives above y≈100 so it clears the
// car roofs; anything on the floor is drawn after the cars, so it reads as standing
// in the aisle in front of them. States run off the clock — the level empties as
// people drive to work, Pan Marek polishes at midday, has the bonnet up by dusk, and
// by night is gone with a cover over the Octavia.

const W = 1600;
const GROUND = 150;

const P = {
  ceil: "#4d4a45",
  wall: "#6b675f",
  wallLo: "#5d5a52",
  wallHi: "#7a766c",
  column: "#7a766c",
  columnHi: "#8f8a7c",
  columnLo: "#605c55",
  floor: "#43413d",
  floorLo: "#35332f",
  floorHi: "#57534c",
  paint: "#c9b784",
  paintLo: "#9c8f66",
  hazard: "#c9a24b",
  hazardDark: "#3a3833",
  steel: "#8a8f96",
  steelHi: "#aeb8be",
  steelDark: "#5d6266",
  pipe: "#9aa0a8",
  pipeLo: "#7d8288",
  red: "#a33a30",
  redHi: "#c9463c",
  green: "#3ddc84",
  greenDark: "#0d3d24",
  amber: "#ffb340",
  paper: "#e0ddd0",
  paperHi: "#f0eee8",
  water: "#5d7a8a",
  oil: "#2b2926",
  skin: "#e0b48c",
  skinShade: "#c79a72",
  shadow: "#00000055",
  shadowSoft: "#00000022",
};

const CAR = {
  glass: "#25313c",
  glassHi: "#3a4a58",
  glassLo: "#1b242c",
  tyre: "#161513",
  tyreHi: "#26241f",
  rim: "#8fa0ad",
  rimDark: "#3a4148",
  plate: "#e8e8e0",
  plateEU: "#2b4f9e",
  lampCold: "#cfe2f5",
  chrome: "#b8bfc6",
  dark: "#1a1a18",
};

type Ph = "dawn" | "day" | "dusk" | "night";

function toPhase(phase?: string): Ph {
  if (phase === "night") return "night";
  if (phase === "dusk") return "dusk";
  if (phase === "dawn" || phase === "morning") return "dawn";
  return "day";
}

/** Optional world flags, read defensively so this compiles unchanged. */
function extras(world: WorldState) {
  const w = world as unknown as Record<string, boolean | undefined>;
  return {
    hoseOpen: !!w.hoseOpen,
    cageOpen: !!w.cageOpen,
    catFed: !!w.catFed,
    noticeRead: !!w.noticeRead,
  };
}

// ---------------------------------------------------------------------------
// a 3×5 font for bay numbers and every little display down here
// ---------------------------------------------------------------------------

const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "%": ["101", "001", "010", "100", "101"],
  "-": ["000", "000", "111", "000", "000"],
  P: ["111", "101", "111", "100", "100"],
  A: ["111", "101", "111", "101", "101"],
  K: ["101", "101", "110", "101", "101"],
  W: ["101", "101", "111", "111", "101"],
  R: ["111", "101", "111", "110", "101"],
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
      for (let c = 0; c < w; c++) {
        if (rows[r][c] === "1") out.push(px(cx + c, y + r, 1, 1, fill, `t${i}${r}${c}`));
      }
    }
    cx += w + gap;
  }
  return <g>{out}</g>;
}

// ---------------------------------------------------------------------------
// cars, seen from the front
// ---------------------------------------------------------------------------

type CarType = "small" | "hatch" | "sedan" | "suv" | "van";

const SPEC: Record<
  CarType,
  { w: number; roofY: number; beltY: number; bumperY: number; inset: number }
> = {
  small: { w: 62, roofY: 104, beltY: 122, bumperY: 136, inset: 5 },
  hatch: { w: 70, roofY: 100, beltY: 120, bumperY: 134, inset: 5 },
  sedan: { w: 76, roofY: 98, beltY: 118, bumperY: 133, inset: 6 },
  suv: { w: 84, roofY: 86, beltY: 112, bumperY: 128, inset: 7 },
  van: { w: 90, roofY: 78, beltY: 110, bumperY: 126, inset: 6 },
};

interface CarProps {
  cx: number;
  type?: CarType;
  body: string;
  bodyHi: string;
  bodyLo: string;
  lit?: boolean;
  dusty?: boolean;
  /** plugged into the wallbox, port glowing */
  charging?: boolean;
}

/**
 * A neighbour's car, nose to the aisle: tread faces of both front tyres, bumper
 * with its intake and plate, grille and lamps, then the glasshouse set inboard
 * with the ceiling tube laid diagonally across the screen.
 */
function CarFront({
  cx,
  type = "sedan",
  body,
  bodyHi,
  bodyLo,
  lit = false,
  dusty = false,
  charging = false,
}: CarProps) {
  const s = SPEC[type];
  const left = Math.round(cx - s.w / 2);
  const right = left + s.w;
  const glassW = s.w - s.inset * 2;
  const glassH = s.beltY - s.roofY;
  const tall = type === "suv" || type === "van";
  return (
    <g>
      {px(left - 3, 146, s.w + 6, 5, P.shadow)}
      {px(left + 4, 151, s.w - 8, 2, P.shadowSoft)}
      {/* tyres, head-on: tread face with a sliver of sidewall */}
      {px(left + 1, 134, 13, 16, CAR.tyre)}
      {px(left + 1, 134, 13, 2, CAR.tyreHi)}
      {px(left + 3, 148, 9, 2, "#0d0c0b")}
      {px(right - 14, 134, 13, 16, CAR.tyre)}
      {px(right - 14, 134, 13, 2, CAR.tyreHi)}
      {px(right - 12, 148, 9, 2, "#0d0c0b")}
      {/* glasshouse */}
      {px(left + s.inset, s.roofY, glassW, glassH, body)}
      {px(left + s.inset + 2, s.roofY - 3, glassW - 4, 3, bodyHi)}
      {px(left + s.inset, s.roofY, glassW, 2, bodyHi)}
      {px(left + s.inset + 3, s.roofY + 4, glassW - 6, glassH - 6, CAR.glass)}
      {px(left + s.inset + 3, s.roofY + 4, glassW - 6, 2, CAR.glassLo)}
      <polygon
        points={`${left + s.inset + 4},${s.beltY - 4} ${left + s.inset + 18},${s.roofY + 5} ${left + s.inset + 26},${s.roofY + 5} ${left + s.inset + 12},${s.beltY - 4}`}
        fill="#ffffff"
        opacity={0.11}
      />
      {px(left + s.inset + 5, s.roofY + 6, 6, 2, CAR.glassHi)}
      {px(cx - 4, s.roofY + 5, 8, 3, CAR.dark)}
      {px(left + s.inset + 5, s.beltY - 5, glassW - 14, 1, "#33383d")}
      {px(left + s.inset + 8, s.beltY - 7, 1, 3, "#33383d")}
      {tall ? (
        <g>
          {px(left + s.inset, s.roofY - 5, 3, 5, CAR.dark)}
          {px(right - s.inset - 3, s.roofY - 5, 3, 5, CAR.dark)}
          {px(left + s.inset, s.roofY - 5, glassW, 2, CAR.dark)}
        </g>
      ) : null}
      {/* mirrors on their stalks */}
      {px(left + s.inset - 5, s.roofY + 10, 6, 5, body)}
      {px(left + s.inset - 5, s.roofY + 10, 6, 1, bodyHi)}
      {px(right - s.inset - 1, s.roofY + 10, 6, 5, body)}
      {px(right - s.inset - 1, s.roofY + 10, 6, 1, bodyHi)}
      {/* front clip */}
      {px(left, s.beltY, s.w, s.bumperY - s.beltY, body)}
      {px(left + 2, s.beltY, s.w - 4, 2, bodyHi)}
      {px(left, s.bumperY - 2, s.w, 2, bodyLo)}
      {/* headlamps */}
      {px(left + 3, s.beltY + 4, 17, 7, lit ? "#fff6d8" : CAR.lampCold)}
      {px(left + 3, s.beltY + 4, 17, 2, lit ? "#ffffff" : "#e2ecf5")}
      {px(left + 5, s.beltY + 7, 6, 3, lit ? "#fff0b8" : "#9fb4c4")}
      {px(right - 20, s.beltY + 4, 17, 7, lit ? "#fff6d8" : CAR.lampCold)}
      {px(right - 20, s.beltY + 4, 17, 2, lit ? "#ffffff" : "#e2ecf5")}
      {px(right - 11, s.beltY + 7, 6, 3, lit ? "#fff0b8" : "#9fb4c4")}
      {/* grille and badge */}
      {px(left + 22, s.beltY + 4, s.w - 44, 8, CAR.dark)}
      {px(left + 24, s.beltY + 5, s.w - 48, 1, "#3a3833")}
      {px(left + 24, s.beltY + 8, s.w - 48, 1, "#3a3833")}
      {px(cx - 3, s.beltY + 6, 6, 4, CAR.chrome)}
      {/* bumper, intake, fogs, plate */}
      {px(left - 1, s.bumperY, s.w + 2, GROUND - s.bumperY - 2, body)}
      {px(left - 1, s.bumperY, s.w + 2, 2, bodyHi)}
      {px(left + 8, s.bumperY + 5, s.w - 16, 7, "#12100f")}
      {[0, 1, 2, 3, 4].map((i) => px(left + 12 + i * 8, s.bumperY + 6, 4, 5, "#1d1b19", `in${i}`))}
      {px(left + 3, s.bumperY + 6, 6, 4, lit ? "#ffd98a" : "#b9c4cc")}
      {px(right - 9, s.bumperY + 6, 6, 4, lit ? "#ffd98a" : "#b9c4cc")}
      {px(cx - 11, s.bumperY + 4, 22, 7, CAR.plate)}
      {px(cx - 11, s.bumperY + 4, 3, 7, CAR.plateEU)}
      {px(cx - 6, s.bumperY + 6, 12, 3, "#5d6266")}
      {px(left + 6, s.bumperY + 2, 4, 3, bodyLo)}
      {px(cx + 14, s.bumperY + 2, 2, 2, bodyLo)}
      {px(cx - 16, s.bumperY + 2, 2, 2, bodyLo)}
      {lit ? (
        <g>
          {px(left + s.inset + 6, s.roofY + 6, glassW - 12, 6, "#5a4a30")}
          {px(cx - 8, s.beltY - 9, 16, 3, "#c9863f")}
        </g>
      ) : null}
      {/* plugged in: the port on the wing, and the cable going up to the box */}
      {charging ? (
        <g>
          {px(left + 6, s.beltY + 14, 8, 6, "#2b2926")}
          <rect x={left + 8} y={s.beltY + 16} width={4} height={2} fill={P.green}>
            <animate
              attributeName="opacity"
              values="1;0.25;1"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </rect>
          {px(left + 9, s.beltY - 2, 2, 16, "#1d1b19")}
          {px(left + 9, s.roofY + 2, 2, 18, "#1d1b19")}
        </g>
      ) : null}
      {/* dust, and what a bored neighbour wrote in it */}
      {dusty ? (
        <g>
          <rect
            x={left}
            y={s.beltY}
            width={s.w}
            height={s.bumperY - s.beltY}
            fill="#8a8578"
            opacity={0.22}
          />
          <rect
            x={left + s.inset + 3}
            y={s.roofY + 4}
            width={glassW - 6}
            height={glassH - 6}
            fill="#8a8578"
            opacity={0.16}
          />
          {px(cx - 10, s.beltY + 14, 2, 6, "#b8b3a4")}
          {px(cx - 8, s.beltY + 14, 4, 2, "#b8b3a4")}
          {px(cx - 8, s.beltY + 18, 4, 2, "#b8b3a4")}
          {px(cx - 2, s.beltY + 14, 2, 6, "#b8b3a4")}
        </g>
      ) : null}
    </g>
  );
}

/**
 * The Golf 7 R in Pure White, nose to the aisle.
 *
 * The Mk7 face, built the way it actually is: a slim lamp cluster either side of
 * a two-slat grille, with the upper chrome bar running unbroken from lamp to lamp
 * and the roundel sitting on it. R specifics — the badge on the grille bar, the
 * three-part lower intake with its chrome blade, satin-chrome mirror caps, and
 * blue calipers behind the 19" spokes. White paint reads through its shading, so
 * the flanks and the underside of the bumper carry most of the drawing.
 */
function GolfFront({ cx, locked }: { cx: number; locked: boolean }) {
  const body = "#eceeea";
  const bodyHi = "#ffffff";
  const bodyMid = "#d6d9d5";
  const bodyLo = "#b6bab6";
  const bodyShade = "#9aa09c";
  const black = "#141414";
  const w = 78;
  const left = Math.round(cx - w / 2);
  const right = left + w;
  const roofY = 96;
  const beltY = 116;
  const bumperY = 132;
  return (
    <g>
      {px(left - 3, 146, w + 6, 5, "#00000066")}
      {/* puddle lights, when it's expecting you */}
      {locked ? null : (
        <g>
          <ellipse cx={left - 4} cy={151} rx={16} ry={5} fill="#ffb340" opacity={0.22} />
          <ellipse cx={right + 4} cy={151} rx={16} ry={5} fill="#ffb340" opacity={0.22} />
        </g>
      )}
      {/* 19" wheels: tread face, two-tone spoke behind, blue caliper */}
      {px(left + 1, 132, 14, 18, CAR.tyre)}
      {px(left + 1, 132, 14, 2, CAR.tyreHi)}
      {px(left + 4, 137, 9, 10, CAR.rimDark)}
      {px(left + 5, 138, 7, 8, "#7d8a94")}
      {px(left + 7, 140, 3, 4, CAR.rim)}
      {px(left + 4, 141, 2, 4, "#2b6bd9")}
      {px(right - 15, 132, 14, 18, CAR.tyre)}
      {px(right - 15, 132, 14, 2, CAR.tyreHi)}
      {px(right - 13, 137, 9, 10, CAR.rimDark)}
      {px(right - 12, 138, 7, 8, "#7d8a94")}
      {px(right - 10, 140, 3, 4, CAR.rim)}
      {px(right - 6, 141, 2, 4, "#2b6bd9")}
      {/* glasshouse: black screen surround, roof spoiler over the top */}
      {px(left + 7, roofY, w - 14, beltY - roofY, body)}
      {px(left + 9, roofY - 3, w - 18, 3, bodyHi)}
      {px(left + 12, roofY - 6, w - 24, 3, black)}
      {px(left + 9, roofY + 3, w - 18, 1, "#2b2b2b")}
      {px(left + 10, roofY + 4, w - 20, beltY - roofY - 10, CAR.glass)}
      {px(left + 10, roofY + 4, w - 20, 2, CAR.glassLo)}
      <polygon
        points={`${left + 12},${beltY - 6} ${left + 26},${roofY + 5} ${left + 34},${roofY + 5} ${left + 20},${beltY - 6}`}
        fill="#ffffff"
        opacity={0.13}
      />
      {px(left + 12, roofY + 6, 7, 2, CAR.glassHi)}
      {px(cx - 4, roofY + 5, 8, 3, black)}
      {px(left + 12, beltY - 8, w - 26, 1, "#33383d")}
      {px(left + 15, beltY - 10, 1, 3, "#33383d")}
      {/* A-pillar shading, so the white doesn't go flat */}
      {px(left + 7, roofY + 2, 3, beltY - roofY - 4, bodyMid)}
      {px(right - 10, roofY + 2, 3, beltY - roofY - 4, bodyLo)}
      {/* satin chrome mirror caps — folded flat when locked */}
      <g>
        {px(locked ? left + 4 : left, roofY + 10, locked ? 5 : 8, 5, "#c2c8cc")}
        {px(locked ? left + 4 : left, roofY + 10, locked ? 5 : 8, 2, "#dde2e6")}
        {locked ? null : px(left, roofY + 13, 8, 2, "#9aa2a8")}
        {locked ? null : px(left + 1, roofY + 12, 6, 1, "#ffb340")}
      </g>
      <g>
        {px(locked ? right - 9 : right - 8, roofY + 10, locked ? 5 : 8, 5, "#c2c8cc")}
        {px(locked ? right - 9 : right - 8, roofY + 10, locked ? 5 : 8, 2, "#dde2e6")}
        {locked ? null : px(right - 8, roofY + 13, 8, 2, "#9aa2a8")}
        {locked ? null : px(right - 7, roofY + 12, 6, 1, "#ffb340")}
      </g>
      {/* bonnet: two long creases running out of the lamps, tube reflection */}
      {px(left, beltY, w, bumperY - beltY, body)}
      {px(left + 2, beltY, w - 4, 2, bodyHi)}
      {px(left + 16, beltY + 3, 20, 1, bodyMid)}
      {px(left + 44, beltY + 3, 20, 1, bodyMid)}
      {px(left + 2, beltY + 1, w - 4, 1, "#ffffff")}
      {px(left, bumperY - 2, w, 2, bodyLo)}
      {/* the Mk7 face: lamps, chrome bar, two slats, roundel */}
      {px(left + 2, beltY + 4, 22, 8, black)}
      {px(left + 3, beltY + 5, 20, 6, locked ? "#93a6b8" : "#e6f2ff")}
      {px(left + 4, beltY + 5, 15, 2, locked ? "#7f93a6" : "#c9e0f5")}
      {px(left + 4, beltY + 9, 18, 2, locked ? "#b9c9de" : "#ffffff")}
      {px(right - 24, beltY + 4, 22, 8, black)}
      {px(right - 23, beltY + 5, 20, 6, locked ? "#93a6b8" : "#e6f2ff")}
      {px(right - 20, beltY + 5, 15, 2, locked ? "#7f93a6" : "#c9e0f5")}
      {px(right - 22, beltY + 9, 18, 2, locked ? "#b9c9de" : "#ffffff")}
      {/* grille: black, two slats, chrome bar straight through into the lamps */}
      {px(left + 24, beltY + 4, w - 48, 9, black)}
      {px(left + 24, beltY + 8, w - 48, 1, "#3a3a3a")}
      {px(left + 2, beltY + 6, w - 4, 2, CAR.chrome)}
      {px(left + 2, beltY + 6, w - 4, 1, "#d8dee4")}
      {px(cx - 4, beltY + 5, 8, 5, "#dde2e6")}
      {px(cx - 3, beltY + 6, 6, 3, "#4a5058")}
      {px(cx - 2, beltY + 7, 4, 1, "#dde2e6")}
      {/* the R badge, on the bar to the left of the roundel */}
      {px(cx - 15, beltY + 5, 6, 5, "#1d1d1d")}
      <PixelText x={cx - 14} y={beltY + 5} text="R" fill="#c9463c" />
      {/* bumper: three-part lower intake, chrome blade, splitter */}
      {px(left - 1, bumperY, w + 2, GROUND - bumperY - 2, body)}
      {px(left - 1, bumperY, w + 2, 2, bodyHi)}
      {px(left + 1, bumperY + 3, 16, 10, "#101010")}
      {px(left + 3, bumperY + 5, 12, 3, "#1e1e1e")}
      {px(left + 22, bumperY + 3, w - 44, 10, "#101010")}
      {[0, 1, 2, 3, 4].map((i) => px(left + 25 + i * 6, bumperY + 5, 4, 6, "#1c1c1c", `lg${i}`))}
      {px(right - 17, bumperY + 3, 16, 10, "#101010")}
      {px(right - 15, bumperY + 5, 12, 3, "#1e1e1e")}
      {px(left + 1, bumperY + 11, 16, 2, CAR.chrome)}
      {px(right - 17, bumperY + 11, 16, 2, CAR.chrome)}
      {px(left + 2, bumperY + 14, w - 4, 2, "#3a3a3a")}
      {px(left + 2, bumperY + 14, w - 4, 1, "#6a6a6a")}
      {/* the underside shading that makes white read as white */}
      {px(left, GROUND - 4, w, 2, bodyShade)}
      {px(cx - 11, bumperY + 3, 22, 7, CAR.plate)}
      {px(cx - 11, bumperY + 3, 3, 7, CAR.plateEU)}
      {px(cx - 6, bumperY + 5, 12, 3, "#5d6266")}
      {/* awake */}
      {locked ? null : (
        <g>
          {px(left + 12, roofY + 6, w - 24, 6, "#6b5432")}
          {px(cx - 10, beltY - 11, 20, 3, "#c9863f")}
          {px(cx + 4, beltY - 11, 6, 3, P.green)}
        </g>
      )}
    </g>
  );
}

/** The Octavia with a cover over it — Pan Marek does not take chances. */
function CoveredCar({ cx }: { cx: number }) {
  const w = 82;
  const left = Math.round(cx - w / 2);
  const cover = "#9a9a92";
  const coverHi = "#adada4";
  const coverLo = "#7d7d76";
  return (
    <g>
      {px(left - 3, 146, w + 6, 5, P.shadow)}
      {px(left + 3, 134, 12, 16, CAR.tyre)}
      {px(left + w - 15, 134, 12, 16, CAR.tyre)}
      {px(left + 10, 96, w - 20, 22, cover)}
      {px(left + 12, 94, w - 24, 3, coverHi)}
      {px(left + 4, 116, w - 8, 20, cover)}
      {px(left + 4, 116, w - 8, 2, coverHi)}
      {px(left, 132, w, 14, cover)}
      {px(left, 132, w, 2, coverHi)}
      {px(left, 144, w, 3, coverLo)}
      {px(left + 20, 98, 1, 34, coverLo)}
      {px(left + 46, 100, 1, 30, coverLo)}
      {px(left + 33, 118, 1, 24, coverLo)}
      {px(left + 6, 146, w - 12, 2, coverLo)}
      {px(left + 6, 112, 6, 4, "#6b6b64")}
      {px(left + w - 12, 112, 6, 4, "#6b6b64")}
      <rect x={left + 12} y={94} width={w - 24} height={4} fill={coverHi}>
        <animate attributeName="y" values="94;93;94" dur="9s" repeatCount="indefinite" />
      </rect>
    </g>
  );
}

/** The Octavia with the bonnet up and a work lamp hooked under it. */
function BonnetUpCar({ cx }: { cx: number }) {
  const body = "#c9c4b6";
  const bodyHi = "#dedad0";
  const bodyLo = "#a8a49a";
  const w = 80;
  const left = Math.round(cx - w / 2);
  const right = left + w;
  return (
    <g>
      {px(left - 3, 146, w + 6, 5, P.shadow)}
      {px(left + 2, 134, 13, 16, CAR.tyre)}
      {px(right - 15, 134, 13, 16, CAR.tyre)}
      {px(left + 4, 84, w - 8, 30, body)}
      {px(left + 4, 84, w - 8, 3, bodyHi)}
      {px(left + 4, 111, w - 8, 3, bodyLo)}
      {px(left + 10, 88, w - 20, 1, bodyLo)}
      {px(right - 14, 96, 3, 18, bodyLo)}
      {px(left + 6, 114, w - 12, 18, "#1b1a17")}
      {px(left + 10, 118, 16, 12, "#2b3a2b")}
      {px(left + 12, 116, 5, 3, "#8a8f96")}
      {px(left + 20, 116, 5, 3, "#a33a30")}
      {px(left + 30, 120, 22, 8, "#3a3833")}
      {px(left + 32, 122, 18, 2, "#4d4a45")}
      {px(right - 24, 118, 14, 12, "#2b2926")}
      {px(right - 22, 120, 10, 2, "#5d6266")}
      {px(left + 34, 108, 10, 6, "#e8c445")}
      {px(left + 36, 114, 6, 3, "#fff6d8")}
      <ellipse cx={left + 39} cy={122} rx={24} ry={12} fill="#ffe6a8" opacity={0.24}>
        <animate
          attributeName="opacity"
          values="0.24;0.3;0.24"
          dur="5.5s"
          repeatCount="indefinite"
        />
      </ellipse>
      {px(left - 1, 132, w + 2, 16, body)}
      {px(left - 1, 132, w + 2, 2, bodyHi)}
      {px(left + 8, 137, w - 16, 7, "#12100f")}
      {px(left + w / 2 - 11, 136, 22, 7, CAR.plate)}
      {px(left + w / 2 - 11, 136, 3, 7, CAR.plateEU)}
      {px(left + 3, 138, 6, 4, "#b9c4cc")}
      {px(right - 9, 138, 6, 4, "#b9c4cc")}
      {px(left + 3, 133, 17, 6, "#9fb4c4")}
      {px(right - 20, 133, 17, 6, "#9fb4c4")}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Pan Marek
// ---------------------------------------------------------------------------

type MarekMode = "polish" | "bonnet" | "away";

function marekMode(ph: Ph): MarekMode {
  if (ph === "dusk") return "bonnet";
  if (ph === "night") return "away";
  return "polish";
}

// The hand-drawn PanMarek, kept for one release while the built NPC proves
// itself in every phase and state. Delete once it has.
// @ts-expect-error TS6133
function _PanMarek({ x, mode }: { x: number; mode: MarekMode }) {
  if (mode === "away") return null;
  const lean = mode === "bonnet";
  return (
    <g>
      {px(x - 4, 148, 30, 3, "#00000044")}
      <g transform={lean ? `translate(-6,6) rotate(-8 ${x + 10} 148)` : undefined}>
        {px(x + 3, 80, 14, 4, "#8f8a7c")}
        {px(x + 2, 82, 16, 2, "#7a766c")}
        {px(x + 1, 84, 8, 2, "#7a766c")}
        {px(x + 4, 86, 12, 8, P.skin)}
        {px(x + 4, 91, 12, 3, P.skinShade)}
        {px(x + 6, 88, 2, 2, "#3d2a1a")}
        {px(x + 11, 88, 2, 2, "#3d2a1a")}
        {px(x + 7, 92, 7, 2, "#8f8a7c")}
        {px(x + 8, 94, 5, 2, P.skinShade)}
        {px(x + 2, 96, 16, 25, "#5f7053")}
        {px(x + 2, 96, 16, 2, "#6d8060")}
        {px(x + 14, 98, 4, 23, "#4f5e45")}
        {px(x + 9, 98, 2, 21, "#4f5e45")}
        {px(x + 3, 104, 6, 5, "#556449")}
        {px(x + 16, 98, 4, 14, "#4f5e45")}
        {px(x + 16, 110, 4, 4, P.skin)}
        {px(x + 3, 121, 6, 24, "#3a4148")}
        {px(x + 11, 121, 6, 24, "#3a4148")}
        {px(x + 3, 121, 14, 2, "#333a40")}
        {px(x + 1, 145, 8, 5, "#22201e")}
        {px(x + 11, 145, 8, 5, "#22201e")}
        {px(x + 1, 145, 18, 1, "#3a3833")}
      </g>
      <g>
        {px(x - 2, 98, 4, 15, "#5f7053")}
        {px(x - 3, 111, 5, 5, P.skin)}
        {px(x - 8, 113, 8, 5, "#c9c4b6")}
        {px(x - 8, 116, 8, 2, "#aeaba0")}
        {mode === "polish" ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${x} 100;-9 ${x} 100;5 ${x} 100;-6 ${x} 100;0 ${x} 100`}
            dur="2.6s"
            repeatCount="indefinite"
          />
        ) : (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`-14 ${x} 100;-16 ${x} 100;-12 ${x} 100;-14 ${x} 100`}
            dur="6s"
            repeatCount="indefinite"
          />
        )}
      </g>
      {/* his kit: bucket, wax tin, a rag drying on the handle */}
      {px(x + 24, 132, 15, 18, "#3a6b7a")}
      {px(x + 23, 131, 17, 3, "#4d8090")}
      {px(x + 26, 135, 9, 3, "#8fa0ad")}
      {px(x + 42, 140, 9, 10, "#c9a24b")}
      {px(x + 42, 140, 9, 2, "#d9b45c")}
      {px(x + 24, 128, 15, 3, "#c9c4b6")}
      {px(x + 22, 148, 20, 2, P.shadowSoft)}
    </g>
  );
}

/** The garage cat, who comes out when the level goes quiet. */
function GarageCat({ x, ph, fed }: { x: number; ph: Ph; fed: boolean }) {
  if (ph === "day") return null;
  const coat = "#4a4438";
  const coatHi = "#5d5648";
  const night = ph === "night";
  if (night) {
    return (
      <g>
        {px(x - 2, 148, 24, 3, P.shadowSoft)}
        {px(x, 138, 22, 10, coat)}
        {px(x, 138, 22, 2, coatHi)}
        {px(x + 17, 133, 9, 8, coat)}
        {px(x + 18, 130, 3, 4, coat)}
        {px(x + 23, 130, 3, 4, coat)}
        {px(x + 19, 136, 2, 1, "#c9a24b")}
        {px(x + 23, 136, 2, 1, "#c9a24b")}
        <rect x={x - 5} y={144} width={7} height={3} fill={coat}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${x + 2} 145;-10 ${x + 2} 145;4 ${x + 2} 145;0 ${x + 2} 145`}
            dur="7.8s"
            repeatCount="indefinite"
          />
        </rect>
        <rect x={x + 4} y={136} width={12} height={4} fill={coatHi}>
          <animate attributeName="y" values="136;135;136" dur="4.6s" repeatCount="indefinite" />
        </rect>
        {fed ? px(x + 26, 145, 10, 4, "#8fa0ad") : null}
      </g>
    );
  }
  // sitting up, watching the aisle
  return (
    <g>
      {px(x - 2, 148, 20, 3, P.shadowSoft)}
      {px(x + 2, 130, 11, 18, coat)}
      {px(x + 2, 130, 11, 2, coatHi)}
      {px(x + 3, 121, 10, 10, coat)}
      {px(x + 3, 117, 4, 5, coat)}
      {px(x + 9, 117, 4, 5, coat)}
      {px(x + 4, 124, 2, 2, "#8fa86a")}
      {px(x + 10, 124, 2, 2, "#8fa86a")}
      {px(x + 7, 127, 2, 1, "#b98b86")}
      {px(x + 1, 144, 5, 4, coat)}
      {px(x + 9, 144, 5, 4, coat)}
      <g>
        {px(x + 13, 136, 3, 12, coat)}
        {px(x + 13, 145, 7, 3, coat)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`0 ${x + 14} 138;-7 ${x + 14} 138;4 ${x + 14} 138;0 ${x + 14} 138`}
          dur="6.4s"
          repeatCount="indefinite"
        />
      </g>
      {fed ? px(x + 20, 145, 10, 4, "#8fa0ad") : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// the level itself
// ---------------------------------------------------------------------------

interface Bay {
  cx: number;
  label: string;
}

const BAYS: Bay[] = [
  { cx: 165, label: "12" },
  { cx: 260, label: "13" },
  { cx: 355, label: "14" },
  { cx: 448, label: "15" },
  { cx: 530, label: "16" },
  { cx: 630, label: "17" },
  { cx: 727, label: "18" },
  { cx: 820, label: "19" },
  { cx: 911, label: "20" },
  { cx: 1010, label: "21" },
  { cx: 1109, label: "22" },
  { cx: 1190, label: "23" },
  { cx: 1269, label: "24" },
  { cx: 1350, label: "25" },
];

/** Which bays hold a car right now — the fillers come and go with the clock. */
function occupancy(ph: Ph): Record<number, boolean> {
  const away = ph === "day" ? [260, 448, 1190, 1350] : ph === "dawn" ? [448, 1190] : [];
  const occupied: Record<number, boolean> = {};
  for (const b of BAYS) occupied[b.cx] = !away.includes(b.cx);
  // 17 is the fire point, 19 is the storage cage, 21 is Marek's working space
  occupied[630] = false;
  occupied[820] = false;
  occupied[1010] = false;
  return occupied;
}

function Services() {
  return (
    <g>
      {px(0, 0, W, 40, P.ceil)}
      {px(0, 38, W, 2, "#3f3d39")}
      {px(0, 6, W, 8, P.pipe)}
      {px(0, 6, W, 1, "#b4bac2")}
      {px(0, 12, W, 2, P.pipeLo)}
      {px(0, 17, W, 7, "#8f959c")}
      {px(0, 22, W, 2, "#70757c")}
      {[110, 222, 334, 446, 558, 670, 782, 894, 1006, 1118, 1230, 1342, 1454, 1566].map((cx) => (
        <g key={`clamp${cx}`}>
          {px(cx, 5, 4, 20, P.steelDark)}
          {px(cx + 1, 25, 2, 15, "#5d6266")}
          {px(cx - 1, 4, 6, 2, "#7d8288")}
        </g>
      ))}
      {px(818, 14, 12, 12, "#8a3a34")}
      {px(822, 10, 4, 4, "#8a3a34")}
      {px(821, 17, 6, 6, "#5d2c27")}
      {px(816, 26, 16, 3, P.steelDark)}
      {px(0, 30, W, 3, "#8a3a34")}
      {px(0, 30, W, 1, "#a04a44")}
      {px(0, 44, W, 2, "#8a3a34")}
      {[200, 600, 1000, 1400].map((x) => (
        <g key={`spr${x}`}>
          {px(x, 46, 3, 4, "#8a3a34")}
          {px(x - 2, 50, 7, 2, "#b8bfc6")}
        </g>
      ))}
      {px(0, 50, W, 4, "#8f8a7c")}
      {[80, 260, 440, 620, 800, 980, 1160, 1340, 1520].map((x) =>
        px(x, 54, 4, 4, "#7a766c", `tb${x}`),
      )}
      {px(0, 58, W, 3, "#c9a24b")}
      {px(0, 64, W, 2, "#5d6266")}
      {/* condensation, dripping on its own schedule */}
      {[318, 958, 1284].map((x, i) => (
        <g key={`drip${x}`}>
          {px(x, 24, 2, 3, "#7d9aa8")}
          <rect x={x} y={26} width={2} height={3} fill="#a8c2d4" opacity={0.8}>
            <animate
              attributeName="y"
              values="26;146"
              dur={`${2.6 + i * 0.7}s`}
              begin={`${i * 1.4}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.9;0.9;0"
              dur={`${2.6 + i * 0.7}s`}
              begin={`${i * 1.4}s`}
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ))}
      {/* a spider, letting itself down out of the services and thinking better of it */}
      <g>
        {px(1082, 40, 1, 10, "#57534c")}
        {px(1080, 49, 4, 3, "#2b2926")}
        {px(1079, 48, 1, 2, "#2b2926")}
        {px(1084, 48, 1, 2, "#2b2926")}
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;0 0;0 26;0 26;0 4;0 0"
          keyTimes="0;0.4;0.55;0.72;0.9;1"
          dur="38s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

function Walls({ ph }: { ph: Ph }) {
  return (
    <g>
      {px(0, 40, W, 110, P.wall)}
      {stripes(W, 40, 110, 82, P.wallLo, 40)}
      {px(0, 40, W, 2, P.wallHi)}
      {[
        [70, 74],
        [70, 108],
        [640, 74],
        [1210, 74],
      ].map(([x, y]) => (
        <g key={`tie${x}${y}`}>
          {px(x, y, 3, 3, "#57534c")}
          {px(x, y, 3, 1, "#3f3d39")}
        </g>
      ))}
      {px(470, 118, 60, 30, "#5f5c55")}
      {px(482, 124, 34, 12, "#78746b")}
      {px(1240, 116, 44, 34, "#5f5c55")}
      {/* bay numbers, stencilled above each space */}
      {BAYS.map((b) => (
        <PixelText key={`bn${b.cx}`} x={b.cx - 4} y={70} text={b.label} fill={P.paintLo} />
      ))}
      {/* P -1 painted big at the lift end */}
      {px(30, 76, 8, 26, P.paint)}
      {px(38, 76, 10, 5, P.paint)}
      {px(38, 88, 10, 5, P.paint)}
      {px(44, 81, 4, 7, P.paint)}
      {px(58, 86, 10, 4, P.paint)}
      {px(74, 76, 5, 26, P.paint)}
      {/* the low kerb along the back of the bays */}
      {px(0, 130, W, 4, "#57534c")}
      {px(0, 130, W, 1, "#6b675f")}
      {/* WYJŚCIE, and the convex mirror in its corner */}
      {px(1488, 60, 74, 16, P.greenDark)}
      {px(1490, 62, 70, 12, "#0f4a2c")}
      {px(1492, 64, 66, 8, P.green)}
      {px(1452, 54, 24, 22, "#3a3833")}
      {px(1454, 56, 20, 18, "#aebfc9")}
      {px(1456, 58, 16, 14, "#c2d2dc")}
      {px(1458, 60, 6, 5, "#dfe8ee")}
      <rect x={1462} y={66} width={5} height={4} fill="#6d7a84" opacity={0.7}>
        <animate attributeName="x" values="1457;1468;1457" dur="19s" repeatCount="indefinite" />
      </rect>
      {/* CCTV panning the aisle */}
      <g>
        {px(430, 48, 4, 8, "#3a3833")}
        <g>
          {px(424, 54, 16, 9, "#22201e")}
          {px(424, 54, 16, 2, "#3a3833")}
          {px(438, 56, 4, 4, "#4a4844")}
          {px(440, 57, 2, 2, "#6d7278")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 432 56;7 432 56;7 432 56;-7 432 56;-7 432 56;0 432 56"
            dur="24s"
            repeatCount="indefinite"
          />
        </g>
        <rect x={426} y={60} width={2} height={2} fill="#ff4040">
          <animate attributeName="opacity" values="1;0;0;1" dur="3.6s" repeatCount="indefinite" />
        </rect>
      </g>
      {/* ventilation, fans turning */}
      {[340, 1140].map((vx) => (
        <g key={`vent${vx}`}>
          {px(vx, 44, 38, 20, "#3a3833")}
          {px(vx, 44, 38, 2, "#4d4a45")}
          {px(vx + 2, 46, 34, 16, "#1d1b19")}
          <g>
            {px(vx + 10, 52, 18, 3, "#5d5a52")}
            {px(vx + 17, 46, 3, 15, "#4d4a45")}
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={`0 ${vx + 19} 54;360 ${vx + 19} 54`}
              dur="1.8s"
              repeatCount="indefinite"
            />
          </g>
          {[0, 1, 2, 3].map((i) => px(vx + 2, 47 + i * 4, 34, 1, "#4d4a45", `vs${vx}${i}`))}
        </g>
      ))}
      {/* the parking rules, high enough to clear the roofs */}
      {px(464, 62, 34, 2, "#8a8f96")}
      {px(466, 64, 30, 36, P.paper)}
      {px(466, 64, 30, 4, "#2b4f9e")}
      {px(470, 72, 22, 2, "#5d6266")}
      {px(470, 77, 18, 1, "#8a8f96")}
      {px(470, 81, 20, 1, "#8a8f96")}
      {px(470, 85, 14, 1, "#8a8f96")}
      {px(470, 90, 12, 8, P.red)}
      {px(472, 93, 8, 2, P.paper)}
      {ph === "night" ? null : null}
    </g>
  );
}

/** One ceiling sensor per bay: red when taken, green when free. */
function BaySensors({ occupied }: { occupied: Record<number, boolean> }) {
  return (
    <g>
      {BAYS.map((b, i) => {
        const taken = occupied[b.cx];
        return (
          <g key={`sn${b.cx}`}>
            {px(b.cx - 7, 40, 14, 7, "#3a3833")}
            {px(b.cx - 7, 40, 14, 1, "#4d4a45")}
            {px(b.cx - 5, 42, 4, 3, "#22201e")}
            <rect
              x={b.cx + 1}
              y={42}
              width={5}
              height={4}
              fill={taken ? "#ff4040" : P.green}
              opacity={0.95}
            >
              <animate
                attributeName="opacity"
                values="0.95;0.7;0.95"
                dur={`${4 + (i % 3)}s`}
                repeatCount="indefinite"
              />
            </rect>
            <ellipse
              cx={b.cx + 3}
              cy={48}
              rx={9}
              ry={4}
              fill={taken ? "#ff4040" : P.green}
              opacity={0.12}
            />
          </g>
        );
      })}
    </g>
  );
}

/** The ramp up to the street, its barrier, its control pillar. */
function Ramp({ ph }: { ph: Ph }) {
  const night = ph === "night";
  const daylight = night ? "#3a4150" : ph === "dusk" ? "#c9a274" : "#b8c4a8";
  const daylightHi = night ? "#4a5262" : ph === "dusk" ? "#dcbc90" : "#d0dcbe";
  return (
    <g>
      {px(1496, 70, 104, 80, "#8a8578")}
      {px(1496, 70, 104, 2, "#9a9488")}
      {px(1512, 70, 88, 64, daylight)}
      {px(1512, 70, 88, 8, daylightHi)}
      {px(1496, 104, 104, 6, "#7a766c")}
      {px(1496, 124, 104, 6, "#7a766c")}
      {px(1496, 140, 104, 5, "#6f6b62")}
      {/* someone comes down every so often, headlights first */}
      <ellipse cx={1560} cy={120} rx={40} ry={26} fill="#fff0c8" opacity={0}>
        <animate
          attributeName="opacity"
          values="0;0;0.55;0.3;0"
          keyTimes="0;0.72;0.84;0.92;1"
          dur="66s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cx"
          values="1596;1596;1540;1500;1470"
          keyTimes="0;0.72;0.84;0.92;1"
          dur="66s"
          repeatCount="indefinite"
        />
      </ellipse>
      {/* the control pillar: card reader, keypad, intercom button */}
      {px(1478, 96, 14, 54, P.steel)}
      {px(1478, 96, 14, 2, "#a0a5ac")}
      {px(1480, 100, 10, 12, "#1b2026")}
      <rect x={1482} y={103} width={6} height={2} fill={P.green}>
        <animate attributeName="opacity" values="1;0.2;1" dur="2.2s" repeatCount="indefinite" />
      </rect>
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => px(1481 + c * 3, 116 + r * 4, 2, 2, "#5d6266", `kp${r}${c}`)),
      )}
      {px(1481, 130, 8, 6, "#c9a24b")}
      {px(1483, 132, 4, 2, "#3a3833")}
      {px(1476, 148, 18, 2, P.shadowSoft)}
      {/* the barrier, which lifts for them and comes back down */}
      <g>
        {px(1492, 92, 8, 58, "#8f8a7c")}
        {px(1492, 92, 8, 2, "#a39d8c")}
      </g>
      <g style={{ transformOrigin: "1498px 96px" }}>
        {px(1498, 94, 70, 5, P.redHi)}
        {px(1498, 94, 70, 1, "#e05a50")}
        {px(1512, 94, 12, 5, "#e0ddd0")}
        {px(1538, 94, 12, 5, "#e0ddd0")}
        {px(1562, 94, 6, 5, "#e0ddd0")}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 1498 96;0 1498 96;-78 1498 96;-78 1498 96;0 1498 96;0 1498 96"
          keyTimes="0;0.7;0.78;0.9;0.96;1"
          dur="66s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// everything bolted to the wall or standing in the aisle
// ---------------------------------------------------------------------------

function WallProps({
  ph,
  x,
}: {
  ph: Ph;
  x: { hoseOpen: boolean; cageOpen: boolean; noticeRead: boolean };
}) {
  return (
    <g>
      {/* --- the lift end: bike rack and the housing association's noticeboard --- */}
      {[58, 66, 74].map((bx) => px(bx, 128, 2, 22, "#8f8a7c", `bh${bx}`))}
      {px(56, 128, 22, 2, "#8f8a7c")}
      {px(50, 130, 15, 14, "#22201e")}
      {px(53, 133, 9, 8, "#5d6266")}
      {px(55, 135, 5, 4, "#8fa0ad")}
      {ph !== "day" ? (
        <g>
          {px(66, 130, 15, 14, "#22201e")}
          {px(69, 133, 9, 8, "#5d6266")}
          {px(64, 124, 12, 6, "#a33a30")}
        </g>
      ) : null}
      {px(86, 66, 34, 40, "#4a4438")}
      {px(86, 66, 34, 2, "#5d5648")}
      {px(88, 68, 30, 36, "#2b2926")}
      <rect x={88} y={68} width={30} height={36} fill="#a8c2d4" opacity={0.14} />
      {px(91, 71, 12, 16, P.paperHi)}
      {px(92, 74, 10, 1, "#5d5648")}
      {px(92, 77, 8, 1, "#8a8f96")}
      {px(92, 80, 9, 1, "#8a8f96")}
      {px(106, 73, 10, 12, x.noticeRead ? "#d8d3c5" : "#e8c445")}
      {px(107, 76, 8, 1, "#7a6a2a")}
      {px(91, 90, 11, 11, "#c9463c")}
      {/* the corner of the top sheet lifts whenever the fans come round */}
      <g>
        {px(103, 84, 5, 4, "#dcd9d1")}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 103 84;0 103 84;-16 103 84;3 103 84;0 103 84"
          dur="11s"
          repeatCount="indefinite"
        />
      </g>
      {/* --- bay 13's fire point, mounted high so it clears the roofs --- */}
      {px(244, 62, 30, 30, P.red)}
      {px(244, 62, 30, 2, "#b8483e")}
      {x.hoseOpen ? (
        <g>
          {px(246, 64, 26, 26, "#5d1e18")}
          {px(250, 68, 18, 18, "#7d2820")}
          {px(254, 72, 10, 10, "#a33a30")}
          {px(236, 62, 8, 30, "#c9463c")}
          {px(236, 62, 2, 30, "#e05a50")}
          {px(258, 88, 4, 26, "#8a3a34")}
          {px(254, 112, 12, 4, "#5d2c27")}
        </g>
      ) : (
        <g>
          {px(246, 64, 26, 26, "#8a2f28")}
          {px(248, 66, 22, 22, "#a33a30")}
          {px(252, 72, 14, 8, "#7d2820")}
          {px(268, 74, 3, 5, P.paper)}
        </g>
      )}
      {px(278, 70, 13, 28, P.red)}
      {px(278, 70, 13, 2, "#c9463c")}
      {px(281, 66, 6, 5, "#3a3833")}
      {px(280, 78, 9, 6, P.paper)}
      {/* --- bay 17's fire alarm call point and the extinguisher beside it --- */}
      {px(596, 66, 30, 30, P.red)}
      {px(596, 66, 30, 2, "#b8483e")}
      {px(598, 68, 26, 26, "#8a2f28")}
      {px(602, 74, 18, 12, "#a33a30")}
      {px(604, 76, 14, 8, "#7d2820")}
      {px(632, 72, 14, 18, P.red)}
      {px(632, 72, 14, 2, "#c9463c")}
      {px(634, 76, 10, 8, P.paper)}
      {px(636, 78, 6, 4, "#c9463c")}
      <rect x={638} y={86} width={3} height={2} fill="#ff4040">
        <animate attributeName="opacity" values="1;0;0;0;1" dur="5s" repeatCount="indefinite" />
      </rect>
      {px(654, 74, 12, 14, "#e8c445")}
      {px(656, 77, 8, 8, "#3a3833")}
      {px(658, 79, 4, 4, "#e8c445")}
      {/* --- bay 19: the storage cage, and everything nobody can throw away --- */}
      {px(788, 74, 66, 76, "#4d4a45")}
      {px(788, 74, 66, 2, "#6b675f")}
      {px(790, 76, 62, 72, "#2b2926")}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => px(792 + i * 8, 76, 1, 72, "#5d5a52", `mv${i}`))}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => px(790, 78 + i * 8, 62, 1, "#5d5a52", `mh${i}`))}
      {px(794, 120, 20, 28, "#3a4a3a")}
      {px(796, 112, 14, 10, "#5d4a37")}
      {px(818, 128, 16, 20, "#4a4438")}
      {px(818, 108, 18, 18, "#2b3a4a")}
      {px(838, 118, 12, 30, "#3a3833")}
      {px(820, 92, 26, 12, "#6b5d4a")}
      {px(796, 96, 16, 12, "#4d3f33")}
      {px(816, 76, 2, 72, "#6b675f")}
      {px(x.cageOpen ? 806 : 812, 108, 6, 6, "#8a8f96")}
      {px(x.cageOpen ? 804 : 810, 112, 8, 6, "#5d6266")}
      {px(822, 78, 4, 6, "#c9c4b6")}
      {/* --- bay 21: the electrical cabinet, humming to itself --- */}
      {px(1024, 70, 34, 58, P.steel)}
      {px(1024, 70, 34, 2, "#a0a5ac")}
      {px(1028, 76, 26, 42, P.steelDark)}
      {px(1030, 80, 22, 2, "#8a8f96")}
      {px(1030, 86, 22, 12, "#2b2926")}
      <PixelText x={1033} y={89} text="230" fill="#8fa86a" />
      <rect x={1048} y={90} width={2} height={2} fill="#ff5050">
        <animate attributeName="opacity" values="1;0;0;1" dur="1.7s" repeatCount="indefinite" />
      </rect>
      {[0, 1, 2, 3, 4].map((i) =>
        px(1031 + i * 4, 102, 3, 8, i % 2 ? "#c9463c" : "#d8d3c5", `bk${i}`),
      )}
      {px(1036, 116, 8, 6, "#c9a24b")}
      {px(1038, 116, 2, 6, "#3a3833")}
      {px(1024, 128, 34, 2, "#57534c")}
      {px(1054, 96, 4, 8, "#8a8f96")}
      {/* --- bay 23: the wallbox, high on the wall, cable dropping to the port --- */}
      {px(1172, 66, 26, 34, P.paperHi)}
      {px(1172, 66, 26, 2, "#ffffff")}
      {px(1176, 70, 18, 12, "#1b2026")}
      <PixelText x={1178} y={73} text="22" fill="#7ee08c" />
      <rect x={1178} y={80} width={14} height={1} fill="#7ee08c">
        <animate attributeName="opacity" values="1;0.2;1" dur="2.8s" repeatCount="indefinite" />
      </rect>
      {px(1176, 86, 8, 10, "#3a3833")}
      {px(1188, 86, 8, 10, "#3a3833")}
      {px(1198, 74, 3, 22, "#2b2926")}
      {px(1198, 94, 10, 3, "#2b2926")}
      {px(1206, 82, 3, 14, "#2b2926")}
      {px(1170, 100, 30, 3, "#8a8f96")}
    </g>
  );
}

function AisleProps({ ph, fed }: { ph: Ph; fed: boolean }) {
  return (
    <g>
      {/* the trolley that will never go home, parked across bay 18 */}
      <g>
        {px(672, 116, 32, 22, "#8f989e")}
        {px(674, 118, 28, 2, P.steelHi)}
        {px(674, 123, 28, 2, P.steelHi)}
        {px(674, 128, 28, 2, P.steelHi)}
        {[678, 686, 694].map((gx) => px(gx, 118, 1, 18, "#7d868c", `tg${gx}`))}
        {px(668, 110, 10, 8, P.redHi)}
        {px(670, 112, 6, 2, P.paper)}
        {px(674, 138, 5, 7, "#5d6266")}
        {px(696, 138, 5, 7, "#5d6266")}
        {px(670, 147, 34, 2, P.shadowSoft)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 687 148;0 687 148;0.8 687 148;-0.5 687 148;0 687 148"
          dur="21s"
          repeatCount="indefinite"
        />
      </g>
      {/* somebody's winter tyres, stacked in the empty bay with a name chalked on */}
      {[0, 1, 2, 3].map((i) => (
        <g key={`ty${i}`}>
          {px(606, 138 - i * 9, 34, 9, i % 2 ? "#1d1b19" : CAR.tyre)}
          {px(606, 138 - i * 9, 34, 2, "#2e2c28")}
          {px(614, 141 - i * 9, 18, 3, "#0d0c0b")}
        </g>
      ))}
      {px(610, 106, 12, 4, "#c9c4b6")}
      {px(602, 146, 42, 3, P.shadow)}
      {/* the drain, the puddle, and the ring the bucket has left */}
      {px(946, 156, 28, 5, "#2e2c29")}
      {[948, 953, 958, 963, 968].map((gx) => px(gx, 157, 2, 3, "#57534c", `dg${gx}`))}
      <ellipse cx={952} cy={160} rx={26} ry={6} fill="#5d7a8a" opacity={0.28} />
      <ellipse cx={956} cy={159} rx={10} ry={2} fill="#8fa8b8" opacity={0.22}>
        <animate attributeName="rx" values="4;16;4" dur="7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.05;0.3" dur="7s" repeatCount="indefinite" />
      </ellipse>
      {px(938, 128, 20, 20, "#8fa0ad")}
      {px(937, 127, 22, 3, P.steelHi)}
      {px(940, 132, 16, 3, P.water)}
      <rect x={940} y={132} width={16} height={2} fill="#7d9aa8">
        <animate attributeName="y" values="132;133;132" dur="2.6s" repeatCount="indefinite" />
      </rect>
      {px(934, 146, 28, 2, P.shadowSoft)}
      {/* the wet floor sign that lives here permanently */}
      {px(978, 122, 4, 28, "#e8c445")}
      {px(964, 148, 30, 3, "#e8c445")}
      {px(970, 128, 16, 12, "#3a3833")}
      {px(974, 131, 6, 6, "#e8c445")}
      {/* the cat, and the saucer somebody keeps filling */}
      <GarageCat x={766} ph={ph} fed={fed} />
      {/* the MZ under a tarp that has slipped again */}
      {px(1404, 108, 66, 28, "#5d6b5d")}
      {px(1404, 108, 66, 3, "#6d7c6d")}
      {px(1412, 100, 40, 10, "#5d6b5d")}
      {px(1418, 96, 22, 6, "#4e5a4e")}
      {px(1400, 130, 18, 18, CAR.tyre)}
      {px(1404, 134, 10, 10, "#8fa0ad")}
      {px(1406, 136, 6, 6, "#5d6266")}
      {px(1452, 130, 18, 18, CAR.tyre)}
      {px(1456, 134, 10, 10, "#8fa0ad")}
      {px(1458, 136, 6, 6, "#5d6266")}
      {px(1398, 146, 76, 3, P.shadow)}
      {px(1436, 118, 14, 10, "#3a3833")}
      {px(1408, 122, 8, 6, "#c9a24b")}
      {/* a broken bumper corner somebody swept against the kerb */}
      {px(1298, 144, 14, 5, "#4a5058")}
      {px(1300, 143, 8, 2, "#626a74")}
    </g>
  );
}

// ---------------------------------------------------------------------------
// the scene
// ---------------------------------------------------------------------------

const COLUMNS = [307, 678, 1059, 1309];

function ParkingScene({ world, phase }: { world: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const occupied = occupancy(ph);
  const mode = marekMode(ph);
  const x = extras(world);

  const lines: React.ReactNode[] = [];
  for (let i = 0; i < BAYS.length - 1; i++) {
    const mid = Math.round((BAYS[i].cx + BAYS[i + 1].cx) / 2);
    lines.push(px(mid, 152, 3, 26, P.paint, `bay${mid}`));
    lines.push(px(mid, 152, 3, 3, "#ddd0a2", `bayh${mid}`));
  }

  return (
    <LayeredScene
      parallax={{ middleBackground: 1 }}
      middleBackground={
        <g>
          <Services />
          <Walls ph={ph} />
          <BaySensors occupied={occupied} />
          <Ramp ph={ph} />
        </g>
      }
      ground={
        <g>
          {px(0, 150, W, 30, P.floor)}
          {px(0, 150, W, 3, "#00000044")}
          {stripes(W, 150, 30, 120, "#3f3d39", 60)}
          {px(0, 166, W, 2, P.paint)}
          {px(0, 168, W, 1, P.paintLo)}
          {lines}
          {[420, 900, 1380].map((ax) => (
            <g key={`ar${ax}`}>
              {px(ax, 172, 22, 3, P.paintLo)}
              {px(ax + 20, 170, 3, 7, P.paintLo)}
              {px(ax + 23, 171, 2, 5, P.paintLo)}
            </g>
          ))}
          {px(1430, 150, 36, 5, P.hazard)}
          {[1434, 1444, 1454].map((sx) => px(sx, 150, 6, 5, P.hazardDark, `sb${sx}`))}
          {[210, 448, 760, 1010, 1240, 1350].map((ox) => (
            <g key={`oil${ox}`}>
              <ellipse cx={ox} cy={160} rx={18} ry={5} fill={P.oil} opacity={0.5} />
              <ellipse cx={ox + 6} cy={163} rx={7} ry={2} fill="#3a3833" opacity={0.5} />
            </g>
          ))}
          {px(500, 172, 70, 2, "#3a3833")}
          {px(1300, 174, 90, 2, "#3a3833")}
          {px(660, 154, 40, 1, "#3a3833")}
          {px(662, 155, 24, 1, "#3a3833")}
        </g>
      }
      staticObjects={<WallProps ph={ph} x={x} />}
      gameplayObjects={
        <g>
          <ElevatorDoors x={8} />
          {/* the row, nose-out, in bay order */}
          <CarFront cx={165} type="sedan" body="#7d786e" bodyHi="#918c80" bodyLo="#615d55" dusty />
          {occupied[260] ? (
            <CarFront cx={260} type="hatch" body="#5d3a3a" bodyHi="#75504e" bodyLo="#452b2b" />
          ) : null}
          <CarFront cx={355} type="sedan" body="#4a5058" bodyHi="#626a74" bodyLo="#373c42" />
          {occupied[448] ? (
            <CarFront
              cx={448}
              type="small"
              body="#8a8578"
              bodyHi="#a09a8c"
              bodyLo="#6a665c"
              dusty
            />
          ) : null}
          <CarFront cx={530} type="small" body="#6b3a42" bodyHi="#855058" bodyLo="#502b31" dusty />
          <CarFront cx={727} type="van" body="#3a4a5d" bodyHi="#4e6076" bodyLo="#2b3746" />
          {mode === "away" ? (
            <CoveredCar cx={911} />
          ) : mode === "bonnet" ? (
            <BonnetUpCar cx={911} />
          ) : (
            <CarFront cx={911} type="sedan" body="#c9c4b6" bodyHi="#dedad0" bodyLo="#a8a49a" />
          )}
          <GolfFront cx={1109} locked={world.golfLocked} />
          {occupied[1190] ? (
            <CarFront
              cx={1190}
              type="hatch"
              body="#e2e2dc"
              bodyHi="#f2f2ee"
              bodyLo="#bdbdb6"
              charging
            />
          ) : null}
          <CarFront cx={1269} type="small" body="#4d5a50" bodyHi="#637265" bodyLo="#3a453e" />
          {occupied[1350] ? (
            <CarFront cx={1350} type="suv" body="#22242a" bodyHi="#3a3d45" bodyLo="#16181c" />
          ) : null}
          {/* the aisle, in front of the row */}
          <AisleProps ph={ph} fed={x.catFed} />
          {/* Pan Marek is an NpcActor in the Effects plane now */}
          {/* columns on the bay lines, hazard-striped at the base */}
          {COLUMNS.map((mid) => {
            const colX = mid - 9;
            return (
              <g key={`col${mid}`}>
                {px(colX, 20, 18, 130, P.column)}
                {px(colX, 20, 4, 130, P.columnHi)}
                {px(colX + 14, 20, 4, 130, P.columnLo)}
                {px(colX, 124, 18, 26, P.hazard)}
                {px(colX, 124, 18, 5, P.hazardDark)}
                {px(colX, 136, 18, 5, P.hazardDark)}
                {px(colX - 2, 148, 22, 3, P.shadow)}
                {px(colX + 2, 130, 8, 2, "#8a8578")}
              </g>
            );
          })}
          {/* the tag on the first column, and the one under it that got scrubbed */}
          {px(298, 78, 18, 26, "#00000018")}
          {px(300, 82, 3, 16, "#2b5aa8")}
          {px(303, 82, 8, 3, "#2b5aa8")}
          {px(308, 85, 3, 6, "#2b5aa8")}
          {px(303, 90, 8, 3, "#2b5aa8")}
          {px(300, 96, 12, 3, "#c9463c")}
          {px(299, 106, 16, 10, "#6f6b62")}
        </g>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// effects
// ---------------------------------------------------------------------------

const PARKING_LAMPS = [177, 447, 717, 987, 1257, 1497];
/** The one over bay 17 has been going for months. */
const DYING_LAMP = 717;
const GOLF_CX = 1109;

const MAREK_MONOLOGUES = [
  "Kurwa, znowu ktoś mi drzwiami przywalił...",
  "Jeszcze tylko przetrę maskę i będzie dobrze.",
  "Coś ten silnik dzisiaj nierówno chodzi. Muszę sprawdzić.",
  "Wosk, polerka... człowiek więcej czasu spędza przy aucie niż w domu.",
  "Kurwa, paliwo znowu podrożało. No nic, trzeba będzie mniej jeździć. Chociaż nie.",
  "Ta rysa była wczoraj? Nie, kurwa, na pewno jej nie było.",
  "W niedzielę nad jezioro. Jak będzie pogoda. Jak mi się będzie chciało.",
  "Kot znowu siedział na masce... No dobra, niech siedzi.",
  "Jeszcze tylko umyć felgi i można jechać.",
  "Dobra... wygląda dobrze. Teraz tylko niech nikt tego nie dotyka.",
] as const;

function ParkingEffects({
  phase,
  fx,
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
  const mode = marekMode(ph);
  const [lit, setLit] = useState(true);
  useEffect(() => {
    if (moving) {
      setLit(true);
      return;
    }
    const timer = window.setTimeout(() => setLit(false), 20_000);
    return () => window.clearTimeout(timer);
  }, [moving]);

  const blinks = fx.filter((f) => f.kind === "golf-blink");
  const revs = fx.filter((f) => f.kind === "golf-rev");

  return (
    <>
      {/* Pan Marek, built rather than drawn — he stops smoking to talk */}
      {mode !== "away" ? (
        <svg
          aria-hidden="true"
          width="100%"
          height="100%"
          viewBox={`0 0 ${W} 180`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0"
        >
          <NpcActor
            npc={NPCS.marek}
            x={1009}
            facing={-1}
            action={mode === "bonnet" ? "lean" : undefined}
          />
        </svg>
      ) : null}
      {mode !== "away" ? (
        <Monologue
          x={1006}
          headY={76}
          scale={scale}
          speaker="Pan Marek"
          lines={MAREK_MONOLOGUES}
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
          <linearGradient id="lightcone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff3cf" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#ffecb0" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ffe6a8" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <rect
          width={W}
          height="180"
          fill="#04050a"
          opacity={lit ? 0.62 : 0.87}
          style={{ transition: "opacity 900ms ease" }}
        />
        {/* the tubes come up in sequence, the way a whole level of them does */}
        {PARKING_LAMPS.map((x, i) => {
          const dying = x === DYING_LAMP;
          return (
            <g
              key={x}
              opacity={lit ? 1 : 0}
              style={{ transition: `opacity ${500 + i * 180}ms ease` }}
            >
              <g>
                <rect x={x - 27} y={36} width={54} height={4} fill="#fff8e0" opacity={0.9} />
                <polygon
                  points={`${x - 24},40 ${x + 24},40 ${x + 78},150 ${x - 78},150`}
                  fill="url(#lightcone)"
                />
                <ellipse cx={x} cy={151} rx={80} ry={7} fill="#ffe6a8" opacity={0.1} />
                {dying ? (
                  <animate
                    attributeName="opacity"
                    values="1;0.15;1;1;0.4;1;0.1;0.9;1;1"
                    dur="6.2s"
                    repeatCount="indefinite"
                  />
                ) : null}
              </g>
              {[0, 1, 2].map((k) => (
                <rect
                  key={k}
                  x={x - 22 + k * 20}
                  y={78 + k * 16}
                  width={1}
                  height={1}
                  fill="#fff6da"
                  opacity={0.6}
                >
                  <animate
                    attributeName="y"
                    values={`${78 + k * 16};${56 + k * 16};${78 + k * 16}`}
                    dur={`${10 + k * 3}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;0.7;0.15;0"
                    dur={`${10 + k * 3}s`}
                    repeatCount="indefinite"
                  />
                </rect>
              ))}
            </g>
          );
        })}
        {/* the work lamp under the Octavia's bonnet doesn't need the sensor */}
        {mode === "bonnet" ? (
          <ellipse cx={905} cy={124} rx={54} ry={30} fill="#ffe6a8" opacity={0.16} />
        ) : null}
        {/* something crosses the aisle at night, quickly, near the wall */}
        {ph === "night" ? (
          <g>
            <rect x={0} y={156} width={7} height={3} fill="#2b2926" opacity={0.9} />
            <rect x={6} y={157} width={5} height={1} fill="#2b2926" opacity={0.9} />
            <animateTransform
              attributeName="transform"
              type="translate"
              values="700 0;700 0;1180 0;1180 0"
              keyTimes="0;0.86;0.94;1"
              dur="47s"
              repeatCount="indefinite"
            />
          </g>
        ) : null}
        {/* key fob answer: both corners, both mirrors, and the flash off the floor */}
        {blinks.map((f) => (
          <g key={f.id} fill="#ffb340">
            {[
              [GOLF_CX - 36, 121, 20, 3],
              [GOLF_CX + 16, 121, 20, 3],
              [GOLF_CX - 39, 108, 8, 2],
              [GOLF_CX + 31, 108, 8, 2],
            ].map(([bx, by, bw, bh]) => (
              <rect key={`${f.id}:${bx}`} x={bx} y={by} width={bw} height={bh}>
                <animate
                  attributeName="opacity"
                  values="0;1;1;0;0;1;1;0"
                  dur="1.3s"
                  repeatCount="1"
                  fill="freeze"
                />
              </rect>
            ))}
            <ellipse cx={GOLF_CX} cy={152} rx={70} ry={10} fill="#ffb340" opacity={0}>
              <animate
                attributeName="opacity"
                values="0;0.22;0;0;0.22;0"
                dur="1.3s"
                repeatCount="1"
                fill="freeze"
              />
            </ellipse>
          </g>
        ))}
        {/* a cold start: the exhaust comes round the flanks and hangs there */}
        {revs.map((f) => (
          <g key={f.id}>
            <rect x={GOLF_CX - 40} y={118} width={80} height={16} fill="#ffe6a8" opacity={0}>
              <animate
                attributeName="opacity"
                values="0;0.28;0.12;0"
                dur="2.4s"
                repeatCount="1"
                fill="freeze"
              />
            </rect>
            {[0, 0.5, 1].map((delay) => (
              <circle
                key={`${f.id}:${delay}`}
                cx={GOLF_CX + 44}
                cy={146}
                r={4}
                fill="#aeb4ba"
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  values="0;0.45;0"
                  begin={`${delay}s`}
                  dur="1.8s"
                  repeatCount="1"
                  fill="freeze"
                />
                <animate
                  attributeName="cy"
                  values="146;128"
                  begin={`${delay}s`}
                  dur="1.8s"
                  repeatCount="1"
                  fill="freeze"
                />
                <animate
                  attributeName="cx"
                  values={`${GOLF_CX + 44};${GOLF_CX + 68}`}
                  begin={`${delay}s`}
                  dur="1.8s"
                  repeatCount="1"
                  fill="freeze"
                />
                <animate
                  attributeName="r"
                  values="3;11"
                  begin={`${delay}s`}
                  dur="1.8s"
                  repeatCount="1"
                  fill="freeze"
                />
              </circle>
            ))}
          </g>
        ))}
        {/* the exit sign and the ramp daylight burn through any darkness */}
        <rect x={1492} y={64} width={66} height={8} fill={P.green} opacity={0.9} />
        <ellipse cx={1525} cy={72} rx={50} ry={16} fill={P.green} opacity={0.07} />
        <rect
          x={1512}
          y={70}
          width={88}
          height={64}
          fill={ph === "night" ? "#4a5262" : "#b8c4a8"}
          opacity={ph === "night" ? 0.18 : 0.38}
        />
      </svg>
    </>
  );
}

export const PARKING_SCENE: SceneDef<WorldState> = {
  id: "parking",
  width: W,
  objects: [
    {
      id: "parking-lift",
      kind: "liftbutton",
      x: 28,
      range: 20,
      to: { scene: "elevator", spawnX: 100 },
    },
    { id: "bikes", kind: "flavor", x: 66, range: 12 },
    { id: "noticeboard", kind: "flavor", x: 102, range: 14 },
    { id: "car-audi", kind: "car", x: 165, range: 26 },
    { id: "extinguisher", kind: "flavor", x: 274, range: 14 },
    { id: "graffiti", kind: "flavor", x: 307, range: 10 },
    { id: "car-passat", kind: "car", x: 355, range: 26 },
    { id: "camera", kind: "flavor", x: 433, range: 12 },
    { id: "sign", kind: "flavor", x: 480, range: 12 },
    { id: "car-lanos", kind: "car", x: 530, range: 24 },
    { id: "tyres", kind: "flavor", x: 620, range: 14 },
    { id: "fire-alarm", kind: "flavor", x: 660, range: 8 },
    { id: "trolley", kind: "flavor", x: 687, range: 10 },
    { id: "car-transit", kind: "car", x: 727, range: 26 },
    { id: "cat", kind: "flavor", x: 780, range: 10 },
    { id: "cage", kind: "flavor", x: 820, range: 22 },
    { id: "car-octavia", kind: "car", x: 911, range: 26 },
    { id: "leak", kind: "flavor", x: 950, range: 14 },
    { id: "pan-marek", kind: "npc", priority: 2, x: 1006, range: 14, face: 1 },
    { id: "electrics", kind: "flavor", x: 1040, range: 14 },
    { id: "golf", kind: "mycar", x: 1109, range: 28 },
    { id: "charger", kind: "flavor", x: 1190, range: 16 },
    { id: "car-corsa", kind: "car", x: 1269, range: 24 },
    { id: "moto", kind: "flavor", x: 1437, range: 20 },
    { id: "mirror-dome", kind: "flavor", x: 1465, range: 10 },
    { id: "barrier-panel", kind: "flavor", x: 1487, range: 9 },
    {
      id: "exit-ramp",
      kind: "stairs",
      priority: 1,
      x: 1545,
      range: 26,
      to: { scene: "outside", spawnX: 150 },
    },
  ],
  Component: ({ world, phase }) => <ParkingScene world={world} phase={phase} />,
  darkness: () => 0,
  Effects: ParkingEffects,
  Foreground: () => (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} 180`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0"
    >
      <g shapeRendering="crispEdges">
        {/* columns passing between the camera and the row */}
        {[580, 1229].map((cx) => (
          <g key={`fc${cx}`}>
            {px(cx, 0, 28, 180, "#57534c")}
            {px(cx, 0, 7, 180, "#6b675f")}
            {px(cx + 24, 0, 4, 180, "#484540")}
            {px(cx, 116, 28, 44, "#c9a24b")}
            {px(cx, 116, 28, 8, "#3a3833")}
            {px(cx, 132, 28, 8, "#3a3833")}
            {px(cx, 148, 28, 12, "#b8933f")}
          </g>
        ))}
        {/* the near lane: two roofs and a windscreen edge, out of focus */}
        {px(150, 162, 190, 18, "#12100f")}
        {px(184, 152, 124, 12, "#1a1816")}
        {px(196, 154, 100, 6, "#232a30")}
        {px(238, 166, 14, 5, "#3a3f45")}
        {px(1300, 166, 210, 14, "#12100f")}
        {px(1336, 156, 140, 12, "#1a1816")}
        {px(1348, 158, 116, 6, "#232a30")}
        {px(1360, 169, 14, 5, "#5a2a30")}
        {/* the ramp's light spilling onto the last few metres */}
        {px(1470, 172, 130, 8, "#6b675f")}
      </g>
    </svg>
  ),
};
