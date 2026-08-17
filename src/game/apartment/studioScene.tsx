import { AnimatePresence, motion } from "motion/react";
import {
  DOG_PALETTE,
  DOG_SLEEPING,
  HEART,
  HEART_PALETTE,
  PixelMap,
} from "@/components/game/sprites";
import { LayeredScene, px, type SceneDef, stripes } from "@/engine";
import type { DayPhase, WorldState } from "@/lib/worldState";
import { roomDarkness } from "@/lib/worldState";

/**
 * The flat, v4 — the light pass.
 *
 * Everything that emits light in this room is now rasterised. There is not a
 * single radialGradient or soft ellipse left: sun shafts are stair-stepped
 * bands, lamp pools are ellipses rasterised into 3–4px rows with quantised
 * alpha, and the falloff between levels is carried by a 2×2 dither rather than
 * a smooth ramp. Light in a pixel scene should be made of pixels.
 *
 * And it runs on the clock. `AMBIENT` holds a tint, a level, a lamp gain and a
 * sun geometry for each of the four phases; every artificial source is then
 * scaled by that gain, so the pendant barely registers at noon and does all the
 * work at midnight. Dawn throws a long shallow shaft to the right, the day a
 * steep one to the left, dusk a long orange one further left, night none.
 *
 * Materials from v3 are unchanged: five tones each, bevelled edges, six texture
 * patterns, ambient occlusion in every junction, and shadows that swing to point
 * away from whichever light is currently dominant.
 */

const W = 920;
const CEIL = 46;
const FLOOR = 150;

/** Five-tone materials: highlight, base, mid, shade, deep shade. */
const M = {
  oak: { hi: "#d8bb85", base: "#b8955e", mid: "#a8854f", lo: "#8f7450", deep: "#6d5738" },
  walnut: { hi: "#7d6448", base: "#5d4a37", mid: "#51402e", lo: "#43362a", deep: "#31271e" },
  graphite: { hi: "#5e646c", base: "#3f4246", mid: "#383b40", lo: "#33363a", deep: "#24262a" },
  steel: { hi: "#dfe4ea", base: "#a8aeb6", mid: "#8a8d92", lo: "#71767c", deep: "#54585d" },
  white: { hi: "#f6f4ee", base: "#e8e6e0", mid: "#dbd8d1", lo: "#c9c5b8", deep: "#a9a69c" },
  clay: { hi: "#dcc096", base: "#c9a878", mid: "#bd9c6c", lo: "#ab8b5e", deep: "#8f7148" },
  greige: { hi: "#d6d0c1", base: "#c9c2b2", mid: "#bcb5a5", lo: "#ada695", deep: "#8f8878" },
  tile: { hi: "#dde6e2", base: "#cdd8d4", mid: "#c0ccc8", lo: "#b0bdb8", deep: "#94a19c" },
  wool: { hi: "#a09daa", base: "#8d8a94", mid: "#7f7c88", lo: "#6f6c78", deep: "#585564" },
  sofa: { hi: "#848a92", base: "#6d7278", mid: "#62676d", lo: "#565b60", deep: "#43474c" },
  leaf: { hi: "#6d9668", base: "#4e6b4e", mid: "#456045", lo: "#3a523c", deep: "#2c3f2e" },
  brass: { hi: "#e6c479", base: "#c9a24b", mid: "#b08f3d", lo: "#8a6d2f", deep: "#5f4b20" },
  floorT: { hi: "#c09a63", base: "#a8875a", mid: "#9c7d51", lo: "#8a6c45", deep: "#6f5636" },
  floorS: { hi: "#b4b1a9", base: "#a5a29a", mid: "#98958d", lo: "#8a8780", deep: "#6f6c66" },
};

const C = {
  glassDay: "#a8c2d4",
  glassDusk: "#c99a72",
  glassDawn: "#bfb8cf",
  glassNight: "#232a34",
  linen: "#e8e2d2",
  warm: "#ffd98a",
  cold: "#dff4ff",
  shadow: "#00000030",
};

type Ph = "dawn" | "day" | "dusk" | "night";

function toPhase(phase?: string): Ph {
  if (phase === "night") return "night";
  if (phase === "dusk") return "dusk";
  if (phase === "dawn" || phase === "morning") return "dawn";
  return "day";
}

function extras(world: WorldState) {
  const w = world as unknown as Record<string, boolean | undefined>;
  return {
    dishesDone: !!w.dishesDone,
    binEmptied: !!w.binEmptied,
    bowlsFilled: !!w.bowlsFilled,
    guitarOut: !!w.guitarOut,
  };
}

// ---------------------------------------------------------------------------
// the day-night model
// ---------------------------------------------------------------------------

interface Ambient {
  tint: string;
  op: number;
  /** how much the artificial lamps actually matter right now */
  lampGain: number;
  /** where the sun shaft lands, and in what colour */
  sun: { botX: number; botW: number; color: string; op: number } | null;
  /** light leaking in through the glazing regardless of the shaft */
  skyGain: number;
}

const AMBIENT: Record<Ph, Ambient> = {
  dawn: {
    tint: "#6f6ba0",
    op: 0.13,
    lampGain: 0.55,
    sun: { botX: 500, botW: 220, color: "#ffdcb0", op: 0.3 },
    skyGain: 0.5,
  },
  day: {
    tint: "#fff2d0",
    op: 0.04,
    lampGain: 0.18,
    sun: { botX: 430, botW: 190, color: "#fff0c8", op: 0.34 },
    skyGain: 1,
  },
  dusk: {
    tint: "#b5572a",
    op: 0.15,
    lampGain: 0.8,
    sun: { botX: 420, botW: 180, color: "#ff9e58", op: 0.24 },
    skyGain: 0.42,
  },
  night: { tint: "#12203a", op: 0.26, lampGain: 1, sun: null, skyGain: 0.1 },
};

// ---------------------------------------------------------------------------
// pixel light — no gradients, no soft ellipses
// ---------------------------------------------------------------------------

/**
 * An ellipse rasterised into chunky rows. Three nested levels stack their alpha,
 * so the falloff comes out as visible steps rather than a smooth ramp.
 */
function PixelGlow({
  cx,
  cy,
  rx,
  ry,
  color,
  op,
  q = 4,
  steps = 3,
  id,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  op: number;
  q?: number;
  steps?: number;
  id: string;
}) {
  if (op <= 0.005) return null;
  const rows: React.ReactNode[] = [];
  for (let s = 0; s < steps; s++) {
    const f = 1 - s / steps;
    const RX = rx * f;
    const RY = ry * f;
    const a = op * (0.34 + s * 0.33);
    const top = -Math.ceil(RY / q) * q;
    for (let y = top; y < RY; y += q) {
      const my = y + q / 2;
      const t = 1 - (my * my) / (RY * RY);
      if (t <= 0) continue;
      const hw = Math.round((RX * Math.sqrt(t)) / q) * q;
      if (hw < q) continue;
      rows.push(
        <rect
          key={`${id}-${s}-${y}`}
          x={cx - hw}
          y={cy + y}
          width={hw * 2}
          height={q}
          fill={color}
          opacity={a}
        />,
      );
    }
  }
  return <g>{rows}</g>;
}

/**
 * A shaft of light as a staircase: horizontal bands stepping sideways as they
 * fall, alpha quantised into a handful of levels, dithered at each boundary.
 */
function PixelBeam({
  topX,
  topW,
  botX,
  botW,
  topY,
  botY,
  color,
  op,
  q = 6,
  levels = 5,
  id,
}: {
  topX: number;
  topW: number;
  botX: number;
  botW: number;
  topY: number;
  botY: number;
  color: string;
  op: number;
  q?: number;
  levels?: number;
  id: string;
}) {
  const bands: React.ReactNode[] = [];
  for (let y = topY; y < botY; y += q) {
    const t = (y - topY) / (botY - topY);
    const lv = Math.max(0, Math.ceil((1 - t) * levels) / levels);
    const bx = Math.round((topX + (botX - topX) * t) / 2) * 2;
    const bw = Math.round((topW + (botW - topW) * t) / 2) * 2;
    bands.push(
      <rect key={`${id}-${y}`} x={bx} y={y} width={bw} height={q} fill={color} opacity={op * lv} />,
    );
    bands.push(
      <rect
        key={`${id}-d-${y}`}
        x={bx}
        y={y + q - 2}
        width={bw}
        height={2}
        fill="url(#st-dither-lite)"
        opacity={op * lv * 0.9}
      />,
    );
  }
  return <g>{bands}</g>;
}

/** A flat wash in quantised steps — under cabinets, along sills, off radiators. */
function PixelWash({
  x,
  y,
  w,
  h,
  color,
  op,
  q = 3,
  id,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  op: number;
  q?: number;
  id: string;
}) {
  if (op <= 0.005) return null;
  const rows: React.ReactNode[] = [];
  const n = Math.max(1, Math.floor(h / q));
  for (let i = 0; i < n; i++) {
    const a = op * (1 - i / n);
    rows.push(
      <rect key={`${id}-${i}`} x={x} y={y + i * q} width={w} height={q} fill={color} opacity={a} />,
    );
  }
  return <g>{rows}</g>;
}

/** The corners fall off — in four hard steps, not a gradient. */
function PixelVignette({ op }: { op: number }) {
  const bands = [
    { inset: 0, a: 1 },
    { inset: 26, a: 0.6 },
    { inset: 52, a: 0.32 },
    { inset: 78, a: 0.14 },
  ];
  return (
    <g>
      {bands.map((b) => (
        <g key={b.inset}>
          <rect
            x={0}
            y={0}
            width={b.inset + 26}
            height={180}
            fill="#0b0e14"
            opacity={op * b.a * 0.25}
          />
          <rect
            x={W - b.inset - 26}
            y={0}
            width={b.inset + 26}
            height={180}
            fill="#0b0e14"
            opacity={op * b.a * 0.25}
          />
        </g>
      ))}
      <rect x={0} y={0} width={W} height={10} fill="#0b0e14" opacity={op * 0.3} />
      <rect x={0} y={172} width={W} height={8} fill="#0b0e14" opacity={op * 0.24} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// shadow model
// ---------------------------------------------------------------------------

interface Shadow {
  src: number;
  strength: number;
}

function dominantLight(ph: Ph, lightOn: boolean, tvOn: boolean): Shadow {
  if (ph === "day") return { src: 604, strength: 1 };
  if (ph === "dawn") return { src: 604, strength: 0.72 };
  if (lightOn) return { src: 726, strength: ph === "dusk" ? 0.8 : 0.95 };
  if (ph === "dusk") return { src: 604, strength: 0.5 };
  if (tvOn) return { src: 752, strength: 0.4 };
  return { src: 604, strength: 0.12 };
}

function castOf(sh: Shadow, x: number, w: number) {
  const c = x + w / 2;
  const dir = c < sh.src ? -1 : 1;
  const d = Math.min(Math.abs(c - sh.src) / 90, 2.4);
  return {
    dir,
    len: Math.round((5 + d * 7) * sh.strength),
    op: (0.16 + d * 0.05) * sh.strength,
  };
}

function Cast({
  x,
  w,
  sh,
  ground = FLOOR,
  depth = 6,
}: {
  x: number;
  w: number;
  sh: Shadow;
  ground?: number;
  depth?: number;
}) {
  const { dir, len, op } = castOf(sh, x, w);
  const half = Math.round(len / 2);
  const halfD = Math.round(depth / 2);
  return (
    <g>
      <polygon
        points={`${x},${ground - 1} ${x + w},${ground - 1} ${x + w + dir * len},${ground + depth} ${x + dir * len},${ground + depth}`}
        fill="#1a1206"
        opacity={op}
      />
      <polygon
        points={`${x},${ground - 1} ${x + w},${ground - 1} ${x + w + dir * half},${ground + halfD} ${x + dir * half},${ground + halfD}`}
        fill="#140f04"
        opacity={op * 0.8}
      />
      {px(x, ground - 2, w, 2, "#00000044")}
    </g>
  );
}

function AO({
  x,
  y,
  w,
  h,
  from = "top",
  op = 0.22,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  from?: "top" | "bottom" | "left" | "right";
  op?: number;
}) {
  const steps = Math.min(Math.max(1, h), 6);
  return (
    <g>
      {Array.from({ length: steps }, (_, i) => {
        const a = (op * (1 - i / steps)).toFixed(3);
        if (from === "top") return px(x, y + i, w, 1, `rgba(0,0,0,${a})`, `ao${i}`);
        if (from === "bottom") return px(x, y + h - 1 - i, w, 1, `rgba(0,0,0,${a})`, `ao${i}`);
        if (from === "left") return px(x + i, y, 1, h, `rgba(0,0,0,${a})`, `ao${i}`);
        return px(x + w - 1 - i, y, 1, h, `rgba(0,0,0,${a})`, `ao${i}`);
      })}
    </g>
  );
}

function Bevel({
  x,
  y,
  w,
  h,
  mat,
  flat = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  mat: { hi: string; base: string; mid: string; lo: string; deep: string };
  flat?: boolean;
}) {
  return (
    <g>
      {px(x, y, w, h, mat.base)}
      {!flat ? px(x, y, w, 1, mat.hi) : null}
      {!flat ? px(x, y + 1, 1, h - 1, mat.mid) : null}
      {px(x + w - 1, y, 1, h, mat.lo)}
      {px(x, y + h - 1, w, 1, mat.deep)}
    </g>
  );
}

/** A stair-stepped diagonal highlight on glass, instead of a gradient polygon. */
function GlassSheen({
  x,
  y,
  h,
  w = 10,
  slant = 0.34,
  op = 0.16,
  id,
}: {
  x: number;
  y: number;
  h: number;
  w?: number;
  slant?: number;
  op?: number;
  id: string;
}) {
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < h; i += 4) {
    const off = Math.round((i * slant) / 2) * 2;
    rows.push(
      <rect
        key={`${id}-${i}`}
        x={x - off}
        y={y + i}
        width={w}
        height={4}
        fill="#ffffff"
        opacity={op}
      />,
    );
    rows.push(
      <rect
        key={`${id}-b-${i}`}
        x={x - off + w}
        y={y + i}
        width={4}
        height={4}
        fill="#ffffff"
        opacity={op * 0.45}
      />,
    );
  }
  return <g>{rows}</g>;
}

// ---------------------------------------------------------------------------
// texture library
// ---------------------------------------------------------------------------

function Defs() {
  return (
    <defs>
      <pattern id="st-grain" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect x="1" y="0" width="1" height="1" fill="#ffffff" opacity="0.07" />
        <rect x="4" y="3" width="1" height="1" fill="#000000" opacity="0.07" />
        <rect x="2" y="4" width="1" height="1" fill="#ffffff" opacity="0.04" />
      </pattern>
      <pattern id="st-wood" width="9" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="9" height="1" fill="#000000" opacity="0.06" />
        <rect x="3" y="2" width="4" height="1" fill="#ffffff" opacity="0.05" />
        <rect x="7" y="1" width="2" height="1" fill="#000000" opacity="0.04" />
      </pattern>
      <pattern id="st-plaster" width="5" height="5" patternUnits="userSpaceOnUse">
        <rect x="0" y="2" width="1" height="1" fill="#000000" opacity="0.05" />
        <rect x="3" y="0" width="1" height="1" fill="#ffffff" opacity="0.06" />
      </pattern>
      <pattern id="st-weave" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="2" height="2" fill="#ffffff" opacity="0.05" />
        <rect x="2" y="2" width="2" height="2" fill="#000000" opacity="0.06" />
      </pattern>
      <pattern id="st-brushed" width="3" height="8" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="8" fill="#ffffff" opacity="0.07" />
        <rect x="2" y="0" width="1" height="8" fill="#000000" opacity="0.05" />
      </pattern>
      {/* the two dithers that carry every light falloff in the room */}
      <pattern id="st-dither" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill="#000000" opacity="0.16" />
        <rect x="1" y="1" width="1" height="1" fill="#000000" opacity="0.16" />
      </pattern>
      <pattern id="st-dither-lite" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill="#ffffff" opacity="0.5" />
        <rect x="1" y="1" width="1" height="1" fill="#ffffff" opacity="0.5" />
      </pattern>
    </defs>
  );
}

// ---------------------------------------------------------------------------
// a 3×5 font for the oven timer
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
  ":": ["0", "1", "0", "1", "0"],
  " ": ["00", "00", "00", "00", "00"],
};

function PixelText({ x, y, text, fill }: { x: number; y: number; text: string; fill: string }) {
  const out: React.ReactNode[] = [];
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const rows = GLYPHS[text[i]] ?? GLYPHS[" "];
    const w = rows[0].length;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < w; c++) {
        if (rows[r][c] === "1") out.push(px(cx + c, y + r, 1, 1, fill, `g${i}${r}${c}`));
      }
    }
    cx += w + 1;
  }
  return <g>{out}</g>;
}

// ---------------------------------------------------------------------------
// doors
// ---------------------------------------------------------------------------

function DoorLeaf({
  x,
  y,
  w,
  h,
  opening,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  opening: boolean;
  children: React.ReactNode;
}) {
  return (
    <g>
      {opening ? px(x, y, w, h, "#14161a") : null}
      {opening ? <AO x={x} y={y} w={w} h={12} from="top" op={0.5} /> : null}
      {opening ? px(x, y, 4, h, "#1d2027") : null}
      <g
        style={{
          transition: "transform 380ms ease-in",
          transform: opening ? "scaleX(0.16)" : "none",
          transformOrigin: `${x}px ${y}px`,
        }}
      >
        {children}
      </g>
    </g>
  );
}

function InteriorDoor({
  x,
  opening,
  lit,
  plate,
}: {
  x: number;
  opening: boolean;
  lit: boolean;
  plate: "drop" | "moon";
}) {
  return (
    <g>
      <Bevel x={x - 2} y={56} w={52} h={94} mat={M.white} />
      {px(x, 58, 48, 92, M.white.lo)}
      <AO x={x} y={58} w={48} h={5} from="top" op={0.3} />
      <AO x={x} y={58} w={5} h={92} from="left" op={0.24} />
      <DoorLeaf x={x + 4} y={62} w={40} h={88} opening={opening}>
        <Bevel x={x + 4} y={62} w={40} h={88} mat={M.white} />
        <rect x={x + 4} y={62} width={40} height={88} fill="url(#st-plaster)" />
        {[
          [68, 34],
          [106, 36],
        ].map(([py, phh]) => (
          <g key={`pn${py}`}>
            {px(x + 8, py, 32, phh, M.white.lo)}
            {px(x + 8, py, 32, 1, M.white.deep)}
            {px(x + 8, py, 1, phh, M.white.deep)}
            {px(x + 39, py, 1, phh, M.white.hi)}
            {px(x + 8, py + phh - 1, 32, 1, M.white.hi)}
          </g>
        ))}
        {px(x + 36, 100, 4, 5, M.steel.base)}
        {px(x + 36, 100, 4, 1, M.steel.hi)}
        {px(x + 39, 100, 1, 5, M.steel.lo)}
        {px(x + 36, 105, 4, 2, M.steel.deep)}
        {px(x + 35, 106, 6, 1, "#00000030")}
      </DoorLeaf>
      {px(x + 18, 70, 8, 8, M.brass.base)}
      {px(x + 18, 70, 8, 1, M.brass.hi)}
      {px(x + 25, 70, 1, 8, M.brass.lo)}
      {plate === "drop" ? px(x + 20, 72, 4, 4, M.brass.deep) : px(x + 20, 72, 4, 2, M.brass.deep)}
      {lit ? px(x + 4, 147, 40, 2, "#ffcf7a") : null}
      {lit ? px(x + 4, 149, 40, 1, "#c9a86a") : null}
      {px(x + 2, 148, 46, 3, C.shadow)}
    </g>
  );
}

// ---------------------------------------------------------------------------
// the yard, behind the glass
// ---------------------------------------------------------------------------

function YardOutside({ ph }: { ph: Ph }) {
  const night = ph === "night";
  const dusk = ph === "dusk";
  const sky = night ? "#1b2430" : dusk ? "#d09566" : ph === "dawn" ? "#c0bcd4" : "#a8c2d4";
  const skyLo = night ? "#28313f" : dusk ? "#e0ab78" : ph === "dawn" ? "#cfc9dc" : "#bcd2e0";
  const block = night ? "#3a4048" : dusk ? "#b89a7e" : "#9aa2ac";
  const blockHi = night ? "#454c56" : dusk ? "#c8a88a" : "#aab2bc";
  const blockLo = night ? "#2f343b" : dusk ? "#a48870" : "#8a929c";
  return (
    <g>
      <Defs />
      {px(150, 30, 620, 130, sky)}
      {px(150, 30, 620, 26, skyLo)}
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={`sk${i}`}
          x={150}
          y={30 + i * 4}
          width={620}
          height={4}
          fill="#2a3240"
          opacity={0.05 * (4 - i)}
        />
      ))}
      {px(180, 46, 180, 108, block)}
      {px(180, 46, 180, 2, blockHi)}
      {px(358, 46, 2, 108, blockLo)}
      {px(420, 40, 300, 116, block)}
      {px(420, 40, 300, 2, blockHi)}
      {px(718, 40, 2, 116, blockLo)}
      <rect x={180} y={46} width={180} height={108} fill="url(#st-plaster)" />
      <rect x={420} y={40} width={300} height={116} fill="url(#st-plaster)" />
      {[62, 86, 110].map((y) => (
        <g key={`row${y}`}>
          {px(184, y, 172, 3, blockLo)}
          {px(184, y, 172, 1, blockHi)}
          {px(424, y, 292, 3, blockLo)}
          {px(424, y, 292, 1, blockHi)}
        </g>
      ))}
      {[
        [196, 68],
        [232, 68],
        [268, 92],
        [304, 68],
        [440, 52],
        [484, 76],
        [530, 52],
        [576, 100],
        [624, 76],
        [672, 52],
      ].map(([wx, wy], i) => (
        <g key={`w${wx}${wy}`}>
          {px(wx - 1, wy - 1, 18, 18, blockLo)}
          {px(wx, wy, 16, 16, night ? "#1b2029" : "#7d94a4")}
          <AO x={wx} y={wy} w={16} h={4} from="top" op={0.3} />
          {night && i % 3 !== 1 ? (
            <g>
              <rect x={wx + 2} y={wy + 2} width={12} height={12} fill={C.warm}>
                <animate
                  attributeName="opacity"
                  values="1;1;0.2;1"
                  dur={`${50 + i * 11}s`}
                  repeatCount="indefinite"
                />
              </rect>
              <rect x={wx - 1} y={wy + 16} width={18} height={2} fill={C.warm} opacity={0.2} />
              <rect x={wx + 2} y={wy + 18} width={12} height={2} fill={C.warm} opacity={0.1} />
            </g>
          ) : null}
          {!night ? px(wx + 2, wy + 2, 5, 12, C.linen) : null}
          {!night ? px(wx, wy + 16, 17, 1, blockHi) : null}
        </g>
      ))}
      <g>
        {px(240, 84, 10, 14, C.linen)}
        {px(240, 84, 10, 2, "#f4f0e4")}
        {px(254, 86, 8, 12, "#7c8ba3")}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-1 247 84;1.5 247 84;-1 247 84"
          dur="6s"
          repeatCount="indefinite"
        />
      </g>
      {[
        { x: 366, y: 104, w: 46, h: 30 },
        { x: 700, y: 108, w: 40, h: 26 },
      ].map((t) => (
        <g key={t.x}>
          {px(t.x, t.y, t.w, t.h, night ? "#2d3a30" : "#4a6150")}
          {px(t.x + 4, t.y, t.w - 12, t.h - 8, night ? "#35443a" : "#556e59")}
          {px(t.x + 10, t.y - 12, t.w - 20, 16, night ? "#35443a" : "#5f7a63")}
          {px(t.x + 18, t.y - 18, 12, 8, night ? "#3b4b40" : "#6a8a6e")}
          {px(t.x + 20, t.y - 16, 6, 3, night ? "#425446" : "#78997c")}
          {px(t.x + t.w / 2 - 2, t.y + t.h, 4, 20, "#4a4438")}
          {px(t.x + t.w / 2 - 2, t.y + t.h, 1, 20, "#5d5648")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${t.x + t.w / 2} ${t.y + t.h};0.9 ${t.x + t.w / 2} ${t.y + t.h};-0.9 ${t.x + t.w / 2} ${t.y + t.h};0 ${t.x + t.w / 2} ${t.y + t.h}`}
            dur={`${9 + t.x / 200}s`}
            repeatCount="indefinite"
          />
        </g>
      ))}
      {px(150, 134, 620, 26, night ? "#3a4038" : "#6f7a5f")}
      {px(150, 134, 620, 2, night ? "#454b42" : "#7d886c")}
      <rect x={150} y={134} width={620} height={26} fill="url(#st-grain)" />
      {px(150, 146, 620, 6, night ? "#4a4a46" : "#9d9a92")}
      {px(150, 146, 620, 1, night ? "#56564f" : "#adaaa2")}
      {px(490, 96, 3, 44, "#5d6266")}
      {px(490, 96, 1, 44, "#7d8288")}
      {px(484, 92, 15, 5, night ? C.warm : "#8a8f96")}
      {night ? (
        <PixelGlow id="yardlamp" cx={491} cy={118} rx={34} ry={38} color={C.warm} op={0.2} q={4} />
      ) : null}
      <g>
        {px(0, 60, 4, 2, night ? "#2b3038" : "#4a5058")}
        {px(3, 59, 3, 1, night ? "#2b3038" : "#4a5058")}
        <animateTransform
          attributeName="transform"
          type="translate"
          values="140 0;140 0;760 -22;760 -22"
          keyTimes="0;0.66;0.84;1"
          dur="52s"
          repeatCount="indefinite"
        />
      </g>
      {px(534, 118, 148, 34, night ? "#5a5750" : "#a5a29a")}
      {px(534, 118, 148, 2, night ? "#6a675f" : "#b5b2aa")}
      <rect x={534} y={118} width={148} height={34} fill="url(#st-grain)" />
      <AO x={534} y={118} w={148} h={4} from="top" op={0.18} />
      {px(534, 114, 148, 3, "#6d7278")}
      {px(534, 114, 148, 1, "#8a8f96")}
      {px(556, 100, 40, 16, "#8a5a3a")}
      {px(556, 100, 40, 2, "#9a6a46")}
      {px(594, 100, 2, 16, "#6d472d")}
      {px(560, 92, 10, 9, night ? "#3d573d" : "#e8a445")}
      {px(574, 90, 10, 11, night ? "#3d573d" : "#e8c445")}
      {px(586, 94, 8, 7, night ? "#33503a" : "#d9832f")}
    </g>
  );
}

// ---------------------------------------------------------------------------
// shell
// ---------------------------------------------------------------------------

function Ceiling({ lightOn, amb }: { lightOn: boolean; amb: Ambient }) {
  const gain = lightOn ? amb.lampGain : 0;
  return (
    <g>
      {px(0, 0, W, CEIL, "#eae7de")}
      {px(0, 0, W, 2, "#f4f1e8")}
      <rect x={0} y={0} width={W} height={CEIL} fill="url(#st-plaster)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={`cf${i}`}
          x={0}
          y={CEIL - 14 + i * 3}
          width={W}
          height={3}
          fill="#000000"
          opacity={0.02 + i * 0.014}
        />
      ))}
      {px(0, CEIL - 3, W, 1, M.white.lo)}
      {px(0, CEIL - 2, W, 2, "#c4c0b3")}
      <AO x={0} y={CEIL} w={W} h={4} from="top" op={0.2} />
      {px(232, 8, 26, 1, "#dcd8cd")}
      {px(258, 9, 16, 1, "#dcd8cd")}
      {px(240, 9, 1, 5, "#dcd8cd")}
      {[168, 236, 304, 372].map((x) => (
        <g key={`sp${x}`}>
          {px(x - 6, CEIL - 7, 12, 5, "#cec9be")}
          {px(x - 6, CEIL - 7, 12, 1, "#ded9cf")}
          {px(x - 4, CEIL - 5, 8, 3, lightOn ? "#fff8e0" : "#b3afa3")}
          {lightOn ? (
            <g>
              <rect
                x={x - 8}
                y={CEIL - 2}
                width={16}
                height={2}
                fill="#fff3cf"
                opacity={0.4 * gain + 0.15}
              />
              <rect
                x={x - 5}
                y={CEIL}
                width={10}
                height={2}
                fill="#fff3cf"
                opacity={0.24 * gain + 0.08}
              />
            </g>
          ) : null}
        </g>
      ))}
      {px(716, CEIL - 6, 20, 4, "#dcd8cd")}
      {px(716, CEIL - 6, 20, 1, "#e8e5db")}
      {px(724, CEIL, 3, 16, "#2e3033")}
      {px(724, CEIL, 1, 16, "#454850")}
      {px(710, CEIL + 16, 31, 3, "#2e3033")}
      {px(710, CEIL + 16, 31, 1, "#454850")}
      {px(713, CEIL + 19, 25, 7, lightOn ? C.warm : "#8f8468")}
      {px(713, CEIL + 19, 25, 1, lightOn ? "#ffeec0" : "#9d9578")}
      {px(716, CEIL + 26, 19, 2, lightOn ? "#ffe6b0" : "#7d7460")}
      {gain > 0.2 ? (
        <g>
          <rect x={700} y={CEIL - 4} width={52} height={4} fill="#ffe6a8" opacity={0.18 * gain} />
          <rect x={690} y={CEIL - 8} width={72} height={4} fill="#ffe6a8" opacity={0.09 * gain} />
        </g>
      ) : null}
      {px(468, CEIL - 8, 14, 6, "#e2e0da")}
      {px(468, CEIL - 8, 14, 1, "#f0eee8")}
      <rect x={472} y={CEIL - 6} width={2} height={2} fill="#ff5050">
        <animate attributeName="opacity" values="0;0;1;0;0" dur="9s" repeatCount="indefinite" />
      </rect>
      {px(596, CEIL - 5, 4, 3, M.steel.lo)}
    </g>
  );
}

function Walls({ ph, lightOn }: { ph: Ph; lightOn: boolean }) {
  const night = ph === "night";
  return (
    <g>
      {px(0, CEIL, 112, 104, M.greige.base)}
      {stripes(112, CEIL, 104, 70, M.greige.mid, 0)}
      <rect x={0} y={CEIL} width={112} height={104} fill="url(#st-plaster)" />
      <AO x={0} y={CEIL} w={112} h={6} from="top" op={0.2} />
      {px(108, CEIL, 4, 104, M.greige.deep)}
      {px(108, CEIL, 1, 104, M.greige.lo)}
      {[
        [112, CEIL, 104, 104],
        [278, CEIL, 126, 104],
        [216, CEIL, 62, 12],
        [216, 106, 62, 44],
      ].map(([wx, wy, ww, wh]) => (
        <g key={`kw${wx}${wy}`}>
          {px(wx, wy, ww, wh, "#e4e1d8")}
          <rect x={wx} y={wy} width={ww} height={wh} fill="url(#st-plaster)" />
        </g>
      ))}
      <AO x={112} y={CEIL} w={292} h={6} from="top" op={0.18} />
      {[
        [112, 104],
        [278, 126],
      ].map(([tx, tw]) => (
        <g key={`tl${tx}`}>
          {px(tx, 78, tw, 34, M.tile.base)}
          {stripes(tw, 78, 34, 40, M.tile.mid, tx)}
          {px(tx, 78, tw, 1, M.tile.hi)}
          {px(tx, 94, tw, 1, M.tile.lo)}
          {px(tx, 95, tw, 1, M.tile.hi)}
          {px(tx, 111, tw, 1, M.tile.deep)}
          <rect x={tx} y={78} width={tw} height={34} fill="url(#st-grain)" />
          <AO x={tx} y={78} w={tw} h={3} from="top" op={0.16} />
        </g>
      ))}
      {[
        [404, CEIL, 130, 104],
        [672, CEIL, 248, 104],
        [534, CEIL, 138, 8],
      ].map(([wx, wy, ww, wh]) => (
        <g key={`cw${wx}${wy}`}>
          {px(wx, wy, ww, wh, M.clay.base)}
          {stripes(ww, wy, wh, 96, M.clay.mid, wx)}
          <rect x={wx} y={wy} width={ww} height={wh} fill="url(#st-plaster)" />
        </g>
      ))}
      <AO x={404} y={CEIL} w={516} h={6} from="top" op={0.18} />
      {px(404, CEIL, 2, 104, M.clay.deep)}
      {px(406, CEIL, 1, 104, M.clay.lo)}
      {px(404, CEIL, 130, 1, M.clay.hi)}
      {px(672, CEIL, 248, 1, M.clay.hi)}
      {px(842, 96, 44, 10, M.clay.lo)}
      {px(842, 96, 44, 1, M.clay.mid)}
      <AO x={0} y={140} w={W} h={6} from="bottom" op={0.16} />
      {px(0, 146, W, 4, "#4a4438")}
      {px(0, 146, W, 1, "#66604f")}
      {px(0, 149, W, 1, "#332f26")}
      {px(560, 146, 100, 4, "#3f3a2f")}
      <Bevel x={116} y={90} w={10} h={14} mat={M.white} />
      {px(119, 94, 4, 6, lightOn ? M.brass.base : "#8f8a7c")}
      {px(119, 94, 4, 1, lightOn ? M.brass.hi : "#9c978a")}
      {px(115, 105, 12, 1, "#00000026")}
      <Bevel x={115} y={128} w={12} h={12} mat={M.white} />
      {px(118, 131, 6, 6, M.white.lo)}
      {px(119, 132, 2, 2, "#8a8d92")}
      {px(122, 132, 2, 2, "#8a8d92")}
      {night ? <rect x={0} y={CEIL} width={W} height={104} fill="#141d2a" opacity={0.12} /> : null}
    </g>
  );
}

function KitchenWindow({
  ph,
  open,
  smoked,
  amb,
}: {
  ph: Ph;
  open: boolean;
  smoked: boolean;
  amb: Ambient;
}) {
  const night = ph === "night";
  const glass =
    ph === "night"
      ? C.glassNight
      : ph === "dusk"
        ? C.glassDusk
        : ph === "dawn"
          ? C.glassDawn
          : C.glassDay;
  return (
    <g>
      {px(212, 50, 70, 60, M.white.lo)}
      {px(212, 50, 70, 1, M.white.hi)}
      <AO x={216} y={54} w={62} h={5} from="top" op={0.3} />
      <AO x={216} y={54} w={5} h={52} from="left" op={0.24} />
      <Bevel x={216} y={54} w={62} h={52} mat={M.white} flat />
      {px(216, 54, 62, 2, M.white.hi)}
      {px(276, 54, 2, 52, M.white.deep)}
      {px(220, 58, 54, night ? 20 : 12, M.white.base)}
      {px(220, 58, 54, 1, M.white.hi)}
      {px(220, 58 + (night ? 18 : 10), 54, 2, M.white.lo)}
      {[24, 32, 40, 48].map((o) => px(220 + o, 58, 1, night ? 20 : 12, M.white.mid, `bl${o}`))}
      <rect x={220} y={58} width={26} height={44} fill={glass} opacity={night ? 0.66 : 0.34} />
      <GlassSheen id="kw1" x={236} y={60} h={40} w={8} op={0.14} />
      {open ? (
        <g>
          <g style={{ transform: "scaleX(0.45)", transformOrigin: "248px 58px" }}>
            <rect x={248} y={58} width={26} height={44} fill={glass} opacity={0.75} />
            {px(248, 58, 26, 2, M.white.base)}
            {px(270, 78, 3, 8, M.steel.base)}
          </g>
          <rect x={246} y={58} width={4} height={44} fill="#f4f0e4" opacity={0.9}>
            <animate attributeName="width" values="4;7;4" dur="3.2s" repeatCount="indefinite" />
          </rect>
        </g>
      ) : (
        <g>
          <rect x={248} y={58} width={26} height={44} fill={glass} opacity={night ? 0.66 : 0.34} />
          <GlassSheen id="kw2" x={264} y={60} h={40} w={8} op={0.11} />
          {px(268, 78, 3, 8, M.steel.base)}
          {px(268, 78, 3, 1, M.steel.hi)}
        </g>
      )}
      {px(245, 58, 4, 44, M.white.base)}
      {px(245, 58, 1, 44, M.white.hi)}
      {px(248, 58, 1, 44, M.white.deep)}
      {amb.skyGain > 0.15 ? (
        <PixelWash
          id="kwlight"
          x={214}
          y={104}
          w={66}
          h={12}
          color={ph === "dusk" ? "#ffb87a" : "#e8f0ff"}
          op={0.2 * amb.skyGain}
          q={3}
        />
      ) : null}
      {open && smoked
        ? [0, 1.4].map((d) => (
            <circle key={d} cx={260} cy={62} r={2} fill="#c9c4b6" opacity={0}>
              <animate
                attributeName="opacity"
                values="0;0.4;0"
                begin={`${d}s`}
                dur="3.4s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values="62;48"
                begin={`${d}s`}
                dur="3.4s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values="2;6"
                begin={`${d}s`}
                dur="3.4s"
                repeatCount="indefinite"
              />
            </circle>
          ))
        : null}
      {px(212, 104, 70, 4, "#dcd9d0")}
      {px(212, 104, 70, 1, "#eceae2")}
      {px(212, 107, 70, 1, "#b8b5ac")}
      <AO x={212} y={108} w={70} h={4} from="top" op={0.26} />
      {px(220, 96, 8, 8, "#a8613f")}
      {px(220, 96, 8, 1, "#c07a52")}
      {px(227, 96, 1, 8, "#8a4e33")}
      {px(219, 103, 10, 1, "#00000033")}
      {px(222, 90, 5, 7, M.leaf.base)}
      {px(222, 90, 2, 7, M.leaf.hi)}
      {px(221, 88, 3, 3, M.leaf.hi)}
      {px(226, 87, 3, 3, M.leaf.mid)}
      {px(234, 98, 7, 6, "#b6c9d2")}
      {px(234, 98, 7, 1, "#d2e0e6")}
      {px(235, 100, 5, 3, M.brass.base)}
      {open ? px(266, 100, 6, 3, "#c94040") : px(268, 99, 4, 5, "#8a8f96")}
    </g>
  );
}

function BalconyDoor({ ph, opening }: { ph: Ph; opening: boolean }) {
  const night = ph === "night";
  const glass =
    ph === "night"
      ? C.glassNight
      : ph === "dusk"
        ? C.glassDusk
        : ph === "dawn"
          ? C.glassDawn
          : C.glassDay;
  const tint = night ? 0.6 : 0.28;
  return (
    <g>
      {px(530, 46, 12, 104, "#8a5a4a")}
      {px(530, 46, 3, 104, "#a06a56")}
      {px(539, 46, 3, 104, "#6d4638")}
      <rect x={530} y={46} width={12} height={104} fill="url(#st-wood)" />
      {px(664, 46, 12, 104, "#8a5a4a")}
      {px(664, 46, 3, 104, "#a06a56")}
      {px(673, 46, 3, 104, "#6d4638")}
      <rect x={664} y={46} width={12} height={104} fill="url(#st-wood)" />
      <AO x={542} y={50} w={124} h={5} from="top" op={0.28} />
      {px(542, 50, 124, 4, M.steel.base)}
      {px(542, 50, 124, 1, M.steel.hi)}
      {px(542, 53, 124, 1, M.steel.deep)}
      {px(542, 146, 124, 4, M.steel.lo)}
      {px(542, 146, 124, 1, M.steel.mid)}
      <rect x={546} y={54} width={56} height={92} fill={glass} opacity={tint} />
      <GlassSheen id="bd1" x={584} y={56} h={88} w={12} op={0.15} />
      {px(602, 54, 4, 92, M.steel.base)}
      {px(602, 54, 1, 92, M.steel.hi)}
      {px(605, 54, 1, 92, M.steel.deep)}
      <g
        style={{
          transition: "transform 380ms ease-in",
          transform: opening ? "translateX(-54px)" : "none",
        }}
      >
        <rect x={604} y={54} width={58} height={92} fill={glass} opacity={tint} />
        <GlassSheen id="bd2" x={644} y={56} h={88} w={10} op={0.11} />
        {px(604, 54, 58, 3, M.steel.base)}
        {px(604, 54, 58, 1, M.steel.hi)}
        {px(604, 54, 2, 92, M.steel.mid)}
        {px(606, 96, 3, 12, M.steel.base)}
        {px(606, 96, 3, 1, M.steel.hi)}
        {px(606, 107, 3, 1, M.steel.deep)}
      </g>
      {opening ? (
        <rect x={600} y={54} width={6} height={92} fill="#f4f0e4" opacity={0.5}>
          <animate attributeName="width" values="6;11;6" dur="3.6s" repeatCount="indefinite" />
        </rect>
      ) : null}
      <g opacity={0.5}>
        {px(546, 54, 26, 92, "#f4f0e4")}
        {px(552, 54, 4, 92, "#faf7ec")}
        {px(562, 54, 3, 92, "#faf7ec")}
        {px(549, 54, 2, 92, "#e6e0d2")}
        <rect x={572} y={54} width={8} height={92} fill="#f4f0e4" opacity={0.6}>
          <animate attributeName="width" values="8;13;8" dur="4.2s" repeatCount="indefinite" />
        </rect>
      </g>
      {px(528, 44, 152, 3, M.walnut.base)}
      {px(528, 44, 152, 1, M.walnut.hi)}
      {px(528, 43, 4, 5, M.brass.base)}
      {px(676, 43, 4, 5, M.brass.base)}
      {px(650, 47, 22, 100, "#8a6a76")}
      {px(650, 47, 22, 2, "#a07f8c")}
      {px(670, 47, 2, 100, "#6d5260")}
      {[656, 664].map((fx) => (
        <g key={`fold${fx}`}>
          {px(fx, 50, 3, 96, "#7a5c68")}
          {px(fx + 3, 50, 1, 96, "#9a7986")}
        </g>
      ))}
      <rect x={650} y={47} width={22} height={100} fill="url(#st-weave)" />
      {px(544, 148, 124, 2, C.shadow)}
    </g>
  );
}

function Floor({ ph, sh }: { ph: Ph; sh: Shadow }) {
  return (
    <g>
      <Defs />
      {px(0, FLOOR, 404, 30, M.floorS.base)}
      {stripes(404, FLOOR, 30, 56, M.floorS.mid, 28)}
      <rect x={0} y={FLOOR} width={404} height={30} fill="url(#st-grain)" />
      {px(0, 164, 404, 1, M.floorS.lo)}
      {px(0, 165, 404, 1, M.floorS.hi)}
      {px(0, 176, 404, 1, M.floorS.lo)}
      <AO x={0} y={FLOOR} w={404} h={5} from="top" op={0.28} />
      {px(402, FLOOR, 4, 30, "#9a8258")}
      {px(402, FLOOR, 1, 30, "#c0a878")}
      {px(405, FLOOR, 1, 30, "#6f5c3a")}
      {px(406, FLOOR, 514, 30, M.floorT.base)}
      {stripes(514, FLOOR, 30, 30, M.floorT.mid, 421)}
      <rect x={406} y={FLOOR} width={514} height={30} fill="url(#st-wood)" />
      {[163, 171].map((y) => (
        <g key={`bd${y}`}>
          {px(406, y, 514, 1, M.floorT.lo)}
          {px(406, y + 1, 514, 1, M.floorT.hi)}
        </g>
      ))}
      {[470, 618, 742, 858].map((x) => px(x, FLOOR, 1, 9, M.floorT.deep, `bj${x}`))}
      <AO x={406} y={FLOOR} w={514} h={5} from="top" op={0.3} />
      {sh.strength > 0.3
        ? [0, 1, 2].map((i) => (
            <rect
              key={`gl${i}`}
              x={406}
              y={FLOOR + 1 + i * 2}
              width={514}
              height={2}
              fill="#ffffff"
              opacity={0.05 * (3 - i) * sh.strength}
            />
          ))
        : null}
      {px(748, 152, 164, 26, M.wool.base)}
      {px(748, 152, 164, 1, M.wool.hi)}
      {px(748, 177, 164, 1, M.wool.deep)}
      <rect x={748} y={152} width={164} height={26} fill="url(#st-weave)" />
      {px(748, 152, 2, 26, M.wool.lo)}
      {px(910, 152, 2, 26, M.wool.lo)}
      {px(766, 160, 128, 8, M.wool.mid)}
      {[770, 790, 810, 830, 850, 870].map((x) => (
        <g key={`rp${x}`}>
          {px(x, 161, 8, 6, M.wool.hi)}
          {px(x, 161, 8, 1, "#aaa7b4")}
        </g>
      ))}
      <AO x={748} y={152} w={164} h={3} from="top" op={0.18} />
      {px(746, 152, 2, 26, "#00000026")}
      {px(226, 154, 52, 12, "#5d6b6a")}
      {px(226, 154, 52, 1, "#71807e")}
      {px(226, 165, 52, 1, "#48534f")}
      <rect x={226} y={154} width={52} height={12} fill="url(#st-weave)" />
      {px(16, FLOOR, 46, 6, "#5a5d62")}
      {px(16, FLOOR, 46, 1, "#70747a")}
      {px(16, 155, 46, 1, "#43464a")}
      {[20, 28, 36, 44, 52].map((x) => px(x, 151, 3, 4, "#4a4d52", `dm${x}`))}
      {px(700, 174, 22, 1, M.floorT.lo)}
      {ph === "dawn" ? px(626, 168, 18, 2, "#b39268") : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// entry — the shoe bench has moved to the foreground
// ---------------------------------------------------------------------------

function Entry({ opening, ph, sh }: { opening: string | null; ph: Ph; sh: Shadow }) {
  return (
    <g>
      <Bevel x={8} y={52} w={58} h={98} mat={M.steel} />
      <AO x={10} y={54} w={54} h={5} from="top" op={0.3} />
      {px(10, 54, 54, 96, M.steel.mid)}
      <DoorLeaf x={14} y={58} w={46} h={92} opening={opening === "frontdoor"}>
        <Bevel x={14} y={58} w={46} h={92} mat={M.graphite} />
        {px(16, 60, 42, 88, M.graphite.mid)}
        {px(16, 60, 42, 1, M.graphite.hi)}
        <rect x={16} y={60} width={42} height={88} fill="url(#st-brushed)" />
        {[
          [74, 30],
          [108, 28],
        ].map(([py, phh]) => (
          <g key={`pn${py}`}>
            {px(20, py, 34, phh, M.graphite.lo)}
            {px(20, py, 34, 1, M.graphite.deep)}
            {px(20, py, 1, phh, M.graphite.deep)}
            {px(53, py, 1, phh, M.graphite.hi)}
            {px(20, py + phh - 1, 34, 1, M.graphite.hi)}
          </g>
        ))}
        {px(50, 92, 3, 22, M.steel.base)}
        {px(50, 92, 3, 1, M.steel.hi)}
        {px(52, 92, 1, 22, M.steel.lo)}
        {px(49, 114, 5, 2, "#00000044")}
        {px(32, 72, 3, 3, "#26282c")}
        {px(32, 72, 3, 1, M.steel.base)}
        {px(50, 118, 3, 4, M.steel.lo)}
        {px(50, 124, 3, 4, M.steel.lo)}
      </DoorLeaf>
      <Cast x={66} w={40} sh={sh} />
      <Bevel x={66} y={56} w={40} h={92} mat={M.oak} />
      <rect x={66} y={56} width={40} height={92} fill="url(#st-wood)" />
      {px(86, 58, 2, 88, M.oak.deep)}
      {px(88, 58, 1, 88, M.oak.hi)}
      {px(80, 98, 3, 9, M.steel.base)}
      {px(89, 98, 3, 9, M.steel.base)}
      {px(80, 98, 3, 1, M.steel.hi)}
      {px(89, 98, 3, 1, M.steel.hi)}
      {px(70, 62, 14, 42, "#c4d4dc")}
      {px(70, 62, 14, 1, "#e2eef2")}
      {px(83, 62, 1, 42, "#9cb0b8")}
      {px(71, 64, 4, 34, "#dfe8ee")}
      {px(74, 76, 8, 16, "#b6c6ce")}
      {px(76, 80, 3, 5, "#cfe0e6")}
      <GlassSheen id="mir" x={80} y={64} h={38} w={6} op={0.14} />
      {ph === "night" || ph === "dusk" ? (
        <g>
          {px(50, 124, 10, 17, "#5f7053")}
          {px(50, 124, 10, 1, "#748a64")}
        </g>
      ) : null}
      {px(94, 108, 16, 4, M.oak.base)}
      {px(94, 108, 16, 1, M.oak.hi)}
      <AO x={94} y={112} w={16} h={3} from="top" op={0.3} />
      {px(97, 112, 2, 4, M.brass.base)}
      {px(103, 112, 2, 4, M.brass.base)}
      {px(96, 104, 5, 4, M.brass.base)}
      {px(96, 104, 5, 1, M.brass.hi)}
      {px(102, 103, 6, 5, "#b6c9d2")}
      {px(102, 103, 6, 1, "#d4e2e8")}
      <Bevel x={96} y={84} w={14} h={20} mat={M.white} />
      {px(98, 87, 10, 9, M.white.lo)}
      {px(98, 87, 10, 1, M.white.deep)}
      <rect x={100} y={98} width={3} height={3} fill="#3ddc84">
        <animate attributeName="opacity" values="1;0.3;1" dur="3.6s" repeatCount="indefinite" />
      </rect>
    </g>
  );
}

// ---------------------------------------------------------------------------
// kitchen
// ---------------------------------------------------------------------------

function Kitchen({
  world,
  ph,
  lightOn,
  x,
  sh,
  amb,
}: {
  world: WorldState;
  ph: Ph;
  lightOn: boolean;
  x: { dishesDone: boolean; binEmptied: boolean };
  sh: Shadow;
  amb: Ambient;
}) {
  const cooking = world.cookerState === "on";
  const dishes = !x.dishesDone && (ph === "dawn" || ph === "day");
  const binFull = !x.binEmptied && (ph === "dusk" || ph === "night");
  const ledGain = lightOn ? amb.lampGain : 0;
  const unit = (ux: number, uw: number, seams: number[]) => (
    <g key={`u${ux}`}>
      <Bevel x={ux} y={50} w={uw} h={26} mat={M.white} />
      <rect x={ux} y={50} width={uw} height={26} fill="url(#st-plaster)" />
      {seams.map((s) => (
        <g key={`sm${s}`}>
          {px(s, 52, 1, 24, M.white.deep)}
          {px(s + 1, 52, 1, 24, M.white.hi)}
        </g>
      ))}
      {px(ux, 74, uw, 2, M.white.lo)}
      <AO x={ux} y={76} w={uw} h={4} from="top" op={0.3} />
    </g>
  );
  return (
    <g>
      {unit(120, 92, [150, 180])}
      {unit(284, 120, [314, 344, 374])}
      {[134, 164, 194, 298, 358, 388].map((hx) => (
        <g key={`uh${hx}`}>
          {px(hx, 70, 12, 2, M.steel.base)}
          {px(hx, 70, 12, 1, M.steel.hi)}
          {px(hx, 72, 12, 1, "#00000033")}
        </g>
      ))}
      {px(120, 76, 92, 2, lightOn ? "#ffe6a8" : "#a8a49a")}
      {px(284, 76, 120, 2, lightOn ? "#ffe6a8" : "#a8a49a")}
      {ledGain > 0.1 ? (
        <g>
          <PixelWash
            id="led1"
            x={120}
            y={78}
            w={92}
            h={18}
            color="#ffe6a8"
            op={0.3 * ledGain}
            q={3}
          />
          <PixelWash
            id="led2"
            x={284}
            y={78}
            w={120}
            h={18}
            color="#ffe6a8"
            op={0.3 * ledGain}
            q={3}
          />
          <rect
            x={120}
            y={90}
            width={92}
            height={4}
            fill="url(#st-dither-lite)"
            opacity={0.1 * ledGain}
          />
          <rect
            x={284}
            y={90}
            width={120}
            height={4}
            fill="url(#st-dither-lite)"
            opacity={0.1 * ledGain}
          />
        </g>
      ) : null}
      <Bevel x={298} y={76} w={48} h={12} mat={M.steel} />
      <rect x={298} y={76} width={48} height={12} fill="url(#st-brushed)" />
      {px(300, 88, 44, 2, cooking ? "#ffe6a8" : M.steel.lo)}
      <Bevel x={316} y={58} w={12} h={18} mat={M.steel} />
      {cooking ? (
        <g>
          <rect x={300} y={88} width={44} height={3} fill="#ffe6a8" opacity={0.6}>
            <animate
              attributeName="opacity"
              values="0.6;0.45;0.6"
              dur="3s"
              repeatCount="indefinite"
            />
          </rect>
          <PixelWash id="hood" x={300} y={91} w={44} h={12} color="#ffd98a" op={0.24} q={3} />
        </g>
      ) : null}
      {px(116, 106, 288, 6, M.oak.base)}
      {px(116, 106, 288, 1, M.oak.hi)}
      {px(116, 107, 288, 1, "#c8a670")}
      {px(116, 110, 288, 1, M.oak.mid)}
      {px(116, 111, 288, 1, M.oak.deep)}
      <rect x={116} y={106} width={288} height={6} fill="url(#st-wood)" />
      <AO x={116} y={112} w={288} h={5} from="top" op={0.34} />
      {px(116, 112, 288, 36, M.graphite.base)}
      <rect x={116} y={112} width={288} height={36} fill="url(#st-brushed)" />
      {[146, 196, 246, 296, 346].map((sx) => (
        <g key={`sm${sx}`}>
          {px(sx, 114, 1, 34, M.graphite.deep)}
          {px(sx + 1, 114, 1, 34, M.graphite.hi)}
        </g>
      ))}
      {[
        [120, 22],
        [152, 40],
        [252, 40],
        [352, 40],
      ].map(([hx, hw]) => (
        <g key={`lh${hx}`}>
          {px(hx, 118, hw, 2, M.steel.base)}
          {px(hx, 118, hw, 1, M.steel.hi)}
          {px(hx, 120, hw, 1, "#00000044")}
        </g>
      ))}
      {px(116, 144, 288, 4, M.graphite.deep)}
      {px(116, 148, 288, 2, "#00000055")}
      {px(126, 96, 34, 3, M.oak.base)}
      {px(126, 96, 34, 1, M.oak.hi)}
      <AO x={126} y={99} w={34} h={3} from="top" op={0.34} />
      {[
        ["#7a8a4a", 128, 6, 10],
        ["#a34a3a", 136, 6, 8],
        [M.brass.base, 144, 6, 9],
        [M.walnut.base, 152, 5, 7],
      ].map(([c, jx, jw, jh]) => (
        <g key={`jar${jx}`}>
          {px(jx as number, 96 - (jh as number), jw as number, jh as number, c as string)}
          {px(jx as number, 96 - (jh as number), jw as number, 1, "#ffffff44")}
          {px(
            (jx as number) + (jw as number) - 1,
            96 - (jh as number),
            1,
            jh as number,
            "#00000033",
          )}
          {px(jx as number, 96 - (jh as number) - 2, jw as number, 2, "#c9c5ba")}
        </g>
      ))}
      <Bevel x={158} y={88} w={22} h={18} mat={M.white} />
      {px(160, 86, 18, 3, M.steel.base)}
      {px(160, 86, 18, 1, M.steel.hi)}
      {px(178, 92, 5, 8, M.steel.base)}
      <GlassSheen id="ket" x={168} y={89} h={16} w={4} op={0.2} />
      {px(160, 102, 18, 2, world.kettleOn ? "#4a90d9" : M.steel.mid)}
      {world.kettleOn ? (
        <g>
          <rect x={160} y={102} width={18} height={2} fill="#8fc0f0">
            <animate attributeName="opacity" values="1;0.5;1" dur="1.8s" repeatCount="indefinite" />
          </rect>
          <PixelWash id="ketglow" x={155} y={104} w={28} h={4} color="#4a90d9" op={0.24} q={2} />
        </g>
      ) : null}
      {px(157, 106, 24, 1, "#00000044")}
      {px(222, 100, 50, 6, M.steel.mid)}
      {px(222, 100, 50, 1, M.steel.hi)}
      {px(224, 102, 46, 4, M.steel.lo)}
      <AO x={224} y={102} w={46} h={3} from="top" op={0.4} />
      {px(224, 105, 46, 1, M.steel.hi)}
      {px(230, 96, 3, 6, M.steel.base)}
      {px(230, 96, 1, 6, M.steel.hi)}
      {px(230, 94, 14, 3, M.steel.base)}
      {px(230, 94, 14, 1, M.steel.hi)}
      {px(243, 96, 2, 4, M.steel.lo)}
      {px(262, 100, 8, 3, "#e8c445")}
      {px(262, 100, 8, 1, "#f2d86a")}
      {dishes ? (
        <g>
          {px(226, 92, 10, 9, "#c8d4da")}
          {px(226, 92, 10, 1, "#e2ecf0")}
          {px(238, 94, 8, 7, "#dfe8ee")}
          {px(248, 93, 9, 8, "#c8d4da")}
          {px(248, 93, 9, 1, "#e2ecf0")}
        </g>
      ) : null}
      {px(206, 96, 32, 10, M.steel.mid)}
      {px(206, 96, 32, 1, M.steel.hi)}
      {[209, 214, 219, 224, 229, 234].map((rx) => px(rx, 92, 1, 5, M.steel.base, `dr${rx}`))}
      <AO x={206} y={106} w={32} h={3} from="top" op={0.3} />
      {dishes ? (
        <g>
          {[
            [208, 88, 7, 9, "#e8e6e0"],
            [216, 87, 7, 10, "#dfe8ee"],
            [224, 88, 7, 9, "#e8e6e0"],
            [232, 90, 5, 7, "#c8d4da"],
          ].map(([dx, dy, dw, dh, c]) => (
            <g key={`pl${dx}`}>
              {px(dx as number, dy as number, dw as number, dh as number, c as string)}
              {px(dx as number, dy as number, dw as number, 1, "#ffffff")}
              {px((dx as number) + (dw as number) - 1, dy as number, 1, dh as number, "#00000026")}
            </g>
          ))}
        </g>
      ) : (
        px(210, 90, 8, 7, "#e8e6e0")
      )}
      {px(274, 84, 30, 3, M.walnut.base)}
      {px(274, 84, 30, 1, M.walnut.hi)}
      {[277, 283, 289, 295].map((kx, i) => (
        <g key={`kn${kx}`}>
          {px(kx, 87, 2, 8 + i, M.steel.base)}
          {px(kx, 87, 1, 8 + i, M.steel.hi)}
          {px(kx, 95 + i, 2, 4, "#3a3128")}
          {px(kx, 99 + i, 2, 1, "#00000033")}
        </g>
      ))}
      {px(278, 92, 12, 14, M.oak.lo)}
      {px(278, 92, 12, 1, M.oak.base)}
      {px(289, 92, 1, 14, M.oak.deep)}
      {px(300, 114, 44, 3, M.steel.base)}
      {px(300, 114, 44, 1, M.steel.hi)}
      {world.cookerState === "open" ? (
        <g>
          {px(300, 117, 44, 29, "#100d0b")}
          <AO x={300} y={117} w={44} h={6} from="top" op={0.55} />
          {px(303, 122, 38, 2, "#4a4438")}
          {px(303, 122, 38, 1, "#5f5748")}
          {px(303, 132, 38, 2, "#4a4438")}
          {px(306, 128, 32, 4, "#6d6258")}
          {px(306, 128, 32, 1, "#847869")}
          {px(308, 126, 12, 3, "#8a5a3a")}
          {px(324, 126, 8, 3, "#a3542f")}
          {px(304, 119, 36, 3, "#ffb340")}
          <PixelGlow
            id="ovenopen"
            cx={322}
            cy={132}
            rx={28}
            ry={14}
            color="#ffb340"
            op={0.26}
            q={3}
          />
          {px(296, 146, 52, 6, "#26282c")}
          {px(296, 146, 52, 1, "#454850")}
          {px(300, 147, 44, 3, "#3f4a55")}
          {px(302, 147, 12, 2, "#5a6a78")}
        </g>
      ) : (
        <g>
          {px(300, 117, 44, 29, M.graphite.mid)}
          {px(300, 117, 44, 1, M.graphite.hi)}
          {px(302, 119, 40, 4, "#31353a")}
          <PixelText
            x={306}
            y={119}
            text={cooking ? "18:40" : "12:00"}
            fill={cooking ? "#ff8a3a" : "#4a5058"}
          />
          {px(304, 125, 36, 14, "#14161a")}
          <AO x={304} y={125} w={36} h={3} from="top" op={0.5} />
          {cooking ? (
            <g>
              {px(306, 127, 32, 10, "#3a2416")}
              <rect x={308} y={128} width={28} height={8} fill="#e8843a" opacity={0.72}>
                <animate
                  attributeName="opacity"
                  values="0.72;0.44;0.72"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </rect>
              {px(310, 134, 24, 2, "#ffb340")}
              {px(314, 130, 12, 4, "#8a5a3a")}
              {px(314, 130, 12, 1, "#a06a44")}
            </g>
          ) : (
            <g>
              {px(306, 127, 12, 10, "#26313c")}
              {px(306, 127, 4, 10, "#3a4c5c")}
            </g>
          )}
          {px(318, 141, 10, 3, M.steel.base)}
          {px(318, 141, 10, 1, M.steel.hi)}
          {px(317, 144, 12, 1, "#00000044")}
        </g>
      )}
      {px(298, 104, 48, 3, "#14161a")}
      {px(298, 104, 48, 1, "#2c3036")}
      {px(306, 105, 10, 1, cooking ? "#e84a3a" : "#33363a")}
      {px(326, 105, 10, 1, "#33363a")}
      {cooking ? (
        <g>
          {px(304, 94, 16, 11, M.steel.mid)}
          {px(304, 94, 16, 1, M.steel.hi)}
          {px(319, 94, 1, 11, M.steel.deep)}
          <GlassSheen id="pot" x={310} y={95} h={9} w={3} op={0.22} />
          {px(305, 92, 14, 2, M.steel.base)}
          {px(310, 90, 4, 2, M.steel.lo)}
          {px(303, 104, 18, 1, "#00000055")}
          <circle cx={312} cy={88} r={2} fill="#e8e6e0" opacity={0}>
            <animate
              attributeName="opacity"
              values="0;0.55;0"
              dur="2.1s"
              repeatCount="indefinite"
            />
            <animate attributeName="cy" values="88;76" dur="2.1s" repeatCount="indefinite" />
            <animate attributeName="r" values="2;6" dur="2.1s" repeatCount="indefinite" />
          </circle>
        </g>
      ) : null}
      <Bevel x={358} y={82} w={30} h={24} mat={M.graphite} />
      <rect x={358} y={82} width={30} height={24} fill="url(#st-brushed)" />
      {px(360, 80, 26, 3, M.graphite.hi)}
      {px(366, 96, 12, 4, M.steel.mid)}
      {px(366, 96, 12, 1, M.steel.hi)}
      {px(368, 100, 8, 6, M.white.base)}
      {px(368, 100, 8, 1, M.white.hi)}
      <rect x={369} y={101} width={6} height={4} fill="#6b4a2f">
        <animate
          attributeName="height"
          values="0;4;4;0"
          keyTimes="0;0.2;0.9;1"
          dur="34s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="y"
          values="105;101;101;105"
          keyTimes="0;0.2;0.9;1"
          dur="34s"
          repeatCount="indefinite"
        />
      </rect>
      {px(382, 86, 4, 6, "#c94040")}
      {px(382, 86, 4, 1, "#e05a50")}
      {px(360, 86, 16, 8, "#14161a")}
      <rect x={362} y={88} width={12} height={4} fill="#7ee08c" opacity={0.8}>
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="4s" repeatCount="indefinite" />
      </rect>
      {px(362, 76, 7, 5, "#a3542f")}
      {px(362, 76, 7, 1, "#c9863f")}
      {px(371, 77, 6, 4, "#a3542f")}
      {px(357, 106, 32, 1, "#00000044")}
      <Bevel x={344} y={118} w={20} h={30} mat={M.steel} />
      <rect x={344} y={118} width={20} height={30} fill="url(#st-brushed)" />
      {px(346, 116, 16, 3, M.steel.base)}
      {px(346, 116, 16, 1, M.steel.hi)}
      {px(350, 146, 8, 3, M.graphite.lo)}
      {binFull ? (
        <g>
          {px(348, 112, 12, 6, "#c8ccd2")}
          {px(348, 112, 12, 1, "#e2e6ea")}
          {px(352, 110, 6, 4, "#e8e6e0")}
        </g>
      ) : null}
      <Cast x={126} w={60} sh={sh} />
      {px(126, 120, 60, 5, M.oak.base)}
      {px(126, 120, 60, 1, M.oak.hi)}
      {px(126, 121, 60, 1, "#c8a670")}
      {px(126, 124, 60, 1, M.oak.deep)}
      <rect x={126} y={120} width={60} height={5} fill="url(#st-wood)" />
      <AO x={126} y={125} w={60} h={4} from="top" op={0.3} />
      {[132, 178].map((lx) => (
        <g key={`tl${lx}`}>
          {px(lx, 125, 4, 23, M.oak.lo)}
          {px(lx, 125, 1, 23, M.oak.base)}
          {px(lx + 3, 125, 1, 23, M.oak.deep)}
        </g>
      ))}
      {px(140, 128, 34, 2, M.oak.lo)}
      {px(190, 116, 5, 32, M.walnut.base)}
      {px(190, 116, 1, 32, M.walnut.hi)}
      {px(188, 116, 9, 3, M.walnut.mid)}
      {px(186, 130, 14, 4, M.walnut.base)}
      {px(186, 130, 14, 1, M.walnut.hi)}
      {ph === "dawn" ? (
        <g>
          {px(140, 112, 9, 8, M.white.base)}
          {px(140, 112, 9, 1, M.white.hi)}
          {px(139, 111, 11, 2, M.steel.mid)}
          {px(139, 119, 11, 1, "#00000033")}
          {px(152, 114, 12, 6, M.brass.base)}
          {px(152, 114, 12, 1, M.brass.hi)}
        </g>
      ) : (
        <g>
          {px(144, 114, 14, 6, "#b6c9d2")}
          {px(144, 114, 14, 1, "#d4e2e8")}
          {px(146, 112, 10, 3, "#8fa8b8")}
          {px(143, 119, 16, 1, "#00000033")}
          {px(164, 116, 12, 4, M.white.lo)}
        </g>
      )}
    </g>
  );
}

function Fridge({ open, ph, sh }: { open: boolean; ph: Ph; sh: Shadow }) {
  return (
    <g>
      <Cast x={352} w={48} sh={sh} />
      {open ? (
        <g>
          {px(320, 56, 28, 92, M.graphite.lo)}
          {px(320, 56, 28, 1, M.graphite.hi)}
          {px(346, 56, 2, 92, M.graphite.deep)}
          {px(322, 60, 24, 84, "#2c2f33")}
          <AO x={322} y={60} w={24} h={5} from="top" op={0.4} />
          {[70, 96, 122].map((ry) => (
            <g key={`fr${ry}`}>
              {px(324, ry, 20, 3, M.steel.mid)}
              {px(324, ry, 20, 1, M.steel.hi)}
            </g>
          ))}
          {px(326, 62, 6, 8, M.white.base)}
          {px(334, 63, 6, 7, "#e8843a")}
          {px(326, 88, 5, 8, "#c94040")}
          {px(333, 90, 5, 6, "#7a8a4a")}
          {px(327, 114, 6, 8, "#e8c433")}
          {px(335, 116, 5, 6, "#4a90d9")}
          {px(352, 54, 48, 94, "#eef4f7")}
          {px(352, 54, 48, 2, "#f8fbfc")}
          {px(398, 54, 2, 94, "#cdd8de")}
          {[82, 108, 130].map((sy) => (
            <g key={`sh${sy}`}>
              {px(354, sy, 44, 2, "#c8d4da")}
              {px(354, sy, 44, 1, "#e6eef2")}
              <AO x={354} y={sy + 2} w={44} h={4} from="top" op={0.22} />
            </g>
          ))}
          {[
            [358, 70, 14, 10, "#c8ccd2"],
            [376, 72, 8, 8, C.linen],
            [386, 74, 8, 6, C.linen],
            [358, 96, 10, 10, "#a34a3a"],
            [372, 94, 8, 12, M.brass.base],
            [384, 98, 10, 8, "#7a8a4a"],
            [358, 118, 16, 10, "#4e7a52"],
            [378, 120, 12, 8, "#e8c433"],
            [358, 136, 20, 8, "#c8ccd2"],
            [382, 134, 14, 10, M.white.lo],
          ].map(([ix, iy, iw, ih, c]) => (
            <g key={`it${ix}${iy}`}>
              {px(ix as number, iy as number, iw as number, ih as number, c as string)}
              {px(ix as number, iy as number, iw as number, 1, "#ffffff55")}
              {px((ix as number) + (iw as number) - 1, iy as number, 1, ih as number, "#00000033")}
            </g>
          ))}
          <rect x={352} y={54} width={48} height={94} fill={C.cold} opacity={0.18}>
            <animate
              attributeName="opacity"
              values="0.18;0.08;0.18"
              dur="2.2s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : (
        <g>
          <Bevel x={352} y={54} w={48} h={94} mat={M.graphite} />
          <rect x={352} y={54} width={48} height={94} fill="url(#st-brushed)" />
          {px(354, 90, 44, 2, M.graphite.deep)}
          {px(354, 92, 44, 1, M.graphite.hi)}
          {px(390, 62, 3, 20, M.steel.base)}
          {px(390, 62, 3, 1, M.steel.hi)}
          {px(390, 96, 3, 26, M.steel.base)}
          {px(390, 96, 3, 1, M.steel.hi)}
          {px(389, 82, 5, 1, "#00000055")}
          {px(389, 122, 5, 1, "#00000055")}
          {[
            [358, 62, 8, 10, C.linen],
            [370, 66, 5, 5, "#c94040"],
            [360, 76, 10, 7, "#e8c433"],
            [376, 78, 6, 6, "#4a90d9"],
            [366, 100, 12, 9, M.white.base],
          ].map(([mx, my, mw, mh, c]) => (
            <g key={`mg${mx}${my}`}>
              {px(mx as number, my as number, mw as number, mh as number, c as string)}
              {px(mx as number, my as number, mw as number, 1, "#ffffff66")}
              {px(mx as number, (my as number) + (mh as number), mw as number, 1, "#00000044")}
            </g>
          ))}
          {px(359, 63, 6, 5, "#7a8f9f")}
          {px(361, 78, 8, 1, M.brass.deep)}
          {px(367, 102, 10, 1, "#8a8d92")}
          {ph === "dawn" ? px(380, 104, 8, 8, "#e8c445") : null}
        </g>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// doors nook — the calendar is gone; it sat across both architraves
// ---------------------------------------------------------------------------

function DoorsNook({
  opening,
  ph,
  lightOn,
  sh,
}: {
  opening: string | null;
  ph: Ph;
  lightOn: boolean;
  sh: Shadow;
}) {
  const cold = ph === "night" || ph === "dawn" || ph === "dusk";
  return (
    <g>
      <InteriorDoor x={408} opening={opening === "door-bath"} lit={false} plate="drop" />
      <InteriorDoor
        x={464}
        opening={opening === "door-study"}
        lit={ph === "night" && lightOn}
        plate="moon"
      />
      <Cast x={496} w={30} sh={sh} depth={4} />
      {px(496, 108, 30, 34, "#dfe0dc")}
      {px(496, 108, 30, 1, "#f0f1ee")}
      {[499, 505, 511, 517].map((fx) => (
        <g key={`rf${fx}`}>
          {px(fx, 110, 4, 30, "#d2d4cf")}
          {px(fx, 110, 1, 30, "#f0f1ee")}
          {px(fx + 3, 110, 1, 30, "#b0b2ad")}
        </g>
      ))}
      {px(496, 142, 30, 3, "#bcbeb9")}
      {px(496, 145, 30, 1, "#00000033")}
      {px(499, 145, 3, 4, M.steel.lo)}
      {px(519, 145, 3, 4, M.steel.lo)}
      {px(506, 104, 14, 34, C.linen)}
      {px(506, 104, 14, 1, "#f2ede0")}
      {px(519, 104, 1, 34, "#c9c2b0")}
      {px(506, 118, 14, 1, "#d6cfbc")}
      {cold ? (
        <g>
          <PixelWash id="rad" x={494} y={100} w={34} h={9} color="#ffd0a8" op={0.22} q={3} />
          <rect x={494} y={103} width={34} height={3} fill="url(#st-dither-lite)" opacity={0.08}>
            <animate
              attributeName="opacity"
              values="0.08;0.03;0.08"
              dur="6s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : null}
      <Cast x={516} w={16} sh={sh} depth={4} />
      {px(516, 130, 16, 18, "#8d8478")}
      {px(516, 130, 16, 1, "#a29a8d")}
      {px(531, 130, 1, 18, "#6f675c")}
      <rect x={516} y={130} width={16} height={18} fill="url(#st-grain)" />
      {px(518, 128, 12, 3, "#7a776f")}
      {px(518, 128, 12, 1, "#8f8c83")}
      {[
        [512, 108, 11, 24, M.leaf.base],
        [521, 100, 11, 32, M.leaf.hi],
        [516, 96, 9, 10, "#63915f"],
        [524, 94, 7, 8, M.leaf.mid],
      ].map(([lx, ly, lw, lh, c]) => (
        <g key={`lf${lx}${ly}`}>
          {px(lx as number, ly as number, lw as number, lh as number, c as string)}
          {px(lx as number, ly as number, Math.round((lw as number) / 2), 1, "#7fae76")}
          {px((lx as number) + (lw as number) - 1, ly as number, 1, lh as number, "#33482f")}
        </g>
      ))}
      {px(520, 132, 3, 14, "#3f5b3f")}
    </g>
  );
}

// ---------------------------------------------------------------------------
// living
// ---------------------------------------------------------------------------

function Living({
  world: _world,
  ph,
  lightOn,
  guitarOut,
  sh,
  amb,
}: {
  world: WorldState;
  ph: Ph;
  lightOn: boolean;
  guitarOut: boolean;
  sh: Shadow;
  amb: Ambient;
}) {
  const dark = ph === "night" || ph === "dusk";
  const gain = lightOn ? amb.lampGain : 0;
  return (
    <g>
      {px(674, 54, 44, 36, "#00000022")}
      <Bevel x={676} y={52} w={40} h={34} mat={M.graphite} />
      {px(679, 55, 34, 28, C.linen)}
      <AO x={679} y={55} w={34} h={3} from="top" op={0.24} />
      {px(681, 58, 10, 10, "#c94040")}
      {px(693, 57, 7, 14, "#2b5aa8")}
      {px(688, 68, 14, 6, "#e8c433")}
      {px(703, 60, 7, 7, "#3a7d84")}
      {px(682, 76, 24, 3, "#a3547c")}
      <GlassSheen id="art" x={698} y={56} h={26} w={6} op={0.1} />
      <Cast x={674} w={44} sh={sh} />
      <Bevel x={674} y={92} w={44} h={56} mat={M.oak} />
      <rect x={674} y={92} width={44} height={56} fill="url(#st-wood)" />
      {[110, 128].map((sy) => (
        <g key={`bs${sy}`}>
          {px(674, sy, 44, 2, M.oak.lo)}
          {px(674, sy, 44, 1, M.oak.hi)}
          <AO x={676} y={sy + 2} w={40} h={4} from="top" op={0.34} />
        </g>
      ))}
      <AO x={676} y={94} w={40} h={4} from="top" op={0.34} />
      {[
        ["#2b5aa8", 678, 5, 14],
        ["#a33a30", 684, 4, 13],
        ["#4e6b4e", 689, 5, 14],
        [M.brass.base, 695, 4, 12],
        [M.walnut.base, 700, 6, 14],
      ].map(([c, bx, bw, bh]) => (
        <g key={`bk${bx}`}>
          {px(bx as number, 96 + (14 - (bh as number)), bw as number, bh as number, c as string)}
          {px(bx as number, 96 + (14 - (bh as number)), bw as number, 1, "#ffffff44")}
          {px(
            (bx as number) + (bw as number) - 1,
            96 + (14 - (bh as number)),
            1,
            bh as number,
            "#00000044",
          )}
        </g>
      ))}
      {[
        ["#7a5a48", 678, 6, 15],
        ["#3a7d84", 685, 5, 13],
        ["#c94040", 691, 4, 15],
        ["#8a8f96", 696, 6, 12],
      ].map(([c, bx, bw, bh]) => (
        <g key={`bk2${bx}`}>
          {px(bx as number, 114 + (15 - (bh as number)), bw as number, bh as number, c as string)}
          {px(bx as number, 114 + (15 - (bh as number)), bw as number, 1, "#ffffff44")}
          {px(
            (bx as number) + (bw as number) - 1,
            114 + (15 - (bh as number)),
            1,
            bh as number,
            "#00000044",
          )}
        </g>
      ))}
      {px(704, 116, 12, 12, C.linen)}
      {px(704, 116, 12, 1, "#f2ede0")}
      {px(706, 118, 8, 7, "#8ba0a8")}
      {px(680, 132, 10, 14, "#4e7a52")}
      {px(680, 132, 5, 1, "#6d9668")}
      {px(682, 130, 6, 4, M.leaf.hi)}
      {px(696, 132, 8, 14, M.brass.base)}
      {px(696, 132, 8, 1, M.brass.hi)}
      {px(703, 132, 1, 14, M.brass.deep)}
      <Cast x={718} w={86} sh={sh} />
      <Bevel x={718} y={116} w={86} h={32} mat={M.oak} />
      <rect x={718} y={116} width={86} height={32} fill="url(#st-wood)" />
      <AO x={720} y={119} w={82} h={4} from="top" op={0.3} />
      {[748, 778].map((dx) => (
        <g key={`md${dx}`}>
          {px(dx, 120, 2, 26, M.oak.deep)}
          {px(dx + 2, 120, 1, 26, M.oak.hi)}
        </g>
      ))}
      {px(736, 122, 22, 20, M.white.base)}
      {px(736, 122, 22, 1, M.white.hi)}
      {px(757, 122, 1, 20, M.white.deep)}
      {px(740, 122, 3, 20, "#26282c")}
      {px(738, 124, 1, 16, "#4a90d9")}
      {px(735, 142, 24, 1, "#00000044")}
      {px(764, 134, 14, 8, "#26282c")}
      {px(764, 134, 14, 1, "#454850")}
      {px(767, 136, 3, 3, "#4a90d9")}
      {[
        ["#2b5aa8", 722, 5, 18],
        ["#c94040", 729, 5, 16],
        ["#3a7d84", 784, 5, 17],
        [M.brass.base, 791, 5, 15],
      ].map(([c, bx, bw, bh]) => (
        <g key={`gb${bx}`}>
          {px(bx as number, 144 - (bh as number), bw as number, bh as number, c as string)}
          {px(bx as number, 144 - (bh as number), bw as number, 1, "#ffffff44")}
          {px(
            (bx as number) + (bw as number) - 1,
            144 - (bh as number),
            1,
            bh as number,
            "#00000044",
          )}
        </g>
      ))}
      {px(802, 130, 10, 1, "#4a4d52")}
      {px(810, 130, 1, 16, "#4a4d52")}
      {px(804, 146, 12, 2, "#4a4d52")}
      {guitarOut || ph !== "night" ? (
        <g>
          <Cast x={766} w={18} sh={sh} depth={4} />
          {px(772, 96, 4, 34, "#6b4a2f")}
          {px(772, 96, 1, 34, "#9a7350")}
          {px(775, 96, 1, 34, "#4a3220")}
          {px(769, 92, 10, 6, M.walnut.base)}
          {px(769, 92, 10, 1, M.walnut.hi)}
          {px(770, 93, 3, 3, M.steel.hi)}
          {px(768, 128, 14, 20, "#c9863f")}
          {px(768, 128, 14, 1, "#e0a25a")}
          {px(781, 128, 1, 20, "#9a6329")}
          {px(766, 134, 18, 12, "#c9863f")}
          {px(766, 134, 18, 1, "#e0a25a")}
          {px(783, 134, 1, 12, "#9a6329")}
          <rect x={766} y={128} width={18} height={20} fill="url(#st-wood)" />
          {px(772, 136, 6, 6, "#5d3a20")}
          <AO x={772} y={136} w={6} h={3} from="top" op={0.5} />
          {px(773, 130, 4, 16, "#e8e2d2")}
        </g>
      ) : null}
      <Cast x={788} w={70} sh={sh} />
      {px(788, 132, 70, 4, M.oak.base)}
      {px(788, 132, 70, 1, M.oak.hi)}
      {px(788, 133, 70, 1, "#c8a670")}
      {px(788, 135, 70, 1, M.oak.deep)}
      <rect x={788} y={132} width={70} height={4} fill="url(#st-wood)" />
      <AO x={788} y={136} w={70} h={4} from="top" op={0.3} />
      {[792, 850].map((lx) => (
        <g key={`ctl${lx}`}>
          {px(lx, 136, 4, 12, M.oak.lo)}
          {px(lx, 136, 1, 12, M.oak.base)}
        </g>
      ))}
      {px(792, 144, 62, 2, M.oak.lo)}
      {px(800, 128, 24, 4, M.steel.mid)}
      {px(800, 128, 24, 1, M.steel.hi)}
      {px(802, 112, 20, 16, M.sofa.base)}
      {px(802, 112, 20, 1, M.sofa.hi)}
      {px(821, 112, 1, 16, M.sofa.deep)}
      {px(804, 114, 16, 12, dark || !lightOn ? "#9fc7d6" : "#7ea8b8")}
      <AO x={804} y={114} w={16} h={2} from="top" op={0.28} />
      {px(806, 116, 8, 2, "#e8f4f8")}
      {px(806, 120, 12, 1, "#e8f4f8")}
      {px(806, 123, 7, 1, "#e8f4f8")}
      <rect x={818} y={116} width={2} height={2} fill="#e8f4f8">
        <animate attributeName="opacity" values="1;1;0;0" dur="1.2s" repeatCount="indefinite" />
      </rect>
      <PixelWash id="lap" x={798} y={128} w={28} h={6} color="#9fc7d6" op={0.24} q={2} />
      {px(832, 128, 10, 5, "#26282c")}
      {px(832, 128, 10, 1, "#454850")}
      {px(834, 129, 6, 3, "#4a90d9")}
      {px(831, 133, 12, 1, "#00000044")}
      {px(826, 126, 9, 7, "#3f6b7a")}
      {px(826, 126, 9, 1, "#5f8f9e")}
      {px(844, 129, 12, 4, "#2e3033")}
      {px(846, 130, 2, 1, "#c94040")}
      {px(850, 58, 48, 30, "#00000018")}
      {px(892, 56, 4, 30, M.oak.lo)}
      {px(852, 56, 44, 4, M.oak.lo)}
      {px(852, 56, 44, 1, M.oak.hi)}
      {px(856, 60, 36, 11, "#2b5aa8")}
      {px(856, 71, 36, 11, "#e8c433")}
      {px(856, 60, 36, 2, "#3a6cc0")}
      {px(856, 80, 36, 2, "#d4b02a")}
      {px(890, 62, 2, 18, "#254e92")}
      {px(872, 60, 2, 22, "#00000018")}
      <Cast x={816} w={102} sh={sh} />
      <Bevel x={816} y={104} w={102} h={44} mat={M.sofa} />
      <rect x={816} y={104} width={102} height={44} fill="url(#st-weave)" />
      {px(816, 100, 15, 48, M.sofa.mid)}
      {px(816, 100, 15, 1, M.sofa.hi)}
      {px(830, 100, 1, 48, M.sofa.deep)}
      {px(903, 100, 15, 48, M.sofa.mid)}
      {px(903, 100, 15, 1, M.sofa.hi)}
      {px(903, 100, 1, 48, M.sofa.hi)}
      <AO x={831} y={104} w={72} h={4} from="top" op={0.26} />
      {px(832, 112, 70, 10, M.sofa.lo)}
      {px(832, 112, 70, 1, M.sofa.base)}
      {px(832, 121, 70, 1, M.sofa.deep)}
      {px(866, 112, 1, 34, M.sofa.deep)}
      {px(867, 112, 1, 34, M.sofa.hi)}
      {[
        [834, M.brass.base, M.brass.hi, M.brass.lo],
        [862, "#3a7d84", "#54a0a8", "#2b5f66"],
      ].map(([cx, base, hi, lo]) => (
        <g key={`cu${cx}`}>
          {px(cx as number, 104, 24, 9, base as string)}
          {px(cx as number, 104, 24, 1, hi as string)}
          {px((cx as number) + 23, 104, 1, 9, lo as string)}
          {px(cx as number, 112, 24, 1, "#00000033")}
        </g>
      ))}
      {px(888, 106, 14, 7, "#8a3a50")}
      {px(888, 106, 14, 1, "#a34a62")}
      {px(818, 118, 14, 28, M.wool.base)}
      {px(818, 118, 14, 1, M.wool.hi)}
      {px(818, 128, 14, 1, M.wool.lo)}
      {px(818, 136, 14, 1, M.wool.lo)}
      <rect x={818} y={118} width={14} height={28} fill="url(#st-weave)" />
      {px(822, 146, 10, 4, M.wool.mid)}
      <Cast x={894} w={22} sh={sh} depth={4} />
      {px(894, 124, 22, 4, M.walnut.base)}
      {px(894, 124, 22, 1, M.walnut.hi)}
      {px(894, 127, 22, 1, M.walnut.deep)}
      <AO x={894} y={128} w={22} h={4} from="top" op={0.3} />
      {px(897, 128, 3, 20, M.walnut.base)}
      {px(910, 128, 3, 20, M.walnut.base)}
      {px(897, 128, 1, 20, M.walnut.hi)}
      {px(898, 106, 16, 12, lightOn ? "#f2dda8" : "#8f8674")}
      {px(898, 106, 16, 1, lightOn ? "#fdf2cd" : "#a09781")}
      {px(913, 106, 1, 12, lightOn ? "#cbb47f" : "#6f685a")}
      {px(904, 118, 4, 6, M.brass.lo)}
      {px(900, 122, 12, 2, M.brass.base)}
      {px(896, 120, 8, 4, "#b6c9d2")}
      {gain > 0.2 ? (
        <PixelGlow
          id="sidelamp"
          cx={906}
          cy={116}
          rx={36}
          ry={28}
          color={C.warm}
          op={0.34 * gain}
          q={4}
        />
      ) : null}
      <Cast x={806} w={12} sh={sh} depth={4} />
      {px(810, 92, 3, 56, M.graphite.mid)}
      {px(810, 92, 1, 56, M.graphite.hi)}
      {px(806, 148, 11, 2, M.graphite.lo)}
      {px(802, 82, 20, 12, lightOn ? "#f2dda8" : "#8f8674")}
      {px(802, 82, 20, 1, lightOn ? "#fdf2cd" : "#a09781")}
      {px(821, 82, 1, 12, lightOn ? "#cbb47f" : "#6f685a")}
      {px(804, 94, 16, 2, lightOn ? "#ffe6b0" : "#7d7460")}
      {gain > 0.2 ? (
        <PixelGlow
          id="floorlamp"
          cx={812}
          cy={94}
          rx={40}
          ry={32}
          color={C.warm}
          op={0.32 * gain}
          q={4}
        />
      ) : null}
    </g>
  );
}

function DogCorner({ ph, bowlsFilled, sh }: { ph: Ph; bowlsFilled: boolean; sh: Shadow }) {
  const fed = bowlsFilled || ph === "dawn" || ph === "dusk";
  return (
    <g>
      <Cast x={616} w={52} sh={sh} depth={4} />
      {px(616, 130, 52, 18, "#7a5a48")}
      {px(616, 130, 52, 1, "#96705a")}
      {px(667, 130, 1, 18, "#5c4436")}
      <rect x={616} y={130} width={52} height={18} fill="url(#st-weave)" />
      {px(620, 126, 44, 8, "#8a6a56")}
      {px(620, 126, 44, 1, "#a48069")}
      <AO x={622} y={133} w={40} h={4} from="top" op={0.32} />
      {px(622, 134, 40, 12, "#5d4a66")}
      {px(624, 136, 36, 8, "#6a5675")}
      {px(624, 136, 36, 1, "#7d6789")}
      {px(650, 132, 18, 10, "#8a3a50")}
      {px(650, 132, 18, 1, "#a44f66")}
      {[596, 578].map((bx, i) => (
        <g key={`bw${bx}`}>
          {px(bx, 138, 14, 8, M.steel.mid)}
          {px(bx, 138, 14, 1, M.steel.hi)}
          {px(bx + 13, 138, 1, 8, M.steel.deep)}
          <AO x={bx + 1} y={139} w={12} h={3} from="top" op={0.34} />
          {i === 0 ? (
            fed ? (
              <g>
                {px(bx + 2, 140, 10, 3, "#8a5a3a")}
                {px(bx + 2, 140, 10, 1, "#a67049")}
              </g>
            ) : (
              px(bx + 2, 141, 10, 2, M.steel.lo)
            )
          ) : (
            <rect x={bx + 2} y={140} width={10} height={3} fill="#8fb0c4">
              <animate
                attributeName="y"
                values="140;140.6;140"
                dur="4.4s"
                repeatCount="indefinite"
              />
            </rect>
          )}
          {px(bx - 1, 146, 16, 1, "#00000044")}
        </g>
      ))}
      {px(ph === "night" ? 604 : 690, 144, 9, 6, "#c94040")}
      {px(ph === "night" ? 604 : 690, 144, 9, 1, "#e05a50")}
      {px(ph === "night" ? 606 : 692, 142, 5, 3, "#e05a50")}
      {px(680, 96, 3, 4, M.brass.base)}
      {px(678, 100, 7, 4, "#4a4438")}
      {px(680, 104, 3, 14, "#4a4438")}
      {px(678, 118, 7, 3, "#4a4438")}
      {px(860, 170, 6, 6, "#c9d84a")}
      {px(860, 170, 6, 1, "#dde85f")}
    </g>
  );
}

function Television({ world, ph }: { world: WorldState; ph: Ph }) {
  const dark = ph === "night" || ph === "dusk";
  return (
    <g>
      {px(716, 78, 72, 36, "#00000022")}
      <Bevel x={718} y={76} w={68} h={36} mat={M.graphite} />
      {px(720, 78, 64, 32, "#14161a")}
      <AO x={720} y={78} w={64} h={3} from="top" op={0.5} />
      {world.tv === "off" ? (
        <g>
          {px(722, 80, 60, 28, "#22262c")}
          <GlassSheen id="tvoff" x={752} y={81} h={26} w={10} op={0.07} />
          {px(742, 88, 14, 12, dark ? "#2b3038" : "#31404d")}
          {px(726, 96, 8, 10, "#282d34")}
          {px(722, 80, 60, 1, "#3a4048")}
        </g>
      ) : null}
      {world.tv === "film" ? (
        <g>
          {px(722, 80, 60, 28, "#26313c")}
          {px(722, 84, 60, 20, "#5d7a8c")}
          {px(722, 84, 60, 2, "#7593a5")}
          {px(722, 80, 60, 4, "#14161a")}
          {px(722, 104, 60, 4, "#14161a")}
          <rect x={722} y={84} width={12} height={20} fill="#8fb0c4" opacity={0.5}>
            <animate attributeName="x" values="722;770;722" dur="7s" repeatCount="indefinite" />
          </rect>
          {px(736, 98, 32, 2, "#c8d8e2")}
        </g>
      ) : null}
      {world.tv === "football" ? (
        <g>
          {px(722, 80, 60, 28, "#3d6b3d")}
          {px(722, 80, 60, 6, "#478047")}
          {px(722, 92, 60, 1, "#5f8a5f")}
          {px(752, 81, 1, 26, "#5f8a5f")}
          {px(722, 80, 16, 4, M.white.base)}
          {px(724, 81, 5, 2, "#c94040")}
          {px(722, 100, 60, 8, "#356035")}
          <rect x={730} y={96} width={3} height={3} fill="#f2f0ea">
            <animate
              attributeName="x"
              values="730;772;738;730"
              dur="4.4s"
              repeatCount="indefinite"
            />
            <animate attributeName="y" values="96;86;100;96" dur="4.4s" repeatCount="indefinite" />
          </rect>
          {px(740, 90, 3, 8, M.white.base)}
          {px(762, 92, 3, 8, "#2b5aa8")}
        </g>
      ) : null}
      {world.tv === "static" ? (
        <g>
          {px(722, 80, 60, 28, "#6d6d6d")}
          {[
            { y: 82, h: 5, c: "#9a9a9a", d: "0.5s" },
            { y: 90, h: 4, c: "#c9c9c9", d: "0.4s" },
            { y: 97, h: 5, c: "#8a8a8a", d: "0.6s" },
            { y: 104, h: 3, c: "#b0b0b0", d: "0.35s" },
          ].map((b) => (
            <rect key={b.y} x={722} y={b.y} width={60} height={b.h} fill={b.c}>
              <animate
                attributeName="opacity"
                values="1;0.2;0.8;0.4;1"
                dur={b.d}
                repeatCount="indefinite"
              />
            </rect>
          ))}
          <rect x={722} y={80} width={60} height={2} fill="#f0f0f0" opacity={0.6}>
            <animate attributeName="y" values="80;106;80" dur="3.4s" repeatCount="indefinite" />
          </rect>
        </g>
      ) : null}
      {world.tv !== "off" ? px(724, 80, 8, 3, "#e8f4f8") : null}
      <rect x={750} y={112} width={3} height={2} fill={world.tv === "off" ? "#a33a30" : "#3ddc84"}>
        <animate attributeName="opacity" values="1;0.4;1" dur="4s" repeatCount="indefinite" />
      </rect>
      {px(726, 112, 20, 2, "#26282c")}
      {px(756, 112, 24, 2, "#26282c")}
    </g>
  );
}

// ---------------------------------------------------------------------------
// the scene
// ---------------------------------------------------------------------------

function StudioScene({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const amb = AMBIENT[ph];
  const lightOn = world.lights.studio;
  const opening = world.doorOpening;
  const win = world.windows["window-kitchen"];
  const x = extras(world);
  const sh = dominantLight(ph, lightOn, world.tv !== "off");
  return (
    <LayeredScene
      parallax={{ farBackground: 0.7, middleBackground: 1 }}
      farBackground={<YardOutside ph={ph} />}
      middleBackground={
        <g>
          <Defs />
          <Ceiling lightOn={lightOn} amb={amb} />
          <Walls ph={ph} lightOn={lightOn} />
          <KitchenWindow ph={ph} open={win.open} smoked={win.smoked} amb={amb} />
          <BalconyDoor ph={ph} opening={opening === "balcony"} />
          <Entry opening={opening} ph={ph} sh={sh} />
          <DoorsNook opening={opening} ph={ph} lightOn={lightOn} sh={sh} />
          <rect x={0} y={0} width={W} height={FLOOR} fill="url(#st-grain)" />
        </g>
      }
      ground={<Floor ph={ph} sh={sh} />}
      staticObjects={
        <g>
          <Defs />
          <Kitchen world={world} ph={ph} lightOn={lightOn} x={x} sh={sh} amb={amb} />
          <Fridge open={world.fridgeOpen} ph={ph} sh={sh} />
          <Bevel x={188} y={58} w={20} h={14} mat={M.graphite} />
          {px(191, 61, 6, 6, M.graphite.lo)}
          <AO x={191} y={61} w={6} h={2} from="top" op={0.4} />
          {px(200, 61, 5, 5, world.radioOn ? "#3ddc84" : "#4a4d52")}
          {px(187, 72, 22, 1, "#00000044")}
          {world.radioOn
            ? [192, 195, 198, 201].map((bx, i) => (
                <rect key={bx} x={bx} y={68} width={2} height={3} fill="#3ddc84">
                  <animate
                    attributeName="height"
                    values="1;3;2;3;1"
                    dur={`${0.7 + i * 0.2}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="y"
                    values="70;68;69;68;70"
                    dur={`${0.7 + i * 0.2}s`}
                    repeatCount="indefinite"
                  />
                </rect>
              ))
            : null}
          <Living
            world={world}
            ph={ph}
            lightOn={lightOn}
            guitarOut={x.guitarOut}
            sh={sh}
            amb={amb}
          />
          <DogCorner ph={ph} bowlsFilled={x.bowlsFilled} sh={sh} />
        </g>
      }
      gameplayObjects={
        <g>
          <Television world={world} ph={ph} />
          <g transform="translate(626 122)">
            <g>
              <PixelMap map={DOG_SLEEPING} palette={DOG_PALETTE} cell={2} />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;0 -1.2;0 0"
                dur="2.8s"
                repeatCount="indefinite"
              />
            </g>
          </g>
          {[0, 1.3, 2.6].map((d, i) => (
            <g key={d} opacity={0}>
              {px(652 + i * 2, 116, 5 + i, 1.5, M.white.base)}
              {px(653 + i * 2, 118, 2, 1.5, M.white.base)}
              {px(652 + i * 2, 120, 5 + i, 1.5, M.white.base)}
              <animate
                attributeName="opacity"
                values="0;0.75;0"
                begin={`${d}s`}
                dur="3.9s"
                repeatCount="indefinite"
              />
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;4 -16"
                begin={`${d}s`}
                dur="3.9s"
                repeatCount="indefinite"
              />
            </g>
          ))}
        </g>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// effects — every light in the room, rasterised
// ---------------------------------------------------------------------------

function Steam({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <div className="pointer-events-none absolute" style={{ left: x * scale, top: y * scale }}>
      <div className="steam" style={{ width: 3 * scale, height: 3 * scale }} />
      <div
        className="steam steam-2"
        style={{ width: 2 * scale, height: 2 * scale, marginLeft: 4 * scale }}
      />
    </div>
  );
}

const MOTES = [
  { x: 596, y: 132, dur: "11s" },
  { x: 628, y: 146, dur: "14s" },
  { x: 660, y: 138, dur: "12.5s" },
  { x: 690, y: 152, dur: "16s" },
  { x: 566, y: 148, dur: "13s" },
  { x: 612, y: 120, dur: "18s" },
];

function StudioEffects({
  world,
  phase,
  fx,
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
  const ph = toPhase(phase);
  const amb = AMBIENT[ph];
  const darkness = roomDarkness(phase as DayPhase, world.lights.studio);
  const lightOn = world.lights.studio;
  const gain = lightOn ? amb.lampGain : 0;
  return (
    <>
      <AnimatePresence>
        {fx
          .filter((f) => f.kind === "heart")
          .map((heart) => (
            <motion.div
              key={heart.id}
              className="pointer-events-none absolute"
              style={{ left: heart.x * scale, width: 10 * scale, height: 8 * scale }}
              initial={{ top: 124 * scale, opacity: 1 }}
              animate={{ top: 102 * scale, opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 10 8">
                <PixelMap map={HEART} palette={HEART_PALETTE} />
              </svg>
            </motion.div>
          ))}
        {fx
          .filter((f) => f.kind === "note")
          .map((note) => (
            <motion.div
              key={note.id}
              className="pointer-events-none absolute text-parchment/90"
              style={{ left: note.x * scale, fontSize: 5 * scale }}
              initial={{ top: 116 * scale, opacity: 0, x: 0 }}
              animate={{
                top: 90 * scale,
                opacity: [0, 1, 1, 0],
                x: (note.id % 2 ? 1 : -1) * 4 * scale,
              }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            >
              {note.id % 2 ? "♪" : "♬"}
            </motion.div>
          ))}
      </AnimatePresence>
      {world.kettleOn ? <Steam x={164} y={76} scale={scale} /> : null}
      {world.cookerState === "on" ? <Steam x={308} y={80} scale={scale} /> : null}
      {world.radioOn ? (
        <div
          className="pointer-events-none absolute text-parchment"
          style={{ left: 196 * scale, top: 46 * scale, fontSize: 6 * scale }}
        >
          <span className="note">♪</span>
          <span className="note note-2">♬</span>
        </div>
      ) : null}
      {actionUi === "smoke" && world.windows["window-kitchen"].open ? (
        <Steam x={258} y={62} scale={scale} />
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
          <pattern id="st-dither-lite" width="2" height="2" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="1" height="1" fill="#ffffff" opacity="0.5" />
            <rect x="1" y="1" width="1" height="1" fill="#ffffff" opacity="0.5" />
          </pattern>
        </defs>
        {/* the phase tint, flat and quantised */}
        <rect x={0} y={0} width={W} height={180} fill={amb.tint} opacity={amb.op} />
        {/* the sun, as a staircase */}
        {amb.sun ? (
          <g>
            <PixelBeam
              id="sun"
              topX={546}
              topW={116}
              botX={amb.sun.botX}
              botW={amb.sun.botW}
              topY={54}
              botY={180}
              color={amb.sun.color}
              op={amb.sun.op}
              q={6}
              levels={5}
            />
            <PixelBeam
              id="mull"
              topX={602}
              topW={6}
              botX={ph === "dawn" ? 630 : 548}
              botW={14}
              topY={54}
              botY={180}
              color="#6b4a24"
              op={0.16}
              q={6}
              levels={3}
            />
            {MOTES.map((m) => (
              <rect key={m.x} x={m.x} y={m.y} width={1} height={1} fill="#fff6da" opacity={0}>
                <animate
                  attributeName="y"
                  values={`${m.y};${m.y - 20};${m.y}`}
                  dur={m.dur}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="x"
                  values={`${m.x};${m.x + 4};${m.x - 3};${m.x}`}
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
        ) : null}
        {gain > 0.1 ? (
          <g>
            <PixelGlow
              id="pendant"
              cx={726}
              cy={92}
              rx={96}
              ry={56}
              color={C.warm}
              op={0.4 * gain}
              q={4}
            />
            <PixelGlow
              id="pendantfloor"
              cx={726}
              cy={158}
              rx={104}
              ry={14}
              color="#ffe6a8"
              op={0.2 * gain}
              q={2}
            />
            <PixelWash
              id="ledfloor"
              x={120}
              y={150}
              w={284}
              h={9}
              color="#ffe6a8"
              op={0.16 * gain}
              q={3}
            />
          </g>
        ) : null}
        {world.fridgeOpen ? (
          <g>
            <PixelWash id="fridge" x={344} y={54} w={64} h={96} color={C.cold} op={0.34} q={6} />
            <PixelGlow
              id="fridgefloor"
              cx={376}
              cy={152}
              rx={54}
              ry={9}
              color="#b8e6ff"
              op={0.24}
              q={3}
            />
          </g>
        ) : null}
        {world.cookerState === "on" ? (
          <PixelGlow id="oven" cx={322} cy={132} rx={44} ry={26} color="#ff9a3a" op={0.22} q={4} />
        ) : null}
        {world.cookerState === "open" ? (
          <PixelGlow
            id="ovenopenfx"
            cx={322}
            cy={140}
            rx={54}
            ry={30}
            color="#ffb03a"
            op={0.26}
            q={4}
          />
        ) : null}
        {world.tv !== "off" && darkness > 0.3 ? (
          <g>
            <g>
              <PixelGlow
                id="tvglow"
                cx={752}
                cy={94}
                rx={92}
                ry={60}
                color="#9fc7d6"
                op={0.24}
                q={4}
              />
              <animate
                attributeName="opacity"
                values="1;0.6;0.9;0.7;1"
                dur="2.2s"
                repeatCount="indefinite"
              />
            </g>
            <PixelGlow
              id="tvfloor"
              cx={790}
              cy={156}
              rx={78}
              ry={10}
              color="#9fc7d6"
              op={0.14}
              q={2}
            />
          </g>
        ) : null}
        <PixelVignette op={0.5 + darkness * 0.5} />
      </svg>
    </>
  );
}

// ---------------------------------------------------------------------------
// scene definition
// ---------------------------------------------------------------------------

export const STUDIO_SCENE: SceneDef<WorldState> = {
  id: "studio",
  width: W,
  objects: [
    {
      id: "frontdoor",
      kind: "flatdoor",
      priority: 1,
      x: 37,
      range: 22,
      to: { scene: "corridor", spawnX: 46 },
    },
    { id: "wardrobe-hall", kind: "openable", x: 85, range: 14 },
    { id: "keys", kind: "flavor", x: 104, range: 6 },
    { id: "switch", kind: "lamp", x: 122, range: 12 },
    { id: "spices", kind: "flavor", x: 143, range: 10 },
    { id: "table", kind: "flavor", x: 156, range: 6 },
    { id: "kettle", kind: "kettle", x: 169, range: 14 },
    { id: "speaker", kind: "radio", x: 197, range: 10 },
    { id: "dishrack", kind: "flavor", x: 217, range: 10 },
    { id: "window-kitchen", kind: "window", x: 247, range: 16 },
    { id: "sink-kitchen", kind: "flavor", x: 247, range: 6 },
    { id: "knives", kind: "flavor", x: 288, range: 10 },
    { id: "cooker", kind: "cooker", x: 322, range: 14 },
    { id: "bin", kind: "flavor", x: 352, range: 8 },
    { id: "espresso", kind: "flavor", x: 374, range: 12 },
    { id: "fridge", kind: "openable", x: 376, range: 16 },
    {
      id: "door-bath",
      kind: "flatdoor",
      priority: 1,
      x: 432,
      range: 18,
      to: { scene: "bath", spawnX: 44 },
    },
    {
      id: "door-study",
      kind: "flatdoor",
      priority: 1,
      x: 488,
      range: 18,
      to: { scene: "study", spawnX: 44 },
    },
    { id: "radiator", kind: "flavor", x: 510, range: 9 },
    { id: "plant-studio", kind: "flavor", x: 524, range: 7 },
    {
      id: "balcony",
      kind: "flatdoor",
      priority: 1,
      x: 580,
      range: 22,
      to: { scene: "balcony", spawnX: 48 },
    },
    { id: "dogbowls", kind: "flavor", x: 594, range: 10 },
    { id: "dogbed", kind: "flavor", x: 630, range: 8 },
    { id: "dog", kind: "dog", priority: 2, x: 648, range: 18 },
    { id: "artbrut", kind: "flavor", x: 696, range: 10 },
    { id: "bookshelf", kind: "panel", x: 700, range: 5, data: "skills" },
    { id: "tv", kind: "tv", x: 726, range: 10 },
    { id: "ps5", kind: "flavor", x: 746, range: 6 },
    { id: "guitar", kind: "guitar", x: 774, range: 14, priority: 1 },
    { id: "laptop", kind: "computer", x: 812, range: 8 },
    { id: "phone", kind: "panel", x: 836, range: 5, data: "links" },
    { id: "sofa", kind: "sport", action: "sit", x: 862, range: 10, face: -1 },
    { id: "flag", kind: "flavor", x: 872, range: 7 },
    { id: "sidetable", kind: "flavor", x: 904, range: 10 },
  ],
  Component: ({ world, phase }) => <StudioScene world={world} phase={phase} />,
  darkness: (phase, world) => roomDarkness(phase as DayPhase, world.lights.studio),
  Effects: StudioEffects,
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
        {/* the shoe bench, now up against the camera by the front door */}
        {px(14, 152, 62, 6, "#8f7450")}
        {px(14, 152, 62, 2, "#c9a86e")}
        {px(14, 157, 62, 1, "#6d5738")}
        {px(18, 158, 5, 22, "#8f7450")}
        {px(18, 158, 2, 22, "#a8854f")}
        {px(67, 158, 5, 22, "#8f7450")}
        {px(67, 158, 2, 22, "#a8854f")}
        {px(18, 168, 54, 4, "#7d6544")}
        {px(18, 168, 54, 1, "#a8854f")}
        {/* the cushion on the seat, and the shoes on the shelf under it */}
        {px(24, 148, 40, 5, "#8a6a76")}
        {px(24, 148, 40, 1, "#a5808e")}
        {px(63, 148, 1, 5, "#6d5260")}
        {px(24, 158, 16, 9, "#4a3a2b")}
        {px(24, 158, 16, 2, "#63503d")}
        {px(44, 159, 14, 8, "#2f2921")}
        {px(44, 159, 14, 2, "#463d33")}
        {px(26, 172, 15, 7, "#6d5f52")}
        {px(26, 172, 15, 2, "#87786a")}
        {px(46, 173, 14, 6, "#6d5f52")}
        {px(12, 178, 66, 2, "#00000033")}
        {/* the pouf */}
        {px(700, 158, 46, 22, "#8a6a76")}
        {px(700, 158, 46, 2, "#a5808e")}
        {px(745, 158, 1, 22, "#6d5260")}
        {px(700, 174, 46, 4, "#6a4f5b")}
        {px(700, 178, 46, 2, "#523c47")}
        {px(706, 162, 34, 2, "#7a5c68")}
        {px(698, 178, 50, 2, "#00000033")}
        {/* the basket of toys */}
        {px(556, 162, 34, 18, "#c9a878")}
        {px(556, 162, 34, 2, "#dcc096")}
        {px(589, 162, 1, 18, "#a5875a")}
        {px(560, 166, 26, 2, "#b09468")}
        {px(562, 170, 10, 7, "#c94040")}
        {px(562, 170, 10, 1, "#e05a50")}
        {px(574, 171, 8, 6, "#4a90d9")}
        {px(592, 174, 9, 6, "#e8c445")}
        {px(554, 179, 38, 1, "#00000033")}
        {/* the near chair */}
        {px(150, 164, 40, 16, "#6d5842")}
        {px(150, 164, 40, 3, "#8a6a4a")}
        {px(189, 164, 1, 16, "#54432f")}
        {px(154, 176, 6, 4, "#4a3a2b")}
        {px(180, 176, 6, 4, "#4a3a2b")}
        {/* the reveals at both ends of the room */}
        {px(0, 0, 6, 180, "#b5ae9e")}
        {px(5, 0, 1, 180, "#8f8878")}
        {px(914, 0, 6, 180, "#b09468")}
        {px(914, 0, 1, 180, "#c9a878")}
      </g>
    </svg>
  ),
};
