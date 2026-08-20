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
   * Layers with factor < 1 tag themselves `data-parallax` with the share of
   * the pan they must cancel, and the runtime writes their transform as it
   * moves the camera, so a full-width layer never shows gaps at the edges.
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
        /**
         * A parallax layer advertises how much of the camera pan it should
         * cancel, and the runtime writes the transform straight onto this
         * element every time the camera moves.
         *
         * It used to read a `--cam` custom property published on the scene
         * root instead. Custom properties inherit, so setting one on an
         * ancestor invalidates the computed style of every descendant —
         * whether or not it uses the variable. With scenes running to eight
         * thousand SVG nodes that turned a camera pan into a subtree style
         * recalculation: measured at 326 ms of `UpdateLayoutTree` standing
         * still against 1572 ms walking, which is where the frame rate went.
         *
         * Two element writes a frame cost nothing and invalidate nothing.
         */
        const shift = 1 - factor;
        const style =
          shift > 0
            ? // promoted to its own compositor layer: without it the whole
              // (often scene-wide) group repaints on the CPU every pan
              { willChange: "transform" }
            : undefined;
        return (
          <g
            key={key}
            data-layer={key}
            data-parallax={shift > 0 ? shift.toFixed(3) : undefined}
            style={style}
          >
            {layers[key]}
          </g>
        );
      })}
    </g>
  );
}
