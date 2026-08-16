import { useEffect, useState } from "react";
import { ElevatorDoors, LayeredScene, px, type SceneDef, stripes } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { NpcMonologue } from "./NpcMonologue";

// --- ПАРКІНГ / underground parking, level -1 ---------------------------------------
// Scale honesty: 1 m ≈ 37 gp. A Golf is 4.26 m → ~158 gp long, roof at ~1.45 m → 54 gp.

const CAR = {
  glass: "#25313c",
  glassHi: "#3a4a58",
  tyre: "#161513",
  rim: "#8fa0ad",
  rimDark: "#3a4148",
  plate: "#e8e8e0",
  plateEU: "#2b4f9e",
  shadow: "#00000055",
};

/** Wheel with tyre, rim, hub — radius 9, sits on the floor line. */
function Wheel({ cx }: { cx: number }) {
  return (
    <g>
      {px(cx - 9, 132, 18, 18, CAR.tyre)}
      {px(cx - 7, 130, 14, 2, CAR.tyre)}
      {px(cx - 7, 150 - 0, 14, 0, CAR.tyre)}
      {px(cx - 5, 136, 10, 10, CAR.rim)}
      {px(cx - 2, 139, 4, 4, CAR.rimDark)}
    </g>
  );
}

interface RealCarProps {
  x: number;
  len?: number;
  body: string;
  bodyHi: string;
  shape?: "sedan" | "hatch" | "liftback" | "van" | "small";
}

/** A neighbor's car in believable proportions, nose pointing left. */
function RealCar({ x, len = 155, body, bodyHi, shape = "sedan" }: RealCarProps) {
  const roofY = shape === "van" ? 84 : 100;
  const beltY = 118;
  const cabinFront = x + (shape === "small" ? 22 : 30);
  const cabinLen =
    shape === "van"
      ? len - 44
      : shape === "hatch" || shape === "small"
        ? len - (shape === "small" ? 44 : 52)
        : len - 74;
  const bPillar = cabinFront + Math.floor(cabinLen / 2);
  return (
    <g>
      {/* lower body slab + rocker */}
      {px(x, beltY, len, 20, body)}
      {px(x, beltY, len, 2, bodyHi)}
      {px(x + 4, 136, len - 8, 3, CAR.shadow)}
      {/* greenhouse */}
      {shape === "van" ? (
        <g>
          {px(x + 6, roofY, len - 12, beltY - roofY, body)}
          {px(x + 6, roofY, len - 12, 2, bodyHi)}
          {px(x + 10, roofY + 4, 26, 26, CAR.glass)}
          {px(x + 42, roofY + 4, 30, 22, CAR.glass)}
        </g>
      ) : (
        <g>
          {px(cabinFront, roofY, cabinLen, beltY - roofY, body)}
          {px(cabinFront + 4, roofY + 1, cabinLen - 8, 2, bodyHi)}
          {/* windscreen rake, side glass split by the B-pillar */}
          {px(cabinFront + 4, roofY + 4, bPillar - cabinFront - 7, 12, CAR.glass)}
          {px(bPillar + 3, roofY + 4, cabinFront + cabinLen - bPillar - 8, 12, CAR.glass)}
          {px(cabinFront + 5, roofY + 5, 6, 3, CAR.glassHi)}
        </g>
      )}
      {/* boot hump for sedans / sloped tail for liftbacks */}
      {shape === "sedan" ? px(x + len - 40, 108, 34, 10, body) : null}
      {shape === "liftback" ? px(x + len - 52, 104, 44, 14, body) : null}
      {/* door seams + handles + mirror */}
      {px(bPillar, beltY + 2, 1, 14, CAR.shadow)}
      {px(cabinFront + 8, beltY + 4, 8, 2, bodyHi)}
      {px(bPillar + 8, beltY + 4, 8, 2, bodyHi)}
      {px(cabinFront - 3, roofY + 8, 4, 4, body)}
      {/* lights and plates */}
      {px(x - 1, beltY + 4, 4, 5, "#e8dfa8")}
      {px(x + len - 3, beltY + 4, 4, 5, "#a03040")}
      {px(x + 8, beltY + 12, 14, 5, CAR.plate)}
      {px(x + 8, beltY + 12, 2, 5, CAR.plateEU)}
      {/* wheels in dark arches */}
      {px(x + 18, 126, 26, 12, "#12100f")}
      {px(x + len - 46, 126, 26, 12, "#12100f")}
      <Wheel cx={x + 31} />
      <Wheel cx={x + len - 33} />
    </g>
  );
}

/** The Golf 7 R — 158 gp of Lapiz Blue. Indicators answer the key fob. */
function GolfR({ x, locked }: { x: number; locked: boolean }) {
  const body = "#e9eae4";
  const bodyHi = "#ffffff";
  const bodyDark = "#b9bab2";
  const black = "#1a1a18";
  return (
    <g>
      {/* body: low slab, short overhangs */}
      {px(x, 116, 158, 22, body)}
      {px(x, 116, 158, 2, bodyHi)}
      {px(x + 4, 135, 150, 3, "#00000066")}
      {/* greenhouse with fast C-pillar */}
      {px(x + 30, 98, 104, 18, body)}
      {px(x + 34, 99, 92, 2, bodyHi)}
      {px(x + 126, 98, 10, 18, bodyDark)}
      {px(x + 35, 102, 40, 12, CAR.glass)}
      {px(x + 80, 102, 44, 12, CAR.glass)}
      {px(x + 36, 103, 7, 4, CAR.glassHi)}
      {/* roof spoiler */}
      {px(x + 126, 95, 14, 3, black)}
      {/* character line + door seams + handles */}
      {px(x + 6, 122, 146, 1, bodyDark)}
      {px(x + 77, 118, 1, 14, bodyDark)}
      {px(x + 46, 121, 9, 2, bodyHi)}
      {px(x + 86, 121, 9, 2, bodyHi)}
      {/* mirror with indicator sliver */}
      {px(x + 26, 104, 5, 4, black)}
      {locked ? null : px(x + 26, 105, 5, 2, "#ffb340")}
      {/* R-line front: LED strip, intake, badge */}
      {px(x - 1, 120, 5, 4, locked ? "#cfe2f5" : "#f0f8ff")}
      {px(x + 2, 130, 10, 5, "#12100f")}
      {px(x + 4, 124, 4, 3, black)}
      {/* tail: dark lamp + quad exhausts */}
      {px(x + 154, 120, 5, 4, locked ? "#802030" : "#c03048")}
      {px(x + 146, 135, 4, 3, CAR.rim)}
      {px(x + 140, 135, 4, 3, CAR.rim)}
      {/* plates */}
      {px(x + 10, 128, 14, 5, CAR.plate)}
      {px(x + 10, 128, 2, 5, CAR.plateEU)}
      {/* arches + 18" wheels */}
      {px(x + 16, 124, 28, 14, "#12100f")}
      {px(x + 112, 124, 28, 14, "#12100f")}
      <Wheel cx={x + 30} />
      <Wheel cx={x + 126} />
      {/* black rear diffuser between the quads */}
      {px(x + 128, 136, 26, 3, black)}
      {/* five thin spokes + blue R calipers */}
      {px(x + 28, 138, 1, 6, CAR.rimDark)}
      {px(x + 124, 138, 1, 6, CAR.rimDark)}
      {px(x + 34, 139, 3, 4, "#2b6bd9")}
      {px(x + 130, 139, 3, 4, "#2b6bd9")}
      {/* welcome puddle light when unlocked */}
      {locked ? null : px(x + 40, 148, 80, 2, "#ffb34033")}
    </g>
  );
}

/** Pan Marek, polishing the Octavia since before you moved in. */
/** Pan Marek — flat cap, olive work jacket, rag mid-polish. Grounded. */
function PanMarek({ x }: { x: number }) {
  return (
    <g>
      {/* contact shadow on the concrete */}
      {px(x - 4, 148, 30, 3, "#00000044")}
      {/* flat cap with a brim over the eyes */}
      {px(x + 3, 80, 14, 4, "#8f8a7c")}
      {px(x + 2, 82, 16, 2, "#7a766c")}
      {px(x + 1, 84, 8, 2, "#7a766c")}
      {/* face, jaw shade, mustache of a serious man */}
      {px(x + 4, 86, 12, 8, "#e0b48c")}
      {px(x + 4, 91, 12, 3, "#c79a72")}
      {px(x + 6, 88, 2, 2, "#3d2a1a")}
      {px(x + 11, 88, 2, 2, "#3d2a1a")}
      {px(x + 7, 92, 7, 2, "#8f8a7c")}
      {px(x + 8, 94, 5, 2, "#c79a72")}
      {/* olive jacket: shoulder light, shaded flank, zipper line */}
      {px(x + 2, 96, 16, 25, "#5f7053")}
      {px(x + 2, 96, 16, 2, "#6d8060")}
      {px(x + 14, 98, 4, 23, "#4f5e45")}
      {px(x + 9, 98, 2, 21, "#4f5e45")}
      {/* left arm out with the rag, mid-wipe */}
      {px(x - 2, 98, 4, 15, "#5f7053")}
      {px(x - 3, 111, 5, 5, "#e0b48c")}
      {px(x - 8, 113, 8, 5, "#c9c4b6")}
      {px(x - 8, 116, 8, 2, "#aeaba0")}
      {/* right arm down */}
      {px(x + 16, 98, 4, 14, "#4f5e45")}
      {px(x + 16, 110, 4, 4, "#e0b48c")}
      {/* trousers with a pressed crease shade */}
      {px(x + 3, 121, 6, 24, "#3a4148")}
      {px(x + 11, 121, 6, 24, "#3a4148")}
      {px(x + 3, 121, 14, 2, "#333a40")}
      {/* boots on the concrete, toe highlight */}
      {px(x + 1, 145, 8, 5, "#22201e")}
      {px(x + 11, 145, 8, 5, "#22201e")}
      {px(x + 1, 145, 18, 1, "#3a3833")}
    </g>
  );
}

function ParkingScene({ world }: { world: WorldState }) {
  const bays: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const bx = 80 + i * 185;
    bays.push(px(bx, 152, 2, 26, "#c9b784", `bay${i}`));
    // stencilled bay numbers
    bays.push(px(bx + 8, 156, 8, 2, "#9c8f66", `bn${i}`));
    bays.push(px(bx + 8, 156, 2, 8, "#9c8f66", `bn2${i}`));
  }
  return (
    <LayeredScene
      parallax={{ middleBackground: 1 }}
      middleBackground={
        <g>
          {/* raw concrete, panel seams, services along the ceiling */}
          {px(0, 0, 1600, 40, "#4d4a45")}
          {px(0, 40, 1600, 110, "#6b675f")}
          {stripes(1600, 40, 110, 82, "#5d5a52", 40)}
          {px(0, 40, 1600, 2, "#7a766c")}
          {/* water mains in silver lagging, clamped every few metres */}
          {px(0, 6, 1600, 8, "#9aa0a8")}
          {px(0, 12, 1600, 2, "#7d8288")}
          {px(0, 17, 1600, 7, "#8f959c")}
          {px(0, 22, 1600, 2, "#70757c")}
          {[110, 222, 334, 446, 558, 670, 782, 894, 1006, 1118, 1230, 1342, 1454, 1566].map(
            (cx) => (
              <g key={`clamp${cx}`}>
                {px(cx, 5, 4, 20, "#6d7278")}
                {px(cx + 1, 25, 2, 15, "#5d6266")}
              </g>
            ),
          )}
          {/* valve wheel where the mains tee off */}
          {px(818, 14, 12, 12, "#8a3a34")}
          {px(822, 10, 4, 4, "#8a3a34")}
          {px(821, 17, 6, 6, "#5d2c27")}
          {/* red fire main + cable tray + the gas line */}
          {px(0, 30, 1600, 3, "#8a3a34")}
          {px(0, 50, 1600, 4, "#8f8a7c")}
          {px(0, 58, 1600, 3, "#c9a24b")}
          {px(0, 64, 1600, 2, "#5d6266")}
          {/* sprinkler line with heads */}
          {px(0, 44, 1600, 2, "#8a3a34")}
          {px(200, 46, 3, 4, "#8a3a34")}
          {px(600, 46, 3, 4, "#8a3a34")}
          {px(1000, 46, 3, 4, "#8a3a34")}
          {px(1400, 46, 3, 4, "#8a3a34")}
          {/* P -1 painted big */}
          {px(60, 72, 8, 26, "#c9b784")}
          {px(68, 72, 10, 5, "#c9b784")}
          {px(68, 84, 10, 5, "#c9b784")}
          {px(74, 77, 4, 7, "#c9b784")}
          {px(92, 82, 10, 4, "#c9b784")}
          {px(110, 72, 5, 26, "#c9b784")}
          {/* WYJŚCIE sign glowing green at the far end */}
          {px(1488, 60, 74, 16, "#0d3d24")}
          {px(1492, 64, 66, 8, "#3ddc84")}
          {/* convex mirror dome in its corner */}
          {px(1452, 58, 22, 20, "#3a3833")}
          {px(1455, 61, 16, 14, "#aebfc9")}
          {px(1458, 64, 6, 5, "#dfe8ee")}
          {/* CCTV camera on a bracket */}
          {px(430, 52, 4, 8, "#3a3833")}
          {px(426, 58, 14, 8, "#22201e")}
          {px(438, 60, 4, 4, "#8a3a34")}
          {/* ventilation grilles */}
          {px(340, 70, 34, 14, "#3a3833")}
          {px(342, 73, 30, 2, "#5d5a52")}
          {px(342, 78, 30, 2, "#5d5a52")}
          {px(1140, 70, 34, 14, "#3a3833")}
          {px(1142, 73, 30, 2, "#5d5a52")}
          {px(1142, 78, 30, 2, "#5d5a52")}
          {/* electrical cabinet with a lightning sticker */}
          {px(700, 78, 30, 52, "#8a8f96")}
          {px(704, 84, 22, 36, "#6d7278")}
          {px(712, 96, 6, 10, "#c9a24b")}
          {/* far wall row of cars asleep behind the divider */}
          {px(140, 116, 90, 16, "#2e2c29")}
          {px(154, 108, 56, 10, "#2e2c29")}
          {px(320, 116, 86, 16, "#33302c")}
          {px(334, 109, 52, 9, "#33302c")}
          {px(560, 116, 92, 16, "#2b2926")}
          {px(576, 108, 58, 10, "#2b2926")}
          {px(880, 116, 88, 16, "#33302c")}
          {px(894, 109, 54, 9, "#33302c")}
          {px(1120, 116, 90, 16, "#2e2c29")}
          {px(1136, 108, 56, 10, "#2e2c29")}
          {px(1330, 116, 86, 16, "#2b2926")}
          {px(0, 130, 1600, 4, "#57534c")}
          {/* exit ramp at the far right: daylight leaking down */}
          {px(1500, 76, 100, 74, "#8a8578")}
          {px(1516, 76, 84, 60, "#b8c4a8")}
          {px(1516, 76, 84, 8, "#d0dcbe")}
          {px(1500, 108, 100, 6, "#7a766c")}
          {px(1500, 128, 100, 6, "#7a766c")}
          {/* barrier arm */}
          {px(1492, 96, 6, 54, "#8f8a7c")}
          {px(1496, 96, 70, 5, "#c9463c")}
          {px(1510, 96, 12, 5, "#e0ddd0")}
          {px(1536, 96, 12, 5, "#e0ddd0")}
        </g>
      }
      ground={
        <g>
          {px(0, 150, 1600, 30, "#43413d")}
          {px(0, 150, 1600, 3, "#00000044")}
          {px(0, 166, 1600, 2, "#c9b784")}
          {bays}
          {/* speed bump before the ramp */}
          {px(1430, 150, 34, 4, "#c9a24b")}
          {px(1436, 150, 6, 4, "#3a3833")}
          {px(1450, 150, 6, 4, "#3a3833")}
          {/* drain grate + oil stains + tyre marks */}
          {px(946, 158, 26, 4, "#2e2c29")}
          {px(948, 159, 22, 1, "#57534c")}
          {px(210, 158, 20, 4, "#35332f")}
          {px(760, 160, 24, 3, "#35332f")}
          {px(1240, 157, 16, 4, "#35332f")}
          {px(500, 170, 60, 2, "#3a3833")}
          {px(1300, 172, 80, 2, "#3a3833")}
        </g>
      }
      staticObjects={
        <g>
          {/* fluorescent tubes, the one over bay 3 dying quietly */}
          {px(150, 36, 54, 4, "#e8f0e8")}
          {px(420, 36, 54, 4, "#e8f0e8")}
          {px(690, 36, 54, 4, "#d0d8d0")}
          {px(960, 36, 54, 4, "#e8f0e8")}
          {px(1230, 36, 54, 4, "#e8f0e8")}
          {px(1470, 36, 54, 4, "#e8f0e8")}
          {/* bike rack by the lift */}
          {px(58, 128, 2, 22, "#8f8a7c")}
          {px(66, 128, 2, 22, "#8f8a7c")}
          {px(74, 128, 2, 22, "#8f8a7c")}
          {px(56, 128, 22, 2, "#8f8a7c")}
          {px(52, 132, 14, 12, "#22201e")}
          {px(55, 135, 8, 6, "#5d6266")}
          {/* hose reel + extinguisher by the first pillar */}
          {px(246, 84, 24, 24, "#a33a30")}
          {px(250, 88, 16, 16, "#7d2820")}
          {px(254, 92, 8, 8, "#a33a30")}
          {px(276, 100, 12, 26, "#a33a30")}
          {px(279, 96, 6, 5, "#3a3833")}
          {/* a stray Biedronka trolley, one wheel dreaming */}
          {px(672, 118, 30, 20, "#8f989e")}
          {px(674, 120, 26, 2, "#aeb8be")}
          {px(676, 124, 22, 2, "#aeb8be")}
          {px(670, 112, 8, 8, "#c9463c")}
          {px(674, 138, 5, 6, "#5d6266")}
          {px(694, 138, 5, 6, "#5d6266")}
          {/* an old MZ motorcycle under a half-slipped tarp */}
          {px(1408, 112, 58, 24, "#5d6b5d")}
          {px(1416, 106, 34, 10, "#5d6b5d")}
          {px(1404, 130, 16, 16, "#161513")}
          {px(1408, 134, 8, 8, "#8fa0ad")}
          {px(1448, 130, 16, 16, "#161513")}
          {px(1452, 134, 8, 8, "#8fa0ad")}
          {/* wet floor sign near the drain */}
          {px(920, 124, 3, 26, "#e8c445")}
          {px(908, 148, 26, 2, "#e8c445")}
          {px(914, 130, 14, 10, "#3a3833")}
        </g>
      }
      gameplayObjects={
        <g>
          <ElevatorDoors x={8} />
          <RealCar x={90} body="#7d786e" bodyHi="#918c80" shape="sedan" len={150} />
          <RealCar x={275} body="#6d7278" bodyHi="#848a92" shape="sedan" len={160} />
          <RealCar x={460} body="#5d3a3a" bodyHi="#75504e" shape="small" len={140} />
          <RealCar x={640} body="#3a4a5d" bodyHi="#4e6076" shape="van" len={175} />
          <RealCar x={830} body="#c9c4b6" bodyHi="#dedad0" shape="liftback" len={162} />
          <PanMarek x={1000} />
          <GolfR x={1030} locked={world.golfLocked} />
          <RealCar x={1200} body="#4d5a50" bodyHi="#637265" shape="small" len={138} />
          <RealCar x={1385} body="#6b5d4a" bodyHi="#82735e" shape="small" len={130} />
          {/* concrete columns between bays, hazard-striped at the base */}
          {px(252, 20, 16, 130, "#7a766c")}
          {px(252, 20, 4, 130, "#8f8a7c")}
          {px(252, 126, 16, 24, "#c9a24b")}
          {px(252, 126, 16, 5, "#3a3833")}
          {px(252, 138, 16, 5, "#3a3833")}
          {px(620, 20, 16, 130, "#7a766c")}
          {px(620, 20, 4, 130, "#8f8a7c")}
          {px(620, 126, 16, 24, "#c9a24b")}
          {px(620, 126, 16, 5, "#3a3833")}
          {px(620, 138, 16, 5, "#3a3833")}
          {px(1178, 20, 16, 130, "#7a766c")}
          {px(1178, 20, 4, 130, "#8f8a7c")}
          {px(1178, 126, 16, 24, "#c9a24b")}
          {px(1178, 126, 16, 5, "#3a3833")}
          {px(1178, 138, 16, 5, "#3a3833")}
        </g>
      }
    />
  );
}

/** Positions of the fluorescent tubes — the light cones hang under them. */
const PARKING_LAMPS = [177, 447, 717, 987, 1257, 1497];
const GOLF_X = 1030;

/**
 * Motion-sensor lighting: walk and the tubes wake, each throwing a soft
 * cone that fades before it reaches the next bay; stand still for twenty
 * seconds and the level sinks back into its concrete dark. The Golf's
 * indicators and exhaust render here too, above the darkness.
 */
const MAREK_MONOLOGUES = [
  "Kurwa, znowu ktoś drzwiami mi w bok stuknął...",
  "Wosk, polerka, wosk. I tak rdza kiedyś wygra.",
  "W niedzielę pojedziemy nad jezioro. Może.",
  "Kurwa, paliwo znowu podrożało. Będę chodził pieszo. Nie będę.",
] as const;

function ParkingEffects({
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
      <NpcMonologue
        x={1010}
        headY={76}
        scale={scale}
        speaker="Pan Marek"
        lines={MAREK_MONOLOGUES}
        muted={dialogueOpen}
      />
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox="0 0 1600 180"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <defs>
          <linearGradient id="lightcone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff3cf" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#ffeCB0" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#ffe6a8" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* the dark itself */}
        <rect
          width="1600"
          height="180"
          fill="#04050a"
          opacity={lit ? 0.62 : 0.87}
          style={{ transition: "opacity 900ms ease" }}
        />
        {/* soft cones, only while the sensors hold */}
        <g style={{ transition: "opacity 700ms ease" }} opacity={lit ? 1 : 0}>
          {PARKING_LAMPS.map((x) => (
            <g key={x}>
              <rect x={x - 27} y={36} width={54} height={4} fill="#fff8e0" opacity={0.9} />
              <polygon
                points={`${x - 24},40 ${x + 24},40 ${x + 78},150 ${x - 78},150`}
                fill="url(#lightcone)"
              />
              <ellipse cx={x} cy={151} rx={80} ry={7} fill="#ffe6a8" opacity={0.1} />
            </g>
          ))}
        </g>
        {/* key fob answer: indicators blink front, mirror and rear */}
        {blinks.map((f) => (
          <g key={f.id} fill="#ffb340">
            {[
              [GOLF_X - 1, 121, 5, 3],
              [GOLF_X + 26, 105, 5, 3],
              [GOLF_X + 154, 121, 5, 3],
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
          </g>
        ))}
        {/* a cold start: tails glow, the quads breathe twice */}
        {revs.map((f) => (
          <g key={f.id}>
            <rect x={GOLF_X + 153} y={120} width={6} height={4} fill="#ff4050" opacity={0.9}>
              <animate
                attributeName="opacity"
                values="0.9;0.9;0"
                dur="2.4s"
                repeatCount="1"
                fill="freeze"
              />
            </rect>
            {[0, 0.5].map((delay) => (
              <circle
                key={`${f.id}:${delay}`}
                cx={GOLF_X + 148}
                cy={137}
                r={3}
                fill="#aeb4ba"
                opacity={0}
              >
                <animate
                  attributeName="opacity"
                  values="0;0.5;0"
                  begin={`${delay}s`}
                  dur="1.6s"
                  repeatCount="1"
                  fill="freeze"
                />
                <animate
                  attributeName="cy"
                  values="137;120"
                  begin={`${delay}s`}
                  dur="1.6s"
                  repeatCount="1"
                  fill="freeze"
                />
                <animate
                  attributeName="cx"
                  values={`${GOLF_X + 148};${GOLF_X + 160}`}
                  begin={`${delay}s`}
                  dur="1.6s"
                  repeatCount="1"
                  fill="freeze"
                />
              </circle>
            ))}
          </g>
        ))}
        {/* the WYJŚCIE sign and the ramp daylight burn through any darkness */}
        <rect x={1492} y={64} width={66} height={8} fill="#3ddc84" opacity={0.9} />
        <rect x={1516} y={76} width={84} height={60} fill="#b8c4a8" opacity={0.35} />
      </svg>
    </>
  );
}

export const PARKING_SCENE: SceneDef<WorldState> = {
  id: "parking",
  width: 1600,
  objects: [
    {
      id: "parking-lift",
      kind: "liftbutton",
      x: 28,
      range: 20,
      to: { scene: "elevator", spawnX: 100 },
    },
    { id: "bikes", kind: "flavor", x: 66, range: 12 },
    { id: "car-audi", kind: "car", x: 165, range: 26 },
    { id: "extinguisher", kind: "flavor", x: 274, range: 14 },
    { id: "car-passat", kind: "car", x: 355, range: 26 },
    { id: "camera", kind: "flavor", x: 433, range: 14 },
    { id: "car-lanos", kind: "car", x: 530, range: 24 },
    { id: "trolley", kind: "flavor", x: 687, range: 12 },
    { id: "car-transit", kind: "car", x: 727, range: 24 },
    { id: "car-octavia", kind: "car", x: 911, range: 26 },
    { id: "wetfloor", kind: "flavor", x: 958, range: 12 },
    { id: "pan-marek", kind: "npc", x: 1008, range: 18, face: 1 },
    { id: "golf", kind: "mycar", x: 1109, range: 28 },
    { id: "car-corsa", kind: "car", x: 1269, range: 24 },
    { id: "moto", kind: "flavor", x: 1437, range: 20 },
    { id: "mirror-dome", kind: "flavor", x: 1463, range: 10 },
    {
      id: "exit-ramp",
      kind: "stairs",
      x: 1545,
      range: 26,
      to: { scene: "outside", spawnX: 110 },
    },
  ],
  Component: ({ world }) => <ParkingScene world={world} />,
  darkness: () => 0,
  Effects: ParkingEffects,
  Foreground: () => (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 1600 180"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0"
    >
      <g shapeRendering="crispEdges">
        {/* columns pass between the camera and the row */}
        {px(604, 0, 26, 180, "#57534c")}
        {px(604, 0, 6, 180, "#6b675f")}
        {px(604, 118, 26, 40, "#c9a24b")}
        {px(604, 118, 26, 8, "#3a3833")}
        {px(604, 134, 26, 8, "#3a3833")}
        {px(1348, 0, 26, 180, "#57534c")}
        {px(1348, 0, 6, 180, "#6b675f")}
        {px(1348, 118, 26, 40, "#c9a24b")}
        {px(1348, 118, 26, 8, "#3a3833")}
        {px(1348, 134, 26, 8, "#3a3833")}
        {/* the noses of the near lane, out of focus in the dark */}
        {px(180, 166, 150, 14, "#12100f")}
        {px(205, 158, 110, 10, "#1a1816")}
        {px(300, 161, 9, 4, "#3a3f45")}
        {px(1250, 168, 170, 12, "#12100f")}
        {px(1280, 160, 120, 10, "#1a1816")}
        {px(1288, 163, 9, 4, "#5a2a30")}
      </g>
    </svg>
  ),
};
