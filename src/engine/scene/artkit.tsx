import type { ReactNode } from "react";
import { FLOOR_Y, SCENE_HEIGHT } from "../core/constants";

/**
 * Art kit — the pixel-drawing vocabulary for scene authors.
 * Everything renders into the width×180 logical canvas, crisp edges.
 */

/**
 * One pixel-art rectangle. The atom of every scene.
 * The fill is part of the default key: scenes legitimately overdraw the same
 * geometry (glass + a warm light tint), and geometry-only keys collide there —
 * React then warns and may drop one of the rects.
 */
export function px(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  key?: string,
): ReactNode {
  return (
    <rect key={key ?? `${x}:${y}:${w}:${h}:${fill}`} x={x} y={y} width={w} height={h} fill={fill} />
  );
}

/** Sky gradient stops per phase of day — shared by windows and exteriors. */
export const SKY: Record<string, { top: string; mid: string; low: string }> = {
  morning: { top: "#8ba3c4", mid: "#c9cfd8", low: "#e8cf9a" },
  day: { top: "#7fa8cc", mid: "#a8c8e0", low: "#cfe2ee" },
  dusk: { top: "#4a3b63", mid: "#b96b8c", low: "#f2a65a" },
  night: { top: "#1a1830", mid: "#232040", low: "#2c2a4a" },
};

/** Full-canvas phase sky for exterior farBackground layers. */
export function PhaseSky({ id, phase, width }: { id: string; phase: string; width: number }) {
  const sky = SKY[phase] ?? SKY.day;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky.top} />
          <stop offset="55%" stopColor={sky.mid} />
          <stop offset="100%" stopColor={sky.low} />
        </linearGradient>
      </defs>
      {px(0, 0, width, SCENE_HEIGHT, `url(#${id})`)}
    </g>
  );
}

/** Repeating vertical stripes — wallpaper, fences, panelling. */
export function stripes(
  width: number,
  y: number,
  h: number,
  step: number,
  fill: string,
  offset = 10,
): ReactNode[] {
  const out: ReactNode[] = [];
  for (let x = offset; x < width; x += step) {
    out.push(px(x, y, 2, h, fill, `st${x}:${y}`));
  }
  return out;
}

/** Floor band with seams — parquet, pavement, tile. */
export function floorBand(width: number, base: string, seam: string, seamStep = 30): ReactNode[] {
  const out: ReactNode[] = [px(0, FLOOR_Y, width, SCENE_HEIGHT - FLOOR_Y, base, "fb")];
  out.push(px(0, FLOOR_Y + 14, width, 1, seam, "fseam"));
  for (let x = 0; x < width; x += seamStep) {
    out.push(px(x + 15, FLOOR_Y, 1, 14, seam, `fs1${x}`));
    out.push(px(x, FLOOR_Y + 14, 1, 16, seam, `fs2${x}`));
  }
  out.push(px(0, FLOOR_Y, width, 3, "#00000022", "fsh"));
  return out;
}

/** Open dark passage to another scene. Interaction center = x + 18. */
export function DoorwayArt({
  x,
  frame = "#8a7052",
  dark = "#1a1520",
}: {
  x: number;
  frame?: string;
  dark?: string;
}) {
  return (
    <g>
      {px(x - 3, 70, 42, 80, frame)}
      {px(x, 74, 36, 76, dark)}
      {px(x, 74, 36, 3, "#000000aa")}
    </g>
  );
}
