import type { ReactNode } from "react";
import type { SpriteMap, SpritePalette } from "../core/types";

/**
 * Crisp pixel-map renderer. Rows are strings of palette characters
 * ("." and " " transparent); horizontal runs of the same character merge
 * into one <rect> — one SVG node per run, not per pixel.
 */
export function PixelSprite({
  map,
  palette,
  cell = 2,
}: {
  map: SpriteMap;
  palette: SpritePalette;
  cell?: number;
}) {
  const rects: ReactNode[] = [];
  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    let runStart = -1;
    let runChar = "";
    const flush = (endX: number) => {
      if (runStart >= 0 && palette[runChar]) {
        rects.push(
          <rect
            key={`${y}:${runStart}`}
            x={runStart * cell}
            y={y * cell}
            width={(endX - runStart) * cell}
            height={cell}
            fill={palette[runChar]}
          />,
        );
      }
      runStart = -1;
      runChar = "";
    };
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const transparent = ch === "." || ch === " ";
      if (ch !== runChar) {
        flush(x);
        if (!transparent) {
          runStart = x;
          runChar = ch;
        }
      }
    }
    flush(row.length);
  }
  return <g shapeRendering="crispEdges">{rects}</g>;
}
