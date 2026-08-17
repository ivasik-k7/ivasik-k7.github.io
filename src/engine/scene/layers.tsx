import type { ReactNode } from "react";

/**
 * Layered scene composition — the engine's canonical depth structure.
 *
 * | Layer            | Purpose                              | Typical content                    |
 * |------------------|--------------------------------------|------------------------------------|
 * | farBackground    | Establishes location and atmosphere  | Sky, distant buildings, trees      |
 * | middleBackground | Gives depth                          | Houses, walls, hills, vegetation   |
 * | ground           | Defines where the player moves       | Roads, grass, pavement, floor      |
 * | staticObjects    | Makes the location believable        | Benches, lamps, signs, bins        |
 * | gameplayObjects  | Objects with interaction/collision   | Doors, chests, vehicles            |
 * | (characters)     | — drawn by the runtime between       |                                    |
 * |                  |   gameplayObjects and foreground     |                                    |
 * | foreground       | Framing and depth — SceneDef.Foreground (in front of the player)      |
 * | effects          | Mood and feedback — SceneDef.Effects (rain, smoke, light, dust)       |
 *
 * The first five layers are SVG groups composed back-to-front inside the
 * scene's artwork. Characters, foreground and effects are runtime slots:
 * the player/NPCs render above the artwork, SceneDef.Foreground renders in
 * front of them, SceneDef.Effects renders DOM/motion overlays on top.
 */
export interface SceneLayers {
  farBackground?: ReactNode;
  middleBackground?: ReactNode;
  ground?: ReactNode;
  staticObjects?: ReactNode;
  gameplayObjects?: ReactNode;
  /**
   * Parallax scroll factor per layer (1 = moves with the ground,
   * 0 = pinned to the viewport). Defaults: far 0.35, middle 0.65, rest 1.
   * The runtime publishes the camera offset as `--cam` (logical px);
   * layers with factor < 1 compensate part of the pan via CSS transform,
   * so a full-width layer never shows gaps at the scene edges.
   */
  parallax?: Partial<Record<LayerKey, number>>;
}

type LayerKey =
  | "farBackground"
  | "middleBackground"
  | "ground"
  | "staticObjects"
  | "gameplayObjects";

const ORDER: LayerKey[] = [
  "farBackground",
  "middleBackground",
  "ground",
  "staticObjects",
  "gameplayObjects",
];

const DEFAULT_PARALLAX: Record<LayerKey, number> = {
  farBackground: 0.35,
  middleBackground: 0.65,
  ground: 1,
  staticObjects: 1,
  gameplayObjects: 1,
};

/** Compose layers back-to-front. Use inside a SceneDef.Component. */
export function LayeredScene(layers: SceneLayers) {
  return (
    <g shapeRendering="crispEdges">
      {ORDER.map((key) => {
        if (!layers[key]) return null;
        const factor = layers.parallax?.[key] ?? DEFAULT_PARALLAX[key];
        // will-change promotes the group to its own compositor layer where the
        // browser supports composited SVG transforms — without it, every --cam
        // tick repaints the whole (often scene-wide) layer on the CPU
        const style =
          factor < 1
            ? {
                transform: `translateX(calc(var(--cam, 0) * ${(1 - factor).toFixed(3)}px))`,
                willChange: "transform",
              }
            : undefined;
        return (
          <g key={key} data-layer={key} style={style}>
            {layers[key]}
          </g>
        );
      })}
    </g>
  );
}
