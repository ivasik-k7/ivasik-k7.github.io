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
 * The flat — an open Polish kitchen-living room, home base of the game.
 * Entry nook, one fitted kitchen run, a doors nook (bathroom + bedroom
 * side by side), the wide sliding balcony glass with Gross's bed in the
 * sun, and the living corner: media wall, coffee table, sofa, the flag.
 * Every appliance carries real states; doors swing before travel.
 */

const W = 920;
const CEIL = 46;

const C = {
  brass: "#c9a24b",
  glassDay: "#a8c2d4",
  glassNight: "#232a34",
  shadow: "#00000030",
  graphite: "#3f4246",
  graphiteHi: "#565a60",
  graphiteLo: "#33363a",
  steel: "#8a8d92",
  steelHi: "#c8ccd2",
  oak: "#b8955e",
  oakHi: "#c9a86e",
  oakLo: "#8f7450",
  white: "#e8e6e0",
  whiteHi: "#f2f0ea",
  whiteLo: "#d6d2c6",
  clay: "#c9a878",
  clayLo: "#c0a070",
};

/** A door leaf that swings when its id is opening; fake-perspective swing. */
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

/** White interior door with two recessed panels and a steel handle. */
function InteriorDoor({ x, opening }: { x: number; opening: boolean }) {
  return (
    <g>
      {px(x, 58, 48, 92, "#b8b6ae")}
      <DoorLeaf x={x + 4} y={62} w={40} h={88} opening={opening}>
        {px(x + 4, 62, 40, 88, C.white)}
        {px(x + 4, 62, 2, 88, C.whiteHi)}
        {px(x + 8, 68, 32, 34, C.whiteLo)}
        {px(x + 9, 69, 30, 2, "#c9c5b8")}
        {px(x + 8, 106, 32, 36, C.whiteLo)}
        {px(x + 9, 107, 30, 2, "#c9c5b8")}
        {px(x + 36, 100, 4, 5, C.steel)}
        {px(x + 36, 100, 4, 1, C.steelHi)}
      </DoorLeaf>
      {px(x + 2, 148, 46, 3, C.shadow)}
    </g>
  );
}

function StudioScene({ world, phase }: { world: WorldState; phase: string }) {
  const night = phase === "night" || phase === "dusk";
  const lightOn = world.lights.studio;
  const glass = night ? C.glassNight : C.glassDay;
  const opening = world.doorOpening;
  const win = world.windows["window-kitchen"];
  return (
    <LayeredScene
      parallax={{ middleBackground: 1 }}
      middleBackground={
        <g>
          {/* ceiling, cornice shadow */}
          {px(0, 0, W, CEIL, "#e8e5dc")}
          {px(0, CEIL - 3, W, 1, "#d6d2c6")}
          {px(0, CEIL - 2, W, 2, "#c9c5b8")}
          {/* entry: warm greige */}
          {px(0, CEIL, 112, 104, "#c9c2b2")}
          {px(108, CEIL, 4, 104, "#b5ae9e")}
          {/* kitchen wall: white paint + slab-tile backsplash */}
          {px(112, CEIL, 292, 104, "#e2dfd6")}
          {px(112, 78, 292, 34, "#cdd8d4")}
          {stripes(292, 78, 34, 40, "#bcc9c4", 112)}
          {px(112, 94, 292, 1, "#bcc9c4")}
          {px(112, 78, 292, 1, "#dde6e2")}
          {/* living wall: clay paint with roller texture */}
          {px(404, CEIL, 516, 104, C.clay)}
          {stripes(516, CEIL, 104, 96, C.clayLo, 404)}
          {px(404, CEIL, 2, 104, "#b09468")}
          {/* baseboard */}
          {px(0, 146, W, 4, "#4a4438")}
          {px(0, 146, W, 1, "#5d5648")}
          {/* ===== kitchen window: three lives — closed, open, smoked ===== */}
          {px(216, 54, 62, 52, "#b8b6ae")}
          {px(216, 54, 62, 2, "#c8c6be")}
          {px(220, 58, 54, 12, C.white)}
          {px(220, 68, 54, 2, C.whiteLo)}
          {/* left sash: fixed */}
          {px(220, 58, 26, 44, glass)}
          {night ? px(226, 76, 8, 6, "#ffd98a") : px(224, 62, 10, 8, "#c3d4de")}
          {/* right sash: swings inward when open */}
          {win.open ? (
            <g>
              {px(248, 58, 26, 44, night ? "#1a2026" : "#8fb0c4")}
              <g
                style={{
                  transform: "scaleX(0.45)",
                  transformOrigin: "248px 58px",
                }}
              >
                {px(248, 58, 26, 44, glass)}
                {px(248, 58, 26, 2, "#b8b6ae")}
                {px(270, 78, 3, 8, C.steel)}
              </g>
              {/* the curtain breathes with the draught */}
              <rect x={246} y={58} width={4} height={44} fill="#f4f0e4" opacity={0.9}>
                <animate attributeName="width" values="4;7;4" dur="3.2s" repeatCount="indefinite" />
              </rect>
            </g>
          ) : (
            <g>
              {px(248, 58, 26, 44, glass)}
              {px(252, 60, 4, 30, night ? "#2e3742" : "#c3d4de")}
              {px(268, 78, 3, 8, C.steel)}
            </g>
          )}
          {px(245, 58, 4, 44, "#b8b6ae")}
          {/* smoked: the last smoke still curling over the sash */}
          {win.open && win.smoked
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
                    values="62;50"
                    begin={`${d}s`}
                    dur="3.4s"
                    repeatCount="indefinite"
                  />
                </circle>
              ))
            : null}
          {/* sill with a cactus and a lighter that lives here now */}
          {px(214, 104, 66, 4, "#d8d5cc")}
          {px(214, 104, 66, 1, "#e6e3da")}
          {px(215, 108, 64, 2, C.shadow)}
          {px(222, 98, 6, 6, "#4e7a52")}
          {px(223, 96, 4, 3, "#5f8a5f")}
          {px(221, 102, 8, 2, "#a34a3a")}
          {win.open ? px(266, 100, 6, 3, "#c94040") : null}
          {/* ===== wide sliding balcony door ===== */}
          {px(534, 48, 8, 102, "#8a5a4a")}
          {px(535, 48, 3, 102, "#966452")}
          {px(664, 48, 8, 102, "#8a5a4a")}
          {px(668, 48, 3, 102, "#7a4e40")}
          {px(542, 50, 124, 100, C.steel)}
          {px(542, 50, 124, 2, "#9aa0a8")}
          {px(546, 54, 56, 92, glass)}
          {night ? (
            px(556, 68, 18, 24, "#1a2026")
          ) : (
            <g>
              {px(548, 90, 52, 14, "#7c776d")}
              {px(556, 66, 18, 26, "#8d8a80")}
              {px(559, 70, 4, 4, "#6f6c62")}
              {px(567, 70, 4, 4, "#6f6c62")}
              {px(559, 80, 4, 4, "#6f6c62")}
              {px(584, 74, 6, 22, "#3d573d")}
              {px(585, 70, 4, 6, "#4e6b4e")}
            </g>
          )}
          <g
            style={{
              transition: "transform 380ms ease-in",
              transform: opening === "balcony" ? "translateX(-54px)" : "none",
            }}
          >
            {px(604, 54, 58, 92, glass)}
            {night ? (
              px(636, 72, 14, 20, "#1a2026")
            ) : (
              <g>
                {px(606, 90, 54, 14, "#7c776d")}
                {px(634, 68, 16, 24, "#8d8a80")}
                {px(637, 72, 4, 4, "#6f6c62")}
                {px(645, 72, 4, 4, "#6f6c62")}
                {px(614, 76, 6, 20, "#3d573d")}
              </g>
            )}
            {px(604, 54, 58, 3, "#9aa0a8")}
            {px(606, 96, 3, 10, C.steelHi)}
            {night ? null : px(608, 58, 20, 10, "#c3d4de")}
          </g>
          {px(602, 54, 4, 92, C.steel)}
          {night ? (
            <g>
              {px(564, 66, 10, 8, "#ffd98a")}
              {px(584, 90, 6, 5, "#f2b96a")}
            </g>
          ) : (
            <g>
              {px(548, 106, 50, 3, "#6d7278")}
              {px(552, 109, 3, 34, "#6d7278")}
              {px(574, 109, 3, 34, "#6d7278")}
              {px(594, 109, 3, 34, "#6d7278")}
            </g>
          )}
          {/* тюль: sheer gathered over the left pane, breathing faintly */}
          <g opacity={0.48}>
            {px(546, 54, 26, 92, "#f4f0e4")}
            {px(552, 54, 4, 92, "#faf7ec")}
            {px(562, 54, 3, 92, "#faf7ec")}
            <rect x={572} y={54} width={8} height={92} fill="#f4f0e4" opacity={0.6}>
              <animate attributeName="width" values="8;13;8" dur="4.2s" repeatCount="indefinite" />
            </rect>
          </g>
          {px(544, 148, 124, 2, C.shadow)}
          {/* ===== the doors nook: bathroom + bedroom side by side ===== */}
          <InteriorDoor x={408} opening={opening === "door-bath"} />
          <InteriorDoor x={464} opening={opening === "door-study"} />
          {/* little brass plates: a droplet, a moon */}
          {px(426, 70, 8, 8, C.brass)}
          {px(428, 72, 4, 4, "#8a6d2f")}
          {px(482, 70, 8, 8, C.brass)}
          {px(484, 72, 4, 2, "#8a6d2f")}
          {/* ===== the front door: anthracite ===== */}
          {px(10, 54, 54, 96, C.steel)}
          <DoorLeaf x={14} y={58} w={46} h={92} opening={opening === "frontdoor"}>
            {px(14, 58, 46, 92, C.graphite)}
            {px(16, 60, 42, 88, "#4a4d52")}
            {px(20, 66, 34, 2, C.graphite)}
            {px(20, 140, 34, 2, C.graphite)}
            {px(50, 92, 3, 22, C.steelHi)}
            {px(32, 72, 3, 3, "#26282c")}
          </DoorLeaf>
          {/* lighting: LED strip + living pendant */}
          {px(120, 76, 276, 2, lightOn ? "#ffe6a8" : "#a8a49a")}
          {px(724, CEIL, 3, 14, "#2e3033")}
          {px(712, CEIL + 14, 27, 3, "#2e3033")}
          {px(715, CEIL + 17, 21, 6, lightOn ? "#ffd98a" : "#8f8468")}
          {/* switch by the entry */}
          {px(118, 92, 8, 12, C.white)}
          {px(120, 96, 4, 4, lightOn ? C.brass : "#8f8a7c")}
        </g>
      }
      ground={
        <g>
          {px(0, 150, 404, 30, "#a5a29a")}
          {px(0, 150, 404, 2, "#00000022")}
          {stripes(404, 150, 30, 56, "#918e86", 28)}
          {px(0, 164, 404, 1, "#918e86")}
          {px(404, 150, 516, 30, "#a8875a")}
          {px(404, 150, 516, 2, "#00000026")}
          {stripes(516, 150, 30, 30, "#96774e", 419)}
          {px(404, 163, 516, 1, "#96774e")}
          {px(404, 171, 516, 1, "#96774e")}
          {/* rug under the coffee table + sofa */}
          {px(752, 152, 156, 26, "#8d8a94")}
          {px(756, 154, 148, 2, "#9d9aa4")}
          {px(752, 152, 2, 26, "#7d7a84")}
          {px(906, 152, 2, 26, "#7d7a84")}
          {/* doormat */}
          {px(18, 150, 42, 4, "#5a5d62")}
          {px(20, 151, 38, 1, "#6b6e73")}
        </g>
      }
      staticObjects={
        <g>
          {/* ===== entry ===== */}
          {px(64, 148, 40, 3, C.shadow)}
          {px(66, 56, 38, 92, "#a8895e")}
          {px(66, 56, 38, 2, "#b8955e")}
          {px(84, 58, 2, 88, C.oakLo)}
          {px(80, 98, 3, 8, C.steel)}
          {px(87, 98, 3, 8, C.steel)}
          {px(70, 62, 12, 40, "#c4d4dc")}
          {px(71, 64, 3, 30, "#dfe8ee")}
          {px(20, 126, 36, 5, "#a8895e")}
          {px(22, 131, 4, 17, C.oakLo)}
          {px(50, 131, 4, 17, C.oakLo)}
          {px(26, 142, 12, 6, C.steel)}
          {px(40, 143, 10, 5, "#3a3129")}
          {px(18, 148, 42, 3, C.shadow)}
          {/* ===== kitchen run ===== */}
          {px(120, 50, 92, 26, C.white)}
          {px(120, 50, 92, 2, C.whiteHi)}
          {px(150, 52, 2, 24, C.whiteLo)}
          {px(180, 52, 2, 24, C.whiteLo)}
          {px(120, 74, 92, 2, C.whiteLo)}
          {px(284, 50, 120, 26, C.white)}
          {px(284, 50, 120, 2, C.whiteHi)}
          {px(314, 52, 2, 24, C.whiteLo)}
          {px(344, 52, 2, 24, C.whiteLo)}
          {px(374, 52, 2, 24, C.whiteLo)}
          {px(284, 74, 120, 2, C.whiteLo)}
          {/* hood */}
          {px(300, 76, 44, 10, "#9aa0a8")}
          {px(300, 76, 44, 2, "#b3b8bf")}
          {px(316, 60, 12, 16, "#9aa0a8")}
          {/* worktop + graphite lowers */}
          {px(116, 106, 288, 6, C.oak)}
          {px(116, 106, 288, 2, C.oakHi)}
          {px(114, 148, 292, 3, C.shadow)}
          {px(116, 112, 288, 36, C.graphite)}
          {px(146, 114, 2, 34, C.graphiteLo)}
          {px(196, 114, 2, 34, C.graphiteLo)}
          {px(246, 114, 2, 34, C.graphiteLo)}
          {px(296, 114, 2, 34, C.graphiteLo)}
          {px(346, 114, 2, 34, C.graphiteLo)}
          {px(120, 118, 22, 2, C.steel)}
          {px(152, 118, 40, 2, C.steel)}
          {px(252, 118, 40, 2, C.steel)}
          {/* ===== the oven: closed / open with the tray / heating ===== */}
          {px(300, 114, 44, 3, C.steel)}
          {world.cookerState === "open" ? (
            <g>
              {/* cavity with racks and Friday's tray */}
              {px(300, 117, 44, 29, "#1a1614")}
              {px(303, 122, 38, 2, "#4a4438")}
              {px(303, 132, 38, 2, "#4a4438")}
              {px(306, 128, 32, 4, "#6d6258")}
              {px(308, 126, 12, 3, "#8a5a3a")}
              {px(324, 126, 8, 3, "#a3542f")}
              {px(304, 119, 36, 3, "#ffb340")}
              {/* the dropped door, glass up, catching the ceiling light */}
              {px(296, 146, 52, 6, "#26282c")}
              {px(300, 147, 44, 3, "#3f4a55")}
              {px(302, 147, 12, 2, "#5a6a78")}
            </g>
          ) : (
            <g>
              {px(300, 117, 44, 29, "#26282c")}
              {px(304, 121, 36, 18, "#14161a")}
              {world.cookerState === "on" ? (
                <g>
                  {px(306, 123, 32, 14, "#3a2416")}
                  <rect x={308} y={125} width={28} height={10} fill="#e8843a" opacity={0.7}>
                    <animate
                      attributeName="opacity"
                      values="0.7;0.4;0.7"
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                  </rect>
                  {px(310, 133, 24, 2, "#ffb340")}
                </g>
              ) : (
                <g>
                  {px(306, 123, 10, 12, "#26313c")}
                  {px(306, 123, 4, 12, "#31404d")}
                </g>
              )}
              {px(318, 141, 8, 3, C.steel)}
            </g>
          )}
          {/* hob on the worktop: a ring that answers the oven state */}
          {px(298, 104, 48, 3, "#14161a")}
          {px(306, 105, 10, 1, world.cookerState === "on" ? "#e84a3a" : "#33363a")}
          {px(326, 105, 10, 1, "#33363a")}
          {world.cookerState === "on" ? (
            <g>
              {px(304, 96, 14, 9, C.steelHi)}
              {px(305, 94, 12, 2, C.steel)}
              <circle cx={311} cy={92} r={2} fill="#e8e6e0" opacity={0}>
                <animate
                  attributeName="opacity"
                  values="0;0.6;0"
                  dur="2.1s"
                  repeatCount="indefinite"
                />
                <animate attributeName="cy" values="92;80" dur="2.1s" repeatCount="indefinite" />
              </circle>
            </g>
          ) : null}
          {/* electric kettle */}
          {px(158, 88, 22, 18, C.white)}
          {px(160, 86, 18, 3, C.steelHi)}
          {px(178, 92, 5, 8, C.steelHi)}
          {px(160, 102, 18, 2, world.kettleOn ? "#4a90d9" : C.steel)}
          {/* sink + tap */}
          {px(226, 100, 42, 6, C.steelHi)}
          {px(232, 96, 3, 6, "#9aa0a8")}
          {px(232, 94, 12, 3, "#9aa0a8")}
          {/* espresso machine */}
          {px(360, 84, 28, 22, "#26282c")}
          {px(362, 82, 24, 3, C.graphite)}
          {px(368, 96, 12, 4, "#9aa0a8")}
          {px(370, 100, 8, 6, C.white)}
          {px(384, 88, 4, 6, "#c94040")}
          {/* spice shelf */}
          {px(126, 96, 34, 3, C.oak)}
          {px(128, 86, 6, 10, "#7a8a4a")}
          {px(136, 88, 6, 8, "#a34a3a")}
          {px(144, 87, 6, 9, C.brass)}
          {px(152, 89, 5, 7, "#5d4a37")}
          {/* table + chair */}
          {px(126, 148, 60, 3, C.shadow)}
          {px(128, 120, 56, 5, C.oak)}
          {px(128, 120, 56, 2, C.oakHi)}
          {px(132, 125, 4, 23, C.oakLo)}
          {px(176, 125, 4, 23, C.oakLo)}
          {/* ===== the fridge: brushed graphite, magnets, real insides ===== */}
          {px(348, 148, 52, 3, C.shadow)}
          {world.fridgeOpen ? (
            <g>
              {/* door swung left: racks with milk, juice, sauces */}
              {px(322, 56, 26, 92, C.graphiteLo)}
              {px(324, 60, 22, 84, "#2c2f33")}
              {px(326, 70, 18, 3, C.steel)}
              {px(328, 62, 6, 8, C.white)}
              {px(336, 63, 6, 7, "#e8843a")}
              {px(326, 96, 18, 3, C.steel)}
              {px(328, 88, 5, 8, "#c94040")}
              {px(335, 90, 5, 6, "#7a8a4a")}
              {px(326, 122, 18, 3, C.steel)}
              {px(329, 114, 6, 8, "#e8c433")}
              {/* cavity: lit shelves — eggs, pot, jars, greens */}
              {px(352, 54, 48, 94, "#e8f0f4")}
              {px(352, 54, 48, 2, "#f5fafc")}
              {px(354, 82, 44, 2, "#c8d4da")}
              {px(354, 108, 44, 2, "#c8d4da")}
              {px(354, 130, 44, 2, "#c8d4da")}
              {px(358, 70, 14, 10, "#c8ccd2")}
              {px(360, 68, 10, 3, "#b3b8bf")}
              {px(376, 72, 8, 8, "#e8e2d2")}
              {px(386, 74, 8, 6, "#e8e2d2")}
              {px(358, 96, 10, 10, "#a34a3a")}
              {px(372, 94, 8, 12, "#c9a24b")}
              {px(384, 98, 10, 8, "#7a8a4a")}
              {px(358, 118, 16, 10, "#4e7a52")}
              {px(378, 120, 12, 8, "#e8c433")}
              {px(358, 136, 20, 8, "#c8ccd2")}
              <rect x={352} y={54} width={48} height={94} fill="#dff4ff" opacity={0.18}>
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
              {/* closed: brushed doors, seam, handles, magnets, Gross's vet note */}
              {px(352, 54, 48, 94, C.graphite)}
              {px(352, 54, 48, 2, C.graphiteHi)}
              {px(356, 56, 1, 90, "#484c52")}
              {px(366, 56, 1, 90, "#484c52")}
              {px(378, 56, 1, 90, "#484c52")}
              {px(390, 56, 1, 90, "#484c52")}
              {px(354, 90, 44, 2, C.graphiteLo)}
              {px(390, 62, 3, 20, C.steelHi)}
              {px(390, 96, 3, 26, C.steelHi)}
              {px(358, 62, 8, 10, "#e8e2d2")}
              {px(359, 63, 6, 5, "#7a8f9f")}
              {px(370, 66, 5, 5, "#c94040")}
              {px(360, 76, 10, 7, "#e8c433")}
              {px(361, 78, 8, 1, "#8a6d2f")}
              {px(361, 80, 6, 1, "#8a6d2f")}
            </g>
          )}
          {/* speaker on the upper shelf */}
          {px(188, 60, 18, 12, "#26282c")}
          {px(191, 63, 5, 5, "#4a4d52")}
          {px(199, 63, 4, 4, world.radioOn ? "#3ddc84" : "#4a4d52")}
          {/* ===== living side ===== */}
          {/* plant between the bedroom door and the curtain */}
          {px(514, 148, 18, 3, C.shadow)}
          {px(516, 130, 14, 18, "#8d8478")}
          {px(512, 108, 11, 24, "#4e6b4e")}
          {px(521, 102, 10, 30, "#57755a")}
          {/* Gross's bed in the balcony sun */}
          {px(618, 148, 48, 3, C.shadow)}
          {px(618, 132, 48, 16, "#7a5a48")}
          {px(622, 128, 40, 8, "#8a6a56")}
          {px(624, 136, 36, 10, "#5d4a66")}
          {px(626, 138, 32, 6, "#6a5675")}
          {/* art brut above the media wall's left shoulder */}
          {px(676, 54, 40, 32, "#26282c")}
          {px(679, 57, 34, 26, "#e8e2d2")}
          {px(681, 60, 10, 10, "#c94040")}
          {px(693, 59, 7, 14, "#2b5aa8")}
          {px(688, 70, 14, 6, "#e8c433")}
          {px(703, 62, 7, 7, "#3a7d84")}
          {px(682, 76, 24, 3, "#a3547c")}
          {/* media stand: PS5, controller, game boxes */}
          {px(686, 148, 96, 3, C.shadow)}
          {px(688, 116, 92, 32, "#a8895e")}
          {px(688, 116, 92, 3, C.oak)}
          {px(718, 120, 2, 26, C.oakLo)}
          {px(750, 120, 2, 26, C.oakLo)}
          {px(724, 122, 22, 20, C.white)}
          {px(728, 122, 3, 20, "#26282c")}
          {px(726, 124, 1, 16, "#4a90d9")}
          {px(754, 134, 14, 8, "#26282c")}
          {px(757, 136, 3, 3, "#4a90d9")}
          {px(692, 126, 5, 18, "#2b5aa8")}
          {px(699, 128, 5, 16, "#c94040")}
          {px(706, 127, 5, 17, "#3a7d84")}
          {/* coffee table: laptop + phone */}
          {px(788, 148, 70, 3, C.shadow)}
          {px(790, 132, 66, 4, C.oak)}
          {px(790, 132, 66, 2, C.oakHi)}
          {px(794, 136, 4, 12, C.oakLo)}
          {px(848, 136, 4, 12, C.oakLo)}
          {px(800, 128, 24, 4, C.steel)}
          {px(802, 112, 20, 16, "#6d7278")}
          {px(804, 114, 16, 12, night || !lightOn ? "#9fc7d6" : "#7ea8b8")}
          {px(806, 116, 8, 2, "#e8f4f8")}
          {px(806, 120, 12, 1, "#e8f4f8")}
          {px(832, 128, 10, 5, "#26282c")}
          {px(834, 129, 6, 3, "#4a90d9")}
          {/* the flag over the sofa */}
          {px(892, 56, 4, 30, C.oakLo)}
          {px(852, 56, 44, 4, C.oakLo)}
          {px(856, 60, 36, 11, "#2b5aa8")}
          {px(856, 71, 36, 11, "#e8c433")}
          {px(856, 60, 36, 2, "#3a6cc0")}
          {px(856, 80, 36, 2, "#d4b02a")}
          {px(890, 62, 2, 18, "#254e92")}
          {/* sofa */}
          {px(816, 148, 102, 3, C.shadow)}
          {px(818, 104, 98, 44, "#6d7278")}
          {px(818, 104, 98, 3, "#7d828a")}
          {px(818, 100, 14, 48, "#5d6266")}
          {px(902, 100, 14, 48, "#5d6266")}
          {px(832, 112, 70, 10, "#5d6266")}
          {px(834, 106, 24, 8, C.brass)}
          {px(862, 106, 24, 8, "#3a7d84")}
          {px(836, 122, 40, 6, "#8d8a94")}
        </g>
      }
      gameplayObjects={
        <g>
          {/* ===== TV: live, animated channels ===== */}
          {px(700, 84, 60, 30, "#14161a")}
          {px(702, 86, 56, 26, "#1a1d24")}
          {world.tv === "film" ? (
            <g>
              {px(704, 88, 52, 22, "#26313c")}
              {px(704, 92, 52, 14, "#5d7a8c")}
              {px(704, 88, 52, 3, "#14161a")}
              {px(704, 107, 52, 3, "#14161a")}
              <rect x={704} y={92} width={10} height={14} fill="#8fb0c4" opacity={0.5}>
                <animate attributeName="x" values="704;746;704" dur="7s" repeatCount="indefinite" />
              </rect>
            </g>
          ) : null}
          {world.tv === "football" ? (
            <g>
              {px(704, 88, 52, 22, "#3d6b3d")}
              {px(704, 97, 52, 1, "#5f8a5f")}
              {px(729, 89, 1, 20, "#5f8a5f")}
              {px(704, 88, 12, 3, "#e8e6e0")}
              <rect x={710} y={100} width={2} height={2} fill="#f2f0ea">
                <animate
                  attributeName="x"
                  values="710;748;716;710"
                  dur="4.4s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="y"
                  values="100;92;104;100"
                  dur="4.4s"
                  repeatCount="indefinite"
                />
              </rect>
            </g>
          ) : null}
          {world.tv === "static" ? (
            <g>
              {px(704, 88, 52, 22, "#6d6d6d")}
              <rect x={704} y={90} width={52} height={4} fill="#9a9a9a">
                <animate
                  attributeName="opacity"
                  values="1;0.2;0.8;0.4;1"
                  dur="0.5s"
                  repeatCount="indefinite"
                />
              </rect>
              <rect x={704} y={98} width={52} height={3} fill="#c9c9c9">
                <animate
                  attributeName="opacity"
                  values="0.3;1;0.5;1;0.3"
                  dur="0.4s"
                  repeatCount="indefinite"
                />
              </rect>
              <rect x={704} y={104} width={52} height={4} fill="#8a8a8a">
                <animate
                  attributeName="opacity"
                  values="0.8;0.3;1;0.2;0.8"
                  dur="0.6s"
                  repeatCount="indefinite"
                />
              </rect>
            </g>
          ) : null}
          {world.tv !== "off" ? px(706, 88, 8, 3, "#e8f4f8") : null}
          {px(726, 114, 8, 2, "#26282c")}
          {/* Gross asleep in his bed — breathing, broadcasting Z's */}
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
              {px(652 + i * 2, 116, 5 + i, 1.5, "#e8e6e0")}
              {px(653 + i * 2, 118, 2, 1.5, "#e8e6e0")}
              {px(652 + i * 2, 120, 5 + i, 1.5, "#e8e6e0")}
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
// effects: steam, notes, TV glow — all world-aware
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
  const darkness = roomDarkness(phase as DayPhase, world.lights.studio);
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
      </AnimatePresence>
      {world.kettleOn ? <Steam x={164} y={76} scale={scale} /> : null}
      {world.radioOn ? (
        <div
          className="pointer-events-none absolute text-parchment"
          style={{ left: 194 * scale, top: 50 * scale, fontSize: 6 * scale }}
        >
          <span className="note">♪</span>
          <span className="note note-2">♬</span>
        </div>
      ) : null}
      {actionUi === "smoke" && world.windows["window-kitchen"].open ? (
        <Steam x={258} y={62} scale={scale} />
      ) : null}
      {world.tv !== "off" && darkness > 0.3 ? (
        <div
          className="pointer-events-none absolute"
          style={{
            left: 668 * scale,
            top: 78 * scale,
            width: 90 * scale,
            height: 60 * scale,
            background: "radial-gradient(closest-side, #9fc7d666, transparent)",
          }}
        />
      ) : null}
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
    { id: "frontdoor", kind: "flatdoor", x: 37, range: 22, to: { scene: "corridor", spawnX: 46 } },
    // { id: "shoes", kind: "flavor", x: 38, range: 8 },
    { id: "wardrobe-hall", kind: "flavor", x: 85, range: 14 },
    { id: "switch", kind: "lamp", x: 122, range: 12 },
    { id: "spices", kind: "flavor", x: 143, range: 10 },
    { id: "kettle", kind: "kettle", x: 169, range: 14 },
    { id: "speaker", kind: "radio", x: 197, range: 10 },
    { id: "table", kind: "flavor", x: 156, range: 6 },
    { id: "window-kitchen", kind: "window", x: 247, range: 16 },
    { id: "sink-kitchen", kind: "flavor", x: 247, range: 6 },
    { id: "cooker", kind: "cooker", x: 322, range: 14 },
    { id: "espresso", kind: "flavor", x: 374, range: 12 },
    { id: "fridge", kind: "openable", x: 376, range: 16 },
    { id: "door-bath", kind: "flatdoor", x: 432, range: 18, to: { scene: "bath", spawnX: 44 } },
    { id: "door-study", kind: "flatdoor", x: 488, range: 18, to: { scene: "study", spawnX: 44 } },
    { id: "plant-studio", kind: "flavor", x: 522, range: 7 },
    { id: "balcony", kind: "flatdoor", x: 580, range: 22, to: { scene: "balcony", spawnX: 48 } },
    { id: "dogbed", kind: "flavor", x: 630, range: 8 },
    { id: "dog", kind: "dog", x: 648, range: 18 },
    { id: "artbrut", kind: "flavor", x: 696, range: 10 },
    { id: "bookshelf", kind: "panel", x: 700, range: 5, data: "skills" },
    { id: "tv", kind: "tv", x: 726, range: 10 },
    { id: "ps5", kind: "flavor", x: 740, range: 5 },
    { id: "laptop", kind: "computer", x: 812, range: 8 },
    { id: "phone", kind: "panel", x: 836, range: 5, data: "links" },
    { id: "flag", kind: "flavor", x: 872, range: 7 },
    { id: "sofa", kind: "sport", action: "sit", x: 862, range: 10, face: -1 },
  ],
  Component: ({ world, phase }) => <StudioScene world={world} phase={phase} />,
  darkness: (phase, world) => roomDarkness(phase as DayPhase, world.lights.studio),
  Effects: StudioEffects,
};
