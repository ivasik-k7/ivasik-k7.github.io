import {
  type DialogueTree,
  defineTree,
  GameRuntime,
  type RuntimeConfig,
  type RuntimeSceneDef,
  SCENE_HEIGHT,
} from "@/engine";
// TODO: move to the barrel once the DialogueBox redesign lands in index.ts
import { npcMemory } from "@/engine/systems/memory";

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
  ground: {
    top: 150,
    bottom: 168,
    blockers: [{ x0: 206, y0: 150, x1: 266, y1: 158 }],
    // the pavement rises toward the gate — feet follow the profile
    profile: [
      { x: 380, bottom: 168 },
      { x: 460, bottom: 158 },
    ],
    // a puddle: slower through it, and `live.surface` reads "puddle" inside
    zones: [{ x0: 300, x1: 348, y0: 160, y1: 168, kind: "puddle", speed: 0.6 }],
  },
  objects: [
    { id: "ex-sign", kind: "read", x: 140, range: 24, priority: 1 },
    { id: "ex-bench", kind: "bench", x: 236, range: 30, y: 154 },
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
      {/* the puddle the zone walks through */}
      <rect x={300} y={160} width={48} height={8} fill="#7f95a0" opacity={0.55} />
      <rect x={306} y={162} width={30} height={2} fill="#a8bcc4" opacity={0.5} />
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

/**
 * The bench talks — the naturalness pilot. Everything a conversation between
 * people (well, a person and a bench) needs to feel real is in this one tree:
 * a greeting that knows how long you've been away, an answer that escalates
 * when you ask it AGAIN, a reaction to a dumb question, the player's own head
 * butting in once, and a wind-down when there is nothing left to say.
 */
const mem = (ctx: unknown) => npcMemory(ctx, "ex-bench");

const BENCH_TREE = defineTree(
  "ex-bench",
  { npc: "ex-bench" },
  {
    // the greeting knows whether you just left or have been gone a while
    start: (ctx) => {
      const m = mem(ctx);
      const back = m.met() && m.minutesSince() < 3 ? "again" : "sit";
      m.visit();
      return back;
    },
    nodes: {
      again: {
        lines: [{ speaker: "BENCH", text: "Back already. The 143 does that to people." }],
        next: "hub",
      },
      sit: {
        lines: [{ text: "The bench holds its peace." }],
        variants: [
          {
            lines: [
              { speaker: "BENCH", text: "Someone carved a heart into me." },
              {
                text: "You haven't even read the timetable yet.",
                when: (ctx) => ((ctx as { world?: World }).world?.read ?? 0) === 0,
              },
            ],
          },
          { lines: [{ speaker: "BENCH", text: "Sit. The wood remembers everyone." }] },
          { lines: [{ speaker: "BENCH", text: "..." }] },
        ],
        next: "hub",
      },
      hub: {
        // the connective tissue between topics — cycling so the wait itself is alive
        lines: [{ text: "The bench waits." }],
        variantMode: "cycle",
        variants: [
          { lines: [{ text: "The bench waits." }] },
          { lines: [{ text: "A tram passes somewhere unseen." }] },
          { lines: [{ text: "The pigeon inspects your shoe." }] },
        ],
        topics: true,
        exhaustedNext: "wrapup",
        choices: [
          {
            id: "ex-bench-heart",
            label: "Ask about the heart",
            once: true,
            next: "heart",
            effect: (ctx) => mem(ctx).learn("heart"),
          },
          {
            id: "ex-bench-143",
            label: "When does the 143 come?",
            next: "when143",
            // asked again, the bench reacts to the repetition — and escalates
            againNext: "when143Again",
          },
          {
            id: "ex-bench-dumb",
            label: "Are you... a talking bench?",
            once: true,
            next: "dumb",
            effect: (ctx) => mem(ctx).warm(-1),
          },
          { label: "Leave" },
        ],
      },
      heart: {
        lines: [
          { text: "Both initials are yours. The bench says nothing more about it." },
          // the player's head butts in — once per save, inner voice
        ],
        interjections: [
          {
            id: "ex-int-heart",
            text: "You don't remember carving it. That is the worst part.",
            once: true,
          },
        ],
        next: "hub",
      },
      when143: {
        lines: [{ speaker: "BENCH", text: "Whenever it feels like it. Ask the timetable." }],
        next: "hub",
      },
      when143Again: {
        lines: [{ text: "fallback" }],
        variantMode: "exhaust",
        variants: [
          { lines: [{ speaker: "BENCH", text: "Still whenever it feels like it." }] },
          {
            lines: [
              {
                speaker: "BENCH",
                text: "You asked. Twice now. The answer is a shrug made of wood.",
              },
            ],
          },
          { lines: [{ speaker: "BENCH", text: "..." }] },
        ],
        next: "hub",
      },
      dumb: {
        lines: [{ speaker: "BENCH", text: "...Are you a talking person? We all do what we can." }],
        interjections: [{ id: "ex-int-dumb", text: "It has a point. Maybe don't.", once: true }],
        next: "hub",
      },
      wrapup: {
        lines: [
          { speaker: "BENCH", text: "Your bus is somewhere. Go stand by the sign like everyone." },
        ],
      },
    },
  },
) as DialogueTree<never>;

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
    bench: ({ startDialogue }) => startDialogue(BENCH_TREE),
  },
  objectLabel: (obj) => LABEL[obj.id] ?? obj.id.toUpperCase(),
  objectVerb: (obj) => (obj.kind === "door" ? "ENTER" : obj.kind === "bench" ? "SIT" : "READ"),
  // same contract as the main game: the drive harness reaches the api with ?drive=1
  onReady: (api) => {
    if (import.meta.env.DEV || new URLSearchParams(window.location.search).has("drive")) {
      (window as unknown as { __game: unknown }).__game = api;
    }
  },
};

export function ExampleGame() {
  return <GameRuntime config={CONFIG} />;
}
