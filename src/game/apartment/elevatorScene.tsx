import { LayeredScene, px, type SceneDef, stripes } from "@/engine";
import type { WorldState } from "@/lib/worldState";

// --- ЛІФТ / lift cab — small, but kept with dignity ---------------------------------

function ElevatorScene() {
  return (
    <LayeredScene
      parallax={{ middleBackground: 1 }}
      middleBackground={
        <g>
          {/* LED ceiling panel, even and kind */}
          {px(0, 0, 200, 42, "#c8ccd2")}
          {px(56, 34, 88, 8, "#f5f8fa")}
          {px(56, 34, 88, 2, "#aeb2b8")}
          {/* brushed steel up top, warm laminate below the rail */}
          {px(0, 42, 200, 46, "#9aa0a8")}
          {stripes(200, 42, 46, 50, "#8f959c", 25)}
          {px(0, 88, 200, 6, "#6b6e73")}
          {px(0, 94, 200, 56, "#a8895e")}
          {stripes(200, 94, 56, 40, "#9a7c52", 20)}
          {/* handrail */}
          {px(8, 96, 184, 4, "#c8ccd2")}
          {px(12, 100, 3, 4, "#6b6e73")}
          {px(186, 100, 3, 4, "#6b6e73")}
        </g>
      }
      ground={
        <g>
          {px(0, 150, 200, 30, "#7a776f")}
          {px(0, 150, 200, 2, "#00000033")}
          {px(0, 164, 200, 1, "#6b675f")}
          {/* corner bumpers */}
          {px(0, 146, 6, 4, "#3f4246")}
          {px(194, 146, 6, 4, "#3f4246")}
        </g>
      }
      staticObjects={
        <g>
          {/* half-height mirror, clean for once */}
          {px(24, 48, 40, 46, "#6b6e73")}
          {px(27, 51, 34, 40, "#b6ccd4")}
          {px(30, 54, 6, 30, "#d4e4ea")}
          {px(40, 60, 16, 1, "#9cb4bc")}
          {/* UDT inspection plate + capacity card */}
          {px(84, 56, 30, 18, "#e8e6e0")}
          {px(87, 59, 24, 3, "#4a4d52")}
          {px(87, 64, 18, 2, "#8a8d92")}
          {px(87, 68, 21, 2, "#8a8d92")}
          {px(84, 78, 30, 10, "#d8d6d0")}
          {px(87, 81, 12, 4, "#b03030")}
          {/* someone's sticker on the laminate — life finds a way */}
          {px(30, 112, 10, 8, "#e8c445")}
          {px(33, 114, 4, 4, "#2e3033")}
        </g>
      }
      gameplayObjects={
        <g>
          {/* button panel: display, 4 / 1 / P, braille dots */}
          {px(144, 60, 22, 60, "#3f4246")}
          {px(148, 64, 14, 10, "#14161a")}
          {px(151, 66, 8, 6, "#3ddc84")}
          {px(148, 80, 10, 9, "#aeb2b8")}
          {px(150, 82, 5, 5, "#e8e6e0")}
          {px(160, 84, 2, 2, "#c8ccd2")}
          {px(148, 93, 10, 9, "#aeb2b8")}
          {px(150, 95, 5, 5, "#e8e6e0")}
          {px(160, 97, 2, 2, "#c8ccd2")}
          {px(148, 106, 10, 9, "#aeb2b8")}
          {px(150, 108, 5, 5, "#c9a24b")}
          {px(160, 110, 2, 2, "#c8ccd2")}
        </g>
      }
    />
  );
}

export const ELEVATOR_SCENE: SceneDef<WorldState> = {
  id: "elevator",
  width: 200,
  objects: [
    { id: "lift-mirror", kind: "flavor", x: 44, range: 16 },
    { id: "lift-plate", kind: "flavor", x: 99, range: 14 },
    { id: "lift-sticker", kind: "flavor", x: 35, range: 8 },
    { id: "lift-panel", kind: "liftpanel", x: 155, range: 26 },
  ],
  Component: ElevatorScene,
  darkness: () => 0.03,
};
