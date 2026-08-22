import { GameRuntime, type RuntimeConfig, type RuntimeSceneDef, SCENE_HEIGHT } from "@/engine";

/**
 * ExampleGame — the smallest complete game the engine can run, kept as
 * living documentation (and reachable at /example, code-split so the real
 * game never pays for it).
 *
 * It demonstrates the whole public surface in ~200 lines: a player rig,
 * two scenes (one with a walkable ground band and a blocker, one classic
 * single-line), doors between them, an interaction handler, a patrolling
 * actor, and a scene lifecycle hook. Everything else — camera, targeting,
 * idle life, saves, touch controls — is the engine's defaults.
 */

type World = { read: number };

/* --- the player: a 9×14-cell figure, cell 2 => 18×28 logical px ---------- */

const P = {
  ".........": undefined, // (row template for reference only)
};
void P;

const BODY = [
  "...ooo...",
  "...ooo...",
  "...eee...",
  "....t....",
  "..ttttt..",
  "..t.t.t..",
  "..t.t.t..",
  "....t....",
  "...l.l...",
  "...l.l...",
  "...l.l...",
  "...l.l...",
  "...s.s...",
  "...s.s...",
];

const swap = (rows: string[], from: string, to: string) => rows.map((r) => r.replaceAll(from, to));

const FRAMES = {
  stand: BODY,
  // the breath: everything settles one row down
  idleB: ["........." /* sink */, ...BODY.slice(0, -1)],
  blink: swap(BODY, "e", "o"),
  walkA: BODY.map((r, i) => (i >= 8 ? r.replace("l.l", "l..").replace("s.s", "s..") : r)),
  walkB: BODY.map((r, i) => (i >= 8 ? r.replace("l.l", "..l").replace("s.s", "..s") : r)),
};

const PLAYER = {
  width: 18,
  height: 28,
  cell: 2,
  palette: { o: "#c8a06a", e: "#2d4a22", t: "#37455c", l: "#2b2b33", s: "#d8d3c5" },
  frames: FRAMES,
  walkCycle: ["walkA", "walkB"] as const,
  actions: {},
};

/* --- a pigeon-ish actor for the stop -------------------------------------- */

const PIGEON = {
  id: "pigeon",
  width: 8,
  height: 6,
  cell: 2,
  palette: { g: "#8b8b94", d: "#55555e" },
  frames: { stand: ["..gg", ".ggd", "..d."], step: ["..gg", ".ggd", ".d.."] },
  idleFrame: "stand",
  walkCycle: ["stand", "step"],
  x: 300,
  patrol: { from: 240, to: 360, speed: 14, pauseMs: 1600 },
};

/* --- scenes ---------------------------------------------------------------- */

const post = (x: number, color: string) => (
  <rect x={x} y={104} width={3} height={46} fill={color} />
);

/** The stop: a ground band 150→168 with a bench you walk around, not through. */
const STOP: RuntimeSceneDef<World> = {
  id: "stop",
  width: 480,
  spawnX: 90,
  ground: { top: 150, bottom: 168, blockers: [{ x0: 206, y0: 150, x1: 266, y1: 158 }] },
  objects: [
    { id: "ex-sign", kind: "read", x: 140, range: 24, priority: 1 },
    { id: "ex-bench", kind: "read", x: 236, range: 30, y: 154 },
    {
      id: "ex-gate",
      kind: "door",
      x: 434,
      // reachable from the EDGE_MARGIN clamp at x=460 — a door the player
      // can stand beside but never reach is the classic off-by-a-margin
      range: 34,
      priority: 1,
      to: { scene: "yard", spawnX: 60 },
    },
  ],
  actors: [PIGEON],
  enter: ({ counterpart }) => {
    if (counterpart) console.debug(`example: entered the stop from ${counterpart}`);
  },
  Component: () => (
    <g shapeRendering="crispEdges">
      <rect width={480} height={SCENE_HEIGHT} fill="#b8c4c2" />
      <rect y={104} width={480} height={46} fill="#9aa8a4" />
      <rect y={150} width={480} height={30} fill="#6f7a72" />
      <rect y={150} width={480} height={2} fill="#5a645d" />
      {/* the sign */}
      {post(138, "#3b4a55")}
      <rect x={126} y={96} width={28} height={14} fill="#e8e4d8" />
      <rect x={129} y={100} width={22} height={2} fill="#3b4a55" />
      <rect x={129} y={104} width={16} height={2} fill="#3b4a55" />
      {/* the bench, planted where its blocker is */}
      <rect x={206} y={140} width={60} height={4} fill="#7a5c3e" />
      <rect x={208} y={144} width={4} height={14} fill="#4e3b28" />
      <rect x={260} y={144} width={4} height={14} fill="#4e3b28" />
      {/* the gate out */}
      {post(424, "#4e3b28")}
      {post(444, "#4e3b28")}
      <rect x={424} y={104} width={23} height={4} fill="#4e3b28" />
    </g>
  ),
};

/** The yard: no `ground` declared — the classic single floor line. */
const YARD: RuntimeSceneDef<World> = {
  id: "yard",
  width: 360,
  spawnX: 60,
  objects: [
    { id: "ex-tree", kind: "read", x: 220, range: 26 },
    {
      id: "ex-back",
      kind: "door",
      x: 40,
      range: 26,
      priority: 1,
      to: { scene: "stop", spawnX: 420 },
    },
  ],
  Component: () => (
    <g shapeRendering="crispEdges">
      <rect width={360} height={SCENE_HEIGHT} fill="#aebfae" />
      <rect y={150} width={360} height={30} fill="#5e6e52" />
      <rect x={214} y={70} width={10} height={80} fill="#5a4632" />
      <rect x={190} y={40} width={58} height={44} fill="#4a6b3a" />
      {post(36, "#4e3b28")}
    </g>
  ),
};

/* --- the game -------------------------------------------------------------- */

const LINES: Record<string, string> = {
  "ex-sign": "Timetable: whenever the 143 feels like it.",
  "ex-bench": "Someone carved a heart into it. Both initials are yours.",
  "ex-tree": "The apples are green in the way that means wait.",
};

const LABEL: Record<string, string> = {
  "ex-sign": "TIMETABLE",
  "ex-bench": "BENCH",
  "ex-gate": "GATE",
  "ex-tree": "APPLE TREE",
  "ex-back": "GATE",
};

const CONFIG: RuntimeConfig<World> = {
  scenes: { stop: STOP, yard: YARD },
  start: { scene: "stop", x: 90 },
  initialWorld: { read: 0 },
  player: PLAYER,
  handlers: {
    read: ({ obj, world, updateWorld, showToast }) => {
      updateWorld({ read: world.read + 1 });
      showToast(LINES[obj.id] ?? "Nothing new.");
    },
  },
  objectLabel: (obj) => LABEL[obj.id] ?? obj.id.toUpperCase(),
  objectVerb: (obj) => (obj.kind === "door" ? "ENTER" : "READ"),
};

export function ExampleGame() {
  return <GameRuntime config={CONFIG} />;
}
