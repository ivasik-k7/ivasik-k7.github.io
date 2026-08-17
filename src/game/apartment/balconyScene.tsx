import { LayeredScene, px, type SceneDef, stripes } from "@/engine";
import type { WorldState } from "@/lib/worldState";

/**
 * The balcony — a concrete shelf on the fourth floor. Third pass.
 *
 * Three planes, and the parallax is the point:
 *   middleBackground (0.72) — everything BEHIND the wall: the flat seen through
 *     the glass, the neighbour's balcony through the missing plank.
 *   ground (1.0) — the wall plane: render, frames, glass, fixtures, laundry
 *     line, slab. Every hitbox lives here.
 *   Foreground (fixed) — the parapet, the flower box, the rail lights. Raised
 *     twelve pixels this pass: the cap now sits at y136 rather than y150, which
 *     is where a 1.1 m parapet actually crosses a person's shin, and it gives
 *     the shot a proper near edge to sit behind.
 *
 * The day is back, and it is the whole lighting model. A balcony has an
 * overhang, so the sun can only reach the back wall when it is low: at dawn a
 * warm band lands high on the render, at dusk a deep orange one lands low, at
 * midday the overhang blocks it and only the outer slab burns while the wall
 * sits in bounce. At night none of it, and the wall lamp, the rail lights and
 * the flat's own windows take over. Everything else follows — the render tone,
 * the glass, the shadows, the laundry on the line, the moths, the cat.
 *
 * Edge light is the house standard now: every solid box is drawn through
 * <Bevel>, one lit pixel along its top and left, one shaded along bottom and
 * right. Five tones per material, five texture patterns over the flats.
 */

const W = 310;

/** Five-tone materials: highlight, base, mid, shade, deep shade. */
const M = {
  render: { hi: "#e2d8c6", base: "#cfc4ae", mid: "#c2b7a1", lo: "#b8ad97", deep: "#9a9078" },
  concrete: { hi: "#b6b3ab", base: "#9d9a92", mid: "#918e86", lo: "#8b8880", deep: "#6f6c66" },
  wood: { hi: "#a8804f", base: "#8a623f", mid: "#7d5836", lo: "#6b4a2f", deep: "#513622" },
  steel: { hi: "#c8ccd2", base: "#8a8d92", mid: "#7d8085", lo: "#6d7278", deep: "#4f5358" },
  frame: { hi: "#a4aab0", base: "#8a8d92", mid: "#7d8085", lo: "#6d7278", deep: "#54585d" },
  leaf: { hi: "#6d9668", base: "#4e6b4e", mid: "#456045", lo: "#3a523c", deep: "#2c3f2e" },
  linen: { hi: "#f6f2e6", base: "#e8e2d2", mid: "#dad3c0", lo: "#c6bfa9", deep: "#a49d88" },
  tin: { hi: "#e2e6ea", base: "#b6bcc2", mid: "#a0a6ac", lo: "#868c92", deep: "#63686d" },
};

const K = {
  renderDamp: "#a89e8a",
  renderPatch: "#c2b7a1",
  rust: "#8a6a4a",
  rustHi: "#a3805c",
  glassNight: "#232a34",
  glassDusk: "#c08a63",
  glassDawn: "#b9b3c6",
  glassDay: "#8fa8b8",
  marigold: "#e8a445",
  marigoldHi: "#f2bd63",
  cream: "#f2ede0",
  warm: "#ffd98a",
  shadow: "#00000038",
  shadowSoft: "#0000001c",
};

type Ph = "dawn" | "day" | "dusk" | "night";

function toPhase(phase?: string): Ph {
  if (phase === "night") return "night";
  if (phase === "dusk") return "dusk";
  if (phase === "dawn" || phase === "morning") return "dawn";
  return "day";
}

/** lights.balcony and the balcony flags may not exist yet — read defensively. */
function state(world: WorldState) {
  const lights = world.lights as unknown as Record<string, boolean | undefined>;
  const b = ((world as unknown as Record<string, unknown>).balcony ?? {}) as Record<
    string,
    boolean | undefined
  >;
  return {
    railLit: !!lights.balcony,
    watered: !!b.watered,
    smoked: !!b.smoked,
    flowersWatered: !!b.flowersWatered,
    bikeCovered: !!b.bikeCovered,
  };
}

/* ================================================================== *
 * texture + shading
 * ================================================================== */

function Defs() {
  return (
    <defs>
      <pattern id="bc-grain" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect x="0" y="1" width="1" height="1" fill="#fffaf0" opacity="0.07" />
        <rect x="3" y="4" width="1" height="1" fill="#000000" opacity="0.07" />
      </pattern>
      <pattern id="bc-stucco" width="5" height="5" patternUnits="userSpaceOnUse">
        <rect x="0" y="2" width="1" height="1" fill="#000000" opacity="0.06" />
        <rect x="3" y="0" width="1" height="1" fill="#ffffff" opacity="0.08" />
        <rect x="2" y="3" width="1" height="1" fill="#ffffff" opacity="0.04" />
      </pattern>
      <pattern id="bc-agg" width="7" height="7" patternUnits="userSpaceOnUse">
        <rect x="1" y="1" width="1" height="1" fill="#ffffff" opacity="0.1" />
        <rect x="4" y="3" width="2" height="1" fill="#000000" opacity="0.07" />
        <rect x="2" y="5" width="1" height="1" fill="#ffffff" opacity="0.06" />
      </pattern>
      <pattern id="bc-wood" width="9" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="9" height="1" fill="#000000" opacity="0.07" />
        <rect x="3" y="2" width="4" height="1" fill="#ffffff" opacity="0.05" />
      </pattern>
      <pattern id="bc-weave" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="2" height="2" fill="#ffffff" opacity="0.06" />
        <rect x="2" y="2" width="2" height="2" fill="#000000" opacity="0.06" />
      </pattern>
      <radialGradient id="bc-lamp" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.55" />
        <stop offset="50%" stopColor="#ffc878" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#ffb860" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="bc-room" cx="0.5" cy="0.4" r="0.6">
        <stop offset="0%" stopColor="#ffcf8a" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#ffcf8a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="bc-bulb" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="bc-ceilfall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5c5344" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#5c5344" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="bc-sheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.04" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="bc-sunband" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff0c8" stopOpacity="0" />
        <stop offset="35%" stopColor="#ffe6a8" stopOpacity="0.34" />
        <stop offset="100%" stopColor="#ffd08a" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="bc-duskband" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffb87a" stopOpacity="0" />
        <stop offset="40%" stopColor="#ff9a52" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#e8763a" stopOpacity="0.06" />
      </linearGradient>
      <radialGradient id="bc-vig" cx="0.5" cy="0.46" r="0.78">
        <stop offset="55%" stopColor="#0d1016" stopOpacity="0" />
        <stop offset="100%" stopColor="#0d1016" stopOpacity="0.34" />
      </radialGradient>
      <linearGradient id="bc-topfall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0d1016" stopOpacity="0.32" />
        <stop offset="100%" stopColor="#0d1016" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

type Mat = { hi: string; base: string; mid: string; lo: string; deep: string };

/** The house standard: one lit pixel top-left, one shaded bottom-right. */
function Bevel({ x, y, w, h, mat }: { x: number; y: number; w: number; h: number; mat: Mat }) {
  return (
    <g>
      {px(x, y, w, h, mat.base)}
      {px(x, y, w, 1, mat.hi)}
      {px(x, y + 1, 1, h - 1, mat.mid)}
      {px(x + w - 1, y, 1, h, mat.lo)}
      {px(x, y + h - 1, w, 1, mat.deep)}
    </g>
  );
}

function AO({
  x,
  y,
  w,
  h,
  op = 0.24,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  op?: number;
}) {
  const n = Math.min(h, 5);
  return (
    <g>
      {Array.from({ length: n }, (_, i) =>
        px(x, y + i, w, 1, `rgba(0,0,0,${(op * (1 - i / n)).toFixed(3)})`, `ao${i}`),
      )}
    </g>
  );
}

function Contact({ x, w, y = 148, op = 0.34 }: { x: number; w: number; y?: number; op?: number }) {
  return (
    <g>
      {px(x, y, w, 2, `rgba(0,0,0,${op})`)}
      {px(x - 1, y + 2, w + 2, 1, `rgba(0,0,0,${(op * 0.5).toFixed(2)})`)}
    </g>
  );
}

/* ================================================================== *
 * PLANE 1 — behind the wall (parallax 0.72)
 * drawn wider than the openings so it never runs dry when it slides
 * ================================================================== */

function FlatInterior({ world, ph }: { world: WorldState; ph: Ph }) {
  const night = ph === "night" || ph === "dusk";
  const lit = world.lights.studio;
  const dark = night && !lit;
  const wall = dark ? "#2b2620" : lit ? "#c9a878" : ph === "dusk" ? "#b08a62" : "#8a7a62";
  const wallLo = dark ? "#221e19" : lit ? "#b08c5e" : "#75664f";
  const floor = dark ? "#241f19" : "#8a5a3a";
  return (
    <g>
      {/* ---- the living room, through the terrace door ---- */}
      {px(6, 40, 104, 112, dark ? "#1d1a16" : wall)}
      {px(6, 40, 104, 26, wallLo)}
      <rect x={6} y={40} width={104} height={112} fill="url(#bc-grain)" />
      {px(6, 118, 104, 34, floor)}
      {px(6, 118, 104, 2, dark ? "#2f2921" : "#9a6a46")}
      <AO x={6} y={118} w={104} h={4} op={0.24} />
      {lit ? (
        <>
          <ellipse cx={62} cy={72} rx={46} ry={36} fill="url(#bc-room)" />
          {px(62, 40, 1, 18, "#4a4438")}
          {px(56, 58, 14, 8, K.warm)}
          {px(56, 58, 14, 1, "#ffeec0")}
          {px(58, 66, 10, 2, "#ffe6b0")}
        </>
      ) : null}
      {/* bookshelf against the far wall */}
      {px(10, 74, 22, 44, dark ? "#241f19" : "#6b4a2f")}
      {px(10, 74, 22, 1, dark ? "#2f2921" : "#8a623f")}
      {[78, 90, 102].map((y) => px(12, y, 18, 2, dark ? "#2f2921" : "#8a623f", `sh${y}`))}
      {!dark
        ? [12, 16, 19, 23, 26].map((x, i) => (
            <g key={`bk${x}`}>
              {px(
                x,
                80 - (i % 2),
                3,
                9 + (i % 3),
                ["#7a3a3a", "#3f5b7a", "#6b6a4a", "#8a6d2f", "#4a5a3a"][i],
              )}
              {px(x, 80 - (i % 2), 3, 1, "#ffffff33")}
            </g>
          ))
        : null}
      {/* sofa, back to the glass, and the cat that owns it */}
      {px(20, 96, 40, 22, dark ? "#3a3630" : "#6d7278")}
      {px(20, 92, 40, 6, dark ? "#464038" : "#7d828a")}
      {px(20, 92, 40, 1, dark ? "#514a41" : "#8d939b")}
      {px(24, 88, 12, 6, dark ? "#464038" : "#7d828a")}
      {px(44, 86, 10, 8, dark ? "#3f3a34" : "#5f646a")}
      <g>
        {px(46, 82, 9, 6, dark ? "#2f3238" : "#3a3f47")}
        {px(46, 79, 2, 3, dark ? "#2f3238" : "#3a3f47")}
        {px(51, 79, 2, 3, dark ? "#2f3238" : "#3a3f47")}
        {px(47, 83, 1, 1, "#c9cdd4")}
        {px(52, 83, 1, 1, "#c9cdd4")}
        <rect x={55} y={84} width={5} height={2} fill={dark ? "#2f3238" : "#3a3f47"}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 55 85;-14 55 85;6 55 85;0 55 85"
            dur="5.6s"
            repeatCount="indefinite"
          />
        </rect>
      </g>
      {/* the TV, throwing its light on the floor */}
      {px(74, 84, 20, 14, "#22201e")}
      {px(74, 84, 20, 1, "#3a3630")}
      {world.tv !== "off" ? (
        <>
          <rect x={76} y={86} width={16} height={10} fill="#9fc7d6" opacity={0.75}>
            <animate
              attributeName="opacity"
              values="0.75;0.4;0.7;0.45;0.75"
              dur="1.8s"
              repeatCount="indefinite"
            />
          </rect>
          <rect x={68} y={112} width={32} height={8} fill="#9fc7d6" opacity={0.18}>
            <animate
              attributeName="opacity"
              values="0.18;0.08;0.16;0.1;0.18"
              dur="1.8s"
              repeatCount="indefinite"
            />
          </rect>
        </>
      ) : (
        px(76, 86, 16, 10, "#31343a")
      )}
      {px(72, 98, 24, 4, dark ? "#2f2921" : "#5d4a37")}
      {/* the dark hallway beyond — depth inside depth */}
      {px(96, 62, 14, 56, dark ? "#141210" : "#3a3128")}
      {px(96, 62, 2, 56, dark ? "#1c1917" : "#4a4034")}
      {px(28, 126, 46, 10, dark ? "#2b2620" : "#7e6f74")}
      {px(28, 126, 46, 1, dark ? "#332d26" : "#8f7f84")}
      {px(32, 128, 38, 2, dark ? "#332d26" : "#a8968c")}
      {/* ---- the bedroom, through the smaller window ---- */}
      {px(140, 46, 74, 60, world.lights.study ? "#8a7250" : "#2b2620")}
      {px(140, 46, 74, 16, world.lights.study ? "#75603f" : "#221e19")}
      <rect x={140} y={46} width={74} height={60} fill="url(#bc-grain)" />
      {world.lights.study ? (
        <>
          <ellipse cx={168} cy={70} rx={28} ry={22} fill="url(#bc-room)" />
          {px(160, 62, 12, 8, K.warm)}
          {px(160, 62, 12, 1, "#ffeec0")}
          {px(163, 70, 6, 2, "#ffe6b0")}
        </>
      ) : null}
      {px(186, 74, 26, 32, world.lights.study ? "#6b4a2f" : "#241f19")}
      {px(186, 74, 26, 2, world.lights.study ? "#8a623f" : "#2f2921")}
      {px(144, 86, 22, 20, world.lights.study ? "#7a8f9f" : "#26221d")}
      {px(144, 86, 22, 3, world.lights.study ? "#8ba2b3" : "#2d2823")}
      {/* ---- the neighbour's balcony, through the missing plank ---- */}
      {px(286, 58, 34, 44, night ? "#2a2a30" : "#8f8a80")}
      {px(286, 58, 34, 1, night ? "#3a3a42" : "#a09a90")}
      {px(286, 88, 34, 14, night ? "#22222a" : "#7a766d")}
      <Bevel
        x={290}
        y={66}
        w={8}
        h={18}
        mat={{
          hi: night ? "#4a4a55" : "#c25a48",
          base: night ? "#3a3a44" : "#b04a3a",
          mid: night ? "#33333c" : "#a04434",
          lo: night ? "#2c2c34" : "#8f3c2e",
          deep: night ? "#242429" : "#743024",
        }}
      />
      <Bevel
        x={300}
        y={62}
        w={10}
        h={22}
        mat={{
          hi: night ? "#3d3d47" : "#8a623f",
          base: night ? "#33333c" : "#6b4a2f",
          mid: night ? "#2d2d35" : "#5f4229",
          lo: night ? "#28282f" : "#513622",
          deep: night ? "#212127" : "#3d281a",
        }}
      />
      {night ? (
        <g>
          {px(302, 58, 6, 6, "#ffcf7a")}
          <rect x={300} y={56} width={10} height={10} fill="#ffcf7a" opacity={0.2}>
            <animate
              attributeName="opacity"
              values="0.2;0.28;0.2"
              dur="6s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : null}
      {px(288, 56, 20, 2, night ? "#3a3a44" : "#a8a49a")}
      {px(292, 58, 5, 9, night ? "#44444e" : M.linen.base)}
      {px(292, 58, 5, 1, night ? "#50505a" : M.linen.hi)}
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — the wall plane (parallax 1). Hitboxes live here.
 * ================================================================== */

function Facade({ world, ph, lampOn }: { world: WorldState; ph: Ph; lampOn: boolean }) {
  const night = ph === "night";
  const dark = night || ph === "dusk";
  const glass =
    ph === "night"
      ? K.glassNight
      : ph === "dusk"
        ? K.glassDusk
        : ph === "dawn"
          ? K.glassDawn
          : K.glassDay;
  const laundryOut = ph === "day" || ph === "dawn";
  const half = ph === "dusk";
  return (
    <g>
      <Defs />
      {/* ---- wall, drawn around the openings so the room shows through ---- */}
      {px(0, 0, W, 48, M.render.base)}
      {stripes(W, 0, 48, 70, M.render.mid, 0)}
      {px(0, 48, 22, 98, M.render.base)}
      {px(92, 48, 62, 98, M.render.base)}
      {px(200, 48, 110, 98, M.render.base)}
      {px(154, 48, 46, 10, M.render.base)}
      {px(154, 96, 46, 50, M.render.base)}
      <rect x={0} y={0} width={W} height={150} fill="url(#bc-stucco)" />
      {[4, 14, 100, 118, 136, 208, 224, 250, 274].map((x) => (
        <g key={`st${x}`}>
          {px(x, 48, 3, 98, M.render.mid)}
          {px(x, 48, 1, 98, M.render.hi)}
        </g>
      ))}
      {px(0, 146, W, 4, M.render.lo)}
      {px(0, 146, W, 1, M.render.mid)}
      {px(0, 40, W, 3, M.render.lo)}
      {px(0, 40, W, 1, M.render.hi)}
      {/* the ceiling of the balcony above, and the shade it throws */}
      {px(0, 0, W, 14, "#a89d87")}
      {px(0, 0, W, 1, "#b8ad97")}
      {px(0, 12, W, 2, "#8f8570")}
      <rect x={0} y={14} width={W} height={22} fill="url(#bc-ceilfall)" />
      {/* the rolled awning nobody has let down since 2019 */}
      {px(28, 14, 96, 7, "#7a5a48")}
      {px(28, 14, 96, 1, "#8f6b57")}
      {px(28, 20, 96, 1, "#5f4638")}
      {[34, 60, 88, 114].map((x) => px(x, 21, 3, 3, M.steel.lo, `aw${x}`))}
      {/* swallows' nest wedged in the corner of the eave */}
      {px(228, 12, 18, 9, "#8a7a62")}
      {px(228, 12, 18, 1, "#a3927a")}
      {px(232, 14, 10, 4, "#6b5f4c")}
      <AO x={232} y={14} w={10} h={2} op={0.4} />
      {!night ? (
        <g>
          {px(234, 11, 3, 3, "#2f3238")}
          {px(239, 11, 3, 3, "#2f3238")}
          {px(234, 11, 3, 1, "#464a52")}
        </g>
      ) : null}
      {/* damage the building has stopped apologising for */}
      {px(126, 60, 1, 26, M.render.lo)}
      {px(127, 60, 1, 26, M.render.hi)}
      {px(127, 86, 1, 14, M.render.lo)}
      {px(124, 74, 3, 1, M.render.lo)}
      {px(238, 56, 22, 20, K.renderPatch)}
      {px(238, 56, 22, 1, "#d2c7b1")}
      {px(259, 56, 1, 20, M.render.lo)}
      {px(0, 128, 20, 18, K.renderDamp)}
      {px(0, 128, 14, 8, "#9c9280")}
      {px(276, 120, 14, 26, K.renderDamp)}
      {px(222, 50, 4, 22, K.rust)}
      {px(222, 50, 1, 22, K.rustHi)}
      {px(226, 50, 2, 14, "#9a7a58")}
      <rect x={0} y={0} width={W} height={150} fill="url(#bc-grain)" />

      {/* ---- the glass door back into the living room ---- */}
      <Bevel x={16} y={42} w={82} h={108} mat={M.frame} />
      {px(18, 44, 78, 106, M.frame.mid)}
      <AO x={18} y={44} w={78} h={4} op={0.28} />
      <rect x={22} y={48} width={70} height={98} fill={glass} opacity={dark ? 0.62 : 0.34} />
      <polygon points="26,146 60,48 78,48 44,146" fill="url(#bc-sheen)" />
      {px(54, 48, 4, 98, M.frame.base)}
      {px(54, 48, 1, 98, M.frame.hi)}
      {px(57, 48, 1, 98, M.frame.deep)}
      {px(22, 96, 70, 2, M.frame.base)}
      {px(22, 96, 70, 1, M.frame.hi)}
      {/* tape over a crack, and a sticker somebody's kid put there */}
      {px(28, 118, 18, 2, "#d8d3b8")}
      {px(30, 108, 1, 12, "#c8ccd2")}
      {px(74, 122, 7, 7, "#d9832f")}
      {px(74, 122, 7, 1, "#eda152")}
      {px(76, 124, 3, 3, K.cream)}
      {/* тюль on the inside of the glass */}
      <g opacity={0.44}>
        {px(24, 48, 11, 96, "#f4f0e4")}
        {px(24, 48, 3, 96, "#fbf8ee")}
        {px(80, 48, 11, 96, "#f4f0e4")}
        {px(35, 48, 3, 60, "#f4f0e4")}
      </g>
      {/* condensation at night, low in the panes */}
      {night ? (
        <g opacity={0.3}>
          {px(24, 128, 28, 16, "#cfe0ea")}
          {px(60, 132, 30, 12, "#cfe0ea")}
        </g>
      ) : null}
      {px(88, 92, 3, 12, M.steel.hi)}
      {px(88, 92, 3, 2, "#e2e6ea")}
      {px(87, 104, 5, 1, "#00000044")}
      {px(16, 148, 84, 3, K.shadow)}
      {/* doormat */}
      {px(20, 150, 34, 9, "#6b5f4c")}
      {px(20, 150, 34, 1, "#87786a")}
      {[24, 30, 36, 42, 48].map((x) => px(x, 152, 2, 6, "#5a5040", `mt${x}`))}
      {/* boots by the door, one fallen over */}
      {px(2, 138, 13, 10, "#4a3a2b")}
      {px(2, 138, 13, 1, "#63503d")}
      {px(2, 147, 13, 1, "#2f2921")}
      {px(4, 132, 9, 7, "#3f3226")}
      {px(14, 142, 12, 6, "#4a3a2b")}
      {px(14, 142, 12, 1, "#63503d")}

      {/* ---- the bedroom window further along ---- */}
      <Bevel x={148} y={50} w={58} h={52} mat={M.frame} />
      {px(150, 52, 54, 48, M.frame.mid)}
      <AO x={150} y={52} w={54} h={4} op={0.28} />
      <rect x={154} y={56} width={46} height={40} fill={glass} opacity={dark ? 0.6 : 0.36} />
      <polygon points="156,96 176,56 186,56 166,96" fill="url(#bc-sheen)" />
      {px(176, 56, 3, 40, M.frame.base)}
      {px(176, 56, 1, 40, M.frame.hi)}
      {px(154, 74, 46, 1, M.frame.base)}
      {px(196, 76, 3, 8, M.steel.hi)}
      {px(148, 100, 58, 4, "#dcd9d0")}
      {px(148, 100, 58, 1, "#eceae2")}
      {px(148, 103, 58, 1, "#b8b5ac")}
      <AO x={149} y={104} w={56} h={4} op={0.28} />
      {px(184, 96, 12, 5, M.wood.base)}
      {px(184, 96, 12, 1, M.wood.hi)}
      {px(186, 92, 3, 5, M.leaf.hi)}
      {px(190, 91, 3, 6, M.leaf.base)}

      {/* ---- wall lamp, moths in season ---- */}
      {px(114, 54, 4, 4, M.steel.base)}
      {px(110, 58, 12, 3, M.steel.lo)}
      {px(110, 58, 12, 1, M.steel.base)}
      {px(111, 61, 10, 7, lampOn ? K.warm : "#c9c4b6")}
      {px(111, 61, 10, 1, lampOn ? "#fff0c4" : "#d8d3c5")}
      {px(112, 68, 8, 2, lampOn ? "#ffe6b0" : "#b0aba0")}
      {lampOn ? (
        <>
          <ellipse cx={116} cy={70} rx={34} ry={26} fill="url(#bc-lamp)">
            <animate attributeName="rx" values="34;36;34" dur="6.5s" repeatCount="indefinite" />
          </ellipse>
          {[
            { x: 104, y: 60, d: "2.7s", r: 9 },
            { x: 126, y: 66, d: "3.4s", r: 7 },
            { x: 118, y: 52, d: "2.2s", r: 6 },
          ].map((m) => (
            <rect key={m.x} x={m.x} y={m.y} width={2} height={2} fill="#e8dfc0" opacity={0.85}>
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`0 0; ${m.r} -${m.r / 2}; -${m.r / 2} ${m.r}; ${m.r / 3} ${m.r / 3}; 0 0`}
                dur={m.d}
                repeatCount="indefinite"
              />
            </rect>
          ))}
        </>
      ) : null}
      {/* the switch, by the door where your hand already goes */}
      <Bevel
        x={102}
        y={88}
        w={8}
        h={11}
        mat={{ hi: "#f2efe4", base: "#e2ded2", mid: "#d4d0c4", lo: "#c2beb2", deep: "#a09c92" }}
      />
      {px(104, 91, 4, 5, lampOn ? "#c9a24b" : "#8f8a7c")}
      {px(104, 91, 4, 1, lampOn ? "#e6c479" : "#9c978a")}

      {/* ---- AC unit, conduit, and the drip it has never fixed ---- */}
      <Bevel
        x={220}
        y={32}
        w={30}
        h={18}
        mat={{ hi: "#d8d3c6", base: "#c9c4b6", mid: "#bcb7a9", lo: "#aca79a", deep: "#8d887c" }}
      />
      {px(222, 34, 26, 12, "#b0aba0")}
      {[224, 228, 232, 236, 240, 244].map((x) => (
        <g key={`ac${x}`}>
          {px(x, 35, 2, 10, "#a09b90")}
          {px(x, 35, 1, 10, "#bab5aa")}
        </g>
      ))}
      <AO x={222} y={50} w={26} h={3} op={0.3} />
      {px(248, 38, 8, 2, M.steel.lo)}
      {px(254, 38, 2, 30, "#6b6558")}
      {px(254, 38, 1, 30, "#837c6c")}
      {px(254, 68, 12, 2, "#6b6558")}
      {px(232, 50, 2, 6, M.steel.base)}
      <rect x={232} y={56} width={2} height={3} fill="#a8c2d4" opacity={0.8}>
        <animate attributeName="y" values="56;140" dur="3.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.9;0" dur="3.2s" repeatCount="indefinite" />
      </rect>
      {/* the satellite dish nobody has watched since the fibre came */}
      {px(266, 70, 3, 14, M.steel.lo)}
      {px(258, 66, 13, 13, "#d8d5cc")}
      {px(258, 66, 13, 1, "#eceae2")}
      {px(260, 68, 9, 9, "#bcb9b0")}
      {px(263, 78, 2, 5, M.steel.lo)}

      {/* ---- drainpipe with its brackets ---- */}
      {px(262, 0, 7, 150, M.render.lo)}
      {px(262, 0, 2, 150, M.render.mid)}
      {px(268, 0, 1, 150, M.render.deep)}
      {px(260, 60, 11, 4, M.wood.base)}
      {px(260, 112, 11, 4, M.wood.base)}
      {px(263, 64, 5, 10, K.rust)}
      {px(264, 120, 4, 20, "#a08a6a")}

      {/* ---- the neighbour's divider, one plank gone ---- */}
      {px(288, 18, 18, 132, "#b5ae9e")}
      {px(288, 18, 3, 132, "#c8c1b1")}
      {px(304, 18, 2, 132, "#a29b8c")}
      <rect x={288} y={18} width={18} height={132} fill="url(#bc-wood)" />
      {[30, 50, 70, 100, 120, 140].map((y) => (
        <g key={`dv${y}`}>
          {px(288, y, 18, 1, "#a29b8c")}
          {px(288, y + 1, 18, 1, "#c2bbab")}
        </g>
      ))}
      {px(288, 76, 18, 2, "#9c9486")}
      {px(288, 92, 18, 2, "#9c9486")}

      {/* ---- electrics and the house number ---- */}
      <Bevel
        x={272}
        y={54}
        w={12}
        h={14}
        mat={{ hi: "#d8d3c6", base: "#c9c4b6", mid: "#bcb7a9", lo: "#aca79a", deep: "#8d887c" }}
      />
      {px(273, 55, 10, 12, "#b0aba0")}
      {px(276, 68, 2, 16, "#6b6558")}
      {px(276, 84, 8, 2, "#6b6558")}
      <Bevel
        x={230}
        y={108}
        w={14}
        h={10}
        mat={{ hi: "#5f7095", base: "#4a5a7a", mid: "#42506d", lo: "#39465f", deep: "#2b3549" }}
      />
      {px(232, 110, 3, 6, K.cream)}
      {px(236, 110, 3, 6, K.cream)}

      {/* ---- laundry line: out by day, empty pegs after dark ---- */}
      <path d="M 8 30 Q 150 41 302 27" stroke="#3a3b3a" strokeWidth="1" fill="none" />
      {[60, 80, 104, 130, 174, 196].map((x, i) => (
        <g key={`pg${x}`}>
          {px(x, 32 + (i % 3), 3, 4, ["#c94040", "#4a90d9", "#e8c445"][i % 3])}
          {px(x, 32 + (i % 3), 3, 1, ["#e05a50", "#6aaced", "#f2d86a"][i % 3])}
        </g>
      ))}
      {laundryOut ? (
        <g>
          <g>
            {px(82, 34, 22, 28, "#7c8ba3")}
            {px(82, 34, 22, 2, "#93a2ba")}
            {px(103, 36, 1, 26, "#65738a")}
            <rect x={82} y={34} width={22} height={28} fill="url(#bc-weave)" />
            {px(84, 48, 18, 1, "#6d7c94")}
            {px(82, 60, 22, 3, "#6d7c94")}
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="-2 93 34;2.4 93 34;-1 93 34;-2 93 34"
              dur="4.6s"
              repeatCount="indefinite"
            />
          </g>
          <g>
            {px(158, 36, 18, 22, M.linen.base)}
            {px(158, 36, 18, 2, M.linen.hi)}
            {px(175, 38, 1, 20, M.linen.lo)}
            <rect x={158} y={36} width={18} height={22} fill="url(#bc-weave)" />
            {px(154, 38, 5, 12, M.linen.base)}
            {px(175, 38, 5, 12, M.linen.base)}
            {px(160, 58, 5, 7, M.linen.base)}
            {px(169, 58, 5, 7, M.linen.base)}
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="2 166 36;-2.6 166 36;1 166 36;2 166 36"
              dur="5.4s"
              repeatCount="indefinite"
            />
          </g>
        </g>
      ) : null}
      {laundryOut || half ? (
        <g>
          {px(128, 36, 8, 12, "#c94040")}
          {px(136, 36, 8, 12, "#c94040")}
          {px(128, 36, 16, 2, "#e05a50")}
          {px(143, 38, 1, 10, "#9a2f2a")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-1.5 132 36;2 132 36;-1.5 132 36"
            dur="3.9s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
      {/* a pigeon that has decided this is its line now */}
      {!night ? (
        <g>
          {px(200, 26, 11, 7, "#6d7278")}
          {px(200, 26, 11, 2, "#8d939b")}
          {px(210, 23, 5, 5, "#5d6266")}
          {px(210, 23, 5, 1, "#767c82")}
          {px(213, 24, 2, 1, "#c9a24b")}
          {px(212, 25, 1, 1, "#e8e6e0")}
          {px(202, 33, 1, 3, "#c9a24b")}
          {px(206, 33, 1, 3, "#c9a24b")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 205 30;0 205 30;-3 205 30;0 205 30;2 205 30;0 205 30"
            dur="7.5s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}

      {/* ---- the slab underfoot ---- */}
      {px(0, 150, W, 30, M.concrete.base)}
      {stripes(W, 150, 30, 52, M.concrete.mid, 26)}
      <rect x={0} y={150} width={W} height={30} fill="url(#bc-agg)" />
      {px(0, 150, W, 2, "#00000026")}
      <AO x={0} y={150} w={W} h={5} op={0.3} />
      {px(0, 164, W, 1, M.concrete.lo)}
      {px(0, 165, W, 1, M.concrete.hi)}
      {[112, 238].map((x) => px(x, 150, 1, 14, M.concrete.lo, `sj${x}`))}
      {px(60, 170, 26, 1, M.concrete.lo)}
      {px(196, 156, 12, 3, "#7a8f9f")}
      {px(120, 160, 8, 2, "#8a6a56")}
      {px(266, 168, 6, 2, "#7a8f9f")}
      {/* floor drain, and the puddle that never quite goes */}
      {px(148, 168, 12, 6, "#7f7d76")}
      {px(148, 168, 12, 1, "#93918a")}
      {[149, 152, 155, 158].map((x) => px(x, 169, 1, 4, "#5f5d57", `dr${x}`))}
      <ellipse
        cx={168}
        cy={172}
        rx={16}
        ry={5}
        fill={dark ? "#2f3a46" : "#8aa2b0"}
        opacity={0.45}
      />
      <ellipse cx={168} cy={171} rx={9} ry={2} fill={dark ? "#5d7a8a" : "#bcd2e0"} opacity={0.35} />
      {px(96, 166, 2, 2, "#4a4438")}
      {px(102, 172, 2, 2, "#4a4438")}
      {px(200, 152, 22, 3, "#6b5540")}
      {px(206, 155, 10, 2, "#5c4838")}
      {px(0, 150, W, 6, K.shadowSoft)}
      {world.tv !== "off" && dark ? (
        <rect x={22} y={150} width={70} height={12} fill="#9fc7d6" opacity={0.1}>
          <animate
            attributeName="opacity"
            values="0.1;0.04;0.09;0.05;0.1"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </rect>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * props on the slab
 * ================================================================== */

function Props({
  ph,
  lampOn,
  s,
}: {
  ph: Ph;
  lampOn: boolean;
  s: { watered: boolean; smoked: boolean; bikeCovered: boolean };
}) {
  const night = ph === "night";
  const rackOut = ph === "day" || ph === "dawn";
  return (
    <g>
      <Defs />
      {/* ---- stool with the tin-can ashtray, lighter, cold mug ---- */}
      <Contact x={56} w={28} />
      {px(58, 128, 24, 4, M.wood.base)}
      {px(58, 128, 24, 1, M.wood.hi)}
      {px(58, 131, 24, 1, M.wood.deep)}
      <rect x={58} y={128} width={24} height={4} fill="url(#bc-wood)" />
      <AO x={58} y={132} w={24} h={3} op={0.3} />
      {px(60, 132, 3, 16, M.wood.lo)}
      {px(60, 132, 1, 16, M.wood.base)}
      {px(77, 132, 3, 16, M.wood.lo)}
      {px(61, 140, 18, 2, M.wood.lo)}
      <Bevel x={64} y={120} w={9} h={8} mat={M.tin} />
      {px(65, 122, 7, 2, "#9aa0a8")}
      {px(66, 118, 2, 3, K.cream)}
      {px(69, 119, 2, 2, "#d9d3c2")}
      {s.smoked ? (
        <g>
          {px(63, 117, 2, 3, K.cream)}
          {px(71, 118, 2, 2, "#d9d3c2")}
          {px(88, 146, 3, 1, K.cream)}
        </g>
      ) : null}
      {px(s.smoked ? 78 : 74, 124, 4, 4, "#c94040")}
      {px(s.smoked ? 78 : 74, 124, 4, 1, "#e05a50")}
      <Bevel
        x={52}
        y={122}
        w={8}
        h={8}
        mat={{ hi: "#5f8f9e", base: "#3f6b7a", mid: "#38606d", lo: "#2f545f", deep: "#22404a" }}
      />
      {px(60, 124, 2, 4, "#3f6b7a")}
      {/* ---- watering can and the hose that never coils right ---- */}
      <Contact x={96} w={22} />
      <Bevel
        x={98}
        y={132}
        w={16}
        h={16}
        mat={{ hi: "#7d9c88", base: "#5d7a6a", mid: "#526d5f", lo: "#465e52", deep: "#35473e" }}
      />
      {px(114, 134, 6, 3, "#5d7a6a")}
      {px(118, 130, 4, 5, "#5d7a6a")}
      {px(100, 126, 3, 7, "#4e6b5c")}
      {px(100, 126, 12, 2, "#4e6b5c")}
      {px(100, 126, 12, 1, "#658474")}
      {s.watered ? (
        <g>
          {px(116, 137, 3, 2, "#a8c2d4")}
          <ellipse cx={120} cy={148} rx={9} ry={2} fill="#8aa2b0" opacity={0.4} />
        </g>
      ) : null}
      {px(122, 160, 16, 4, "#3f5b4a")}
      {px(122, 160, 16, 1, "#517059")}
      {px(126, 164, 12, 4, "#4a6b56")}
      {px(124, 158, 4, 3, "#3f5b4a")}
      {/* ---- the folding drying rack, out while the sun is ---- */}
      {rackOut ? (
        <g>
          <Contact x={128} w={48} op={0.26} />
          {px(128, 106, 2, 42, M.steel.base)}
          {px(128, 106, 1, 42, M.steel.hi)}
          {px(174, 106, 2, 42, M.steel.base)}
          {px(174, 106, 1, 42, M.steel.hi)}
          {[110, 118, 126, 134].map((y) => (
            <g key={`rk${y}`}>
              {px(130, y, 44, 1, M.steel.base)}
              {px(130, y + 1, 44, 1, M.steel.deep)}
            </g>
          ))}
          {/* socks and a tea towel over the bars */}
          {px(134, 108, 6, 9, M.linen.base)}
          {px(134, 108, 6, 1, M.linen.hi)}
          {px(142, 108, 6, 9, "#7c8ba3")}
          {px(142, 108, 6, 1, "#93a2ba")}
          {px(152, 116, 14, 12, "#c94040")}
          {px(152, 116, 14, 1, "#e05a50")}
          {px(165, 118, 1, 10, "#9a2f2a")}
          <rect x={152} y={116} width={14} height={12} fill="url(#bc-weave)" />
          {px(132, 132, 10, 8, M.linen.mid)}
          {px(132, 132, 10, 1, M.linen.hi)}
          {px(130, 146, 44, 2, M.steel.lo)}
        </g>
      ) : (
        <g>
          {/* folded flat against the wall for the night */}
          <Contact x={128} w={12} op={0.22} />
          {px(128, 100, 10, 48, M.steel.base)}
          {px(128, 100, 3, 48, M.steel.hi)}
          {px(137, 100, 1, 48, M.steel.deep)}
          {px(130, 112, 6, 1, M.steel.lo)}
          {px(130, 124, 6, 1, M.steel.lo)}
        </g>
      )}
      {/* ---- seedling boxes, labelled on lolly sticks ---- */}
      <Contact x={198} w={40} />
      {px(200, 134, 36, 14, M.wood.base)}
      {px(200, 134, 36, 1, M.wood.hi)}
      {px(235, 134, 1, 14, M.wood.deep)}
      <rect x={200} y={134} width={36} height={14} fill="url(#bc-wood)" />
      {px(200, 138, 36, 1, M.wood.lo)}
      {px(202, 136, 32, 2, s.watered ? "#3a2c1e" : "#4a3a2b")}
      {[
        { x: 204, y: 126, h: 9, tone: s.watered ? M.leaf.hi : M.leaf.base },
        { x: 212, y: 122, h: 13, tone: s.watered ? "#7fae76" : M.leaf.hi },
        { x: 220, y: 127, h: 8, tone: s.watered ? M.leaf.hi : M.leaf.base },
        { x: 228, y: 123, h: 12, tone: s.watered ? "#7fae76" : M.leaf.hi },
      ].map((sp) => (
        <g key={`sp${sp.x}`}>
          {px(sp.x, sp.y, 4, sp.h, sp.tone)}
          {px(sp.x, sp.y, 2, sp.h, "#7fae76")}
          {px(sp.x - 1, sp.y - 3, 6, 3, M.leaf.base)}
          {px(sp.x - 1, sp.y - 3, 3, 1, M.leaf.hi)}
        </g>
      ))}
      {!s.watered ? px(234, 129, 3, 6, "#7a7a4a") : px(234, 127, 3, 8, M.leaf.hi)}
      {px(206, 128, 2, 8, K.cream)}
      {px(205, 126, 4, 3, K.cream)}
      {px(224, 130, 2, 6, K.cream)}
      {s.watered ? [206, 216, 226].map((x) => px(x, 133, 1, 1, "#bfe0f5", `wd${x}`)) : null}
      {px(216, 144, 8, 4, M.wood.lo)}
      {px(240, 142, 5, 6, M.steel.base)}
      {px(240, 142, 5, 1, M.steel.hi)}
      {px(242, 136, 2, 7, M.wood.lo)}
      {/* the bag of soil, slumped against the boxes */}
      {px(238, 128, 14, 20, "#5d4a37")}
      {px(238, 128, 14, 1, "#75604a")}
      {px(251, 130, 1, 18, "#43362a")}
      {px(240, 132, 10, 5, "#8a7a52")}
      {/* ---- the broom, leaning where it always leans ---- */}
      {px(194, 96, 3, 52, M.wood.base)}
      {px(194, 96, 1, 52, M.wood.hi)}
      {px(192, 140, 8, 8, "#c9a24b")}
      {px(192, 140, 8, 1, "#dfb865")}
      {[193, 195, 197, 199].map((x) => px(x, 146, 1, 3, "#a3803a", `br${x}`))}
      <Contact x={191} w={10} op={0.22} />
      {/* ---- crate of empty jars, newspaper packed between ---- */}
      <Contact x={238} w={32} />
      {px(240, 126, 28, 22, M.wood.base)}
      {px(240, 126, 28, 1, M.wood.hi)}
      {px(267, 126, 1, 22, M.wood.deep)}
      <rect x={240} y={126} width={28} height={22} fill="url(#bc-wood)" />
      {px(240, 136, 28, 1, M.wood.lo)}
      {[244, 252, 260].map((x) => px(x, 130, 2, 16, M.wood.lo, `cr${x}`))}
      {[
        { x: 242, y: 120, w: 8, h: 8 },
        { x: 252, y: 119, w: 8, h: 9 },
        { x: 262, y: 121, w: 6, h: 7 },
      ].map((j) => (
        <g key={`jr${j.x}`}>
          {px(j.x, j.y, j.w, j.h, "#aebfc9")}
          {px(j.x, j.y, j.w, 2, "#cddce4")}
          {px(j.x + j.w - 1, j.y, 1, j.h, "#8fa0ab")}
          {px(j.x + 1, j.y - 2, j.w - 2, 2, "#b0a692")}
        </g>
      ))}
      {px(240, 144, 28, 3, "#d8d3c2")}
      {/* ---- skis and poles, cobwebbed into the corner ---- */}
      <Contact x={176} w={18} op={0.26} />
      {[178, 184].map((x, i) => (
        <g key={`sk${x}`}>
          {px(x, 62 + i * -2, 5, 86 + i * 2, "#c94040")}
          {px(x, 62 + i * -2, 2, 86 + i * 2, "#e05a50")}
          {px(x + 4, 62 + i * -2, 1, 86 + i * 2, "#9a2f2a")}
          {px(x, 62 + i * -2, 5, 2, K.cream)}
          {px(x, 98 + i * 2, 5, 6, "#2f3238")}
        </g>
      ))}
      {px(190, 76, 2, 72, M.steel.base)}
      {px(190, 76, 1, 72, M.steel.hi)}
      {px(188, 78, 6, 2, M.steel.lo)}
      {px(189, 140, 5, 4, M.steel.lo)}
      <g opacity={0.4}>
        {px(174, 64, 6, 1, K.cream)}
        {px(174, 64, 1, 8, K.cream)}
        {px(175, 70, 5, 1, K.cream)}
      </g>
      {/* ---- the bicycle, wintering with dignity ---- */}
      <Contact x={256} w={50} />
      {[260, 282].map((wx) => (
        <g key={`wh${wx}`}>
          {px(wx, 124, 20, 20, "#22201e")}
          {px(wx, 124, 20, 1, "#3a3630")}
          {px(wx + 2, 126, 16, 16, "#3a3630")}
          {px(wx + 5, 129, 10, 10, "#5d6266")}
          {px(wx + 5, 129, 10, 1, "#767c82")}
          {px(wx + 8, 132, 4, 4, M.steel.base)}
        </g>
      ))}
      {px(270, 116, 24, 8, "#7a3b35")}
      {px(270, 116, 24, 1, "#9c4f48")}
      {px(293, 117, 1, 7, "#5d2b26")}
      {px(272, 124, 2, 14, "#7a3b35")}
      {px(288, 122, 2, 12, "#7a3b35")}
      {px(266, 112, 10, 4, "#22201e")}
      {px(266, 112, 10, 1, "#3a3630")}
      {px(292, 108, 7, 4, "#22201e")}
      {px(294, 104, 3, 5, M.steel.base)}
      {px(276, 138, 12, 2, "#4a4438")}
      {px(258, 136, 4, 10, M.steel.base)}
      {px(296, 118, 8, 6, M.wood.lo)}
      {px(296, 118, 8, 1, M.wood.base)}
      {/* the dust sheet: pulled right over, or half off */}
      {s.bikeCovered ? (
        <g>
          {px(256, 106, 50, 38, "#b8bcc2")}
          {px(256, 106, 50, 2, "#d2d6dc")}
          {px(305, 108, 1, 36, "#93979d")}
          {px(268, 108, 1, 34, "#a4a8ae")}
          {px(288, 110, 1, 32, "#a4a8ae")}
          <rect x={256} y={106} width={50} height={38} fill="url(#bc-weave)" />
        </g>
      ) : (
        <g>
          {px(280, 118, 24, 14, "#b8bcc2")}
          {px(280, 118, 24, 2, "#d2d6dc")}
          {px(303, 120, 1, 12, "#93979d")}
          {px(298, 132, 8, 6, "#a8acb2")}
        </g>
      )}
      {/* ---- folded chair leaning by the door ---- */}
      <Contact x={100} w={14} op={0.26} />
      {px(102, 96, 10, 52, M.steel.lo)}
      {px(102, 96, 3, 52, M.steel.hi)}
      {px(111, 96, 1, 52, M.steel.deep)}
      {px(104, 104, 6, 34, M.steel.mid)}
      {px(103, 138, 8, 3, "#4a4e52")}
      {/* the warm pool the wall lamp lays on the concrete */}
      {lampOn ? (
        <ellipse cx={116} cy={158} rx={54} ry={14} fill="url(#bc-lamp)" opacity={0.6} />
      ) : null}
      {!night ? (
        <>
          {px(0, 156, W, 2, K.shadowSoft)}
          {[24, 94, 164, 234, 300].map((x) => px(x, 150, 3, 8, K.shadowSoft, `rs${x}`))}
        </>
      ) : null}
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — foreground: parapet, box, rail lights. Raised 12px.
 * ================================================================== */

function BalconyFront({ world, phase }: { world?: WorldState; phase?: string }) {
  const ph = toPhase(phase);
  const night = ph === "night";
  const s = world ? state(world) : { railLit: false, flowersWatered: false };
  const lit = s.railLit;
  const bulbs = [14, 38, 62, 86, 110, 134, 158, 182, 206, 230, 254, 278, 300];
  const RAIL = 136;
  const CAP = 146;
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} 180`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0"
    >
      <Defs />
      <g shapeRendering="crispEdges">
        {/* the underside of the balcony above, framing the top of the shot */}
        <rect x={0} y={0} width={W} height={11} fill="url(#bc-topfall)" />
        {/* a pot hanging from it, close enough to be nearly out of frame */}
        {px(10, 0, 1, 12, "#4a4438")}
        {px(26, 0, 1, 12, "#4a4438")}
        {px(8, 12, 20, 12, M.wood.base)}
        {px(8, 12, 20, 2, M.wood.hi)}
        {px(27, 14, 1, 10, M.wood.deep)}
        {px(10, 24, 16, 3, M.wood.lo)}
        {px(12, 6, 4, 7, "#3f5b4a")}
        {px(18, 4, 4, 9, "#4e6b5c")}
        {px(18, 4, 2, 9, "#658474")}
        {px(22, 8, 5, 5, "#3f5b4a")}
        {px(14, 24, 2, 10, "#4e6b5c")}
        {px(20, 24, 2, 14, "#3f5b4a")}
        {px(19, 38, 4, 3, "#4e6b5c")}

        {/* ---- steel rail, now at chest-of-a-parapet height ---- */}
        {px(0, RAIL, W, 4, M.steel.lo)}
        {px(0, RAIL, W, 1, M.steel.hi)}
        {px(0, RAIL + 3, W, 1, "#43474b")}
        {[20, 90, 160, 230, 296].map((x) => (
          <g key={`p${x}`}>
            {px(x, RAIL + 4, 3, 8, M.steel.lo)}
            {px(x, RAIL + 4, 1, 8, M.steel.base)}
            {px(x - 1, RAIL + 10, 5, 2, K.rust)}
          </g>
        ))}
        {/* string lights looped along the rail */}
        <path
          d={`M 4 ${RAIL + 2} Q 40 ${RAIL + 14} 76 ${RAIL + 2} Q 112 ${RAIL + 14} 148 ${RAIL + 2} Q 184 ${RAIL + 14} 220 ${RAIL + 2} Q 256 ${RAIL + 14} 292 ${RAIL + 2} L 308 ${RAIL + 6}`}
          stroke="#3a3b3a"
          strokeWidth="1"
          fill="none"
        />
        {bulbs.map((x, i) => {
          const y = RAIL + (i % 2 === 0 ? 8 : 11);
          return (
            <g key={`b${x}`}>
              {lit ? (
                <circle cx={x + 1} cy={y + 1} r={7} fill="url(#bc-bulb)">
                  <animate
                    attributeName="opacity"
                    values="0.85;1;0.78;0.95;0.85"
                    dur={`${3.2 + (i % 4) * 0.7}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ) : null}
              {px(x, y, 3, 3, lit ? "#ffe6b0" : "#b8b4a8")}
              {px(x, y, 3, 1, lit ? "#fff4d4" : "#c8c4b8")}
            </g>
          );
        })}

        {/* ---- concrete parapet ---- */}
        {px(0, CAP, W, 34, M.concrete.base)}
        {px(0, CAP, W, 2, M.concrete.hi)}
        {px(0, CAP + 2, W, 1, "#adaaa2")}
        {stripes(W, CAP, 34, 62, M.concrete.mid, 30)}
        <rect x={0} y={CAP} width={W} height={34} fill="url(#bc-agg)" />
        {px(0, 174, W, 4, M.concrete.lo)}
        {px(0, 178, W, 2, M.concrete.deep)}
        {/* paint peeling in flakes, rust bleeding from the posts */}
        {px(36, CAP + 6, 18, 6, "#b8b5ad")}
        {px(36, CAP + 6, 18, 1, "#c6c3bb")}
        {px(212, CAP + 10, 22, 5, "#b8b5ad")}
        {px(88, CAP + 4, 6, 10, "#9a7a58")}
        {px(228, CAP + 4, 5, 8, "#9a7a58")}
        {px(140, CAP + 14, 30, 1, M.concrete.lo)}

        {/* ---- flower box on the rail ---- */}
        {px(102, 130, 56, 14, M.wood.base)}
        {px(102, 130, 56, 2, M.wood.hi)}
        {px(157, 132, 1, 12, M.wood.deep)}
        <rect x={102} y={130} width={56} height={14} fill="url(#bc-wood)" />
        {px(102, 136, 56, 1, M.wood.lo)}
        {px(104, 142, 52, 2, M.wood.lo)}
        {px(106, 132, 48, 3, s.flowersWatered ? "#2f4a30" : "#3d573d")}
        {px(106, 126, 46, 5, "#4a6b4a")}
        {px(106, 126, 46, 1, "#5d8159")}
        {[
          { x: 106, y: 122, c: K.marigold },
          { x: 118, y: 119, c: K.marigoldHi },
          { x: 130, y: 122, c: "#d9832f" },
          { x: 142, y: 120, c: K.marigold },
          { x: 148, y: 124, c: "#d9832f" },
        ].map((f) => (
          <g key={`f${f.x}`}>
            {px(f.x, f.y, 8, 7, s.flowersWatered ? K.marigoldHi : f.c)}
            {px(f.x, f.y, 8, 1, "#f6d189")}
            {px(f.x + 2, f.y + 2, 4, 3, "#b8641f")}
            {px(f.x + 3, f.y + 7, 2, 6, "#3d573d")}
          </g>
        ))}
        {px(112, 124, 3, 8, "#4a6b4a")}
        {px(136, 123, 3, 9, "#4a6b4a")}
        {s.flowersWatered ? (
          <g>
            {px(110, 144, 4, 1, "#6b5540")}
            {px(132, 144, 5, 1, "#6b5540")}
          </g>
        ) : null}
        {/* a bee doing its rounds, when there's sun to do them in */}
        {ph === "day" || ph === "dawn" ? (
          <g>
            {px(124, 114, 3, 2, "#e8c445")}
            {px(125, 113, 1, 1, "#2f3238")}
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 0; 14 -6; 26 4; 8 8; -6 -4; 0 0"
              dur="9s"
              repeatCount="indefinite"
            />
          </g>
        ) : null}
        {/* ivy that got up here on its own */}
        {px(268, CAP - 2, 2, 32, "#3f5b4a")}
        {px(266, CAP + 2, 5, 4, "#4e6b5c")}
        {px(270, CAP + 8, 5, 4, "#3f5b4a")}
        {px(264, CAP + 14, 5, 4, "#4e6b5c")}
        {px(270, CAP + 20, 5, 4, "#3f5b4a")}
        {px(272, 128, 4, 8, "#4e6b5c")}
        {px(272, 128, 2, 8, "#658474")}
        {/* the mug somebody left on the rail an hour ago */}
        {px(186, 128, 10, 10, "#3f6b7a")}
        {px(186, 128, 10, 2, "#5f8f9e")}
        {px(195, 130, 1, 8, "#2f545f")}
        {px(188, 130, 6, 2, "#2c4a55")}
        {px(196, 131, 3, 5, "#3f6b7a")}
        {/* peg cord and two pegs, very close to the lens */}
        {px(0, 118, 3, 2, "#3a3b3a")}
        {px(2, 119, 2, 5, "#c94040")}
        {px(2, 125, 2, 5, "#4a90d9")}
        {/* the stray that shows up when it's quiet */}
        <g>
          {px(226, 124, 22, 12, "#4a4438")}
          {px(226, 124, 22, 2, "#5d5648")}
          {px(247, 126, 1, 10, "#332f26")}
          {px(244, 118, 10, 9, "#4a4438")}
          {px(244, 118, 10, 1, "#5d5648")}
          {px(245, 115, 3, 4, "#4a4438")}
          {px(251, 115, 3, 4, "#4a4438")}
          {px(246, 121, 2, 1, night ? "#c9a24b" : "#8fa86a")}
          {px(250, 121, 2, 1, night ? "#c9a24b" : "#8fa86a")}
          {px(248, 123, 2, 1, "#b98b86")}
          {px(228, 136, 4, 6, "#4a4438")}
          {px(240, 136, 4, 6, "#4a4438")}
          <g>
            {px(220, 122, 7, 3, "#4a4438")}
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 227 123; -18 227 123; 8 227 123; -6 227 123; 0 227 123"
              dur="6.4s"
              repeatCount="indefinite"
            />
          </g>
        </g>
        {/* near vignette, so the eye sits in the middle of the shelf */}
        <rect x={0} y={0} width={W} height={180} fill="url(#bc-vig)" />
      </g>
    </svg>
  );
}

/* ================================================================== *
 * scene
 * ================================================================== */

function BalconyScene({ world, phase }: { world: WorldState; phase: string }) {
  const ph = toPhase(phase);
  const s = state(world);
  const lampOn = s.railLit || ((ph === "night" || ph === "dusk") && world.lights.studio);
  return (
    <LayeredScene
      /* the room behind the glass sits ~2m back; it should lag the wall */
      parallax={{ middleBackground: 0.72 }}
      middleBackground={
        <g>
          <Defs />
          <FlatInterior world={world} ph={ph} />
        </g>
      }
      ground={<Facade world={world} ph={ph} lampOn={lampOn} />}
      staticObjects={<Props ph={ph} lampOn={lampOn} s={s} />}
      gameplayObjects={<g>{/* hitboxes only */}</g>}
    />
  );
}

/* ================================================================== *
 * effects — the day, and what each hour does to a balcony
 * ================================================================== */

function Steam({ x, y, scale, slow }: { x: number; y: number; scale: number; slow?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: x * scale, top: y * scale, opacity: slow ? 0.55 : 1 }}
    >
      <div className="steam" style={{ width: 3 * scale, height: 3 * scale }} />
      <div
        className="steam steam-2"
        style={{ width: 2 * scale, height: 2 * scale, marginLeft: 4 * scale }}
      />
    </div>
  );
}

function BalconyEffects({
  world,
  phase,
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
  const night = ph === "night";
  return (
    <>
      {actionUi === "smoke" ? <Steam x={116} y={86} scale={scale} /> : null}
      {!night ? <Steam x={188} y={126} scale={scale} slow /> : null}
      {night || ph === "dusk" ? <Steam x={236} y={44} scale={scale} slow /> : null}
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} 180`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <defs>
          <linearGradient id="bfx-dawn" x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#ffe0b0" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#ffd08a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bfx-dusk" x1="0.9" y1="0" x2="0.1" y2="1">
            <stop offset="0%" stopColor="#ff9a52" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#e8763a" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="bfx-vig" cx="0.5" cy="0.45" r="0.8">
            <stop offset="60%" stopColor="#0b1014" stopOpacity="0" />
            <stop offset="100%" stopColor="#0b1014" stopOpacity="0.24" />
          </radialGradient>
        </defs>
        {/* dawn: the sun is low enough to get under the overhang and up the wall */}
        {ph === "dawn" ? (
          <g>
            <polygon points="0,52 310,38 310,104 0,118" fill="url(#bfx-dawn)" />
            {[40, 120, 210, 280].map((x) => (
              <rect
                key={`ds${x}`}
                x={x}
                y={52}
                width={5}
                height={62}
                fill="#6b4a24"
                opacity={0.1}
              />
            ))}
            <rect x={0} y={0} width={W} height={180} fill="#ffdcb0" opacity={0.07} />
          </g>
        ) : null}
        {/* day: the overhang keeps it off the wall; only the outer slab burns */}
        {ph === "day" ? (
          <g>
            <rect x={0} y={150} width={W} height={12} fill="#fff2d0" opacity={0.16} />
            <rect x={0} y={138} width={W} height={10} fill="#fff2d0" opacity={0.1} />
            <rect x={0} y={0} width={W} height={180} fill="#fff6e0" opacity={0.05} />
          </g>
        ) : null}
        {/* dusk: low and orange, and it reaches all the way to the back wall */}
        {ph === "dusk" ? (
          <g>
            <polygon points="0,96 310,80 310,148 0,150" fill="url(#bfx-dusk)" />
            {[24, 94, 164, 234, 300].map((x) => (
              <rect
                key={`dk${x}`}
                x={x}
                y={96}
                width={6}
                height={52}
                fill="#7a3a18"
                opacity={0.14}
              />
            ))}
            <rect x={0} y={0} width={W} height={180} fill="#e8894a" opacity={0.09} />
          </g>
        ) : null}
        {/* night: the flat's own windows are the only warm thing out here */}
        {night ? (
          <g>
            <rect x={0} y={0} width={W} height={180} fill="#16233a" opacity={0.16} />
            {world.lights.studio ? (
              <>
                <ellipse cx={57} cy={110} rx={54} ry={52} fill="#ffd98a" opacity={0.12} />
                <rect x={20} y={148} width={76} height={14} fill="#ffd98a" opacity={0.08} />
              </>
            ) : null}
            {world.lights.study ? (
              <ellipse cx={177} cy={90} rx={38} ry={34} fill="#ffd98a" opacity={0.1} />
            ) : null}
          </g>
        ) : null}
        {/* the swallows leave at dawn and come back at dusk */}
        {ph === "dawn" || ph === "dusk" ? (
          <g>
            {[0, 2.1].map((d) => (
              <g key={`sw${d}`}>
                {px(0, 20, 4, 1, "#2f3238")}
                {px(3, 19, 3, 1, "#2f3238")}
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values={
                    ph === "dawn" ? "236 0;236 0;-20 -14;-20 -14" : "-20 -14;-20 -14;236 0;236 0"
                  }
                  keyTimes="0;0.7;0.92;1"
                  dur="26s"
                  begin={`${d}s`}
                  repeatCount="indefinite"
                />
              </g>
            ))}
          </g>
        ) : null}
        <rect x={0} y={0} width={W} height={180} fill="url(#bfx-vig)" />
      </svg>
    </>
  );
}

export const BALCONY_SCENE: SceneDef<WorldState> = {
  id: "balcony",
  width: W,
  objects: [
    { id: "boots", kind: "flavor", x: 10, range: 8 },
    {
      id: "door-living3",
      kind: "flatdoor",
      priority: 1,
      x: 44,
      range: 20,
      to: { scene: "studio", spawnX: 580 },
    },
    { id: "ashtray", kind: "flavor", x: 70, range: 8 },
    { id: "smoke", kind: "sport", action: "smoke", x: 96, range: 12 },
    { id: "switch-balcony", kind: "lamp", x: 116, range: 7 },
    { id: "flowers", kind: "flavor", x: 132, range: 7 },
    { id: "call", kind: "sport", action: "call", x: 148, range: 7 },
    { id: "laundry", kind: "flavor", x: 166, range: 8 },
    { id: "skis", kind: "flavor", x: 184, range: 7 },
    { id: "broom", kind: "flavor", x: 196, range: 5 },
    { id: "seedlings", kind: "flavor", x: 216, range: 10 },
    { id: "ac-unit", kind: "flavor", x: 234, range: 8 },
    { id: "crate", kind: "flavor", x: 252, range: 8 },
    { id: "bicycle", kind: "flavor", x: 280, range: 13 },
    { id: "divider", kind: "flavor", x: 302, range: 8 },
  ],
  Component: ({ world, phase }) => <BalconyScene world={world} phase={phase} />,
  darkness: (phase, world) => {
    const lit = state(world).railLit;
    if (phase === "night") return lit ? 0.16 : 0.34;
    if (phase === "dusk") return lit ? 0.06 : 0.14;
    if (phase === "dawn") return 0.06;
    return 0;
  },
  Foreground: (p) => <BalconyFront {...p} />,
  Effects: BalconyEffects,
  idleLean: true,
};
