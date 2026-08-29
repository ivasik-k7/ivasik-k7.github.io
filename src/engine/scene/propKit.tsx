import { rimLight } from "./lightKit";
import {
  AOSet,
  aoPaths,
  Bev,
  type BevelSet,
  Box,
  type BoxSet,
  bevelPaths,
  boxPaths,
  Contact,
  Cylinder,
  type CylinderSet,
  contactPaths,
  cylinderPaths,
  glyphRects,
  hash,
  M,
  type Mat,
  matFrom,
  mirrorX,
  outline,
  type Ph,
  phased,
  pick,
  pxPath,
  type Rect,
  repeat,
  rustRuns,
  steppedEllipse,
  steppedLine,
  steppedRing,
  stepTranslate,
} from "./pixelKit";

/**
 * The prop kit — the street furniture every outdoor scene was drawing again.
 *
 * An inventory of the scenes found the same dozen things hand-built in two to
 * eight places each: bike racks, bins, benches, planters, shelters, kiosks,
 * notice boards, cameras, bollards, railings, lamp posts, and the litter that
 * collects around all of them. They are built once here, at the game's scale
 * (38 px ≈ 1 m, top-left light, warm-black shadow), with the volume the hand
 * versions had learned the hard way: a top face, a turned side, a contact
 * shadow, a highlight along the lit edge, and the wear that says the thing has
 * been outside for twenty years.
 *
 * Every generator returns paths precomputed at module scope; every painter is a
 * component that takes the set and the phase and picks its own materials, so a
 * scene writes
 *
 *   const RACK = bikeRack(120, GROUND, 3);
 *   <BikeRack set={RACK} ph={ph} bikes={[0, 2]} />
 *
 * and gets the same rack Elektryków has. Anything a scene wants to add on top —
 * a sticker, a tag, a glove somebody left — goes over the component, as it
 * always did.
 */

/* ================================================================== *
 * materials — the palette street furniture is actually made of
 * ================================================================== */

/** Galvanised steel: the grey everything outdoors is bolted together with. */
export const GALV = phased(M.steel);
/** Powder-coated municipal green, and the black the other half of it is. */
export const MUNICIPAL_GREEN = phased(matFrom("#3f5a44"));
export const MUNICIPAL_BLACK = phased(matFrom("#2b2e32"));
/** Hardwood slats, oiled once and never again. */
export const SLAT_OAK = phased(M.oak);
/** Precast concrete: planters, bollard bases, bin surrounds. */
export const PRECAST = phased(M.concrete);
/** Toughened glass, per phase — a tint over what is behind it. */
export const GLASS_TINT: Record<Ph, string> = {
  dawn: "#c2d6da",
  day: "#c2d6da",
  dusk: "#b9a8a8",
  night: "#6d7a84",
};
export const SHADE = "#171009";

/* ================================================================== *
 * bicycles and where they are locked
 * ================================================================== */

export type BikeRackSet = {
  hoops: string;
  hoopHi: string;
  feet: string;
  contact: ReturnType<typeof contactPaths>;
  /** the x of each stand, for parking bikes against */
  stands: number[];
};

/**
 * Sheffield stands: an inverted U of 50 mm tube, 0.75 m tall, at 1 m centres.
 * The one bike rack every Polish pavement has.
 */
export function bikeRack(x: number, groundY: number, n = 3, pitch = 38): BikeRackSet {
  const h = 28;
  const w = 27;
  const hoops: Rect[] = [];
  const hi: Rect[] = [];
  const feet: Rect[] = [];
  const stands: number[] = [];
  for (let i = 0; i < n; i++) {
    const sx = x + i * pitch;
    stands.push(sx + Math.round(w / 2));
    hoops.push([sx, groundY - h, 3, h], [sx + w - 3, groundY - h, 3, h], [sx, groundY - h, w, 3]);
    hi.push([sx, groundY - h, 1, h], [sx, groundY - h, w, 1]);
    feet.push([sx - 1, groundY - 2, 5, 2], [sx + w - 4, groundY - 2, 5, 2]);
  }
  return {
    hoops: pxPath(hoops),
    hoopHi: pxPath(hi),
    feet: pxPath(feet),
    contact: contactPaths(
      Array.from({ length: n }, (_, i) => [x + i * pitch - 2, w + 4, groundY] as const),
    ),
    stands,
  };
}

export type BicycleSet = {
  tyres: string;
  rims: string;
  hubs: string;
  spokes: string;
  frame: string;
  frameHi: string;
  saddle: string;
  bars: string;
  chain: string;
  pedal: string;
  lock: string;
  contact: ReturnType<typeof contactPaths>;
};

/**
 * A bicycle, side on, 1.75 m long: two 26" wheels as stepped rings with a hub
 * and four spokes, a diamond frame drawn in whole-pixel diagonals, a saddle, a
 * stem and bars, a chainring, and the lock through the back wheel. `facing`
 * is which way the bars point.
 */
export function bicycle(x: number, groundY: number, facing: 1 | -1 = 1): BicycleSet {
  const r = 12;
  const cy = groundY - r - 1;
  const rear = x;
  const front = x + 40;
  const wheel = (cx: number) => steppedRing(cx, cy, r, r, 2, 1);
  const rim = (cx: number) => steppedRing(cx, cy, r - 2, r - 2, 1, 1);
  const spokes = (cx: number) => [
    ...steppedLine(cx - r + 3, cy, cx + r - 3, cy),
    ...steppedLine(cx, cy - r + 3, cx, cy + r - 3),
    ...steppedLine(cx - 7, cy - 7, cx + 7, cy + 7),
    ...steppedLine(cx - 7, cy + 7, cx + 7, cy - 7),
  ];
  const bb = { x: rear + 18, y: cy + 2 }; // bottom bracket
  const seatTube = { x: rear + 14, y: cy - 16 };
  const head = { x: front - 6, y: cy - 15 };
  const frame = [
    ...steppedLine(rear, cy, seatTube.x, seatTube.y, 2), // seat stay
    ...steppedLine(rear, cy, bb.x, bb.y, 2), // chain stay
    ...steppedLine(bb.x, bb.y, seatTube.x, seatTube.y, 2), // seat tube
    ...steppedLine(seatTube.x, seatTube.y, head.x, head.y, 2), // top tube
    ...steppedLine(bb.x, bb.y, head.x, head.y, 2), // down tube
    ...steppedLine(head.x, head.y, front, cy, 2), // fork
  ];
  const frameHi = steppedLine(seatTube.x, seatTube.y - 1, head.x, head.y - 1);
  const saddle: Rect[] = [
    [seatTube.x - 1, seatTube.y - 4, 2, 4],
    [seatTube.x - 6, seatTube.y - 6, 12, 2],
    [seatTube.x - 4, seatTube.y - 7, 8, 1],
  ];
  const bars: Rect[] = [
    [head.x - 1, head.y - 6, 2, 6],
    [head.x - 5, head.y - 7, 12, 2],
  ];
  const chain = [
    ...steppedEllipse(bb.x, bb.y, 4, 4, 1),
    ...steppedLine(bb.x, bb.y - 3, rear, cy - 2),
  ];
  const pedal: Rect[] = [[bb.x + 3, bb.y + 2, 4, 2]];
  const lock: Rect[] = [
    [rear - 2, cy - 4, 2, 8],
    [rear - 2, cy - 4, 6, 2],
    [rear - 2, cy + 2, 6, 2],
  ];
  const all = {
    tyres: [...wheel(rear), ...wheel(front)],
    rims: [...rim(rear), ...rim(front)],
    hubs: [
      [rear - 1, cy - 1, 3, 3],
      [front - 1, cy - 1, 3, 3],
    ] as Rect[],
    spokes: [...spokes(rear), ...spokes(front)],
    frame,
    frameHi,
    saddle,
    bars,
    chain,
    pedal,
    lock,
  };
  const fx = (rs: Rect[]) => (facing === 1 ? rs : mirrorX(rs, x + 20));
  return {
    tyres: pxPath(fx(all.tyres)),
    rims: pxPath(fx(all.rims)),
    hubs: pxPath(fx(all.hubs)),
    spokes: pxPath(fx(all.spokes)),
    frame: pxPath(fx(all.frame)),
    frameHi: pxPath(fx(all.frameHi)),
    saddle: pxPath(fx(all.saddle)),
    bars: pxPath(fx(all.bars)),
    chain: pxPath(fx(all.chain)),
    pedal: pxPath(fx(all.pedal)),
    lock: pxPath(fx(all.lock)),
    contact: contactPaths([[x - 12, 64, groundY] as const]),
  };
}

export function BikeRack({ set, ph }: { set: BikeRackSet; ph: Ph }) {
  const g = GALV[ph];
  return (
    <g>
      <Contact set={set.contact} op={ph === "night" ? 0.4 : 0.8} />
      <path d={set.feet} fill={g.deep} />
      <path d={set.hoops} fill={g.base} />
      <path d={set.hoopHi} fill={g.hi} />
    </g>
  );
}

export function Bicycle({
  set,
  ph,
  colour = "#2f5d8a",
}: {
  set: BicycleSet;
  ph: Ph;
  colour?: string;
}) {
  const paint = phased(matFrom(colour))[ph];
  const g = GALV[ph];
  const night = ph === "night";
  return (
    <g>
      <Contact set={set.contact} op={night ? 0.4 : 0.7} />
      <path d={set.tyres} fill={night ? "#101010" : "#1a1a18"} />
      <path d={set.rims} fill={g.hi} opacity={0.8} />
      <path d={set.spokes} fill={g.base} opacity={0.6} />
      <path d={set.hubs} fill={g.deep} />
      <path d={set.chain} fill={g.lo} />
      <path d={set.frame} fill={paint.base} />
      <path d={set.frameHi} fill={paint.hi} />
      <path d={set.saddle} fill="#1d1b19" />
      <path d={set.bars} fill={g.lo} />
      <path d={set.pedal} fill={g.deep} />
      <path d={set.lock} fill="#c9a24b" />
    </g>
  );
}

/* ================================================================== *
 * bins — the three bins there are
 * ================================================================== */

export type BinStyle = "hoop" | "box" | "post";
export type BinSet = {
  style: BinStyle;
  body: BevelSet;
  box?: BoxSet;
  mouth: string;
  liner: string;
  lid: string;
  ashtray: string;
  post: string;
  sticker: string;
  rust: string;
  contact: ReturnType<typeof contactPaths>;
  ao: ReturnType<typeof aoPaths>;
};

/**
 * A litter bin. `hoop` is the ring on a post with a bag hanging in it — the
 * cheapest bin a council buys; `box` is the square steel one with a lid and
 * an ashtray on top; `post` is the small one bolted to a lamp column.
 */
export function litterBin(x: number, groundY: number, style: BinStyle = "box"): BinSet {
  if (style === "hoop") {
    const top = groundY - 36;
    return {
      style,
      body: bevelPaths([[x - 8, top + 2, 16, 22]]),
      mouth: pxPath([[x - 7, top, 14, 3]]),
      liner: pxPath([[x - 6, top + 4, 12, 18]]),
      lid: "",
      ashtray: "",
      post: pxPath([[x - 1, top + 24, 3, groundY - top - 24]]),
      sticker: pxPath([[x - 5, top + 10, 5, 4]]),
      rust: pxPath(rustRuns([[x + 1, top + 24]], 5)),
      contact: contactPaths([[x - 5, 11, groundY] as const]),
      ao: aoPaths([[x - 8, top + 24, 16]]),
    };
  }
  if (style === "post") {
    const top = groundY - 60;
    return {
      style,
      body: bevelPaths([[x - 6, top, 12, 16]]),
      mouth: pxPath([[x - 5, top + 2, 10, 4]]),
      liner: "",
      lid: pxPath([[x - 7, top - 2, 14, 2]]),
      ashtray: "",
      post: "",
      sticker: pxPath([[x - 4, top + 9, 4, 3]]),
      rust: pxPath(rustRuns([[x - 2, top + 16]], 4)),
      contact: contactPaths([]),
      ao: aoPaths([]),
    };
  }
  const top = groundY - 38;
  return {
    style,
    body: bevelPaths([[x - 9, top + 6, 18, 32]]),
    box: boxPaths([[x - 9, top + 6, 18, 32]], 3),
    mouth: pxPath([[x - 7, top + 10, 14, 6]]),
    liner: pxPath([[x - 6, top + 11, 12, 2]]),
    lid: pxPath([[x - 10, top + 3, 20, 3]]),
    ashtray: pxPath([
      [x - 4, top, 8, 3],
      [x - 3, top + 1, 6, 1],
    ]),
    post: "",
    sticker: pxPath([[x - 6, top + 24, 6, 5]]),
    rust: pxPath(rustRuns([[x - 8, top + 20]], 6)),
    contact: contactPaths([[x - 10, 20, groundY] as const]),
    ao: aoPaths([]),
  };
}

export function LitterBin({ set, ph, full = false }: { set: BinSet; ph: Ph; full?: boolean }) {
  const g = GALV[ph];
  const green = MUNICIPAL_GREEN[ph];
  const night = ph === "night";
  return (
    <g>
      <Contact set={set.contact} op={night ? 0.4 : 0.8} />
      {set.post ? <path d={set.post} fill={g.lo} /> : null}
      {set.style === "box" && set.box ? (
        <Box set={set.box} mat={green} />
      ) : (
        <Bev
          set={set.body}
          mat={
            set.style === "hoop"
              ? { hi: "#2b2b2b", base: "#1a1a1a", mid: "#161616", lo: "#101010", deep: "#080808" }
              : green
          }
        />
      )}
      {set.liner && set.style === "hoop" ? <path d={set.liner} fill="#0d0d0d" /> : null}
      <path d={set.mouth} fill={g.base} />
      {set.lid ? <path d={set.lid} fill={g.hi} /> : null}
      <path d={set.mouth} fill="#000" opacity={0.65} transform="translate(0,2)" />
      {full ? <path d={set.liner} fill="#8a8578" opacity={0.9} /> : null}
      {set.ashtray ? <path d={set.ashtray} fill={g.deep} /> : null}
      <path d={set.sticker} fill="#c9463c" opacity={0.85} />
      <path d={set.rust} fill="#8a4a2a" opacity={0.7} />
      <AOSet set={set.ao} op={0.6} />
    </g>
  );
}

/* ================================================================== *
 * benches
 * ================================================================== */

export type BenchStyle = "perforated" | "slats" | "shelter";
export type BenchSet = {
  style: BenchStyle;
  seat: BevelSet;
  seatTop: string;
  perf: string;
  back: string;
  backHi: string;
  legs: string;
  legHi: string;
  shine: string;
  burn: string;
  underShade: ReturnType<typeof aoPaths>;
  contact: ReturnType<typeof contactPaths>;
};

/**
 * A bench, `w` wide, seat at 0.45 m. `perforated` is the steel one the SKM
 * bolts to shelters, `slats` the hardwood-on-cast-iron park bench, `shelter`
 * the narrow perch inside a bus shelter. All three carry the shine where
 * people actually sit and the one cigarette burn.
 */
export function bench(
  x: number,
  groundY: number,
  w = 68,
  style: BenchStyle = "perforated",
): BenchSet {
  const seatY = groundY - 17;
  const seatH = style === "slats" ? 4 : 3;
  const legs: Rect[] =
    style === "slats"
      ? [
          [x + 2, seatY, 3, 17],
          [x + w - 5, seatY, 3, 17],
          [x + 1, groundY - 2, 5, 2],
          [x + w - 6, groundY - 2, 5, 2],
        ]
      : [
          [x + 6, seatY + seatH, 3, 17 - seatH],
          [x + w - 9, seatY + seatH, 3, 17 - seatH],
        ];
  const back: Rect[] =
    style === "perforated"
      ? [
          [x + 4, seatY - 14, w - 8, 3],
          [x + 4, seatY - 8, w - 8, 3],
        ]
      : style === "slats"
        ? [
            [x + 4, seatY - 16, w - 8, 3],
            [x + 4, seatY - 11, w - 8, 3],
            [x + 4, seatY - 6, w - 8, 3],
          ]
        : [];
  const backPosts: Rect[] =
    style === "shelter"
      ? []
      : [
          [x + 6, seatY - 16, 3, 16],
          [x + w - 9, seatY - 16, 3, 16],
        ];
  const perf =
    style === "perforated"
      ? repeat(Math.floor((w - 12) / 4), 4, [x + 7, seatY + 1, 2, 1] as Rect)
      : style === "slats"
        ? [[x + 4, seatY + 2, w - 8, 1] as Rect]
        : [];
  const sitters = [x + Math.round(w * 0.25), x + Math.round(w * 0.5), x + Math.round(w * 0.78)];
  return {
    style,
    seat: bevelPaths([[x + 2, seatY, w - 4, seatH]]),
    seatTop: pxPath([[x + 3, seatY, w - 6, 1]]),
    perf: pxPath(perf),
    back: pxPath([...back, ...backPosts]),
    backHi: pxPath(back.map(([bx, by, bw]) => [bx, by, bw, 1] as Rect)),
    legs: pxPath(legs),
    legHi: pxPath(legs.map(([lx, ly, , lh]) => [lx, ly, 1, lh] as Rect)),
    shine: pxPath(sitters.map((sx) => [sx - 5, seatY, 10, 1] as Rect)),
    burn: pxPath([[x + Math.round(w * 0.62), seatY, 2, 1]]),
    underShade: aoPaths([[x + 4, seatY + seatH, w - 8]]),
    contact: contactPaths([[x, w, groundY] as const]),
  };
}

export function Bench({ set, ph }: { set: BenchSet; ph: Ph }) {
  const g = GALV[ph];
  const wood = SLAT_OAK[ph];
  const iron = MUNICIPAL_BLACK[ph];
  const seatMat = set.style === "slats" ? wood : g;
  return (
    <g>
      <Contact set={set.contact} op={ph === "night" ? 0.4 : 0.8} />
      <path d={set.legs} fill={set.style === "slats" ? iron.base : g.lo} />
      <path d={set.legHi} fill={set.style === "slats" ? iron.hi : g.base} />
      <path d={set.back} fill={set.style === "slats" ? wood.base : g.base} />
      <path d={set.backHi} fill={set.style === "slats" ? wood.hi : g.hi} />
      <Bev set={set.seat} mat={seatMat} />
      <path d={set.perf} fill={set.style === "slats" ? wood.deep : g.deep} opacity={0.8} />
      <path d={set.seatTop} fill={seatMat.hi} />
      <path d={set.shine} fill="#ffffff" opacity={0.28} />
      <path d={set.burn} fill="#2b2622" />
      <AOSet set={set.underShade} op={0.7} />
    </g>
  );
}

/* ================================================================== *
 * planters and bollards
 * ================================================================== */

export type PlanterSet = {
  box: BoxSet;
  lip: string;
  soil: string;
  shrubs: string;
  shrubHi: string;
  shrubLo: string;
  blooms: string;
  contact: ReturnType<typeof contactPaths>;
};

/** A precast planter with the municipal shrubs in it, and a few blooms in season. */
export function planter(x: number, groundY: number, w = 56, h = 18, seed = 5): PlanterSet {
  const top = groundY - h;
  const shrubs: Rect[] = [];
  const hi: Rect[] = [];
  const lo: Rect[] = [];
  const blooms: Rect[] = [];
  const n = Math.max(2, Math.round(w / 22));
  for (let i = 0; i < n; i++) {
    const cx = x + 8 + Math.round(((w - 16) * (i + 0.5)) / n);
    const rx = 9 + pick(seed + i, 5);
    const ry = 7 + pick(seed * 3 + i, 4);
    const cy = top - ry + 2;
    shrubs.push(...steppedEllipse(cx, cy, rx, ry, 2));
    hi.push(...steppedEllipse(cx - 3, cy - 3, Math.round(rx * 0.5), Math.round(ry * 0.4), 2));
    lo.push(...steppedEllipse(cx + 3, cy + 3, Math.round(rx * 0.6), Math.round(ry * 0.4), 2));
    for (let b = 0; b < 3; b++) {
      if (hash(seed + i * 7 + b) > 0.45)
        blooms.push([
          cx - rx + 3 + pick(seed + b + i, rx * 2 - 6),
          cy - ry + 2 + pick(seed * 2 + b, ry),
          2,
          2,
        ]);
    }
  }
  return {
    box: boxPaths([[x, top, w, h]], 3),
    lip: pxPath([[x - 1, top - 1, w + 2, 2]]),
    soil: pxPath([[x + 3, top + 1, w - 6, 2]]),
    shrubs: pxPath(shrubs),
    shrubHi: pxPath(hi),
    shrubLo: pxPath(lo),
    blooms: pxPath(blooms),
    contact: contactPaths([[x - 1, w + 2, groundY] as const]),
  };
}

export function Planter({
  set,
  ph,
  blooms = "#e8a445",
  bare = false,
}: {
  set: PlanterSet;
  ph: Ph;
  blooms?: string;
  bare?: boolean;
}) {
  const c = PRECAST[ph];
  const leaf = phased(M.leaf)[ph];
  return (
    <g>
      <Contact set={set.contact} op={ph === "night" ? 0.4 : 0.8} />
      {bare ? (
        <path d={set.shrubs} fill="#5d5442" opacity={0.7} />
      ) : (
        <>
          <path d={set.shrubs} fill={leaf.base} />
          <path d={set.shrubLo} fill={leaf.deep} opacity={0.6} />
          <path d={set.shrubHi} fill={leaf.hi} opacity={0.8} />
          <path d={set.blooms} fill={blooms} />
        </>
      )}
      <Box set={set.box} mat={c} />
      <path d={set.soil} fill="#3a2a18" />
      <path d={set.lip} fill={c.hi} />
    </g>
  );
}

export type BollardSet = {
  posts: CylinderSet;
  caps: string;
  bands: string;
  bases: string;
  contact: ReturnType<typeof contactPaths>;
};

/** Bollards: 0.9 m steel posts at `pitch` centres, with a cap and a reflective band. */
export function bollards(x0: number, x1: number, groundY: number, pitch = 57): BollardSet {
  const xs: number[] = [];
  for (let x = x0; x <= x1; x += pitch) xs.push(x);
  const h = 34;
  return {
    posts: cylinderPaths(xs.map((x) => [x, groundY - h, 6, h] as Rect)),
    caps: pxPath(xs.map((x) => [x - 1, groundY - h - 2, 8, 2] as Rect)),
    bands: pxPath(xs.map((x) => [x, groundY - h + 6, 6, 3] as Rect)),
    bases: pxPath(xs.map((x) => [x - 1, groundY - 3, 8, 3] as Rect)),
    contact: contactPaths(xs.map((x) => [x - 2, 10, groundY] as const)),
  };
}

export function Bollards({ set, ph }: { set: BollardSet; ph: Ph }) {
  const g = GALV[ph];
  return (
    <g>
      <Contact set={set.contact} op={ph === "night" ? 0.4 : 0.8} />
      <path d={set.bases} fill={g.deep} />
      <Cylinder set={set.posts} mat={g} />
      <path d={set.caps} fill={g.hi} />
      <path d={set.bands} fill={ph === "night" ? "#fff2a8" : "#e8e0c8"} opacity={0.9} />
    </g>
  );
}

/* ================================================================== *
 * shelters and kiosks
 * ================================================================== */

export type ShelterSet = {
  roof: BoxSet;
  roofDirt: string;
  posts: CylinderSet;
  glass: string;
  glassSky: string;
  glassFrame: string;
  bench: BenchSet;
  caseFrame: BevelSet;
  casePaper: string;
  caseLines: string;
  caseGlare: string;
  ao: ReturnType<typeof aoPaths>;
  contact: ReturnType<typeof contactPaths>;
  /** where the light pool goes at night */
  lampX: number;
};

/**
 * A bus/tram shelter: a steel portal frame 2.5 m to the underside of a
 * shallow single-pitch roof, a glazed back with a sky band across it, a
 * perch bench and a timetable case on the right-hand post.
 */
export function busShelter(x: number, groundY: number, w = 130): ShelterSet {
  const roofY = groundY - 95;
  const postW = 5;
  return {
    roof: boxPaths([[x - 6, roofY, w + 12, 5]], 3),
    roofDirt: pxPath([[x - 4, roofY - 3, w + 8, 3]]),
    posts: cylinderPaths([
      [x, roofY + 5, postW, groundY - roofY - 5],
      [x + w - postW, roofY + 5, postW, groundY - roofY - 5],
    ]),
    glass: pxPath([[x + postW + 2, roofY + 9, w - postW * 2 - 4, groundY - roofY - 32]]),
    glassSky: pxPath([[x + postW + 2, roofY + 9, w - postW * 2 - 4, 8]]),
    glassFrame: pxPath([
      ...outline(x + postW + 1, roofY + 8, w - postW * 2 - 2, groundY - roofY - 30, 1),
      [x + Math.round(w / 2), roofY + 8, 1, groundY - roofY - 30],
    ]),
    bench: bench(x + 14, groundY, w - 60, "shelter"),
    caseFrame: bevelPaths([[x + w - 34, roofY + 22, 26, 36]]),
    casePaper: pxPath([[x + w - 31, roofY + 25, 20, 30]]),
    caseLines: pxPath(repeat(6, 4, [x + w - 29, roofY + 30, 16, 1] as Rect, "y")),
    caseGlare: pxPath([[x + w - 30, roofY + 25, 3, 30]]),
    ao: aoPaths([[x - 4, roofY + 5, w + 8]]),
    contact: contactPaths([
      [x - 1, postW + 2, groundY] as const,
      [x + w - postW - 1, postW + 2, groundY] as const,
    ]),
    lampX: x + Math.round(w / 2),
  };
}

export function BusShelter({ set, ph, behind }: { set: ShelterSet; ph: Ph; behind?: string }) {
  const g = GALV[ph];
  const night = ph === "night";
  return (
    <g>
      <Contact set={set.contact} op={night ? 0.4 : 0.8} />
      {/* the back glazing: whatever is behind it, then the tint, then the sky band */}
      {behind ? <path d={set.glass} fill={behind} /> : null}
      <path d={set.glass} fill={GLASS_TINT[ph]} opacity={0.22} />
      <path d={set.glassSky} fill="#ffffff" opacity={night ? 0.06 : 0.14} />
      <path d={set.glassFrame} fill={g.lo} />
      <Bench set={set.bench} ph={ph} />
      <Bev set={set.caseFrame} mat={g} />
      <path d={set.casePaper} fill="#f4f4f0" />
      <path d={set.caseLines} fill={g.mid} opacity={0.5} />
      <path d={set.caseGlare} fill="#ffffff" opacity={0.25} />
      <Cylinder set={set.posts} mat={g} />
      <AOSet set={set.ao} op={0.8} />
      <Box set={set.roof} mat={g} />
      <path d={set.roofDirt} fill={SHADE} opacity={0.25} />
    </g>
  );
}

export type KioskSet = {
  body: BoxSet;
  roof: BoxSet;
  roofLip: string;
  window: string;
  shelves: string;
  stock: string;
  hatch: string;
  hatchGlass: string;
  sign: string;
  shutter: string;
  shutterSlats: string;
  ao: ReturnType<typeof aoPaths>;
  contact: ReturnType<typeof contactPaths>;
  signAt: { x: number; y: number };
};

/** A Ruch kiosk: a 1.5 m green box with a window full of things and a hatch. */
export function kiosk(x: number, groundY: number, w = 56, h = 82): KioskSet {
  const top = groundY - h;
  return {
    body: boxPaths([[x, top, w, h]], 4),
    roof: boxPaths([[x - 4, top - 6, w + 8, 6]], 3),
    roofLip: pxPath([[x - 4, top - 1, w + 8, 1]]),
    window: pxPath([[x + 6, top + 12, w - 12, 30]]),
    shelves: pxPath(repeat(3, 10, [x + 7, top + 20, w - 14, 1] as Rect, "y")),
    stock: pxPath([
      ...repeat(Math.floor((w - 16) / 8), 8, [x + 8, top + 14, 6, 5] as Rect),
      ...repeat(Math.floor((w - 16) / 7), 7, [x + 8, top + 24, 5, 5] as Rect),
      ...repeat(Math.floor((w - 16) / 9), 9, [x + 8, top + 34, 7, 6] as Rect),
    ]),
    hatch: pxPath([[x + Math.round(w / 2) - 8, top + 46, 16, 22]]),
    hatchGlass: pxPath([[x + Math.round(w / 2) - 6, top + 48, 12, 10]]),
    sign: pxPath([[x + 4, top + 2, w - 8, 8]]),
    shutter: pxPath([[x + 6, top + 12, w - 12, 30]]),
    shutterSlats: pxPath(repeat(10, 3, [x + 6, top + 13, w - 12, 1] as Rect, "y")),
    ao: aoPaths([[x, top, w]]),
    contact: contactPaths([[x - 2, w + 4, groundY] as const]),
    signAt: { x: x + 8, y: top + 3 },
  };
}

export function Kiosk({ set, ph, open = true }: { set: KioskSet; ph: Ph; open?: boolean }) {
  const green = MUNICIPAL_GREEN[ph];
  const g = GALV[ph];
  const night = ph === "night";
  return (
    <g>
      <Contact set={set.contact} op={night ? 0.4 : 0.8} />
      <Box set={set.body} mat={green} />
      <path d={set.sign} fill="#f4f4f0" />
      {open ? (
        <>
          <path
            d={set.window}
            fill={night ? "#ffd98a" : GLASS_TINT[ph]}
            opacity={night ? 0.9 : 1}
          />
          <path d={set.shelves} fill={green.deep} opacity={0.7} />
          <path d={set.stock} fill={night ? "#8a6a3a" : "#5d6266"} opacity={0.85} />
          <path d={set.hatch} fill="#1a1d22" opacity={0.75} />
          <path d={set.hatchGlass} fill={night ? "#ffd98a" : "#6d7a84"} opacity={0.6} />
        </>
      ) : (
        <>
          <path d={set.shutter} fill={g.base} />
          <path d={set.shutterSlats} fill={g.deep} opacity={0.6} />
          <path d={set.hatch} fill={g.lo} />
        </>
      )}
      <AOSet set={set.ao} op={0.7} />
      <Box set={set.roof} mat={g} />
      <path d={set.roofLip} fill={g.deep} />
    </g>
  );
}

/* ================================================================== *
 * boards, cases, signs
 * ================================================================== */

export type NoticeBoardSet = {
  frame: BevelSet;
  cork: string;
  papers: string;
  papersLines: string;
  pins: string;
  liftedCorner: Rect;
  glass: string;
  ao: ReturnType<typeof aoPaths>;
};

/** A housing-association notice board: frame, cork, pinned papers, one curling. */
export function noticeBoard(x: number, y: number, w = 40, h = 44, seed = 9): NoticeBoardSet {
  const papers: Rect[] = [];
  const lines: Rect[] = [];
  const pins: Rect[] = [];
  const cols = Math.max(1, Math.floor((w - 8) / 14));
  for (let i = 0; i < cols * 2; i++) {
    const px = x + 4 + (i % cols) * 14 + pick(seed + i, 3);
    const py = y + 5 + Math.floor(i / cols) * 18 + pick(seed * 3 + i, 3);
    const pw = 10 + pick(seed + i * 7, 3);
    const ph = 12 + pick(seed * 5 + i, 4);
    papers.push([px, py, pw, ph]);
    for (let l = 0; l < 3; l++) lines.push([px + 2, py + 3 + l * 3, pw - 4 - pick(i + l, 3), 1]);
    pins.push([px + Math.round(pw / 2), py, 1, 1]);
  }
  const last = papers[papers.length - 1];
  return {
    frame: bevelPaths(outline(x, y, w, h, 2)),
    cork: pxPath([[x + 2, y + 2, w - 4, h - 4]]),
    papers: pxPath(papers),
    papersLines: pxPath(lines),
    pins: pxPath(pins),
    liftedCorner: [last[0] + last[2] - 4, last[1] + last[3] - 4, 4, 4],
    glass: pxPath([[x + 3, y + 3, 3, h - 6]]),
    ao: aoPaths([[x, y + h, w]]),
  };
}

export function NoticeBoard({
  set,
  ph,
  glazed = false,
}: {
  set: NoticeBoardSet;
  ph: Ph;
  glazed?: boolean;
}) {
  const wood = SLAT_OAK[ph];
  const [cx, cy, cw, ch] = set.liftedCorner;
  return (
    <g>
      <AOSet set={set.ao} op={0.6} />
      <path d={set.cork} fill={ph === "night" ? "#5a4530" : "#8a6a48"} />
      <path d={set.papers} fill="#f0eee8" />
      <path d={set.papersLines} fill="#8a8f96" />
      <path d={set.pins} fill="#c9463c" />
      <g>
        <path d={pxPath([[cx, cy, cw, ch]])} fill="#dcd9d1" />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`0 ${cx} ${cy};0 ${cx} ${cy};-16 ${cx} ${cy};3 ${cx} ${cy};0 ${cx} ${cy}`}
          dur="11s"
          repeatCount="indefinite"
          calcMode="discrete"
        />
      </g>
      {glazed ? <path d={set.glass} fill="#ffffff" opacity={0.18} /> : null}
      <Bev set={set.frame} mat={wood} />
    </g>
  );
}

export type SignSet = {
  plate: BevelSet;
  post: string;
  postHi: string;
  contact: ReturnType<typeof contactPaths>;
  textAt: { x: number; y: number };
};

/** A sign plate on a post — for the 3×5 font to write on. */
export function signPost(x: number, groundY: number, w = 48, h = 14, postH = 70): SignSet {
  const top = groundY - postH - h;
  return {
    plate: bevelPaths([[x - Math.round(w / 2), top, w, h]]),
    post: pxPath([[x - 1, top + h, 3, postH]]),
    postHi: pxPath([[x - 1, top + h, 1, postH]]),
    contact: contactPaths([[x - 3, 7, groundY] as const]),
    textAt: { x: x - Math.round(w / 2) + 4, y: top + 4 },
  };
}

export function SignPost({ set, ph, mat }: { set: SignSet; ph: Ph; mat: Mat }) {
  const g = GALV[ph];
  return (
    <g>
      <Contact set={set.contact} op={ph === "night" ? 0.4 : 0.7} />
      <path d={set.post} fill={g.lo} />
      <path d={set.postHi} fill={g.hi} />
      <Bev set={set.plate} mat={mat} />
    </g>
  );
}

/* ================================================================== *
 * cameras, railings, lamp posts
 * ================================================================== */

export type CctvSet = {
  arm: string;
  body: BevelSet;
  hood: string;
  lens: string;
  led: string;
  pivot: { x: number; y: number };
};

/** A CCTV camera on a wall arm, looking `facing`. Pan it with the pivot. */
export function cctv(x: number, y: number, facing: 1 | -1 = 1): CctvSet {
  const bodyRects: Rect[] = [[x, y, 16, 8]];
  const fx = (rs: Rect[]) => (facing === 1 ? rs : mirrorX(rs, x + 8));
  return {
    arm: pxPath(
      fx([
        [x - 6, y + 2, 8, 2],
        [x - 6, y - 8, 2, 12],
      ]),
    ),
    body: bevelPaths(fx(bodyRects)),
    hood: pxPath(fx([[x - 1, y - 1, 18, 2]])),
    lens: pxPath(
      fx([
        [x + 14, y + 2, 3, 4],
        [x + 15, y + 3, 1, 2],
      ]),
    ),
    led: pxPath(fx([[x + 2, y + 5, 2, 2]])),
    pivot: { x: x + 8, y: y + 4 },
  };
}

export function Cctv({ set, ph, pan = true }: { set: CctvSet; ph: Ph; pan?: boolean }) {
  const dark = MUNICIPAL_BLACK[ph];
  const { x, y } = set.pivot;
  return (
    <g>
      <path d={set.arm} fill={GALV[ph].lo} />
      <g>
        <Bev set={set.body} mat={dark} />
        <path d={set.hood} fill={dark.hi} />
        <path d={set.lens} fill="#0a0c10" />
        <path d={set.lens} fill="#6d7a84" opacity={0.6} transform="translate(0,-1)" />
        {pan ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${x} ${y};7 ${x} ${y};7 ${x} ${y};-7 ${x} ${y};-7 ${x} ${y};0 ${x} ${y}`}
            dur="24s"
            repeatCount="indefinite"
          />
        ) : null}
      </g>
      <path d={set.led} fill="#ff4040">
        <animate
          attributeName="opacity"
          values="1;0;0;1"
          dur="3.6s"
          repeatCount="indefinite"
          calcMode="discrete"
        />
      </path>
    </g>
  );
}

export type RailingSet = {
  posts: string;
  postHi: string;
  rails: string;
  railHi: string;
  rust: string;
  feet: string;
  contact: ReturnType<typeof contactPaths>;
};

/** Galvanised railing: posts at `pitch`, a top rail and a knee rail, rust at the feet. */
export function railing(x0: number, x1: number, groundY: number, h = 40, pitch = 40): RailingSet {
  const xs: number[] = [];
  for (let x = x0; x <= x1 - 3; x += pitch) xs.push(x);
  xs.push(x1 - 3);
  const posts = xs.map((x) => [x, groundY - h, 3, h] as Rect);
  return {
    posts: pxPath(posts),
    postHi: pxPath(xs.map((x) => [x, groundY - h, 1, h] as Rect)),
    rails: pxPath([
      [x0, groundY - h, x1 - x0, 3],
      [x0, groundY - Math.round(h * 0.45), x1 - x0, 2],
    ]),
    railHi: pxPath([[x0, groundY - h, x1 - x0, 1]]),
    rust: pxPath(
      rustRuns(
        xs.filter((_, i) => i % 2 === 0).map((x) => [x + 1, groundY - 8] as const),
        5,
      ),
    ),
    feet: pxPath(xs.map((x) => [x - 1, groundY - 2, 5, 2] as Rect)),
    contact: contactPaths(xs.map((x) => [x - 1, 5, groundY] as const)),
  };
}

export function Railing({ set, ph }: { set: RailingSet; ph: Ph }) {
  const g = GALV[ph];
  return (
    <g>
      <Contact set={set.contact} op={ph === "night" ? 0.35 : 0.6} />
      <path d={set.feet} fill={g.deep} />
      <path d={set.posts} fill={g.base} />
      <path d={set.postHi} fill={g.hi} />
      <path d={set.rails} fill={g.base} />
      <path d={set.railHi} fill={g.hi} />
      <path d={set.rust} fill="#8a4a2a" opacity={0.7} />
    </g>
  );
}

export type LampPostSet = {
  column: CylinderSet;
  base: BoxSet;
  head: BevelSet;
  lens: string;
  bracket: string;
  door: string;
  contact: ReturnType<typeof contactPaths>;
  headAt: { x: number; y: number };
};

/**
 * A street lamp column with its base plinth, access door, bracket and head.
 * `h` is the visible height — a 5 m column runs out of the frame, so pass what
 * fits. Light comes from lightKit: `streetLamp(headAt.x, headAt.y, groundY)`.
 */
export function lampPost(
  x: number,
  groundY: number,
  h = 150,
  style: "cobra" | "post-top" = "cobra",
): LampPostSet {
  const top = groundY - h;
  const headY = top + 4;
  const headRect: Rect = style === "cobra" ? [x + 6, headY, 20, 6] : [x - 6, headY - 8, 16, 10];
  return {
    column: cylinderPaths([[x, top, 5, h]]),
    base: boxPaths([[x - 3, groundY - 12, 11, 12]], 2),
    head: bevelPaths([headRect]),
    lens: pxPath(style === "cobra" ? [[x + 8, headY + 6, 16, 2]] : [[x - 4, headY - 6, 12, 6]]),
    bracket: pxPath(style === "cobra" ? [[x + 4, headY + 1, 4, 3]] : []),
    door: pxPath([[x + 1, groundY - 40, 3, 12]]),
    contact: contactPaths([[x - 4, 13, groundY] as const]),
    headAt: { x: style === "cobra" ? x + 16 : x + 2, y: headY + 6 },
  };
}

export function LampPost({ set, ph, lit }: { set: LampPostSet; ph: Ph; lit?: boolean }) {
  const g = GALV[ph];
  const on = lit ?? ph !== "day";
  return (
    <g>
      <Contact set={set.contact} op={ph === "night" ? 0.4 : 0.8} />
      <Box set={set.base} mat={g} />
      <Cylinder set={set.column} mat={g} />
      <path d={set.door} fill={g.deep} opacity={0.7} />
      <path d={set.bracket} fill={g.lo} />
      <Bev set={set.head} mat={MUNICIPAL_BLACK[ph]} />
      <path d={set.lens} fill={on ? "#fff6d8" : "#c2c8cc"} opacity={on ? 1 : 0.7} />
    </g>
  );
}

/* ================================================================== *
 * litter and birds — what collects around all of the above
 * ================================================================== */

export type LitterSet = {
  stubs: string;
  gum: string;
  paper: string;
  caps: string;
  receipts: string;
  leavesDry: string;
};

/**
 * The litter a stretch of pavement has: cigarette ends, gum trodden black,
 * paper, bottle caps, a receipt, dry leaves. `density` 1 is a normal street;
 * 3 is outside a bar on a Sunday morning.
 */
export function litter(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  density = 1,
  seed = 41,
): LitterSet {
  const w = x1 - x0;
  const h = y1 - y0;
  const at = (i: number, k: number): [number, number] => [
    x0 + Math.round(hash(seed + i * 13 + k) * (w - 4)),
    y0 + Math.round(hash(seed * 3 + i * 7 + k) * (h - 2)),
  ];
  const n = Math.round((w / 60) * density);
  const stubs: Rect[] = [];
  const gum: Rect[] = [];
  const paper: Rect[] = [];
  const caps: Rect[] = [];
  const receipts: Rect[] = [];
  const leavesDry: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const [sx, sy] = at(i, 1);
    stubs.push([sx, sy, 2, 1]);
    const [gx, gy] = at(i, 2);
    gum.push([gx, gy, 2, 1]);
    if (i % 3 === 0) {
      const [px, py] = at(i, 3);
      paper.push([px, py, 4 + pick(i, 3), 2]);
    }
    if (i % 4 === 1) {
      const [cx, cy] = at(i, 4);
      caps.push([cx, cy, 2, 1]);
    }
    if (i % 6 === 2) {
      const [rx, ry] = at(i, 5);
      receipts.push([rx, ry, 5, 2], [rx, ry, 5, 1]);
    }
    if (i % 2 === 0) {
      const [lx, ly] = at(i, 6);
      leavesDry.push([lx, ly, 3, 2], [lx + 3, ly + 1, 1, 1]);
    }
  }
  return {
    stubs: pxPath(stubs),
    gum: pxPath(gum),
    paper: pxPath(paper),
    caps: pxPath(caps),
    receipts: pxPath(receipts),
    leavesDry: pxPath(leavesDry),
  };
}

export function Litter({ set, ph, leaves = false }: { set: LitterSet; ph: Ph; leaves?: boolean }) {
  const night = ph === "night";
  return (
    <g>
      <path d={set.gum} fill={night ? "#3a3d42" : "#6f6c66"} opacity={0.7} />
      <path d={set.stubs} fill="#e8e4dc" opacity={night ? 0.35 : 0.55} />
      <path d={set.paper} fill="#e8e4da" opacity={night ? 0.5 : 0.75} />
      <path d={set.receipts} fill="#f4f4f0" opacity={night ? 0.5 : 0.8} />
      <path d={set.caps} fill="#b8912e" opacity={0.7} />
      {leaves ? <path d={set.leavesDry} fill="#9a6f34" opacity={0.85} /> : null}
    </g>
  );
}

/** Gulls in the sky: the three-pixel M that reads as a gull at any size. */
export function gulls(points: readonly (readonly [x: number, y: number])[]): string {
  return pxPath(
    points.flatMap(([x, y]) => [
      [x, y + 1, 3, 1] as Rect,
      [x + 3, y, 3, 1] as Rect,
      [x + 6, y + 1, 3, 1] as Rect,
    ]),
  );
}

/** A pigeon on the ground, and the hop it takes. Render one <Pigeon> per bird. */
export type PigeonSet = { body: string; hop: ReturnType<typeof stepTranslate> };

export function pigeon(x: number, y: number, i = 0, facing: 1 | -1 = 1): PigeonSet {
  const rects: Rect[] = [
    [x, y - 3, 5, 3],
    [x + 4, y - 4, 2, 2],
    [x + 6, y - 3, 1, 1],
    [x + 1, y, 1, 1],
    [x + 3, y, 1, 1],
  ];
  const body = pxPath(facing === 1 ? rects : mirrorX(rects, x + 3));
  const d = facing;
  return {
    body,
    hop: stepTranslate(
      [
        [0, 0],
        [6 * d, 0],
        [6 * d, 0],
        [13 * d, 0],
        [13 * d, 0],
        [21 * d, 0],
        [21 * d, 0],
        [0, 0],
      ],
      `${9 + i * 2}s`,
      [0, 0.07, 0.25, 0.32, 0.55, 0.62, 0.92, 1],
    ),
  };
}

export function Pigeon({ set, ph }: { set: PigeonSet; ph: Ph }) {
  if (ph === "night") return null;
  return (
    <g fill="#5d6068">
      <path d={set.body} />
      <animateTransform {...set.hop} />
    </g>
  );
}

/* ================================================================== *
 * pictograms — the signs the props carry
 * ================================================================== */

export const PICTO = {
  wheelchair: [
    "   ##    ",
    "   ##    ",
    "         ",
    "  ####   ",
    "  #  #   ",
    " ##  #   ",
    "##   ##  ",
    "#     #  ",
    "#    ##  ",
    " ##### # ",
    "  ###    ",
  ],
  bicycle: [
    "      ##   ",
    "  #####    ",
    " #   #   # ",
    "###  #  ###",
    "# # ### # #",
    "# #  #  # #",
    "###     ###",
  ],
  noSmoking: [
    "  ####  ",
    " #    # ",
    "#   ## #",
    "#  ## ##",
    "# ##   #",
    "###    #",
    " #    # ",
    "  ####  ",
  ],
  cctv: [
    "  #####  ",
    " #     # ",
    "#  ###  #",
    "#  ###  #",
    " #     # ",
    "  #####  ",
    "    #    ",
    "   ###   ",
  ],
  arrowUp: ["  #  ", " ### ", "#####", "  #  ", "  #  ", "  #  "],
  arrowDown: ["  #  ", "  #  ", "  #  ", "#####", " ### ", "  #  "],
  exit: ["#   ###", "#  #   ", "#### ##", "#  #  #", "#   ###"],
  bin: [" ##### ", "#######", " #   # ", " #   # ", " #   # ", " ##### "],
  wifi: ["  ###  ", " #   # ", "#  #  #", "  ###  ", "   #   ", "  ###  ", "   #   "],
} as const;

/** A pictogram as rects at (x, y). */
export const picto = (name: keyof typeof PICTO, x: number, y: number): Rect[] =>
  glyphRects(PICTO[name], x, y);

/** Rim-light a set of rects along its lit edges — re-exported for prop overlays. */
export { rimLight };
