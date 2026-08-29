import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  PixelLabel,
  playSfx,
  prose,
  proseQuiet,
  pxPath,
  type Rect,
  RULE,
  SIGNAL,
  textPath,
} from "@/engine";
import { useMenuInput } from "../menu/useMenuInput";
import { LINE } from "./stationTimetable";

/**
 * The Tricity, as the diagram on the bulkhead draws it.
 *
 * §18 asks that this preserve immersion rather than open an unrelated
 * fullscreen UI, so it is a map and not a menu: the bay, the coast, the wood
 * along the western ridge, the three cities and the one line that threads all
 * of them. You pick a station by pointing at the place it is.
 *
 * EVERYTHING STATIC IS BUILT ONCE. The coastline, the sea, the wood, the urban
 * blotches, the rail, the chevrons and the lettering are all computed at module
 * scope from `LINE`, which is itself a module constant. `MapArt` is a `memo()`
 * taking no props, so React mounts that subtree once and never touches it
 * again; sweeping the cursor along the line changes fourteen markers and one
 * caption, and nothing else in the document.
 *
 * NOTHING JUMPS. The map frame holds a fixed aspect ratio and the caption
 * block holds a fixed height, so a long station name cannot push the map up
 * and a short one cannot let it drop back. Markers animate opacity only. The
 * hit targets are real buttons sized as a percentage of the same box the SVG
 * fills, so they track the art exactly at every scale.
 */

/* ----------------------------------------------------------------- palette */

const PARCHMENT = "#e3d9c2";
const RAIL_BLUE = "#3f8fd6";
const RAIL_DIM = "#2a4c68";
const RAIL_CORE_C = "#bcdcf6";
const PANEL_BG = "#12161d";
const PANEL_EDGE = "#2b3440";
const SEA_C = "#16394f";
const SEA_DEEP_C = "#112c3e";
const SURF_C = "#3a7d96";
const SHORE_C = "#4a6b62";
const LAND_C = "#242a24";
const FOREST_C = "#1b2a1d";
const FOREST_HI = "#2c4130";
const URBAN_C = "#2f2e28";
const URBAN_HI = "#3b3931";
const RIVER_C = "#1d4358";

/* ------------------------------------------------------------ the geometry */

const MAP_W = 300;
const MAP_H = 190;
/** Fills are laid in two-pixel rows: half the path data, twice the grain. */
const STEP = 2;
/** The pixel font is four pixels to a character at scale one. */
const CH = 4;

/**
 * The line, in map pixels: Gdańsk Główny in the south-east, up the coast to
 * Gdynia Główna in the north-west, which is the shape the Tricity actually is
 * and the reason the whole conurbation reads as one long ribbon.
 */
const RAIL: readonly (readonly [number, number])[] = [
  [252, 174],
  [242, 162],
  [231, 152],
  [221, 141],
  [210, 131],
  [198, 121],
  [185, 111],
  [171, 101],
  [157, 91],
  [145, 80],
  [133, 68],
  [121, 57],
  [109, 46],
  [95, 34],
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L");

const key = (s: string) =>
  norm(s)
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/** Station name → where it sits, keyed on a normalised name so the table
 *  survives whatever ids the timetable happens to use. */
const PLACES: Record<string, readonly [number, number]> = {
  gdanskglowny: RAIL[0],
  gdanskstocznia: RAIL[1],
  gdanskpolitechnika: RAIL[2],
  gdanskwrzeszcz: RAIL[3],
  gdanskzaspa: RAIL[4],
  gdanskprzymorzeuniwersytet: RAIL[5],
  gdanskoliwa: RAIL[6],
  sopotwyscigi: RAIL[7],
  sopot: RAIL[8],
  sopotkamiennypotok: RAIL[9],
  gdyniaorlowo: RAIL[10],
  gdyniaredlowo: RAIL[11],
  gdyniawzgorzeswmaksymiliana: RAIL[12],
  gdyniaglowna: RAIL[13],
};

/** By name, then by a loose contains match, then by fractional position. */
function placeOf(name: string, i: number, n: number): readonly [number, number] {
  const k = key(name);
  if (PLACES[k]) return PLACES[k];
  for (const p of Object.keys(PLACES)) {
    if (k.length > 4 && (p.includes(k) || k.includes(p))) return PLACES[p];
  }
  const t = n < 2 ? 0 : (i / (n - 1)) * (RAIL.length - 1);
  const a = RAIL[Math.floor(t)];
  const b = RAIL[Math.min(RAIL.length - 1, Math.ceil(t))];
  const f = t - Math.floor(t);
  return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f)];
}

/**
 * The city is already written on the map, so the pin drops it — except on the
 * two termini, where dropping it leaves GLOWNY and GLOWNA a letter apart and
 * the one thing a terminus label must never be is ambiguous.
 */
function pinLabel(name: string): string {
  const clean = norm(name)
    .toUpperCase()
    .replace(/[^A-Z0-9 .-]/g, "");
  const cut = clean.replace(/^(GDANSK|GDYNIA|SOPOT)\s+/, "");
  if (cut.length < 2 || /^GLOWN/.test(cut)) return clean.slice(0, 24);
  return cut.slice(0, 24);
}

type Stop = { id: string; name: string; scene?: string; spawnX?: number; stationAt?: string };

/** The whole station table, resolved once. */
const STOPS = (LINE as readonly Stop[]).map((st, i, all) => {
  const [x, y] = placeOf(st.name, i, all.length);
  const pin = pinLabel(st.name);
  const w = pin.length * CH;
  /* labels flip to the inland side rather than run off the frame */
  const flip = x + 9 + w > MAP_W - 3;
  return { ...st, i, x, y, pin, pinX: flip ? x - 9 - w : x + 9, open: Boolean(st.scene) };
});

/* --------------------------------------------------------- land, sea, wood */

const interp = (pts: readonly (readonly [number, number])[], y: number): number => {
  if (y <= pts[0][0]) {
    const [y0, x0] = pts[0];
    const [y1, x1] = pts[1];
    return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
  }
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][0]) {
      const [y0, x0] = pts[i - 1];
      const [y1, x1] = pts[i];
      return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    }
  }
  const [ya, xa] = pts[pts.length - 2];
  const [yb, xb] = pts[pts.length - 1];
  return xb + ((xb - xa) * (y - yb)) / (yb - ya);
};

/**
 * The coast, as (y, x): the rail offset north-east by about a kilometre and a
 * half, then wandered by hand — the Gdynia basins bite in at the top, Sopot
 * pushes its beach out in the middle, and the bay leaves the frame bottom right.
 */
const COAST: readonly (readonly [number, number])[] = [
  [0, 118],
  [10, 128],
  [16, 123],
  [22, 139],
  [30, 152],
  [38, 159],
  [49, 171],
  [60, 180],
  [70, 193],
  [80, 209],
  [90, 224],
  [100, 236],
  [110, 247],
  [121, 259],
  [131, 271],
  [143, 281],
  [160, 296],
  [172, 310],
];
const coastX = (y: number) => interp(COAST, y);

/** The western wood: the Trójmiejski park, a long band behind the cities. */
const woodR = (y: number) => coastX(y) - 118;
const woodL = (y: number) => coastX(y) - 176;

const rows = (left: (y: number) => number, right: (y: number) => number, step = STEP): Rect[] => {
  const out: Rect[] = [];
  for (let y = 0; y < MAP_H; y += step) {
    const a = Math.max(0, Math.round(left(y)));
    const b = Math.min(MAP_W, Math.round(right(y)));
    if (b > a) out.push([a, y, b - a, Math.min(step, MAP_H - y)]);
  }
  return out;
};

const LAND_PATH = pxPath([[0, 0, MAP_W, MAP_H]]);
const SEA_PATH = pxPath(rows(coastX, () => MAP_W));
const SEA_DEEP_PATH = pxPath(
  rows(
    (y) => coastX(y) + 34,
    () => MAP_W,
  ),
);
const SURF_PATH = pxPath(rows(coastX, (y) => coastX(y) + 3, 1));
const SHORE_PATH = pxPath(rows((y) => coastX(y) - 2, coastX, 1));
const WOOD_PATH = pxPath(rows(woodL, woodR));

/** Tree stipple, deterministic — primes, so it never crawls. */
const WOOD_DOTS = pxPath(
  (() => {
    const out: Rect[] = [];
    for (let y = 0; y < MAP_H; y += 4) {
      const l = Math.max(0, Math.round(woodL(y)));
      const r = Math.min(MAP_W, Math.round(woodR(y)));
      for (let x = l; x < r - 1; x += 5) {
        if ((x * 7 + y * 13) % 4 < 2) out.push([x + ((y / 4) % 2 ? 2 : 0), y, 2, 2]);
      }
    }
    return out;
  })(),
);

/** Waves: short dashes, thinning out to sea. */
const WAVES = pxPath(
  (() => {
    const out: Rect[] = [];
    for (let y = 4; y < MAP_H; y += 6) {
      const c = coastX(y);
      for (let k = 0; k < 5; k++) {
        const x = Math.round(c + 10 + k * 22 + ((y * 5) % 14));
        if (x + 6 < MAP_W) out.push([x, y, k > 2 ? 3 : 5, 1]);
      }
    }
    return out;
  })(),
);

/** The three cities, as blotches of denser ground on the rail. */
const CITY_BLOBS = [
  [232, 156, 36, 28],
  [160, 92, 24, 20],
  [104, 42, 28, 24],
] as const;

const ellipse = (cx: number, cy: number, rx: number, ry: number): Rect[] => {
  const out: Rect[] = [];
  for (let dy = -ry; dy <= ry; dy += STEP) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    if (w > 0) out.push([cx - w, cy + dy, w * 2, STEP]);
  }
  return out;
};
const URBAN_PATH = pxPath(CITY_BLOBS.flatMap(([cx, cy, rx, ry]) => ellipse(cx, cy, rx, ry)));
const URBAN_GRID = pxPath(
  (() => {
    const out: Rect[] = [];
    for (const [cx, cy, rx, ry] of CITY_BLOBS) {
      for (let dy = -ry; dy <= ry; dy += 5) {
        const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
        for (let dx = -w; dx < w; dx += 5) {
          if ((dx * 3 + dy * 7) % 3 === 0) out.push([cx + dx, cy + dy, 2, 2]);
        }
      }
    }
    return out;
  })(),
);

/** The Motława, coming up out of the bottom of the frame behind Gdańsk. */
const RIVER_PATH = pxPath([
  [256, 176, 3, 14],
  [258, 164, 3, 12],
  [261, 154, 3, 10],
  [264, 145, 3, 9],
  [267, 137, 4, 8],
]);

/** Sopot's pier, the one thing everybody draws on this coast. */
const PIER_X = Math.round(coastX(60));
const PIER = pxPath([
  [PIER_X - 1, 60, 16, 2],
  [PIER_X + 13, 56, 6, 6],
]);

/** Gdynia's basins: two notches of sea biting into the port. */
const BASINS = pxPath([
  [Math.round(coastX(14)) - 13, 13, 15, 3],
  [Math.round(coastX(24)) - 17, 24, 19, 3],
]);

/** Shipyard cranes over the Gdańsk yard, three ticks on the skyline. */
const CRANES = pxPath([
  [246, 122, 1, 8],
  [243, 122, 7, 1],
  [253, 116, 1, 10],
  [250, 116, 7, 1],
  [260, 126, 1, 7],
  [257, 126, 6, 1],
]);

/* ------------------------------------------------------------ the rail art */

/** An integer line, as pixel runs — the rail is drawn, not stroked. */
function segRects(ax: number, ay: number, bx: number, by: number, t: number): Rect[] {
  const out: Rect[] = [];
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx - dy;
  let x = ax;
  let y = ay;
  for (;;) {
    out.push([x, y, t, t]);
    if (x === bx && y === by) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}
const railRects = (t: number) =>
  RAIL.slice(0, -1).flatMap((p, i) => segRects(p[0], p[1], RAIL[i + 1][0], RAIL[i + 1][1], t));

const RAIL_SHADOW = pxPath(railRects(3).map(([x, y, w, h]) => [x + 1, y + 1, w, h] as Rect));
const RAIL_PATH = pxPath(railRects(3));
const RAIL_CORE = pxPath(railRects(1).map(([x, y]) => [x + 1, y + 1, 1, 1] as Rect));

/** The stretch already behind the unit. Both directions, both endpoints, all
 *  precomputed — the component only ever indexes this. */
const BEHIND: Record<string, string> = {};
for (let idx = 0; idx < RAIL.length; idx++) {
  for (const d of [1, -1]) {
    const seg: Rect[] = [];
    const lo = d > 0 ? 0 : idx;
    const hi = d > 0 ? idx : RAIL.length - 1;
    for (let i = lo; i < hi; i++) {
      seg.push(...segRects(RAIL[i][0], RAIL[i][1], RAIL[i + 1][0], RAIL[i + 1][1], 3));
    }
    BEHIND[`${idx}:${d}`] = pxPath(seg);
  }
}

/** Chevrons at every mid-point, one set per direction. */
function chevrons(d: number): string {
  const out: Rect[] = [];
  for (let i = 0; i < RAIL.length - 1; i++) {
    const cx = Math.round((RAIL[i][0] + RAIL[i + 1][0]) / 2);
    const cy = Math.round((RAIL[i][1] + RAIL[i + 1][1]) / 2);
    for (let k = 0; k < 3; k++) {
      out.push([cx - 2 + k * d, cy - 2 + k, 1, 1]);
      out.push([cx - 2 + k * d, cy + 2 - k, 1, 1]);
    }
  }
  return pxPath(out);
}
const CHEV_FWD = chevrons(1);
const CHEV_BACK = chevrons(-1);

/* --------------------------------------------------------------- lettering */

const CITY_LABELS = [
  { t: "GDANSK", x: 196, y: 172 },
  { t: "SOPOT", x: 122, y: 98 },
  { t: "GDYNIA", x: 58, y: 50 },
] as const;
const SEA_LABEL = { t: "ZATOKA GDANSKA", x: 198, y: 44 } as const;

/* ----------------------------------------------------------- the art layer */

const MapArt = memo(function MapArt() {
  return (
    <g>
      <path d={LAND_PATH} fill={LAND_C} />
      <path d={WOOD_PATH} fill={FOREST_C} />
      <path d={WOOD_DOTS} fill={FOREST_HI} opacity={0.55} />
      <path d={URBAN_PATH} fill={URBAN_C} />
      <path d={URBAN_GRID} fill={URBAN_HI} opacity={0.7} />
      <path d={RIVER_PATH} fill={RIVER_C} />
      <path d={SHORE_PATH} fill={SHORE_C} opacity={0.7} />
      <path d={SEA_PATH} fill={SEA_C} />
      <path d={SEA_DEEP_PATH} fill={SEA_DEEP_C} opacity={0.55} />
      <path d={BASINS} fill={SEA_C} />
      <path d={SURF_PATH} fill={SURF_C} opacity={0.55} />
      <path d={WAVES} fill={SURF_C} opacity={0.3} />
      <path d={PIER} fill={PARCHMENT} opacity={0.45} />
      <path d={CRANES} fill={PARCHMENT} opacity={0.3} />
      <path d={textPath(SEA_LABEL.t, SEA_LABEL.x, SEA_LABEL.y)} fill={SURF_C} opacity={0.45} />
      {CITY_LABELS.map((c) => (
        <path key={c.t} d={textPath(c.t, c.x, c.y)} fill={PARCHMENT} opacity={0.5} />
      ))}
    </g>
  );
});

/* --------------------------------------------------------------- component */

const MIN_PER_STOP = 3;

export function RouteMap({
  here,
  toward,
  onClose,
  onTravel,
}: {
  here: string;
  toward?: "gdansk" | "gdynia";
  onClose: () => void;
  onTravel: (scene: string, spawnX: number, stationAt?: string) => void;
}) {
  const hereIdx = useMemo(() => STOPS.findIndex((s) => s.id === here), [here]);
  const dir = toward === "gdansk" ? -1 : 1;
  const terminus = dir > 0 ? STOPS[STOPS.length - 1] : STOPS[0];
  const railIdx = Math.min(
    RAIL.length - 1,
    Math.max(0, hereIdx < 0 ? (dir > 0 ? 0 : RAIL.length - 1) : hereIdx),
  );
  const behind = BEHIND[`${railIdx}:${dir}`] ?? "";

  const ahead = useCallback(
    (i: number) => (hereIdx < 0 ? true : dir > 0 ? i > hereIdx : i < hereIdx),
    [hereIdx, dir],
  );

  const reachable = useMemo(() => STOPS.filter((s) => s.open), []);
  const [pick, setPick] = useState(() => {
    const f = reachable.findIndex(
      (s) => s.id !== here && (hereIdx < 0 || (dir > 0 ? s.i > hereIdx : s.i < hereIdx)),
    );
    if (f >= 0) return f;
    const o = reachable.findIndex((s) => s.id !== here);
    return o < 0 ? 0 : o;
  });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    setPick((p) => (p < reachable.length ? p : 0));
  }, [reachable.length]);

  const move = useCallback(
    (d: number) => {
      setPick((p) => {
        if (reachable.length < 2) return p;
        const n = (p + d + reachable.length) % reachable.length;
        if (n !== p) playSfx("click");
        return n;
      });
    },
    [reachable.length],
  );

  const selected = reachable[pick];

  const go = useCallback(() => {
    if (!selected?.scene || selected.spawnX === undefined) return;
    playSfx("chime");
    onTravel(selected.scene, selected.spawnX, selected.stationAt);
  }, [selected, onTravel]);

  useMenuInput(true, {
    onHorizontal: move,
    onVertical: move,
    onConfirm: go,
    onCancel: onClose,
  });

  const trip = useMemo(() => {
    if (!selected || hereIdx < 0 || selected.i === hereIdx) return null;
    if (ahead(selected.i)) {
      const n = Math.abs(selected.i - hereIdx);
      return { n, mins: n * MIN_PER_STOP, back: false };
    }
    const toEnd = dir > 0 ? STOPS.length - 1 - hereIdx : hereIdx;
    const backFrom = dir > 0 ? STOPS.length - 1 - selected.i : selected.i;
    const n = toEnd + backFrom;
    return { n, mins: n * MIN_PER_STOP, back: true };
  }, [selected, hereIdx, ahead, dir]);

  const shown = hover !== null ? STOPS[hover] : selected;
  const caption = !shown
    ? "The line is not showing any stops this game can reach."
    : !shown.open
      ? "On the line, but not in the game yet."
      : shown.id === here
        ? "Where you got on. You could stay on and go round again."
        : hover === null && trip?.back
          ? `Behind you. You would ride to ${terminus?.name ?? "the end"} and come back.`
          : "The doors will open on the right.";

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Put the map back"
        className="absolute inset-0"
        style={{ background: "rgba(6,8,13,0.88)" }}
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-3xl"
        style={{
          background: PANEL_BG,
          border: `2px solid ${PANEL_EDGE}`,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 18px 48px rgba(0,0,0,0.55)",
          padding: "18px 20px 16px",
        }}
      >
        <div className="mb-3 flex items-center gap-3">
          <PixelLabel text="SKM TROJMIASTO" px={3} fill={SIGNAL} opacity={0.9} />
          <span style={{ flex: 1, height: 2, background: RULE }} />
          <PixelLabel
            text={terminus ? `>> ${pinLabel(terminus.name)}` : "LINIA 1"}
            px={2}
            fill={PARCHMENT}
            opacity={0.5}
          />
        </div>

        {/* the map. Fixed ratio, so the buttons over it can be positioned in
            percentages and land on the pixel they name. */}
        <div
          className="relative w-full"
          style={{ aspectRatio: `${MAP_W} / ${MAP_H}`, background: SEA_DEEP_C }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            preserveAspectRatio="none"
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <MapArt />
            <path d={RAIL_SHADOW} fill="#000" opacity={0.45} />
            <path d={RAIL_PATH} fill={RAIL_BLUE} />
            {behind ? <path d={behind} fill={RAIL_DIM} /> : null}
            <path d={RAIL_CORE} fill={RAIL_CORE_C} opacity={0.5} />
            <path d={dir > 0 ? CHEV_FWD : CHEV_BACK} fill={PARCHMENT} opacity={0.35} />

            {STOPS.map((s) => {
              const isHere = s.id === here;
              const isPick = selected?.id === s.id;
              const isHover = hover === s.i;
              const live = ahead(s.i) || isHere;
              const r = isHere ? 4 : s.open ? 3 : 2;
              return (
                <g key={s.id}>
                  <rect
                    x={s.x - r}
                    y={s.y - r}
                    width={r * 2}
                    height={r * 2}
                    fill={
                      isPick
                        ? SIGNAL
                        : s.open
                          ? live
                            ? PARCHMENT
                            : "rgba(227,217,194,0.5)"
                          : "rgba(227,217,194,0.28)"
                    }
                  />
                  {isHere ? (
                    <rect
                      x={s.x - 7}
                      y={s.y - 7}
                      width={14}
                      height={14}
                      fill="none"
                      stroke={SIGNAL}
                      strokeWidth={2}
                    >
                      <animate
                        attributeName="opacity"
                        values="0.9;0.35;0.9"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                    </rect>
                  ) : null}
                  {isPick && !isHere ? (
                    <rect
                      x={s.x - 6}
                      y={s.y - 6}
                      width={12}
                      height={12}
                      fill="none"
                      stroke={SIGNAL}
                      strokeWidth={2}
                    />
                  ) : null}
                  {isPick || isHover || isHere ? (
                    <path
                      d={textPath(s.pin, s.pinX, s.y - 3)}
                      fill={isPick ? SIGNAL : PARCHMENT}
                      opacity={isPick || isHere ? 0.95 : 0.75}
                    />
                  ) : null}
                </g>
              );
            })}
          </svg>

          {/* the hit targets: real buttons, sized off the same box */}
          {STOPS.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={!s.open}
              aria-label={`${s.name}${s.id === here ? ", where you got on" : ""}${
                s.open ? "" : ", not in the game yet"
              }`}
              aria-current={selected?.id === s.id ? "true" : undefined}
              className="absolute disabled:cursor-default"
              style={{
                left: `${(s.x / MAP_W) * 100}%`,
                top: `${(s.y / MAP_H) * 100}%`,
                width: "4.6%",
                aspectRatio: "1",
                transform: "translate(-50%, -50%)",
                background: "transparent",
                border: 0,
                padding: 0,
              }}
              onPointerEnter={() => setHover(s.i)}
              onPointerLeave={() => setHover((h) => (h === s.i ? null : h))}
              onFocus={() => setHover(s.i)}
              onBlur={() => setHover((h) => (h === s.i ? null : h))}
              onClick={() => {
                const at = reachable.findIndex((r) => r.id === s.id);
                if (at >= 0 && at !== pick) {
                  setPick(at);
                  playSfx("click");
                }
              }}
              onDoubleClick={go}
            />
          ))}
        </div>

        {/* the caption. Fixed height, so nothing below it ever moves. */}
        <div className="mt-3 flex items-start justify-between gap-6" style={{ minHeight: 84 }}>
          <div style={{ minWidth: 0 }}>
            <div className="flex items-baseline gap-3">
              <PixelLabel text="GET OFF AT" px={2} fill={PARCHMENT} opacity={0.45} />
              <PixelLabel text={shown?.name ?? "—"} px={3} fill={SIGNAL} />
            </div>
            <p style={{ ...prose(12), marginTop: 6, maxWidth: 440, minHeight: 32 }}>{caption}</p>
            <p style={{ ...proseQuiet(11), marginTop: 4, opacity: 0.7, minHeight: 14 }}>
              {trip && hover === null
                ? `${trip.n} ${trip.n === 1 ? "stop" : "stops"} · about ${trip.mins} min`
                : "\u00a0"}
            </p>
          </div>
          <button
            type="button"
            onClick={go}
            disabled={!selected?.scene}
            className="shrink-0 disabled:opacity-40 disabled:cursor-default"
            style={{
              border: `2px solid ${SIGNAL}`,
              padding: "8px 16px",
              background: "rgba(63,143,214,0.16)",
            }}
          >
            <PixelLabel text="GET OFF" px={2} fill={SIGNAL} />
          </button>
        </div>

        <p style={{ ...proseQuiet(11), marginTop: 10 }}>
          ←→ pick · e get off there · esc put it back
        </p>
      </div>
    </div>
  );
}
