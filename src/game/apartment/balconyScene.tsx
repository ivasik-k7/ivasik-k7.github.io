import { LayeredScene, px, type SceneDef, stripes } from "@/engine";
import type { WorldState } from "@/lib/worldState";

/**
 * The balcony — a concrete shelf on the fourth floor.
 *
 * Three planes, and the parallax is the point:
 *   middleBackground (0.72) — everything BEHIND the wall: the flat seen through
 *     the glass, the neighbour's balcony through the missing plank. When the
 *     camera pans, the room slides inside its frame the way a real room does.
 *   ground (1.0) — the wall plane itself: render, frames, glass, fixtures,
 *     laundry line, and the slab underfoot. Every hitbox lives on this plane.
 *   Foreground (fixed) — the parapet, the flower box, the rail lights, and the
 *     things close enough to be out of focus.
 *
 * At your back: your own flat, warm and lived-in. Overhead a laundry line and a
 * swallows' nest. At your feet the seedlings, the crate, the bike that winters
 * here. Somebody's radio through the divider.
 */

const W = 310;

const K = {
  render: "#cfc4ae",
  renderHi: "#ddd3c0",
  renderLo: "#b8ad97",
  renderDamp: "#a89e8a",
  renderPatch: "#c2b7a1",
  rust: "#8a6a4a",
  frame: "#8a8d92",
  frameHi: "#9aa0a8",
  frameLo: "#6d7278",
  glassNight: "#232a34",
  glassDay: "#8fa8b8",
  concrete: "#9d9a92",
  concreteHi: "#adaaa2",
  concreteLo: "#8b8880",
  wood: "#8a623f",
  woodHi: "#a1794f",
  woodLo: "#6b4a2f",
  steel: "#8a8d92",
  steelHi: "#c8ccd2",
  steelLo: "#5d6266",
  leaf: "#4e6b4e",
  leafHi: "#57755a",
  marigold: "#e8a445",
  marigoldHi: "#e8c445",
  linen: "#e8e2d2",
  cream: "#f2ede0",
  warm: "#ffd98a",
  shadow: "#00000038",
  shadowSoft: "#00000018",
};

function isNightish(phase?: string) {
  return phase === "night" || phase === "dusk";
}

/** lights.balcony may not exist yet in WorldState — read it defensively. */
function railLit(world: WorldState) {
  const lights = world.lights as unknown as Record<string, boolean | undefined>;
  return lights.balcony ?? false;
}

/* ================================================================== *
 * defs
 * ================================================================== */

function SceneDefs() {
  return (
    <defs>
      <radialGradient id="bc-lamp" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.55" />
        <stop offset="50%" stopColor="#ffc878" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#ffb860" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="bc-room" cx="0.5" cy="0.4" r="0.6">
        <stop offset="0%" stopColor="#ffcf8a" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#ffcf8a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="bc-ceilfall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#5c5344" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#5c5344" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="bc-sheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.03" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="bc-vig" cx="0.5" cy="0.46" r="0.78">
        <stop offset="55%" stopColor="#0d1016" stopOpacity="0" />
        <stop offset="100%" stopColor="#0d1016" stopOpacity="0.34" />
      </radialGradient>
      <pattern id="bc-grain" width="6" height="6" patternUnits="userSpaceOnUse">
        <rect x="0" y="1" width="1" height="1" fill="#fffaf0" opacity="0.07" />
        <rect x="3" y="4" width="1" height="1" fill="#000000" opacity="0.07" />
      </pattern>
    </defs>
  );
}

/* ================================================================== *
 * PLANE 1 — behind the wall (parallax 0.72)
 * art is drawn wider than the openings so it never runs dry when it slides
 * ================================================================== */

function FlatInterior({ world, night }: { world: WorldState; night: boolean }) {
  const lit = world.lights.studio;
  const dark = night && !lit;
  const wall = dark ? "#2b2620" : lit ? "#c9a878" : "#8a7a62";
  const wallLo = dark ? "#221e19" : lit ? "#b08c5e" : "#75664f";
  const floor = dark ? "#241f19" : "#8a5a3a";

  return (
    <g>
      {/* ---- the living room, seen through the terrace door ---- */}
      {px(6, 40, 104, 112, dark ? "#1d1a16" : wall)}
      {px(6, 40, 104, 26, wallLo)}
      {px(6, 118, 104, 34, floor)}
      {px(6, 118, 104, 2, dark ? "#2f2921" : "#9a6a46")}
      {lit ? (
        <>
          <ellipse cx={62} cy={72} rx={44} ry={34} fill="url(#bc-room)" />
          {/* pendant on its flex */}
          {px(62, 40, 1, 18, "#4a4438")}
          {px(56, 58, 14, 8, K.warm)}
          {px(58, 66, 10, 2, "#ffe6b0")}
        </>
      ) : null}
      {/* bookshelf against the far wall */}
      {px(10, 74, 22, 44, dark ? "#241f19" : "#6b4a2f")}
      {[78, 90, 102].map((y) => px(12, y, 18, 2, dark ? "#2f2921" : "#8a623f", `sh${y}`))}
      {!dark
        ? [12, 16, 19, 23, 26].map((x, i) =>
            px(
              x,
              80 - (i % 2),
              3,
              9 + (i % 3),
              ["#7a3a3a", "#3f5b7a", "#6b6a4a", "#8a6d2f", "#4a5a3a"][i],
              `bk${x}`,
            ),
          )
        : null}
      {/* sofa, back to the glass, and the cat that owns it */}
      {px(20, 96, 40, 22, dark ? "#3a3630" : "#6d7278")}
      {px(20, 92, 40, 6, dark ? "#464038" : "#7d828a")}
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
      {/* rug */}
      {px(28, 126, 46, 10, dark ? "#2b2620" : "#7e6f74")}
      {px(32, 128, 38, 2, dark ? "#332d26" : "#a8968c")}
      {/* ---- the bedroom, seen through the smaller window ---- */}
      {px(140, 46, 74, 60, world.lights.study ? "#8a7250" : "#2b2620")}
      {px(140, 46, 74, 16, world.lights.study ? "#75603f" : "#221e19")}
      {world.lights.study ? (
        <>
          <ellipse cx={168} cy={70} rx={26} ry={20} fill="url(#bc-room)" />
          {px(160, 62, 12, 8, K.warm)}
          {px(163, 70, 6, 2, "#ffe6b0")}
        </>
      ) : null}
      {px(186, 74, 26, 32, world.lights.study ? "#6b4a2f" : "#241f19")}
      {px(186, 74, 26, 2, world.lights.study ? "#8a623f" : "#2f2921")}
      {px(144, 86, 22, 20, world.lights.study ? "#7a8f9f" : "#26221d")}
      {px(144, 86, 22, 3, world.lights.study ? "#8ba2b3" : "#2d2823")}
      {/* ---- the neighbour's balcony, through the missing plank ---- */}
      {px(286, 60, 34, 40, night ? "#2a2a30" : "#8f8a80")}
      {px(286, 88, 34, 12, night ? "#22222a" : "#7a766d")}
      {px(290, 66, 8, 18, night ? "#3a3a44" : "#b04a3a")} {/* red bucket */}
      {px(290, 66, 8, 2, night ? "#4a4a55" : "#c25a48")}
      {px(300, 62, 10, 22, night ? "#33333c" : "#6b4a2f")} {/* their chair */}
      {px(300, 70, 10, 2, night ? "#3d3d47" : "#8a623f")}
      {night ? px(302, 60, 6, 6, "#ffcf7a") : null}
      {px(288, 58, 20, 2, night ? "#3a3a44" : "#a8a49a")}
      {px(292, 60, 5, 9, night ? "#44444e" : K.linen)} {/* their washing */}
    </g>
  );
}

/* ================================================================== *
 * PLANE 2 — the wall plane (parallax 1). Hitboxes live here.
 * ================================================================== */

function Facade({ world, night, lampOn }: { world: WorldState; night: boolean; lampOn: boolean }) {
  const glass = night ? K.glassNight : K.glassDay;
  return (
    <g>
      {/* ---- wall, drawn around the openings so the room shows through ---- */}
      {px(0, 0, W, 48, K.render)}
      {stripes(W, 0, 48, 70, "#c4baa4", 0)}
      {px(0, 48, 22, 98, K.render)}
      {px(92, 48, 62, 98, K.render)}
      {px(200, 48, 110, 98, K.render)}
      {px(154, 48, 46, 10, K.render)}
      {px(154, 96, 46, 50, K.render)}
      {px(0, 146, W, 4, K.renderLo)}
      {/* hand-placed roller streaks on the wall pieces */}
      {[4, 14, 100, 118, 136, 208, 224, 250, 274].map((x) => px(x, 48, 3, 98, "#c4baa4", `st${x}`))}
      {px(0, 40, W, 3, "#b0a692")}
      {px(0, 40, W, 1, "#bdb39d")}
      {/* the ceiling of the balcony above */}
      {px(0, 0, W, 14, "#a89d87")}
      {px(0, 12, W, 2, "#94897410")}
      <rect x={0} y={14} width={W} height={20} fill="url(#bc-ceilfall)" />
      {/* swallows' nest wedged in the corner of the eave */}
      {px(228, 12, 18, 9, "#8a7a62")}
      {px(228, 12, 18, 2, "#9a8a70")}
      {px(232, 14, 10, 4, "#6b5f4c")}
      {px(234, 11, 3, 3, "#2f3238")}
      {px(239, 11, 3, 3, "#2f3238")}
      {/* damage the building has stopped apologising for */}
      {px(126, 60, 1, 26, K.renderLo)}
      {px(127, 86, 1, 14, K.renderLo)}
      {px(124, 74, 3, 1, K.renderLo)}
      {px(238, 56, 22, 20, K.renderPatch)}
      {px(238, 56, 22, 1, "#cdc2ac")}
      {px(0, 128, 20, 18, K.renderDamp)}
      {px(0, 128, 14, 8, "#9c9280")}
      {px(276, 120, 14, 26, K.renderDamp)}
      {px(222, 50, 4, 22, K.rust)}
      {px(226, 50, 2, 14, "#9a7a58")}
      <rect x={0} y={0} width={W} height={150} fill="url(#bc-grain)" />
      {/* ---- the glass door back into the living room ---- */}
      {px(16, 42, 82, 108, K.frameLo)}
      {px(18, 44, 78, 106, K.frame)}
      {px(18, 44, 78, 2, K.frameHi)}
      {px(18, 44, 2, 106, K.frameHi)}
      <rect x={22} y={48} width={70} height={98} fill={glass} opacity={night ? 0.62 : 0.34} />
      <polygon points="26,146 60,48 78,48 44,146" fill="url(#bc-sheen)" />
      {px(54, 48, 4, 98, K.frame)}
      {px(54, 48, 1, 98, K.frameHi)}
      {px(22, 96, 70, 2, K.frame)}
      {/* tape over a crack in the lower pane, and a sticker somebody's kid put there */}
      {px(28, 118, 18, 2, "#d8d3b8")}
      {px(30, 108, 1, 12, "#c8ccd2")}
      {px(74, 122, 7, 7, "#d9832f")}
      {px(76, 124, 3, 3, "#f2ede0")}
      {/* тюль on the inside of the glass */}
      <g opacity={0.42}>
        {px(24, 48, 11, 96, "#f4f0e4")}
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
      {px(88, 92, 3, 12, K.steelHi)}
      {px(88, 92, 3, 2, "#e2e6ea")}
      {px(16, 148, 84, 3, K.shadow)}
      {/* doormat */}
      {px(20, 152, 34, 9, "#6b5f4c")}
      {px(20, 152, 34, 2, "#7d7060")}
      {[24, 30, 36, 42, 48].map((x) => px(x, 154, 2, 6, "#5a5040", `mt${x}`))}
      {/* ---- the bedroom window further along ---- */}
      {px(148, 50, 58, 52, K.frameLo)}
      {px(150, 52, 54, 48, K.frame)}
      {px(150, 52, 54, 2, K.frameHi)}
      <rect x={154} y={56} width={46} height={40} fill={glass} opacity={night ? 0.6 : 0.36} />
      <polygon points="156,96 176,56 186,56 166,96" fill="url(#bc-sheen)" />
      {px(176, 56, 3, 40, K.frame)}
      {px(154, 74, 46, 1, K.frame)}
      {px(196, 76, 3, 8, K.steelHi)}
      {px(148, 100, 58, 4, "#d8d5cc")}
      {px(148, 100, 58, 1, "#e6e3da")}
      {px(149, 104, 56, 2, K.shadow)}
      {px(184, 96, 12, 5, "#8a5a3a")} {/* a pot left on the inner sill */}
      {px(186, 92, 3, 5, K.leafHi)}
      {/* ---- wall lamp, moths in season ---- */}
      {px(114, 54, 4, 4, K.steel)}
      {px(110, 58, 12, 3, K.steelLo)}
      {px(111, 61, 10, 7, lampOn ? K.warm : "#c9c4b6")}
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
      {px(102, 88, 8, 11, "#e2ded2")}
      {px(104, 91, 4, 5, lampOn ? "#c9a24b" : "#8f8a7c")}
      {/* ---- AC unit, conduit, and the drip it has never fixed ---- */}
      {px(220, 32, 30, 18, "#c9c4b6")}
      {px(220, 32, 30, 2, "#d6d1c4")}
      {px(222, 34, 26, 12, "#b0aba0")}
      {[224, 228, 232, 236, 240, 244].map((x) => px(x, 35, 2, 10, "#a09b90", `ac${x}`))}
      {px(222, 48, 26, 2, K.shadow)}
      {px(248, 38, 8, 2, K.steelLo)}
      {px(254, 38, 2, 30, "#6b6558")}
      {px(254, 68, 12, 2, "#6b6558")}
      {px(232, 50, 2, 6, "#9aa0a8")}
      <rect x={232} y={56} width={2} height={3} fill="#a8c2d4" opacity={0.8}>
        <animate attributeName="y" values="56;140" dur="3.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.9;0" dur="3.2s" repeatCount="indefinite" />
      </rect>
      {/* ---- drainpipe with its brackets ---- */}
      {px(262, 0, 7, 150, K.renderLo)}
      {px(262, 0, 2, 150, "#c4baa4")}
      {px(260, 60, 11, 4, "#8a5a3a")}
      {px(260, 112, 11, 4, "#8a5a3a")}
      {px(263, 64, 5, 10, K.rust)}
      {px(264, 120, 4, 20, "#a08a6a")}
      {/* ---- the neighbour's divider, one plank gone ---- */}
      {px(288, 18, 18, 132, "#b5ae9e")}
      {px(288, 18, 3, 132, "#c5beae")}
      {px(288, 18, 18, 2, "#a89d87")}
      {[30, 50, 70, 100, 120, 140].map((y) => px(288, y, 18, 1, "#a29b8c", `dv${y}`))}
      {px(288, 78, 18, 14, "#00000000")} {/* the gap — the plane behind shows here */}
      {px(288, 76, 18, 2, "#9c9486")}
      {px(288, 92, 18, 2, "#9c9486")}
      {px(304, 18, 2, 132, "#a29b8c")}
      {/* ---- electrics and the house number ---- */}
      {px(272, 54, 12, 14, "#c9c4b6")}
      {px(273, 55, 10, 12, "#b0aba0")}
      {px(276, 68, 2, 16, "#6b6558")}
      {px(276, 84, 8, 2, "#6b6558")}
      {px(230, 108, 14, 10, "#4a5a7a")}
      {px(232, 110, 3, 6, K.cream)}
      {px(236, 110, 3, 6, K.cream)}
      {/* ---- laundry line ---- */}
      <path d="M 8 30 Q 150 41 302 27" stroke="#3a3b3a" strokeWidth="1" fill="none" />
      {px(60, 32, 3, 4, "#c94040")}
      {px(130, 35, 3, 4, "#4a90d9")}
      {px(196, 33, 3, 4, "#c94040")}
      {px(80, 33, 3, 4, "#4a90d9")}
      {px(104, 34, 3, 4, "#e8c445")}
      {px(174, 34, 3, 4, "#e8c445")}
      <g>
        {px(82, 34, 22, 28, "#7c8ba3")}
        {px(82, 34, 22, 2, "#8c9bb3")}
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
        {px(158, 36, 18, 22, K.linen)}
        {px(158, 36, 18, 2, K.cream)}
        {px(154, 38, 5, 12, K.linen)}
        {px(175, 38, 5, 12, K.linen)}
        {px(160, 58, 5, 7, K.linen)}
        {px(169, 58, 5, 7, K.linen)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="2 166 36;-2.6 166 36;1 166 36;2 166 36"
          dur="5.4s"
          repeatCount="indefinite"
        />
      </g>
      <g>
        {px(128, 36, 8, 12, "#c94040")}
        {px(136, 36, 8, 12, "#c94040")}
        {px(128, 36, 16, 2, "#d95a5a")}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-1.5 132 36;2 132 36;-1.5 132 36"
          dur="3.9s"
          repeatCount="indefinite"
        />
      </g>
      {/* a pigeon that has decided this is its line now */}
      <g>
        {px(200, 26, 11, 7, "#6d7278")}
        {px(200, 26, 11, 2, "#828890")}
        {px(210, 23, 5, 5, "#5d6266")}
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
      {/* ---- the slab underfoot ---- */}
      {px(0, 150, W, 30, K.concrete)}
      {px(0, 150, W, 2, "#00000026")}
      {stripes(W, 150, 30, 52, K.concreteLo, 26)}
      {px(0, 164, W, 1, K.concreteLo)}
      {px(112, 150, 1, 12, K.concreteLo)}
      {px(238, 158, 1, 14, K.concreteLo)}
      {px(60, 170, 26, 1, K.concreteLo)}
      {px(196, 156, 12, 3, "#7a8f9f")} {/* old paint spots */}
      {px(120, 160, 8, 2, "#8a6a56")}
      {px(266, 168, 6, 2, "#7a8f9f")}
      {/* floor drain, and the puddle that never quite goes */}
      {px(148, 168, 12, 6, "#7f7d76")}
      {[149, 152, 155, 158].map((x) => px(x, 169, 1, 4, "#5f5d57", `dr${x}`))}
      <ellipse
        cx={168}
        cy={172}
        rx={16}
        ry={5}
        fill={night ? "#2f3a46" : "#8aa2b0"}
        opacity={0.45}
      />
      <ellipse
        cx={168}
        cy={171}
        rx={9}
        ry={2}
        fill={night ? "#5d7a8a" : "#bcd2e0"}
        opacity={0.35}
      />
      {/* cigarette burns and soil spilled from the boxes */}
      {px(96, 166, 2, 2, "#4a4438")}
      {px(102, 172, 2, 2, "#4a4438")}
      {px(200, 152, 22, 3, "#6b5540")}
      {px(206, 155, 10, 2, "#5c4838")}
      {/* the shadow the parapet throws back into the room-side */}
      {px(0, 150, W, 6, K.shadowSoft)}
      {world.tv !== "off" && night ? (
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

function Props({ night, lampOn }: { night: boolean; lampOn: boolean }) {
  return (
    <g>
      {/* ---- stool with the tin-can ashtray, lighter, cold mug ---- */}
      {px(56, 148, 28, 3, K.shadow)}
      {px(58, 128, 24, 4, K.wood)}
      {px(58, 128, 24, 1, K.woodHi)}
      {px(60, 132, 3, 16, K.woodLo)}
      {px(77, 132, 3, 16, K.woodLo)}
      {px(61, 140, 18, 2, K.woodLo)}
      {px(64, 120, 9, 8, K.steelHi)}
      {px(64, 120, 9, 2, "#e2e6ea")}
      {px(65, 122, 7, 2, "#9aa0a8")}
      {px(66, 118, 2, 3, K.cream)}
      {px(69, 119, 2, 2, "#d9d3c2")}
      {px(74, 124, 4, 4, "#c94040")}
      {px(52, 122, 8, 8, "#3f6b7a")}
      {px(52, 122, 8, 2, "#517e8d")}
      {px(60, 124, 2, 4, "#3f6b7a")}
      {/* ---- watering can and the hose that never coils right ---- */}
      {px(96, 148, 22, 3, K.shadow)}
      {px(98, 132, 16, 16, "#5d7a6a")}
      {px(98, 132, 16, 2, "#6d8c79")}
      {px(114, 134, 6, 3, "#5d7a6a")}
      {px(118, 130, 4, 5, "#5d7a6a")}
      {px(100, 126, 3, 7, "#4e6b5c")}
      {px(100, 126, 12, 2, "#4e6b5c")}
      {px(122, 160, 16, 4, "#3f5b4a")}
      {px(126, 164, 12, 4, "#4a6b56")}
      {px(124, 158, 4, 3, "#3f5b4a")}
      {/* ---- seedling boxes, labelled on lolly sticks ---- */}
      {px(198, 148, 40, 3, K.shadow)}
      {px(200, 134, 36, 14, "#8a5a3a")}
      {px(200, 134, 36, 2, "#9a6a46")}
      {px(200, 138, 36, 1, "#7a4e32")}
      {px(202, 136, 32, 2, "#4a3a2b")}
      {px(204, 126, 4, 9, K.leaf)}
      {px(203, 123, 6, 3, K.leafHi)}
      {px(212, 123, 4, 12, K.leafHi)}
      {px(210, 120, 8, 3, K.leaf)}
      {px(220, 127, 4, 8, K.leaf)}
      {px(228, 124, 4, 11, K.leafHi)}
      {px(226, 121, 8, 3, K.leaf)}
      {px(234, 129, 3, 6, "#7a7a4a")} {/* one that didn't take */}
      {px(206, 128, 2, 8, K.cream)}
      {px(205, 126, 4, 3, K.cream)}
      {px(224, 130, 2, 6, K.cream)}
      {px(216, 144, 8, 4, "#6b4a2f")}
      {px(240, 142, 5, 6, "#8a8d92")} {/* trowel */}
      {px(242, 136, 2, 7, "#6b4a2f")}
      {/* ---- crate of empty jars, newspaper packed between ---- */}
      {px(238, 148, 32, 3, K.shadow)}
      {px(240, 126, 28, 22, K.wood)}
      {px(240, 126, 28, 2, K.woodHi)}
      {px(240, 136, 28, 1, K.woodLo)}
      {px(244, 130, 2, 16, K.woodLo)}
      {px(252, 130, 2, 16, K.woodLo)}
      {px(260, 130, 2, 16, K.woodLo)}
      {px(242, 120, 8, 8, "#aebfc9")}
      {px(242, 120, 8, 2, "#c6d5dd")}
      {px(243, 118, 6, 2, "#b0a692")}
      {px(252, 119, 8, 9, "#aebfc9")}
      {px(252, 119, 8, 2, "#c6d5dd")}
      {px(253, 117, 6, 2, "#c94040")}
      {px(262, 121, 6, 7, "#b8c6ce")}
      {px(240, 144, 28, 3, "#d8d3c2")}
      {/* ---- skis and poles, cobwebbed into the corner ---- */}
      {px(176, 146, 18, 4, K.shadow)}
      {px(178, 62, 5, 86, "#c94040")}
      {px(184, 60, 5, 88, "#c94040")}
      {px(178, 62, 5, 2, K.cream)}
      {px(184, 60, 5, 2, K.cream)}
      {px(178, 100, 5, 6, "#2f3238")}
      {px(184, 98, 5, 6, "#2f3238")}
      {px(190, 76, 2, 72, "#8a8d92")}
      {px(188, 78, 6, 2, "#6d7278")}
      {px(189, 140, 5, 4, "#5d6266")}
      <g opacity={0.4}>
        {px(174, 64, 6, 1, K.cream)}
        {px(174, 64, 1, 8, K.cream)}
        {px(175, 70, 5, 1, K.cream)}
      </g>
      {/* ---- the bicycle, wintering with dignity ---- */}
      {px(256, 148, 50, 3, K.shadow)}
      {px(260, 124, 20, 20, "#22201e")}
      {px(262, 126, 16, 16, "#3a3630")}
      {px(265, 129, 10, 10, "#5d6266")}
      {px(268, 132, 4, 4, "#8a8d92")}
      {px(282, 124, 20, 20, "#22201e")}
      {px(284, 126, 16, 16, "#3a3630")}
      {px(287, 129, 10, 10, "#5d6266")}
      {px(290, 132, 4, 4, "#8a8d92")}
      {px(270, 116, 24, 8, "#7a3b35")}
      {px(270, 116, 24, 2, "#8f4a44")}
      {px(272, 124, 2, 14, "#7a3b35")}
      {px(288, 122, 2, 12, "#7a3b35")}
      {px(266, 112, 10, 4, "#22201e")}
      {px(268, 110, 6, 2, "#3a3630")}
      {px(292, 108, 7, 4, "#22201e")}
      {px(294, 104, 3, 5, "#5d6266")}
      {px(276, 138, 12, 2, "#4a4438")}
      {px(258, 136, 4, 10, "#8a8d92")} {/* pump clipped to the frame */}
      {px(296, 118, 8, 6, "#6b4a2f")} {/* basket */}
      {px(296, 118, 8, 2, "#8a623f")}
      {/* a dust sheet half pulled off the back wheel */}
      {px(280, 118, 24, 14, "#b8bcc2")}
      {px(280, 118, 24, 2, "#c8ccd2")}
      {px(298, 132, 8, 6, "#a8acb2")}
      {/* ---- folded chair leaning by the door ---- */}
      {px(100, 148, 14, 3, K.shadow)}
      {px(102, 96, 10, 52, "#5d6266")}
      {px(102, 96, 10, 2, "#7d828a")}
      {px(104, 104, 6, 34, "#6d7278")}
      {px(103, 138, 8, 3, "#4a4e52")}
      {/* warm pool the wall lamp lays on the concrete */}
      {lampOn ? (
        <ellipse cx={116} cy={162} rx={54} ry={16} fill="url(#bc-lamp)" opacity={0.65} />
      ) : null}
      {night ? null : (
        <>
          {/* daylight throws the rail's shadow back across the slab */}
          {px(0, 156, W, 2, K.shadowSoft)}
          {[24, 94, 164, 234, 300].map((x) => px(x, 150, 3, 8, K.shadowSoft, `rs${x}`))}
        </>
      )}
    </g>
  );
}

/* ================================================================== *
 * PLANE 3 — foreground: parapet, box, rail lights, near clutter
 * ================================================================== */

function BalconyFront({ world, phase }: { world?: WorldState; phase?: string }) {
  const night = isNightish(phase);
  const lit = world ? railLit(world) : false;
  const bulbs = [14, 38, 62, 86, 110, 134, 158, 182, 206, 230, 254, 278, 300];
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} 180`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0"
    >
      <defs>
        <radialGradient id="bc-bulb" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bc-topfall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d1016" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0d1016" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g shapeRendering="crispEdges">
        {/* the underside of the balcony above, framing the top of the shot */}
        <rect x={0} y={0} width={W} height={10} fill="url(#bc-topfall)" />
        {/* a pot hanging from it, close enough to be nearly out of frame */}
        {px(10, 0, 1, 12, "#4a4438")}
        {px(26, 0, 1, 12, "#4a4438")}
        {px(8, 12, 20, 12, "#8a5a3a")}
        {px(8, 12, 20, 2, "#9a6a46")}
        {px(10, 24, 16, 3, "#7a4e32")}
        {px(12, 6, 4, 7, "#3f5b4a")}
        {px(18, 4, 4, 9, "#4e6b5c")}
        {px(22, 8, 5, 5, "#3f5b4a")}
        {px(14, 24, 2, 10, "#4e6b5c")}
        {px(20, 24, 2, 14, "#3f5b4a")}
        {px(19, 38, 4, 3, "#4e6b5c")}

        {/* ---- steel rail ---- */}
        {px(0, 150, W, 4, "#6d7278")}
        {px(0, 150, W, 1, "#9aa0a8")}
        {px(0, 154, W, 1, "#4a4e52")}
        {[20, 90, 160, 230, 296].map((x) => (
          <g key={`p${x}`}>
            {px(x, 154, 3, 8, "#6d7278")}
            {px(x, 154, 1, 8, "#8a8d92")}
            {px(x - 1, 160, 5, 2, K.rust)}
          </g>
        ))}
        {/* string lights looped along the rail */}
        <path
          d="M 4 152 Q 40 164 76 152 Q 112 164 148 152 Q 184 164 220 152 Q 256 164 292 152 L 308 156"
          stroke="#3a3b3a"
          strokeWidth="1"
          fill="none"
        />
        {bulbs.map((x, i) => {
          const y = i % 2 === 0 ? 158 : 161;
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
        {px(0, 158, W, 22, "#a5a29a")}
        {px(0, 158, W, 3, "#b5b2aa")}
        {px(0, 176, W, 4, "#8b8880")}
        {stripes(W, 158, 22, 62, "#918e86", 30)}
        {/* paint peeling off in flakes, rust bleeding from the posts */}
        {px(36, 164, 18, 6, "#b8b5ad")}
        {px(36, 164, 18, 1, "#c6c3bb")}
        {px(212, 168, 22, 5, "#b8b5ad")}
        {px(88, 162, 6, 10, "#9a7a58")}
        {px(228, 162, 5, 8, "#9a7a58")}
        {px(140, 172, 30, 1, "#8b8880")}
        {px(0, 158, W, 1, "#c2bfb7")}

        {/* ---- flower box on the rail ---- */}
        {px(102, 144, 56, 14, "#8a5a3a")}
        {px(102, 144, 56, 2, "#9a6a46")}
        {px(102, 150, 56, 1, "#7a4e32")}
        {px(104, 156, 52, 2, "#6b4a2f")}
        {px(106, 146, 48, 3, "#3d573d")}
        {px(106, 140, 46, 5, "#4a6b4a")}
        {[
          { x: 106, y: 136, c: K.marigold },
          { x: 118, y: 133, c: K.marigoldHi },
          { x: 130, y: 136, c: "#d9832f" },
          { x: 142, y: 134, c: K.marigold },
          { x: 148, y: 138, c: "#d9832f" },
        ].map((f) => (
          <g key={`f${f.x}`}>
            {px(f.x, f.y, 8, 7, f.c)}
            {px(f.x + 2, f.y + 2, 4, 3, "#b8641f")}
            {px(f.x + 3, f.y + 7, 2, 6, "#3d573d")}
          </g>
        ))}
        {px(112, 138, 3, 8, "#4a6b4a")}
        {px(136, 137, 3, 9, "#4a6b4a")}
        {/* a bee doing its rounds */}
        <g>
          {px(124, 128, 3, 2, "#e8c445")}
          {px(125, 127, 1, 1, "#2f3238")}
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 14 -6; 26 4; 8 8; -6 -4; 0 0"
            dur="9s"
            repeatCount="indefinite"
          />
        </g>
        {/* ivy that got up here on its own */}
        {px(268, 148, 2, 30, "#3f5b4a")}
        {px(266, 152, 5, 4, "#4e6b5c")}
        {px(270, 158, 5, 4, "#3f5b4a")}
        {px(264, 164, 5, 4, "#4e6b5c")}
        {px(270, 170, 5, 4, "#3f5b4a")}
        {px(272, 142, 4, 8, "#4e6b5c")}
        {/* the mug somebody left on the rail an hour ago */}
        {px(186, 142, 10, 10, "#3f6b7a")}
        {px(186, 142, 10, 2, "#517e8d")}
        {px(188, 144, 6, 2, "#2c4a55")}
        {px(196, 145, 3, 5, "#3f6b7a")}
        {/* peg cord and two pegs, very close to the lens */}
        {px(0, 130, 3, 2, "#3a3b3a")}
        {px(2, 131, 2, 5, "#c94040")}
        {px(2, 137, 2, 5, "#4a90d9")}
        {/* the stray that shows up when it's quiet */}
        <g opacity={night ? 1 : 0.95}>
          {px(226, 138, 22, 12, "#4a4438")}
          {px(226, 138, 22, 2, "#5d5648")}
          {px(244, 132, 10, 9, "#4a4438")}
          {px(245, 129, 3, 4, "#4a4438")}
          {px(251, 129, 3, 4, "#4a4438")}
          {px(246, 135, 2, 1, night ? "#c9a24b" : "#8fa86a")}
          {px(250, 135, 2, 1, night ? "#c9a24b" : "#8fa86a")}
          {px(248, 137, 2, 1, "#b98b86")}
          {px(228, 150, 4, 6, "#4a4438")}
          {px(240, 150, 4, 6, "#4a4438")}
          <g>
            {px(220, 136, 7, 3, "#4a4438")}
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 227 137; -18 227 137; 8 227 137; -6 227 137; 0 227 137"
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
  const night = isNightish(phase);
  const lampOn = railLit(world) || (night && world.lights.studio);
  return (
    <LayeredScene
      /* the room behind the glass sits ~2m back; it should lag the wall */
      parallax={{ middleBackground: 0.72 }}
      middleBackground={
        <g>
          <SceneDefs />
          <FlatInterior world={world} night={night} />
        </g>
      }
      ground={<Facade world={world} night={night} lampOn={lampOn} />}
      staticObjects={<Props night={night} lampOn={lampOn} />}
      gameplayObjects={<g>{/* hitboxes only */}</g>}
    />
  );
}

/* ================================================================== *
 * DOM effects
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
  const night = isNightish(phase);
  return (
    <>
      {actionUi === "smoke" ? <Steam x={116} y={86} scale={scale} /> : null}
      {/* the mug on the rail, still just warm */}
      {!night ? <Steam x={188} y={138} scale={scale} slow /> : null}
      {/* the AC's breath on a cold evening */}
      {night ? <Steam x={236} y={44} scale={scale} slow /> : null}
      {world.tv !== "off" ? null : null}
    </>
  );
}

export const BALCONY_SCENE: SceneDef<WorldState> = {
  id: "balcony",
  width: W,
  objects: [
    {
      id: "door-living3",
      kind: "flatdoor",
      x: 44,
      range: 20,
      to: { scene: "studio", spawnX: 580 },
    },
    { id: "ashtray", kind: "flavor", x: 70, range: 8 },
    { id: "smoke", kind: "sport", action: "smoke", x: 96, range: 14 },
    { id: "switch-balcony", kind: "lamp", x: 118, range: 7 },
    { id: "flowers", kind: "flavor", x: 134, range: 8 },
    { id: "call", kind: "sport", action: "call", x: 150, range: 7 },
    { id: "laundry", kind: "flavor", x: 168, range: 9 },
    { id: "skis", kind: "flavor", x: 186, range: 8 },
    { id: "seedlings", kind: "flavor", x: 214, range: 10 },
    { id: "ac-unit", kind: "flavor", x: 234, range: 9 },
    { id: "crate", kind: "flavor", x: 254, range: 9 },
    { id: "bicycle", kind: "flavor", x: 280, range: 13 },
    { id: "divider", kind: "flavor", x: 302, range: 8 },
  ],
  Component: ({ world, phase }) => <BalconyScene world={world} phase={phase} />,
  darkness: (phase, world) => {
    const lit = railLit(world);
    if (phase === "night") return lit ? 0.16 : 0.34;
    if (phase === "dusk") return lit ? 0.06 : 0.15;
    return 0;
  },
  Foreground: (p) => <BalconyFront {...p} />,
  Effects: BalconyEffects,
  idleLean: true,
};
