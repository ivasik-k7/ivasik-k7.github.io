import { LayeredScene, PhaseSky, px, type SceneDef, StreetLamp, stripes } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { NpcMonologue } from "./NpcMonologue";

/**
 * Ulica Słoneczna — the street at true scale.
 *
 * One storey is ~2.8 m ≈ 104 gp, so the frame holds the ground floor and the
 * sill line of the first — the blocks continue past the top of the screen, the
 * way buildings do when you stand under them.
 *
 * Almost everything here has states, and the states are driven by the clock
 * rather than by flags, because that is how a street works: Żabka rolls its
 * grille down at night, the babcia goes in when it gets cold and the cat takes
 * her bench, the lamps warm up at dusk before they commit, the bins fill over
 * the day and get emptied at dawn, the bus board counts down until there is
 * nothing left to count. World flags (paczkomatUsed, binOpen, …) layer on top.
 */

const STREET_W = 1280;

const S = {
  render14: "#cfc4ae",
  render14Hi: "#ddd3c0",
  render14Lo: "#b8ad97",
  renderPatch: "#c3b8a2",
  renderDamp: "#a89e8a",
  plinth: "#8d8478",
  plinthDark: "#7a7268",
  plinthWorn: "#9a9184",
  slab: "#b0a692",
  render16: "#b9c0c4",
  render16Lo: "#a2a9ad",
  frame: "#8a8578",
  frameDark: "#6f6a5e",
  glassDay: "#a8c2d4",
  glassDark: "#2a3138",
  glassLit: "#ffd98a",
  glassLitWarm: "#f2b96a",
  curtain: "#e8e2d2",
  zabka: "#0a6b3c",
  zabkaHi: "#0d7d46",
  zabkaDark: "#07522e",
  grille: "#7a7d84",
  grilleDark: "#5d6066",
  white: "#f2f2ee",
  sidewalk: "#9d9a92",
  sidewalkSeam: "#8b8880",
  sidewalkWorn: "#a8a59d",
  curb: "#b5b2aa",
  asphalt: "#5d5a55",
  asphaltLo: "#4a4844",
  plaqueBlue: "#1e4478",
  steel: "#9aa0a8",
  steelDark: "#6d7278",
  gas: "#e8c445",
  gasLo: "#c9a52e",
  rust: "#9a7a58",
  led: "#7ee08c",
  ledAmber: "#ffb03a",
  ledRed: "#ff5050",
  chalk: "#e8e2d2",
  leafDry: "#b07a3a",
  skin: "#e0b48c",
  skinShade: "#c79a72",
  shadow: "#00000038",
  shadowSoft: "#0000001c",
};

// ---------------------------------------------------------------------------
// phase
// ---------------------------------------------------------------------------

type Ph = "dawn" | "day" | "dusk" | "night";

function toPhase(phase: string): Ph {
  if (phase === "night") return "night";
  if (phase === "dusk") return "dusk";
  if (phase === "dawn" || phase === "morning") return "dawn";
  return "day";
}

/** Optional world.street flags, read defensively so this compiles as-is. */
function flags(world: WorldState) {
  const s = (world.street ?? {}) as unknown as Record<string, boolean | undefined>;
  return {
    paczkomatUsed: !!s.paczkomatUsed,
    binOpen: !!s.binOpen,
    binsEmptied: !!s.binsEmptied,
    catFed: !!s.catFed,
    boardRead: !!s.boardRead,
  };
}

// ---------------------------------------------------------------------------
// lettering + a 3×5 pixel font for every screen on the street
// ---------------------------------------------------------------------------

function Letter({ ch, x, y, fill }: { ch: string; x: number; y: number; fill: string }) {
  const strokes: Record<string, number[][]> = {
    Z: [
      [0, 0, 8, 2],
      [4, 2, 3, 2],
      [2, 4, 3, 2],
      [0, 6, 3, 2],
      [0, 8, 8, 2],
    ],
    A: [
      [0, 2, 2, 8],
      [6, 2, 2, 8],
      [2, 0, 4, 2],
      [2, 5, 4, 2],
    ],
    B: [
      [0, 0, 2, 10],
      [2, 0, 4, 2],
      [2, 4, 4, 2],
      [2, 8, 4, 2],
      [6, 1, 2, 3],
      [6, 6, 2, 3],
    ],
    K: [
      [0, 0, 2, 10],
      [4, 0, 3, 2],
      [2, 3, 3, 2],
      [2, 5, 3, 2],
      [4, 8, 3, 2],
      [6, 6, 2, 2],
      [6, 1, 2, 2],
    ],
  };
  const dot = ch === "Ż";
  const base = dot ? "Z" : ch;
  return (
    <g>
      {dot ? px(x + 3, y - 4, 2, 2, fill) : null}
      {(strokes[base] ?? []).map(([sx, sy, w, h]) =>
        px(x + sx, y + sy, w, h, fill, `${ch}${sx}:${sy}`),
      )}
    </g>
  );
}

/** ŻABKA at 1.5× — a fascia you can read from across the yard. */
function ZabkaLettering({ x, y, dim }: { x: number; y: number; dim?: boolean }) {
  const word = ["Ż", "A", "B", "K", "A"];
  return (
    <g transform={`translate(${x} ${y}) scale(1.5)`}>
      {word.map((ch, i) => (
        <Letter
          key={`${ch}${String(i)}`}
          ch={ch}
          x={i * 12}
          y={0}
          fill={dim ? "#8fae9c" : S.white}
        />
      ))}
    </g>
  );
}

const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  ":": ["0", "1", "0", "1", "0"],
  ".": ["0", "0", "0", "0", "1"],
  "-": ["000", "000", "111", "000", "000"],
  " ": ["00", "00", "00", "00", "00"],
  M: ["101", "111", "111", "101", "101"],
  I: ["1", "1", "1", "1", "1"],
  N: ["101", "111", "111", "111", "101"],
  O: ["111", "101", "101", "101", "111"],
  P: ["111", "101", "111", "100", "100"],
  S: ["111", "100", "111", "001", "111"],
  T: ["111", "010", "010", "010", "010"],
  W: ["101", "101", "111", "111", "101"],
  A: ["111", "101", "111", "101", "101"],
  R: ["111", "101", "111", "110", "101"],
  E: ["111", "100", "111", "100", "111"],
  Z: ["111", "001", "010", "100", "111"],
  K: ["101", "101", "110", "101", "101"],
  C: ["111", "100", "100", "100", "111"],
  D: ["110", "101", "101", "101", "110"],
  U: ["101", "101", "101", "101", "111"],
  Ł: ["100", "110", "100", "100", "111"],
};

/** Renders a string in the 3×5 pixel font. Used on every display out here. */
function PixelText({
  x,
  y,
  text,
  fill,
  gap = 1,
}: {
  x: number;
  y: number;
  text: string;
  fill: string;
  gap?: number;
}) {
  const out: React.ReactNode[] = [];
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const rows = GLYPHS[text[i]] ?? GLYPHS[" "];
    const w = rows[0].length;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < w; c++) {
        if (rows[r][c] === "1") out.push(px(cx + c, y + r, 1, 1, fill, `t${i}${r}${c}`));
      }
    }
    cx += w + gap;
  }
  return <g>{out}</g>;
}

// ---------------------------------------------------------------------------
// first-floor sills, cropped by the frame — each one a different household
// ---------------------------------------------------------------------------

type Life = "plain" | "curtains" | "plant" | "lit" | "blinds" | "tv" | "cat" | "dish";

function SillWindow({ x, ph, life = "plain" }: { x: number; ph: Ph; life?: Life }) {
  const night = ph === "night";
  const dark = night || ph === "dusk";
  // who is awake, and when
  const lit =
    (life === "lit" && ph !== "day") ||
    (life === "tv" && dark) ||
    (life === "curtains" && ph === "dawn");
  const glass = lit ? S.glassLit : dark ? S.glassDark : S.glassDay;
  return (
    <g>
      {/* the window sits deep in the wall */}
      {px(x - 3, 0, 30, 30, S.frameDark)}
      {px(x - 1, 0, 26, 27, S.frame)}
      {px(x, 0, 24, 24, glass)}
      {!dark ? px(x, 0, 24, 9, "#bcd2e0") : null}
      {px(x + 11, 0, 2, 24, S.frame)}
      {lit ? px(x, 0, 24, 24, "#ffe6a8") : null}
      {life === "curtains" ? (
        <g>
          {px(x, 0, 5, 24, S.curtain)}
          {px(x + 19, 0, 5, 24, S.curtain)}
          {px(x + 5, 0, 2, 18, "#d8d3c5")}
          {px(x + 17, 0, 2, 15, "#d8d3c5")}
          {lit ? px(x + 8, 6, 8, 18, "#c9a878") : null}
        </g>
      ) : null}
      {life === "blinds" ? (
        <g>
          {px(x, 0, 24, dark ? 20 : 10, "#d8d3c5")}
          {px(x, 4, 24, 1, "#b8b3a4")}
          {px(x, 8, 24, 1, "#b8b3a4")}
          {dark ? px(x, 14, 24, 1, "#b8b3a4") : null}
          {dark ? px(x, 18, 24, 1, "#b8b3a4") : null}
        </g>
      ) : null}
      {life === "plant" ? (
        <g>
          {px(x + 3, 17, 7, 7, "#8a5a3a")}
          {px(x + 3, 17, 7, 2, "#9a6a46")}
          {px(x + 2, 11, 9, 6, "#4e6b4e")}
          {px(x + 4, 8, 4, 4, "#57755a")}
          {px(x + 14, 19, 6, 5, "#8a5a3a")}
          {px(x + 14, 14, 6, 5, "#57755a")}
          {px(x + 20, 18, 3, 6, "#7a7a4a")}
        </g>
      ) : null}
      {life === "tv" && dark ? (
        <rect x={x + 4} y={6} width={16} height={16} fill="#9fc7d6" opacity={0.55}>
          <animate
            attributeName="opacity"
            values="0.55;0.22;0.5;0.28;0.55"
            dur="1.9s"
            repeatCount="indefinite"
          />
        </rect>
      ) : null}
      {life === "cat" ? (
        <g>
          {px(x + 7, 15, 11, 9, dark ? "#2b2f36" : "#3a3f47")}
          {px(x + 7, 12, 3, 4, dark ? "#2b2f36" : "#3a3f47")}
          {px(x + 12, 12, 3, 4, dark ? "#2b2f36" : "#3a3f47")}
          {px(x + 8, 16, 2, 1, dark ? "#c9a24b" : "#8fa86a")}
          {px(x + 13, 16, 2, 1, dark ? "#c9a24b" : "#8fa86a")}
          <rect x={x + 17} y={21} width={5} height={2} fill={dark ? "#2b2f36" : "#3a3f47"}>
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={`0 ${x + 17} 22;-16 ${x + 17} 22;6 ${x + 17} 22;0 ${x + 17} 22`}
              dur="6.2s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : null}
      {/* concrete sill, drip shadow, and the things that end up on sills */}
      {px(x - 4, 30, 32, 4, "#c4baa4")}
      {px(x - 4, 30, 32, 1, "#d4cab4")}
      {px(x - 3, 34, 30, 3, S.shadow)}
      {life === "plain" ? px(x + 16, 26, 5, 4, "#aebfc9") : null}
      {life === "dish" ? (
        <g>
          {px(x + 26, 4, 3, 14, S.steelDark)}
          {px(x + 22, 2, 11, 11, "#d8d5cc")}
          {px(x + 24, 4, 7, 7, "#b8b5ac")}
          {px(x + 27, 12, 2, 4, S.steelDark)}
        </g>
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// people
// ---------------------------------------------------------------------------

/** The smoker. Hood up when it's cold, phone out when it isn't. */
function Smoker({ x, ph }: { x: number; ph: Ph }) {
  const cold = ph !== "day";
  return (
    <g>
      {px(x - 3, 148, 27, 3, "#00000044")}
      {cold ? (
        <g>
          {px(x + 2, 78, 15, 5, "#4a5866")}
          {px(x + 1, 82, 17, 7, "#3a4148")}
          {px(x + 2, 79, 13, 1, "#56657a")}
          {px(x + 5, 85, 10, 8, S.skin)}
          {px(x + 5, 89, 10, 4, S.skinShade)}
        </g>
      ) : (
        <g>
          {/* hood down: cropped hair, ears, the fold at the neck */}
          {px(x + 3, 78, 13, 6, "#3d2a1a")}
          {px(x + 3, 78, 13, 2, "#503a26")}
          {px(x + 4, 84, 11, 9, S.skin)}
          {px(x + 4, 89, 11, 4, S.skinShade)}
          {px(x + 3, 86, 2, 3, S.skinShade)}
          {px(x + 15, 86, 2, 3, S.skinShade)}
          {px(x, 92, 19, 5, "#3a4148")}
        </g>
      )}
      {px(x + 7, cold ? 87 : 86, 2, 2, "#3d2a1a")}
      {px(x + 12, cold ? 87 : 86, 2, 2, "#3d2a1a")}
      {px(x + 8, cold ? 92 : 91, 5, 1, "#b08668")}
      {/* hoodie */}
      {px(x, 94, 19, 24, "#4a5866")}
      {px(x, 94, 19, 2, "#56657a")}
      {px(x + 14, 96, 5, 22, "#3e4b57")}
      {px(x + 4, 106, 11, 8, "#3e4b57")}
      {px(x + 4, 106, 11, 1, "#56657a")}
      {px(x + 6, 96, 1, 9, "#e8e2d2")}
      {px(x + 11, 96, 1, 9, "#e8e2d2")}
      {/* right arm up with the cigarette */}
      {px(x + 16, 96, 4, 9, "#4a5866")}
      {px(x + 17, 103, 4, 4, S.skin)}
      {px(x + 20, 104, 5, 2, S.white)}
      <rect x={x + 25} y={104} width={2} height={2} fill="#e86a3a">
        <animate
          attributeName="opacity"
          values="0.35;1;0.5;0.35"
          dur="2.8s"
          repeatCount="indefinite"
        />
      </rect>
      {/* left hand: phone during the day, pocket when it's cold */}
      {!cold ? (
        <g>
          {px(x - 4, 100, 4, 8, "#4a5866")}
          {px(x - 5, 106, 4, 4, S.skin)}
          {px(x - 7, 99, 5, 8, "#22262c")}
          <rect x={x - 6} y={100} width={3} height={6} fill="#9fc7d6" opacity={0.8}>
            <animate
              attributeName="opacity"
              values="0.8;0.55;0.85;0.6;0.8"
              dur="4.5s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : (
        px(x - 2, 102, 5, 10, "#3e4b57")
      )}
      {/* joggers + sneakers */}
      {px(x + 3, 118, 6, 27, "#2e3033")}
      {px(x + 11, 118, 6, 27, "#2e3033")}
      {px(x + 5, 118, 1, 26, "#4a4d52")}
      {px(x + 13, 118, 1, 26, "#4a4d52")}
      {px(x + 2, 145, 8, 5, "#8a8f96")}
      {px(x + 11, 145, 8, 5, "#8a8f96")}
      {px(x + 2, 145, 17, 1, "#aeb2b8")}
      {/* his ashtray: the pavement */}
      {px(x - 6, 148, 2, 1, S.white)}
      {px(x - 1, 149, 2, 1, S.white)}
      {px(x + 22, 148, 2, 1, S.white)}
      {/* the drift */}
      {[0, 1.3, 2.6].map((delay) => (
        <circle key={delay} cx={x + 26} cy={102} r={2} fill="#c9c4b6" opacity={0}>
          <animate
            attributeName="opacity"
            values="0;0.45;0"
            begin={`${delay}s`}
            dur="3.9s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="cy"
            values="102;80"
            begin={`${delay}s`}
            dur="3.9s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="cx"
            values={`${x + 26};${x + 36}`}
            begin={`${delay}s`}
            dur="3.9s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="r"
            values="1.5;3.8"
            begin={`${delay}s`}
            dur="3.9s"
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </g>
  );
}

/** Babcia Krysia. Feeds the birds by day, buttons up at dusk, indoors by night. */
function Babcia({ x, ph }: { x: number; ph: Ph }) {
  const feeding = ph === "day" || ph === "dawn";
  return (
    <g>
      {px(x - 2, 148, 28, 3, "#00000040")}
      {/* beret, silver hair */}
      {px(x + 3, 86, 13, 4, "#7c3040")}
      {px(x + 8, 84, 2, 2, "#7c3040")}
      {px(x + 2, 89, 15, 2, "#8a3a50")}
      {px(x + 3, 91, 3, 3, "#c9c4b6")}
      {px(x + 14, 91, 3, 3, "#c9c4b6")}
      {/* face, glasses catching the light */}
      {px(x + 5, 91, 11, 8, S.skin)}
      {px(x + 5, 96, 11, 3, S.skinShade)}
      {px(x + 6, 93, 3, 2, "#d8e4ec")}
      {px(x + 11, 93, 3, 2, "#d8e4ec")}
      {px(x + 9, 94, 2, 1, S.steelDark)}
      {px(x + 8, 98, 5, 1, "#b08668")}
      {/* coat; at dusk the collar goes up and a scarf appears */}
      {px(x + 1, 100, 18, 15, "#5d4a66")}
      {px(x + 1, 100, 18, 2, "#6a5675")}
      {px(x + 15, 102, 4, 13, "#4e3d57")}
      {px(x + 9, 104, 2, 2, "#c9a24b")}
      {px(x + 9, 109, 2, 2, "#c9a24b")}
      {!feeding ? (
        <g>
          {px(x + 3, 99, 14, 4, "#8a3a50")}
          {px(x + 3, 99, 14, 1, "#9c4a60")}
          {px(x + 2, 103, 4, 9, "#8a3a50")}
        </g>
      ) : null}
      {/* lap, hands */}
      {px(x, 113, 20, 8, "#5d4a66")}
      {px(x, 113, 20, 1, "#6a5675")}
      {feeding ? (
        <g>
          {/* one hand out, scattering crumbs */}
          {px(x + 18, 112, 6, 4, S.skin)}
          {px(x + 22, 110, 4, 3, "#c9a24b")}
          {[0, 0.8, 1.7].map((d) => (
            <rect key={d} x={x + 26} y={114} width={1} height={1} fill="#d8c9a6" opacity={0}>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                begin={`${d}s`}
                dur="2.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="y"
                values="114;146"
                begin={`${d}s`}
                dur="2.6s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="x"
                values={`${x + 26};${x + 33}`}
                begin={`${d}s`}
                dur="2.6s"
                repeatCount="indefinite"
              />
            </rect>
          ))}
        </g>
      ) : (
        <g>
          {px(x + 6, 115, 8, 3, S.skin)}
          {px(x + 5, 114, 10, 2, "#4e3d57")}
        </g>
      )}
      {/* stockings, boots */}
      {px(x + 4, 121, 5, 24, "#8a8578")}
      {px(x + 11, 121, 5, 24, "#8a8578")}
      {px(x + 3, 145, 7, 5, "#3a3129")}
      {px(x + 11, 145, 7, 5, "#3a3129")}
      {px(x + 3, 145, 15, 1, "#4d4238")}
      {/* the red bag, leaning on her boot */}
      {px(x + 20, 130, 13, 18, "#c9463c")}
      {px(x + 20, 130, 13, 2, "#d85a50")}
      {px(x + 21, 127, 3, 4, "#a33a30")}
      {px(x + 28, 127, 3, 4, "#a33a30")}
      {px(x + 23, 133, 7, 7, "#e8c445")}
      {px(x + 24, 126, 5, 5, "#c9a24b")}
      {px(x + 19, 147, 15, 2, "#00000030")}
      {/* the walking stick she insists she doesn't need */}
      {px(x - 4, 112, 2, 36, "#6b4a2f")}
      {px(x - 6, 110, 6, 3, "#8a623f")}
    </g>
  );
}

/** Pigeons: pecking, waiting, or bursting into the air. */
function Pigeon({
  x,
  delay = 0,
  mode = "peck",
}: {
  x: number;
  delay?: number;
  mode?: "peck" | "idle";
}) {
  return (
    <g>
      {px(x, 146, 5, 3, "#6d7278")}
      {px(x, 146, 5, 1, "#828890")}
      {px(x + 1, 149, 1, 1, "#a3542f")}
      {px(x + 3, 149, 1, 1, "#a3542f")}
      <g>
        {px(x + 4, 144, 3, 3, "#8a8f96")}
        {px(x + 6, 145, 2, 1, "#c9a24b")}
        {px(x + 5, 145, 1, 1, "#2e3033")}
        {mode === "peck" ? (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${x + 4} 147;26 ${x + 4} 147;0 ${x + 4} 147;0 ${x + 4} 147`}
            dur="2.3s"
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
        ) : (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${x + 4} 147;0 ${x + 4} 147;-14 ${x + 4} 147;0 ${x + 4} 147`}
            dur="5.1s"
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
        )}
      </g>
    </g>
  );
}

/** The courtyard cat. Owns the bench after dark. */
function Cat({ x, ph, fed }: { x: number; ph: Ph; fed: boolean }) {
  const night = ph === "night";
  const coat = "#5a4a3e";
  const coatHi = "#6d5c4c";
  if (night) {
    // curled on the bench slats
    return (
      <g>
        {px(x, 94, 24, 10, coat)}
        {px(x, 94, 24, 2, coatHi)}
        {px(x + 19, 90, 9, 8, coat)}
        {px(x + 20, 87, 3, 4, coat)}
        {px(x + 25, 87, 3, 4, coat)}
        {px(x + 21, 92, 2, 1, "#c9a24b")}
        {px(x + 25, 92, 2, 1, "#c9a24b")}
        <rect x={x - 4} y={100} width={8} height={3} fill={coat}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${x + 4} 101;-10 ${x + 4} 101;4 ${x + 4} 101;0 ${x + 4} 101`}
            dur="7.4s"
            repeatCount="indefinite"
          />
        </rect>
        <rect x={x + 4} y={92} width={14} height={4} fill={coatHi} opacity={0.9}>
          <animate attributeName="y" values="92;91;92" dur="4.6s" repeatCount="indefinite" />
        </rect>
      </g>
    );
  }
  // sitting on the pavement, tail wrapped, watching the pigeons
  return (
    <g>
      {px(x - 2, 148, 22, 3, "#00000030")}
      {px(x + 2, 128, 12, 20, coat)}
      {px(x + 2, 128, 12, 2, coatHi)}
      {px(x + 3, 118, 11, 11, coat)}
      {px(x + 3, 114, 4, 5, coat)}
      {px(x + 10, 114, 4, 5, coat)}
      {px(x + 4, 116, 2, 2, "#3f342c")}
      {px(x + 11, 116, 2, 2, "#3f342c")}
      {px(x + 5, 122, 2, 2, fed ? "#7ee08c" : "#c9a24b")}
      {px(x + 10, 122, 2, 2, fed ? "#7ee08c" : "#c9a24b")}
      {px(x + 7, 125, 2, 1, "#b98b86")}
      {px(x + 1, 144, 6, 5, coat)}
      {px(x + 9, 144, 6, 5, coat)}
      <g>
        {px(x + 14, 134, 3, 14, coat)}
        {px(x + 14, 146, 7, 3, coat)}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`0 ${x + 15} 136;-7 ${x + 15} 136;3 ${x + 15} 136;-4 ${x + 15} 136;0 ${x + 15} 136`}
          dur="5.8s"
          repeatCount="indefinite"
        />
      </g>
      {/* ear twitch */}
      <rect x={x + 10} y={114} width={4} height={5} fill={coat}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          values={`0 ${x + 12} 119;0 ${x + 12} 119;-18 ${x + 12} 119;0 ${x + 12} 119;0 ${x + 12} 119`}
          dur="8.2s"
          repeatCount="indefinite"
        />
      </rect>
      {fed ? (
        <g>
          {px(x + 20, 143, 10, 5, "#8fa8b8")}
          {px(x + 21, 144, 8, 2, "#b08668")}
        </g>
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// street furniture
// ---------------------------------------------------------------------------

/** InPost paczkomat — 2 m of yellow certainty. Screen cycles; one door opens. */
function Paczkomat({ x, used, ph }: { x: number; used: boolean; ph: Ph }) {
  const lockers: React.ReactNode[] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      const open = used && r === 3 && c === 1;
      lockers.push(
        px(x + 4 + c * 14, 82 + r * 11, 12, 9, open ? "#2e3033" : "#f5c518", `l${r}${c}`),
      );
      if (open) {
        // the parcel you came for, sitting in the dark
        lockers.push(px(x + 6 + c * 14, 86 + r * 11, 8, 5, "#c9a878", `pk${r}${c}`));
        lockers.push(px(x + 6 + c * 14, 87 + r * 11, 8, 1, "#e8e2d2", `pt${r}${c}`));
      } else {
        lockers.push(px(x + 13 + c * 14, 86 + r * 11, 2, 2, "#8a6d2f", `h${r}${c}`));
        lockers.push(px(x + 5 + c * 14, 83 + r * 11, 9, 1, "#f8d84a", `g${r}${c}`));
      }
    }
  }
  return (
    <g>
      {px(x - 3, 148, 54, 3, S.shadow)}
      {px(x, 74, 48, 76, "#3a3833")}
      {px(x, 74, 48, 5, "#f5c518")}
      {px(x, 74, 48, 1, "#fbe06a")}
      {px(x, 79, 2, 71, "#4d4a45")}
      {px(x + 44, 79, 4, 71, "#2e2c28")}
      {lockers}
      {/* screen: idle prompt, or the code you just typed */}
      {px(x + 17, 92, 16, 14, "#1b2026")}
      {px(x + 18, 93, 14, 12, used ? "#123021" : "#16283f")}
      {used ? (
        <PixelText x={x + 20} y={96} text="OK" fill={S.led} />
      ) : (
        <g>
          <PixelText x={x + 20} y={96} text="12" fill="#7ea8e0" />
          <rect x={x + 19} y={102} width={12} height={1} fill="#7ea8e0">
            <animate attributeName="opacity" values="1;0.2;1" dur="2.4s" repeatCount="indefinite" />
          </rect>
        </g>
      )}
      {/* scanner glass and its sweep */}
      {px(x + 18, 108, 14, 5, "#2a2f36")}
      <rect x={x + 19} y={109} width={3} height={3} fill="#ff5050" opacity={0.85}>
        <animate
          attributeName="x"
          values={`${x + 19};${x + 28};${x + 19}`}
          dur="3.6s"
          repeatCount="indefinite"
        />
      </rect>
      {/* courier sticker peeling off the flank, night-time backlight */}
      {px(x + 2, 132, 10, 7, "#e8e2d2")}
      {px(x + 3, 134, 8, 1, "#3a3833")}
      {ph === "night" ? (
        <rect x={x} y={74} width={48} height={5} fill="#fff0a8" opacity={0.35} />
      ) : null}
    </g>
  );
}

/** 240-litre wheelie bins. Fill through the day, get emptied at dawn. */
function Segregacja({
  x,
  open,
  ph,
  emptied,
}: {
  x: number;
  open: boolean;
  ph: Ph;
  emptied: boolean;
}) {
  const overflowing = !emptied && (ph === "dusk" || ph === "night");
  const bins: Array<[string, string]> = [
    ["#d9b93c", "#b89c2e"], // plastik
    ["#4a90d9", "#3a7cbf"], // papier
    ["#5f7a63", "#4d6350"], // szkło
  ];
  return (
    <g>
      {px(x - 3, 148, 74, 3, S.shadow)}
      {bins.map(([body, lid], i) => {
        const bx = x + i * 24;
        const lifted = i === 0 && open;
        return (
          <g key={body}>
            {px(bx, 104, 20, 38, body)}
            {px(bx, 104, 2, 38, lid)}
            {px(bx + 2, 110, 16, 2, lid)}
            {px(bx + 2, 124, 16, 2, lid)}
            {/* the pictogram every bin carries */}
            {px(bx + 6, 115, 8, 7, "#00000022", `ic${body}`)}
            {px(bx + 8, 117, 4, 3, body, `ic2${body}`)}
            {lifted ? (
              <g>
                {px(bx - 3, 88, 24, 5, lid)}
                {px(bx - 3, 88, 24, 1, body)}
                {px(bx + 1, 96, 18, 8, "#2e3033")}
                {/* what's actually in there */}
                {px(bx + 3, 98, 5, 5, "#aebfc9", `j1${body}`)}
                {px(bx + 10, 99, 6, 4, "#d9d3c2", `j2${body}`)}
                {px(bx + 6, 97, 4, 3, "#c94040", `j3${body}`)}
              </g>
            ) : (
              <g>
                {px(bx - 2, overflowing ? 96 : 99, 24, 5, lid, `lidc${body}`)}
                {px(bx - 2, overflowing ? 96 : 99, 24, 1, body, `lidh${body}`)}
                {px(bx + 18, overflowing ? 98 : 101, 3, 3, S.steelDark, `hinge${body}`)}
                {overflowing ? (
                  <g>
                    {px(bx + 2, 100, 7, 5, "#d9d3c2", `of1${body}`)}
                    {px(bx + 11, 101, 6, 4, "#c9a878", `of2${body}`)}
                  </g>
                ) : null}
              </g>
            )}
            {px(bx + 2, 142, 6, 8, "#26282c", `w1${body}`)}
            {px(bx + 12, 142, 6, 8, "#26282c", `w2${body}`)}
            {px(bx + 4, 144, 2, 3, S.steelDark, `wc1${body}`)}
            {px(bx + 14, 144, 2, 3, S.steelDark, `wc2${body}`)}
          </g>
        );
      })}
      {/* the bag somebody left beside them rather than lift a lid */}
      {overflowing ? (
        <g>
          {px(x + 74, 130, 16, 18, "#2e3033")}
          {px(x + 74, 130, 16, 2, "#43474c")}
          {px(x + 78, 126, 8, 5, "#2e3033")}
          {px(x + 72, 147, 20, 2, "#00000030")}
        </g>
      ) : null}
      {/* dawn: emptied, lids square, one lonely wrapper */}
      {ph === "dawn" ? px(x + 78, 147, 4, 2, "#d9d3c2") : null}
    </g>
  );
}

function ModernBench({ x }: { x: number }) {
  return (
    <g>
      {px(x - 2, 148, 56, 3, S.shadow)}
      {px(x + 4, 120, 3, 30, S.steelDark)}
      {px(x + 45, 120, 3, 30, S.steelDark)}
      {px(x + 2, 112, 8, 3, S.steelDark)}
      {px(x + 42, 112, 8, 3, S.steelDark)}
      {px(x, 120, 52, 3, "#a1794f")}
      {px(x, 120, 52, 1, "#c2955e")}
      {px(x, 124, 52, 3, "#8a623f")}
      {px(x, 124, 52, 1, "#a1794f")}
      {px(x + 2, 98, 48, 3, "#a1794f")}
      {px(x + 2, 98, 48, 1, "#c2955e")}
      {px(x + 2, 103, 48, 3, "#8a623f")}
      {px(x + 2, 108, 48, 3, "#7a5636")}
      {px(x + 6, 98, 3, 24, S.steelDark)}
      {px(x + 43, 98, 3, 24, S.steelDark)}
      {/* a carved initial in the third slat, and a bottle cap underneath */}
      {px(x + 26, 121, 1, 2, "#6b4a2f")}
      {px(x + 28, 121, 1, 2, "#6b4a2f")}
      {px(x + 27, 122, 1, 1, "#6b4a2f")}
      {px(x + 14, 147, 3, 2, "#c94040")}
    </g>
  );
}

/** Street litter bin. Fills up like everything else. */
function Kosz({ x, full }: { x: number; full: boolean }) {
  return (
    <g>
      {px(x + 2, 148, 12, 3, S.shadow)}
      {px(x + 6, 128, 4, 22, S.steelDark)}
      {px(x, 108, 16, 22, "#4d6350")}
      {px(x, 108, 16, 2, "#5f7a63")}
      {px(x + 2, 110, 2, 18, "#5f7a63")}
      {px(x - 1, 106, 18, 3, "#3f5244")}
      {px(x + 5, 101, 4, 7, "#5f7a63")}
      {px(x + 6, 98, 2, 4, "#4d6350")}
      {full ? (
        <g>
          {px(x + 2, 102, 6, 5, "#d9d3c2")}
          {px(x + 8, 100, 5, 6, "#c9a878")}
          {px(x + 5, 98, 4, 4, "#4a90d9")}
          {px(x + 12, 148, 5, 2, "#d9d3c2")}
        </g>
      ) : null}
      {/* the ashtray ring on top, always in use */}
      {px(x + 1, 106, 4, 1, "#3a3a38")}
    </g>
  );
}

function BikeRack({ x, ph }: { x: number; ph: Ph }) {
  const commuted = ph === "day" || ph === "dawn"; // one bike is out being used
  return (
    <g>
      {px(x - 2, 148, 52, 3, S.shadow)}
      {[0, 12, 24, 36].map((o) => px(x + o, 126, 2, 24, S.steel, `r${o}`))}
      {px(x - 2, 126, 46, 2, S.steel)}
      {/* the one that never moves: flat tyre, rusted chain, a wheel and a ghost */}
      {px(x + 2, 130, 13, 13, "#22201e")}
      {px(x + 5, 133, 7, 7, S.steelDark)}
      {px(x + 2, 141, 13, 3, "#1a1917")}
      {px(x + 1, 128, 4, 3, S.rust)}
      {!commuted ? (
        <g>
          {px(x + 18, 130, 13, 13, "#22201e")}
          {px(x + 21, 133, 7, 7, S.steelDark)}
          {px(x + 10, 124, 14, 7, "#7a3b35")}
          {px(x + 8, 122, 6, 3, "#22201e")}
        </g>
      ) : (
        // just the lock left around the hoop
        <g>
          {px(x + 20, 128, 3, 10, "#2b5aa8")}
          {px(x + 20, 136, 8, 3, "#2b5aa8")}
        </g>
      )}
      {px(x + 30, 136, 8, 8, "#22201e")}
      {px(x + 40, 136, 8, 8, "#22201e")}
      {px(x + 34, 131, 10, 6, "#d478a8")}
      {px(x + 36, 128, 4, 4, "#e8e2d2")}
    </g>
  );
}

function Plaque({ x, y, digits }: { x: number; y: number; digits: string }) {
  return (
    <g>
      {px(x, y, 26, 14, S.plaqueBlue)}
      {px(x + 1, y + 1, 24, 12, "#2a5a94")}
      {px(x + 3, y + 3, 20, 2, S.white)}
      <PixelText x={x + 7} y={y + 7} text={digits} fill={S.white} />
    </g>
  );
}

/** Przystanek 512 — shelter, timetable, and a board that counts down. */
function BusStop({ x, ph }: { x: number; ph: Ph }) {
  const night = ph === "night";
  const mins = ph === "dawn" ? "4" : ph === "day" ? "7" : ph === "dusk" ? "12" : "-";
  return (
    <g>
      {px(x - 4, 148, 74, 3, S.shadow)}
      {/* roof and posts */}
      {px(x - 2, 56, 70, 4, "#4a4e52")}
      {px(x - 2, 56, 70, 1, "#6d7278")}
      {px(x, 60, 4, 90, S.steelDark)}
      {px(x + 62, 60, 4, 90, S.steelDark)}
      {/* back glass with the city's dusty adverts */}
      {px(x + 6, 62, 54, 86, night ? "#2f353c" : "#b8ccd8")}
      <rect x={x + 6} y={62} width={54} height={86} fill="#ffffff" opacity={0.14} />
      {px(x + 10, 70, 22, 44, "#c9463c")}
      {px(x + 12, 74, 18, 3, S.white)}
      {px(x + 12, 80, 14, 3, S.white)}
      {px(x + 12, 100, 18, 10, "#e8c445")}
      {/* the bench inside, and the gum under it */}
      {px(x + 8, 122, 50, 4, "#8a623f")}
      {px(x + 8, 122, 50, 1, "#a1794f")}
      {px(x + 10, 126, 3, 22, S.steelDark)}
      {px(x + 52, 126, 3, 22, S.steelDark)}
      {/* the pole, the flag, the timetable */}
      {px(x + 70, 66, 3, 84, S.steelDark)}
      {px(x + 66, 60, 12, 8, "#1e4478")}
      {px(x + 67, 61, 10, 6, "#2a5a94")}
      {px(x + 68, 63, 8, 2, S.white)}
      {px(x + 64, 96, 16, 22, "#e8e2d2")}
      {px(x + 64, 96, 16, 3, "#1e4478")}
      {[102, 105, 108, 111, 114].map((y) => px(x + 66, y, 12, 1, "#8a8578", `tt${y}`))}
      {/* LED board: minutes, or nothing at all */}
      {px(x + 18, 40, 32, 16, "#1b1f24")}
      {px(x + 18, 40, 32, 1, "#3a4148")}
      <PixelText x={x + 21} y={45} text="512" fill={night ? "#4a5a52" : S.ledAmber} />
      <g>
        <PixelText x={x + 36} y={45} text={mins} fill={night ? "#4a5a52" : S.led} />
        {!night ? (
          <rect x={x + 18} y={40} width={32} height={16} fill="#7ee08c" opacity={0}>
            <animate
              attributeName="opacity"
              values="0;0.06;0"
              dur="5.5s"
              repeatCount="indefinite"
            />
          </rect>
        ) : null}
      </g>
      {/* the puddle of chewing gum and tickets under the bench */}
      {px(x + 20, 147, 3, 2, "#6d6a62")}
      {px(x + 34, 148, 5, 2, "#d9d3c2")}
    </g>
  );
}

/** Pan Heniek, waiting. Leans on the shelter, checks the road, gives up at night. */
function WaitingMan({ x, ph }: { x: number; ph: Ph }) {
  const night = ph === "night";
  return (
    <g>
      {px(x - 2, 148, 24, 3, "#00000040")}
      {/* flat cap and a face that has waited before */}
      {px(x + 2, 82, 15, 4, "#3f4a3a")}
      {px(x + 1, 84, 8, 2, "#4d5a46")}
      {px(x + 4, 86, 11, 9, S.skin)}
      {px(x + 4, 91, 11, 4, S.skinShade)}
      {px(x + 6, 88, 2, 2, "#3d2a1a")}
      {px(x + 11, 88, 2, 2, "#3d2a1a")}
      {px(x + 6, 93, 7, 1, "#8a8578")}
      {/* quilted jacket, hands behind the back */}
      {px(x, 95, 19, 26, "#3f4a3a")}
      {px(x, 95, 19, 2, "#4d5a46")}
      {px(x, 101, 19, 1, "#33402f")}
      {px(x, 108, 19, 1, "#33402f")}
      {px(x + 15, 97, 4, 24, "#33402f")}
      {px(x + 2, 118, 6, 5, S.skin)}
      {/* trousers, sensible shoes */}
      {px(x + 3, 121, 6, 24, "#4a4438")}
      {px(x + 10, 121, 6, 24, "#4a4438")}
      {px(x + 2, 145, 8, 5, "#2f2921")}
      {px(x + 10, 145, 8, 5, "#2f2921")}
      {/* the string bag, or the umbrella at night */}
      {night ? (
        <g>
          {px(x + 19, 100, 2, 44, "#2e3033")}
          {px(x + 14, 96, 12, 4, "#2b4f9e")}
          {px(x + 14, 96, 12, 1, "#3a63bd")}
        </g>
      ) : (
        <g>
          {px(x + 19, 124, 11, 20, "#a89a72")}
          {px(x + 19, 124, 11, 2, "#c2b48c")}
          {px(x + 22, 128, 5, 6, "#4e6b4e")}
          {px(x + 21, 120, 3, 5, "#a89a72")}
          {px(x + 26, 120, 3, 5, "#a89a72")}
        </g>
      )}
      {/* he leans out to look down the road every so often */}
      <animateTransform
        attributeName="transform"
        type="rotate"
        values={`0 ${x + 9} 148;0 ${x + 9} 148;-3 ${x + 9} 148;0 ${x + 9} 148;0 ${x + 9} 148`}
        dur="11s"
        repeatCount="indefinite"
      />
    </g>
  );
}

/** Wall bankomat on block 16. Awake by day, "chwilowo nieczynny" at night. */
function Bankomat({ x, ph }: { x: number; ph: Ph }) {
  const night = ph === "night";
  return (
    <g>
      {px(x, 84, 34, 46, "#3a4148")}
      {px(x, 84, 34, 2, "#4d5560")}
      {px(x + 2, 86, 30, 42, "#2b3138")}
      {px(x + 4, 90, 22, 16, night ? "#1b2026" : "#16283f")}
      {night ? (
        <PixelText x={x + 6} y={95} text="- -" fill="#3f4a52" />
      ) : (
        <g>
          <PixelText x={x + 6} y={94} text="PIN" fill="#7ea8e0" />
          <rect x={x + 6} y={100} width={16} height={1} fill="#7ea8e0">
            <animate
              attributeName="opacity"
              values="1;0.15;1"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      )}
      {/* keypad, card slot, cash mouth */}
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => px(x + 6 + c * 6, 110 + r * 5, 4, 3, "#4d5560", `k${r}${c}`)),
      )}
      {px(x + 27, 92, 4, 10, "#5d656e")}
      {px(x + 27, 94, 4, 1, night ? "#4a5058" : "#7ee08c")}
      {px(x + 6, 126, 22, 3, "#1b2026")}
      {px(x + 6, 126, 22, 1, "#5d656e")}
      {/* the little canopy and its shadow */}
      {px(x - 2, 80, 38, 4, "#8a9094")}
      {px(x - 2, 80, 38, 1, "#9aa0a4")}
      {px(x, 130, 34, 3, S.shadow)}
      {!night ? (
        <rect x={x - 6} y={84} width={46} height={50} fill="#ffe6a8" opacity={0.05} />
      ) : null}
    </g>
  );
}

/** Gablota with the housing-association notices, half of them expired. */
function NoticeBoard({ x }: { x: number }) {
  return (
    <g>
      {px(x, 76, 40, 40, "#4a4438")}
      {px(x, 76, 40, 2, "#5d5648")}
      {px(x + 2, 78, 36, 36, "#d8d3c5")}
      <rect x={x + 2} y={78} width={36} height={36} fill="#a8c2d4" opacity={0.22} />
      {px(x + 5, 81, 14, 18, S.white)}
      {px(x + 6, 83, 12, 1, "#5d5648")}
      {px(x + 6, 86, 10, 1, "#8a8578")}
      {px(x + 6, 89, 11, 1, "#8a8578")}
      {px(x + 6, 92, 7, 1, "#8a8578")}
      {px(x + 21, 84, 14, 12, "#e8c445")}
      {px(x + 23, 87, 10, 1, "#7a6a2a")}
      {px(x + 23, 90, 7, 1, "#7a6a2a")}
      {px(x + 5, 102, 12, 10, "#c9463c")}
      {px(x + 20, 100, 16, 12, S.white)}
      {px(x + 22, 103, 12, 1, "#8a8578")}
      {/* the corner that's been curling since spring */}
      {px(x + 33, 100, 4, 4, "#cfc4ae")}
      {px(x + 18, 114, 3, 3, "#8a8578")}
    </g>
  );
}

/** Sandwich board on the pavement — out while the shop is open, folded at night. */
function SandwichBoard({ x, open }: { x: number; open: boolean }) {
  if (!open) {
    // folded flat against the glass, chained to the drainpipe
    return (
      <g>
        {px(x + 2, 148, 14, 3, S.shadow)}
        {px(x + 4, 106, 8, 44, "#e8e2d2")}
        {px(x + 4, 106, 8, 2, "#f4f0e4")}
        {px(x + 4, 128, 8, 2, S.zabka)}
        {px(x + 2, 136, 12, 2, S.steelDark)}
      </g>
    );
  }
  return (
    <g>
      {px(x - 2, 148, 26, 3, S.shadow)}
      {px(x + 2, 112, 18, 34, "#e8e2d2")}
      {px(x + 2, 112, 18, 3, S.zabka)}
      {px(x + 20, 114, 3, 32, "#c9c4b6")}
      {px(x + 5, 118, 12, 2, S.zabka)}
      {px(x + 5, 122, 9, 2, "#8a8578")}
      {px(x + 5, 128, 13, 6, "#c9463c")}
      {px(x + 6, 130, 5, 2, S.white)}
      {px(x + 5, 138, 10, 2, "#8a8578")}
      {px(x, 146, 22, 3, "#c9c4b6")}
      {/* it rocks a little when the door swings */}
      <animateTransform
        attributeName="transform"
        type="rotate"
        values={`0 ${x + 10} 148;0 ${x + 10} 148;1.5 ${x + 10} 148;-1 ${x + 10} 148;0 ${x + 10} 148`}
        dur="17s"
        repeatCount="indefinite"
      />
    </g>
  );
}

/** Trzepak with a rug over it — the rug only appears when someone's beating it. */
function Trzepak({ x, ph }: { x: number; ph: Ph }) {
  const rug = ph === "day" || ph === "dawn";
  return (
    <g>
      {px(x, 112, 3, 38, "#8f8a7c")}
      {px(x + 29, 112, 3, 38, "#8f8a7c")}
      {px(x, 112, 32, 3, "#8f8a7c")}
      {px(x, 112, 32, 1, "#a39e90")}
      {px(x, 124, 32, 2, "#8f8a7c")}
      {px(x - 2, 147, 38, 3, S.shadow)}
      {px(x + 1, 146, 3, 4, S.plinthDark)}
      {px(x + 28, 146, 3, 4, S.plinthDark)}
      {rug ? (
        <g>
          {px(x + 4, 115, 22, 16, "#8a3a34")}
          {px(x + 4, 118, 22, 1, "#c9a24b")}
          {px(x + 4, 124, 22, 1, "#c9a24b")}
          {px(x + 4, 115, 22, 1, "#a34a3a")}
          {px(x + 4, 131, 22, 2, "#6d2c28")}
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0 ${x + 15} 115;1.6 ${x + 15} 115;-1.2 ${x + 15} 115;0 ${x + 15} 115`}
            dur="6.8s"
            repeatCount="indefinite"
          />
        </g>
      ) : null}
    </g>
  );
}

// ---------------------------------------------------------------------------
// ambient motion
// ---------------------------------------------------------------------------

function Clouds({ dark }: { dark: boolean }) {
  const tint = dark ? "#6a7080" : "#e8ecf0";
  const tintLo = dark ? "#5a6070" : "#d4dae2";
  const cloud = (cx: number, cy: number, s: number) => (
    <g key={`${cx}${cy}`}>
      {px(cx, cy, 34 * s, 6, tint)}
      {px(cx + 8, cy - 4, 18 * s, 5, tint)}
      {px(cx + 4, cy + 5, 26 * s, 3, tintLo)}
    </g>
  );
  return (
    <g opacity={0.75}>
      <g>
        {cloud(80, 14, 1)}
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;1400 0"
          dur="420s"
          repeatCount="indefinite"
        />
      </g>
      <g>
        {cloud(-260, 26, 1.4)}
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;1600 0"
          dur="330s"
          repeatCount="indefinite"
        />
      </g>
      <g>
        {cloud(-700, 8, 0.8)}
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0;2000 0"
          dur="500s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/** A plane, high up, with a light that keeps its own time. */
function Plane() {
  return (
    <g>
      <g>
        {px(0, 18, 7, 2, "#c8ccd2")}
        {px(2, 16, 2, 6, "#c8ccd2")}
        {px(6, 17, 2, 1, "#aeb4bc")}
        <rect x={0} y={20} width={1} height={1} fill="#ff5050">
          <animate attributeName="opacity" values="1;0;1;0;1" dur="3s" repeatCount="indefinite" />
        </rect>
        {px(-10, 19, 9, 1, "#d8dce2")}
        <animateTransform
          attributeName="transform"
          type="translate"
          values="-40 0;-40 0;1340 40;1340 40"
          keyTimes="0;0.5;0.94;1"
          dur="300s"
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

/** Leaves crossing the pavement, because nothing here stands still. */
function Leaves() {
  const seeds = [
    { x: 180, d: "19s", b: "0s", y: 150 },
    { x: 520, d: "24s", b: "6s", y: 156 },
    { x: 860, d: "21s", b: "11s", y: 152 },
    { x: 1120, d: "26s", b: "3s", y: 158 },
  ];
  return (
    <g>
      {seeds.map((s) => (
        <g key={s.x}>
          {px(s.x, s.y, 3, 2, S.leafDry)}
          {px(s.x + 1, s.y - 1, 1, 1, "#8a5a2a")}
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0;60 -6;140 2;230 -4;320 0"
            dur={s.d}
            begin={s.b}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;1;0"
            dur={s.d}
            begin={s.b}
            repeatCount="indefinite"
          />
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// the scene
// ---------------------------------------------------------------------------

function StreetScene({ world, phase }: { world: WorldState; phase: string }) {
  const p = toPhase(phase);
  const night = p === "night";
  const dark = night || p === "dusk";
  const shopOpen = !night;
  const f = flags(world);
  return (
    <LayeredScene
      parallax={{ farBackground: 0.9, middleBackground: 1 }}
      farBackground={
        <g>
          <PhaseSky id="street-sky" phase={phase} width={STREET_W} />
          <Clouds dark={dark} />
          <Plane />
          {/* west tail of the skyline */}
          {px(470, 96, 30, 40, "#a2a8b6")}
          {px(476, 102, 4, 4, dark ? "#ffd98a" : "#c2c8d2")}
          {px(488, 110, 4, 4, "#c2c8d2")}
          {px(506, 88, 22, 48, "#aab0bc")}
          {px(510, 94, 4, 4, dark ? "#ffd98a" : "#c2c8d2")}
          {px(534, 116, 26, 20, "#556e59")}
          {px(542, 108, 16, 12, "#5f7a63")}
          {/* kościół */}
          {px(598, 92, 34, 44, "#a2a8b6")}
          {px(606, 60, 16, 76, "#a2a8b6")}
          <polygon points="606,60 622,60 614,38" fill="#a2a8b6" />
          {px(613, 32, 2, 8, "#a2a8b6")}
          {px(610, 35, 8, 2, "#a2a8b6")}
          {px(611, 70, 6, 8, dark ? "#8a7a52" : "#8e94a4")}
          {/* high-rise slabs, windows waking in blocks */}
          {px(650, 74, 26, 62, "#aab0bc")}
          {[
            [654, 80],
            [664, 88],
            [654, 100],
            [664, 112],
          ].map(([wx, wy], i) => (
            <rect
              key={`${wx}${wy}`}
              x={wx}
              y={wy}
              width={4}
              height={4}
              fill={dark ? "#ffd98a" : "#c2c8d2"}
            >
              {dark ? (
                <animate
                  attributeName="opacity"
                  values="1;1;0.25;1"
                  dur={`${40 + i * 17}s`}
                  repeatCount="indefinite"
                />
              ) : null}
            </rect>
          ))}
          {px(688, 82, 20, 54, "#a2a8b6")}
          {dark ? px(694, 92, 4, 4, "#ffd98a") : null}
          {/* ciepłownia: stack, bands, beacon, and its plume */}
          {px(830, 30, 12, 106, "#a8a0a0")}
          {px(838, 30, 4, 106, "#948c8c")}
          {px(829, 34, 14, 6, "#c05050")}
          {px(829, 48, 14, 6, "#e8e6e0")}
          {px(829, 62, 14, 6, "#c05050")}
          <rect x={834} y={26} width={4} height={4} fill={S.ledRed}>
            <animate
              attributeName="opacity"
              values="1;0.15;1"
              dur="2.6s"
              repeatCount="indefinite"
            />
          </rect>
          {[0, 3.4, 6.8].map((d) => (
            <circle key={d} cx={836} cy={28} r={4} fill={dark ? "#6a7080" : "#d8dce2"} opacity={0}>
              <animate
                attributeName="opacity"
                values="0;0.5;0"
                begin={`${d}s`}
                dur="10s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values="28;6"
                begin={`${d}s`}
                dur="10s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="cx"
                values="836;880"
                begin={`${d}s`}
                dur="10s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="r"
                values="3;13"
                begin={`${d}s`}
                dur="10s"
                repeatCount="indefinite"
              />
            </circle>
          ))}
          {/* wieża ciśnień */}
          {px(768, 58, 28, 20, "#9a8e94")}
          {px(766, 56, 32, 4, "#8a7e84")}
          <polygon points="766,56 798,56 782,44" fill="#8a7e84" />
          {px(772, 78, 5, 58, "#9a8e94")}
          {px(787, 78, 5, 58, "#8e828a")}
          {px(779, 90, 6, 46, "#9a8e94")}
          {/* kamienice */}
          <polygon points="576,86 648,86 636,66 588,66" fill="#7a5a52" />
          {px(588, 62, 8, 10, "#6a5048")}
          {px(624, 60, 8, 12, "#6a5048")}
          {px(608, 70, 10, 10, "#6a4c46")}
          {px(610, 73, 6, 5, dark ? "#e8c07a" : "#8e94a4")}
          {px(576, 86, 72, 50, "#c4a878")}
          {px(576, 86, 72, 3, "#a88c60")}
          {px(576, 86, 4, 50, "#d4b888")}
          {px(644, 86, 4, 50, "#b09468")}
          {[584, 602, 620].map((wx, i) => (
            <g key={wx}>
              {px(wx, 94, 10, 2, "#a88c60", `l${wx}`)}
              <rect
                x={wx}
                y={96}
                width={10}
                height={14}
                fill={dark ? (i === 1 ? "#ffd98a" : "#3f4650") : "#5a5a6a"}
              />
            </g>
          ))}
          {px(584, 118, 10, 14, dark ? "#ffd98a" : "#5a5a6a")}
          {px(614, 118, 16, 18, "#6a5048")}
          <polygon points="652,90 716,90 706,72 662,72" fill="#6a4c46" />
          {px(668, 66, 7, 10, "#5d443e")}
          {px(652, 90, 64, 46, "#c09488")}
          {px(652, 90, 64, 3, "#a67c72")}
          {px(652, 90, 4, 46, "#d0a498")}
          {[660, 676, 692].map((wx, i) => (
            <rect
              key={wx}
              x={wx}
              y={100}
              width={9}
              height={12}
              fill={dark && i !== 1 ? "#ffd98a" : "#5a5a6a"}
            />
          ))}
          {px(658, 120, 22, 4, "#8a3a34")}
          {px(658, 124, 22, 12, dark ? "#3f4650" : "#4a4a58")}
          <polygon points="720,88 762,88 754,70 728,70" fill="#75584e" />
          {px(742, 62, 7, 12, "#63483f")}
          {px(720, 88, 42, 48, "#a8b498")}
          {px(720, 88, 42, 3, "#8c9a7c")}
          {px(758, 88, 4, 48, "#94a084")}
          {[
            [726, 98],
            [744, 98],
            [726, 118],
            [744, 118],
          ].map(([wx, wy], i) => (
            <rect
              key={`${wx}${wy}`}
              x={wx}
              y={wy}
              width={9}
              height={12}
              fill={dark && i % 3 === 0 ? "#ffd98a" : "#5a5a6a"}
            />
          ))}
          {/* park line, crowns breathing in the wind */}
          {[
            { x: 566, y: 118, w: 28, h: 18, d: "9s" },
            { x: 646, y: 122, w: 24, h: 14, d: "11s" },
            { x: 760, y: 118, w: 30, h: 18, d: "8.5s" },
            { x: 806, y: 122, w: 26, h: 14, d: "12s" },
            { x: 852, y: 118, w: 30, h: 18, d: "10s" },
          ].map((t) => (
            <g key={t.x}>
              {px(t.x, t.y, t.w, t.h, "#556e59")}
              {px(t.x + 8, t.y - 8, t.w - 12, 12, "#5f7a63")}
              {px(t.x + 12, t.y - 13, 10, 8, "#6a8a6e")}
              <animateTransform
                attributeName="transform"
                type="rotate"
                values={`0 ${t.x + t.w / 2} ${t.y + t.h};0.8 ${t.x + t.w / 2} ${t.y + t.h};-0.8 ${t.x + t.w / 2} ${t.y + t.h};0 ${t.x + t.w / 2} ${t.y + t.h}`}
                dur={t.d}
                repeatCount="indefinite"
              />
            </g>
          ))}
          <polygon points="794,96 818,96 806,82 806,82" fill="#5f8a78" />
          {px(798, 96, 16, 12, "#c4a878")}
          {px(804, 78, 4, 6, "#5f8a78")}
          {/* the crane that hasn't moved since March */}
          {px(884, 36, 2, 46, "#4a4653")}
          {px(858, 36, 54, 2, "#4a4653")}
          {px(876, 38, 2, 10, "#4a4653")}
          {px(904, 38, 1, 12, "#4a4653")}
          {px(902, 50, 5, 4, "#8a8478")}
          <rect x={884} y={32} width={3} height={3} fill={S.ledRed}>
            <animate attributeName="opacity" values="1;0.1;1" dur="3.4s" repeatCount="indefinite" />
          </rect>
          {/* the wire and its crows */}
          <path d="M 560 44 Q 760 62 960 46" stroke="#3a3b3a" strokeWidth="1" fill="none" />
          <g>
            {px(742, 54, 4, 3, "#22201e")}
            {px(745, 52, 2, 2, "#22201e")}
            <animateTransform
              attributeName="transform"
              type="rotate"
              values="0 744 57;0 744 57;-9 744 57;0 744 57"
              dur="9.5s"
              repeatCount="indefinite"
            />
          </g>
          {px(692, 53, 4, 3, "#22201e")}
          {px(695, 51, 2, 2, "#22201e")}
        </g>
      }
      middleBackground={
        <g>
          {/* ===================== BLOCK 14 ===================== */}
          {px(60, 0, 520, 150, S.render14)}
          {px(60, 0, 4, 150, S.render14Hi)}
          {px(576, 0, 4, 150, S.render14Lo)}
          {px(238, 0, 2, 138, "#c4baa4")}
          {px(420, 0, 2, 138, "#c4baa4")}
          {px(60, 90, 520, 1, "#c4baa4")}
          {/* a patch of newer render, and damp where the pipe leaks */}
          {px(268, 96, 34, 26, S.renderPatch)}
          {px(268, 96, 34, 1, "#d2c7b1")}
          {px(62, 118, 22, 32, S.renderDamp)}
          {px(62, 118, 14, 12, "#9c9280")}
          {/* floor slab band */}
          {px(60, 36, 520, 2, "#c4baa4")}
          {px(60, 38, 520, 6, S.slab)}
          {px(60, 44, 520, 2, "#9d9484")}
          {/* first-floor windows */}
          <SillWindow x={84} ph={p} life="curtains" />
          <SillWindow x={132} ph={p} life="lit" />
          <SillWindow x={252} ph={p} life="plant" />
          <SillWindow x={296} ph={p} life="tv" />
          <SillWindow x={430} ph={p} life="blinds" />
          <SillWindow x={478} ph={p} life="cat" />
          <SillWindow x={526} ph={p} life="dish" />
          {/* the yellow gas pipe, as inevitable as the render */}
          {px(60, 128, 202, 4, S.gas)}
          {px(60, 128, 202, 1, "#f2d86a")}
          {px(60, 132, 202, 1, S.gasLo)}
          {px(96, 126, 4, 8, S.gasLo)}
          {px(196, 126, 4, 8, S.gasLo)}
          {px(262, 108, 4, 24, S.gas)}
          {px(262, 108, 1, 24, "#f2d86a")}
          {px(258, 104, 12, 5, S.gasLo)}
          {/* drainpipe with its brackets and rust bloom */}
          {px(560, 0, 8, 150, "#c4baa4")}
          {px(560, 0, 2, 150, S.render14Hi)}
          {px(557, 62, 14, 4, "#8a8578")}
          {px(557, 116, 14, 4, "#8a8578")}
          {px(561, 120, 6, 26, S.rust)}
          {/* cable run and a sad little satellite dish */}
          {px(60, 66, 176, 1, "#6d6a62")}
          {px(232, 60, 3, 10, "#6d6a62")}
          {/* plinth, worn where shoulders and bags rub it */}
          {px(60, 138, 520, 12, S.plinth)}
          {px(60, 138, 520, 2, S.plinthDark)}
          {px(140, 140, 60, 8, S.plinthWorn)}
          {px(300, 141, 40, 6, S.plinthWorn)}
          {/* graffiti: a tag, a heart, and a scrubbed-out square */}
          {px(96, 116, 40, 20, "#00000012")}
          {px(100, 120, 3, 14, "#2b5aa8")}
          {px(103, 120, 8, 3, "#2b5aa8")}
          {px(108, 123, 3, 5, "#2b5aa8")}
          {px(103, 128, 8, 3, "#2b5aa8")}
          {px(114, 118, 3, 16, "#c94040")}
          {px(117, 122, 6, 3, "#c94040")}
          {px(122, 125, 3, 9, "#c94040")}
          {px(128, 126, 4, 4, "#c94040")}
          {px(133, 126, 4, 4, "#c94040")}
          {px(130, 130, 5, 3, "#c94040")}
          {px(131, 133, 3, 2, "#c94040")}
          <NoticeBoard x={122} />
          {/* ===================== klatka B ===================== */}
          {px(146, 56, 84, 4, "#d8e4ec99")}
          {px(146, 56, 84, 1, "#eef4f8")}
          {px(150, 60, 3, 8, S.steelDark)}
          {px(222, 60, 3, 8, S.steelDark)}
          {px(146, 60, 84, 4, S.shadow)}
          {px(158, 70, 60, 80, "#3f4246")}
          {px(163, 75, 50, 75, dark ? "#232a30" : S.glassDay)}
          {px(185, 75, 4, 75, "#3f4246")}
          {px(163, 75, 50, 3, "#56606a")}
          {/* someone left the staircase light on, and it's on a timer */}
          {dark ? (
            <rect x={163} y={75} width={50} height={75} fill="#ffd98a" opacity={0.25}>
              <animate
                attributeName="opacity"
                values="0.25;0.25;0;0;0.25"
                dur="34s"
                repeatCount="indefinite"
              />
            </rect>
          ) : null}
          {px(204, 108, 3, 12, S.steel)}
          {px(166, 128, 16, 10, "#e8e2d2")}
          {px(168, 131, 12, 1, "#8a8578")}
          {px(182, 62, 12, 6, dark ? S.glassLit : "#c9c4b6")}
          {px(184, 60, 8, 2, S.steelDark)}
          {dark ? (
            <ellipse cx={188} cy={74} rx={26} ry={16} fill="#ffd98a" opacity={0.16}>
              <animate
                attributeName="opacity"
                values="0.16;0.2;0.16"
                dur="6s"
                repeatCount="indefinite"
              />
            </ellipse>
          ) : null}
          {/* domofon: name list, keypad, the green LED that never sleeps */}
          {px(226, 98, 14, 22, S.steelDark)}
          {px(227, 99, 12, 20, "#8a8f96")}
          {px(228, 101, 10, 9, "#c9c4b6")}
          {[102, 105, 108].map((y) => px(229, y, 8, 1, "#6d6a62", `dn${y}`))}
          {[0, 1, 2].map((c) => px(229 + c * 3, 112, 2, 2, "#6d7278", `dk${c}`))}
          <rect x={230} y={116} width={2} height={2} fill={S.led}>
            <animate attributeName="opacity" values="1;0.4;1" dur="3.2s" repeatCount="indefinite" />
          </rect>
          <Plaque x={162} y={46} digits="14" />
          {/* the doormat and the bike nobody claims */}
          {px(160, 148, 34, 2, "#4a4438")}
          {/* ===================== Żabka ===================== */}
          {px(300, 46, 280, 24, S.zabka)}
          {px(300, 46, 280, 3, S.zabkaHi)}
          {px(300, 68, 280, 2, S.zabkaDark)}
          {px(310, 50, 17, 17, S.white)}
          {px(314, 54, 9, 9, S.zabka)}
          {px(316, 56, 5, 5, S.white)}
          <ZabkaLettering x={350} y={51} dim={night} />
          {/* the fascia is backlit, and one tube is going */}
          {!night ? (
            <rect x={300} y={46} width={280} height={24} fill="#7ee08c" opacity={0.06}>
              <animate
                attributeName="opacity"
                values="0.06;0.06;0.02;0.07;0.06"
                dur="13s"
                repeatCount="indefinite"
              />
            </rect>
          ) : null}
          {/* awning over the pavement */}
          {px(300, 70, 280, 3, "#0d7d46")}
          {px(300, 73, 280, 2, S.zabkaDark)}
          {/* glass wall */}
          {px(302, 75, 276, 75, S.zabkaDark)}
          {px(306, 78, 116, 68, shopOpen ? (dark ? S.glassLitWarm : S.glassDark) : "#1b2a22")}
          {px(306, 78, 116, 3, shopOpen && dark ? "#f8d29a" : "#3a4148")}
          {/* interior: shelves, cooler, and a customer who moves */}
          {px(312, 98, 22, 48, shopOpen ? (dark ? "#c9863f" : "#39434c") : "#22322a")}
          {px(340, 106, 18, 40, shopOpen ? (dark ? "#b8763a" : "#343e47") : "#1e2c26")}
          {px(366, 102, 14, 44, shopOpen ? (dark ? "#c9863f" : "#39434c") : "#22322a")}
          {px(392, 112, 12, 28, shopOpen ? (dark ? "#8a5a3a" : "#2f3941") : "#1e2c26")}
          {shopOpen ? (
            <g opacity={0.85}>
              {px(356, 110, 8, 32, "#2b3138")}
              {px(357, 104, 6, 7, "#2b3138")}
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0;0 0;28 0;28 0;-14 0;-14 0;0 0"
                keyTimes="0;0.12;0.3;0.55;0.72;0.9;1"
                dur="38s"
                repeatCount="indefinite"
              />
            </g>
          ) : null}
          {/* posters */}
          {px(310, 82, 26, 16, "#e8c445")}
          {px(313, 85, 10, 7, "#c94040")}
          {px(342, 82, 26, 16, "#c94040")}
          {px(345, 92, 18, 4, S.white)}
          {/* the door: green frame, hours sticker, handle */}
          {px(430, 75, 52, 75, S.zabka)}
          {px(435, 78, 42, 72, shopOpen ? (dark ? S.glassLitWarm : S.glassDark) : "#1b2a22")}
          {px(438, 82, 16, 14, S.white)}
          <PixelText x={440} y={85} text="6-23" fill={S.zabka} />
          {px(440, 92, 12, 1, S.zabka)}
          {px(470, 108, 3, 12, S.steel)}
          {/* the door swings for the customer, on the same schedule */}
          {shopOpen ? (
            <g style={{ transformOrigin: "482px 75px" }}>
              <rect x={435} y={78} width={42} height={72} fill="#0a6b3c" opacity={0}>
                <animate
                  attributeName="opacity"
                  values="0;0;0.5;0;0"
                  keyTimes="0;0.28;0.32;0.36;1"
                  dur="38s"
                  repeatCount="indefinite"
                />
              </rect>
            </g>
          ) : null}
          {/* right pane with the fridge glow */}
          {px(486, 78, 88, 68, shopOpen ? (dark ? S.glassLitWarm : S.glassDark) : "#1b2a22")}
          {px(490, 90, 22, 56, shopOpen ? "#b8e6ff" : "#3f5a68")}
          {px(492, 94, 18, 2, shopOpen ? "#dff4ff" : "#4a6a78")}
          {px(492, 110, 18, 2, shopOpen ? "#dff4ff" : "#4a6a78")}
          {px(516, 98, 24, 48, shopOpen ? (dark ? "#c9863f" : "#39434c") : "#22322a")}
          {px(546, 106, 20, 40, shopOpen ? (dark ? "#b8763a" : "#343e47") : "#1e2c26")}
          {/* the grille comes down at night */}
          {!shopOpen ? (
            <g>
              {px(302, 75, 276, 4, S.grilleDark)}
              {px(302, 79, 276, 71, "#00000000")}
              {Array.from({ length: 23 }, (_, i) =>
                px(304 + i * 12, 79, 7, 71, S.grille, `gr${i}`),
              )}
              {Array.from({ length: 12 }, (_, i) =>
                px(302, 82 + i * 6, 276, 2, S.grilleDark, `gh${i}`),
              )}
              {px(302, 146, 276, 4, "#4a4e52")}
              {px(430, 108, 8, 8, "#2e3033")}
            </g>
          ) : null}
          {/* crates and the milk delivery, stacked by the door at dawn */}
          {p === "dawn" ? (
            <g>
              {px(492, 128, 22, 10, "#2b5aa8")}
              {px(492, 128, 22, 2, "#3a6bbd")}
              {px(492, 138, 22, 10, "#2b5aa8")}
              {px(494, 130, 18, 6, "#d8e4ec")}
              {px(492, 148, 24, 2, S.shadow)}
            </g>
          ) : null}
          {/* ===================== przejście ===================== */}
          {px(584, 0, 8, 150, "#8a8478")}
          {px(584, 0, 2, 150, "#9a9488")}
          {px(592, 0, 300, 150, "#00000000")}
          {/* the dark passage mouth, with a lamp inside and someone crossing it */}
          {px(592, 40, 300, 110, "#2a2f2c")}
          <rect x={592} y={40} width={300} height={110} fill="#000000" opacity={0.28} />
          {px(700, 44, 20, 6, dark ? "#ffd98a" : "#c9c4b6")}
          {dark ? (
            <ellipse cx={710} cy={70} rx={50} ry={40} fill="#ffd98a" opacity={0.1}>
              <animate
                attributeName="opacity"
                values="0.1;0.13;0.1"
                dur="7s"
                repeatCount="indefinite"
              />
            </ellipse>
          ) : null}
          {/* someone walks the passage every so often */}
          <g opacity={0.55}>
            {px(0, 104, 8, 30, "#1b1f1d")}
            {px(1, 96, 6, 8, "#1b1f1d")}
            <animateTransform
              attributeName="transform"
              type="translate"
              values="600 0;600 0;880 0;880 0"
              keyTimes="0;0.62;0.86;1"
              dur="52s"
              repeatCount="indefinite"
            />
          </g>
          {/* hedge and grass at the mouth of the passage */}
          {px(590, 116, 44, 34, "#33503a")}
          {px(596, 110, 30, 12, "#3d573d")}
          {px(602, 105, 16, 9, "#46624a")}
          {px(588, 147, 48, 3, S.shadow)}
          {px(624, 130, 20, 20, "#2c4632")}
          {/* ===================== BLOCK 16 ===================== */}
          {px(892, 0, 358, 150, S.render16)}
          {px(892, 0, 4, 150, "#c9cfd3")}
          {px(1246, 0, 4, 150, S.render16Lo)}
          {px(1070, 0, 2, 138, "#adb4b8")}
          {px(892, 90, 358, 1, "#adb4b8")}
          {px(892, 36, 358, 2, "#c3cacd")}
          {px(892, 38, 358, 6, "#a8afb3")}
          <SillWindow x={924} ph={p} life="blinds" />
          <SillWindow x={972} ph={p} life="tv" />
          <SillWindow x={1020} ph={p} life="lit" />
          <SillWindow x={1164} ph={p} life="curtains" />
          <SillWindow x={1212} ph={p} life="plant" />
          {px(892, 138, 358, 12, "#8a9094")}
          {px(892, 138, 358, 2, "#7a8084")}
          {/* their gas pipe, painted over twice */}
          {px(892, 124, 158, 4, "#c9c46a")}
          {px(892, 124, 158, 1, "#d8d47a")}
          {px(1100, 124, 150, 4, "#c9c46a")}
          {/* ground-floor flats behind privacy hedges */}
          {px(920, 84, 34, 42, S.frameDark)}
          {px(923, 87, 28, 36, dark ? S.glassDark : S.glassDay)}
          {px(936, 87, 2, 36, S.frameDark)}
          {px(923, 87, 28, 12, "#d8d3c5")}
          {px(914, 126, 46, 24, "#33503a")}
          {px(920, 120, 32, 10, "#3d573d")}
          {px(1160, 84, 34, 42, S.frameDark)}
          {px(1163, 87, 28, 36, dark ? S.glassLit : S.glassDay)}
          {px(1176, 87, 2, 36, S.frameDark)}
          {dark ? px(1166, 92, 10, 14, "#c9863f") : null}
          {px(1154, 126, 46, 24, "#33503a")}
          {px(1160, 120, 32, 10, "#3d573d")}
          {/* their entrance */}
          {px(1040, 58, 76, 4, "#d8e4ec99")}
          {px(1044, 62, 3, 8, S.steelDark)}
          {px(1108, 62, 3, 8, S.steelDark)}
          {px(1054, 70, 52, 80, "#4a5459")}
          {px(1058, 74, 44, 76, dark ? "#232a30" : S.glassDay)}
          {px(1078, 74, 4, 76, "#4a5459")}
          {dark ? px(1058, 74, 44, 76, "#ffd98a") : null}
          {dark ? px(1058, 74, 44, 76, "#00000060") : null}
          {px(1096, 108, 3, 12, S.steel)}
          <Plaque x={1058} y={46} digits="16" />
          {px(1120, 100, 12, 18, S.steelDark)}
          {px(1122, 103, 8, 8, "#c9c4b6")}
          <Bankomat x={986} ph={p} />
        </g>
      }
      ground={
        <g>
          {px(0, 150, STREET_W, 18, S.sidewalk)}
          {px(0, 150, STREET_W, 2, "#00000026")}
          {stripes(STREET_W, 150, 18, 40, S.sidewalkSeam, 20)}
          {px(0, 158, STREET_W, 1, "#a5a29a")}
          {/* worn tracks where everyone actually walks */}
          {px(150, 152, 120, 6, S.sidewalkWorn)}
          {px(430, 152, 90, 6, S.sidewalkWorn)}
          {px(1040, 152, 90, 6, S.sidewalkWorn)}
          {px(0, 166, STREET_W, 3, S.curb)}
          {px(0, 169, STREET_W, 11, S.asphalt)}
          {px(80, 172, 40, 2, S.asphaltLo)}
          {px(500, 174, 60, 2, S.asphaltLo)}
          {px(980, 171, 36, 2, S.asphaltLo)}
          {px(300, 170, 90, 2, "#6a6660")}
          {/* long shadows off the blocks */}
          {px(60, 150, 520, 4, "#00000018")}
          {px(892, 150, 358, 4, "#00000018")}
          {/* manhole, and the steam it lets go of when it's cold */}
          {px(920, 158, 22, 8, "#6d6a62")}
          {px(920, 158, 22, 1, "#7d7a72")}
          {[924, 928, 932, 936].map((mx) => px(mx, 160, 2, 4, "#5a5750", `mh${mx}`))}
          {/* drain grate at the curb */}
          {px(660, 166, 18, 3, "#5a5750")}
          {[662, 666, 670, 674].map((gx) => px(gx, 166, 2, 3, "#3f3d38", `gt${gx}`))}
          {/* puddle that survives everything, and its ripple */}
          {px(640, 160, 30, 4, dark ? "#3a4650" : "#6a7580")}
          {px(645, 159, 18, 1, dark ? "#5d7a8a" : "#8fa0ad")}
          <ellipse cx={655} cy={161} rx={4} ry={1} fill="#c8d8e2" opacity={0}>
            <animate attributeName="rx" values="1;12" dur="6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.45;0" dur="6s" repeatCount="indefinite" />
          </ellipse>
          {/* hopscotch some kid chalked in April */}
          {px(700, 154, 14, 8, "#00000000")}
          {[
            [700, 154],
            [700, 162],
            [714, 154],
            [714, 162],
            [728, 158],
          ].map(([hx, hy]) => (
            <g key={`${hx}${hy}`}>
              {px(hx, hy, 13, 1, S.chalk, `hc1${hx}${hy}`)}
              {px(hx, hy, 1, 8, S.chalk, `hc2${hx}${hy}`)}
              {px(hx + 12, hy, 1, 8, S.chalk, `hc3${hx}${hy}`)}
              {px(hx, hy + 7, 13, 1, S.chalk, `hc4${hx}${hy}`)}
            </g>
          ))}
          {/* grass in the joints, gum, a bottle cap, a lost glove */}
          {px(118, 147, 3, 3, "#4e6b4e")}
          {px(422, 148, 2, 2, "#4e6b4e")}
          {px(704, 147, 3, 3, "#4e6b4e")}
          {px(1058, 148, 2, 2, "#4e6b4e")}
          {px(266, 156, 2, 2, "#6d6a62")}
          {px(812, 162, 2, 2, "#6d6a62")}
          {px(508, 160, 3, 2, "#c94040")}
          <Leaves />
        </g>
      }
      staticObjects={
        <g>
          <Smoker x={244} ph={p} />
          <SandwichBoard x={296} open={shopOpen} />
          <WaitingMan x={488} ph={p} />
          <BusStop x={510} ph={p} />
          <Paczkomat x={620} used={f.paczkomatUsed} ph={p} />
          <Segregacja x={690} open={f.binOpen} ph={p} emptied={f.binsEmptied} />
          <ModernBench x={782} />
          {night ? <Cat x={796} ph={p} fed={f.catFed} /> : <Babcia x={790} ph={p} />}
          {!night ? <Cat x={760} ph={p} fed={f.catFed} /> : null}
          <Kosz x={848} full={!f.binsEmptied && (p === "dusk" || p === "night")} />
          <BikeRack x={872} ph={p} />
          <StreetLamp x={945} on={dark} />
          <Trzepak x={960} ph={p} />
          {/* pigeons: a crowd at her feet by day, two stragglers at night */}
          <Pigeon x={540} />
          <Pigeon x={556} delay={0.9} mode="idle" />
          {!night ? (
            <g>
              <Pigeon x={746} delay={1.6} />
              <Pigeon x={764} delay={0.4} />
              <Pigeon x={828} delay={2.1} />
              <Pigeon x={842} delay={1.1} mode="idle" />
            </g>
          ) : (
            <Pigeon x={746} delay={1.6} mode="idle" />
          )}
          <StreetLamp x={40} on={dark} />
          {/* the lamps take a moment to decide at dusk */}
          {p === "dusk"
            ? [40, 945].map((lx) => (
                <rect key={lx} x={lx - 8} y={40} width={16} height={8} fill="#ffd98a" opacity={0}>
                  <animate
                    attributeName="opacity"
                    values="0;0.5;0;0.35;0;0.6;0.3;0.6"
                    dur="9s"
                    repeatCount="indefinite"
                  />
                </rect>
              ))
            : null}
        </g>
      }
      gameplayObjects={<g>{/* hitboxes only; art lives in the layers above */}</g>}
    />
  );
}

// ---------------------------------------------------------------------------
// effects
// ---------------------------------------------------------------------------

const SMOKER_MONOLOGUES = [
  "Rzucam od poniedziałku. Serio mówię.",
  "Kurwa, zimno. Ale w domu palić nie wolno...",
  "Jedna i wracam. No, może dwie.",
  "Widziałeś, jak podrożyły? Pakiet jak obiad.",
] as const;

const BABCIA_MONOLOGUES = [
  "Za moich czasów masło tyle nie kosztowało...",
  "Autobus znowu nie przyjechał. Siedzę, czekam.",
  "Wnuczek dzwonił! Raz na miesiąc, ale dzwonił.",
  "Ta Żabka to wygoda, ale ceny, panie...",
  "Gołębie mnie znają. Ludzie już mniej.",
] as const;

const HENIEK_MONOLOGUES = [
  "Tablica pisze pięć minut. Pisze tak od dziesięciu.",
  "Kiedyś jeździł co kwadrans. Kiedyś.",
  "Jak nie przyjedzie, to pójdę. Piechotą zdrowiej.",
] as const;

function StreetEffects({
  world,
  phase,
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
  const p = toPhase(phase);
  const night = p === "night";
  const dark = night || p === "dusk";
  const shopOpen = !night;
  void world;
  return (
    <>
      <NpcMonologue
        x={254}
        headY={74}
        scale={scale}
        speaker="Smoker"
        lines={SMOKER_MONOLOGUES}
        muted={dialogueOpen}
      />
      {!night ? (
        <NpcMonologue
          x={800}
          headY={82}
          scale={scale}
          speaker="Babcia Krysia"
          lines={BABCIA_MONOLOGUES}
          muted={dialogueOpen}
        />
      ) : null}
      <NpcMonologue
        x={498}
        headY={78}
        scale={scale}
        speaker="Pan Heniek"
        lines={HENIEK_MONOLOGUES}
        muted={dialogueOpen}
      />
      <svg
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${STREET_W} 180`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0"
      >
        <defs>
          <linearGradient id="streetcone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd98a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffd98a" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="streetsun" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#fff0c8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#fff0c8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {dark ? (
          <g>
            {[40, 945].map((x) => (
              <g key={x}>
                <polygon
                  points={`${x - 14},44 ${x + 14},44 ${x + 52},150 ${x - 52},150`}
                  fill="url(#streetcone)"
                />
                {/* the moths that live in every street lamp */}
                {[0, 1, 2].map((i) => (
                  <rect
                    key={i}
                    x={x - 6 + i * 6}
                    y={46 + i * 3}
                    width={2}
                    height={2}
                    fill="#e8dfc0"
                    opacity={0.7}
                  >
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      values={`0 0; ${8 - i * 3} ${-5 + i}; ${-6 + i * 2} ${7 - i}; ${4 + i} ${3}; 0 0`}
                      dur={`${2.4 + i * 0.6}s`}
                      repeatCount="indefinite"
                    />
                  </rect>
                ))}
              </g>
            ))}
            {shopOpen ? (
              <>
                <rect x={302} y={70} width={276} height={80} fill="#ffd98a" opacity={0.07} />
                <ellipse cx={440} cy={152} rx={160} ry={9} fill="#ffe6a8" opacity={0.14} />
              </>
            ) : (
              <rect x={302} y={75} width={276} height={75} fill="#8fb0c4" opacity={0.04} />
            )}
            <ellipse cx={188} cy={152} rx={44} ry={6} fill="#ffe6a8" opacity={0.09} />
            <ellipse cx={644} cy={152} rx={34} ry={6} fill="#fff0a8" opacity={0.07} />
            <ellipse cx={1141} cy={150} rx={30} ry={6} fill="#ffe6a8" opacity={0.06} />
          </g>
        ) : (
          <g>
            {/* morning light coming down the street between the blocks */}
            <polygon
              points="584,0 900,0 980,150 640,150"
              fill="url(#streetsun)"
              opacity={p === "dawn" ? 1 : 0.45}
            />
          </g>
        )}
      </svg>
    </>
  );
}

// ---------------------------------------------------------------------------
// scene definition
// ---------------------------------------------------------------------------

export const STREET_SCENE: SceneDef<WorldState> = {
  id: "outside",
  width: STREET_W,
  objects: [
    { id: "graffiti", kind: "flavor", x: 112, range: 14 },
    { id: "notice-board", kind: "flavor", x: 142, range: 12 },
    { id: "plaque-14", kind: "flavor", x: 170, range: 10 },
    {
      id: "podezd-door",
      kind: "creakdoor",
      x: 188,
      range: 20,
      to: { scene: "elevator", spawnX: 100 },
    },
    { id: "domofon", kind: "flavor", x: 232, range: 8 },
    { id: "smoker", kind: "npc", x: 254, range: 18 },
    { id: "sandwich-board", kind: "flavor", x: 306, range: 10 },
    { id: "zabka-window", kind: "flavor", x: 360, range: 24 },
    { id: "zabka-hours", kind: "flavor", x: 412, range: 14 },
    {
      id: "zabka-door",
      kind: "creakdoor",
      x: 456,
      range: 22,
      to: { scene: "zabka", spawnX: 60 },
    },
    { id: "waiting-man", kind: "npc", x: 496, range: 12 },
    { id: "bus-stop", kind: "flavor", x: 528, range: 16 },
    { id: "puddle", kind: "flavor", x: 578, range: 10 },
    { id: "hedge", kind: "flavor", x: 610, range: 10 },
    { id: "paczkomat", kind: "paczkomat", x: 644, range: 18 },
    { id: "bins", kind: "bins", x: 724, range: 20 },
    { id: "cat", kind: "flavor", x: 768, range: 10 },
    { id: "babcia", kind: "npc", x: 800, range: 18 },
    { id: "bench", kind: "flavor", x: 830, range: 10 },
    { id: "kosz", kind: "flavor", x: 856, range: 10 },
    { id: "bike-rack", kind: "flavor", x: 894, range: 16 },
    { id: "manhole", kind: "flavor", x: 930, range: 10 },
    { id: "vybivalka", kind: "flavor", x: 976, range: 14 },
    { id: "bankomat", kind: "flavor", x: 1003, range: 14 },
    { id: "plaque-16", kind: "flavor", x: 1070, range: 10 },
    { id: "klatka-16", kind: "flavor", x: 1082, range: 14 },
    { id: "bankomat", kind: "flavor", x: 1141, range: 14 },
    { id: "parter-window", kind: "flavor", x: 1177, range: 12 },
  ],
  Component: ({ world, phase }) => <StreetScene world={world} phase={phase} />,
  darkness: (phase) => (phase === "night" ? 0.32 : phase === "dusk" ? 0.16 : 0),
  Effects: StreetEffects,
  Foreground: () => (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={`0 0 ${STREET_W} 180`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0"
    >
      <g shapeRendering="crispEdges">
        {/* hedges framing the walk, layered greens */}
        {px(-6, 138, 56, 42, "#2c4632")}
        {px(2, 130, 36, 14, "#33503a")}
        {px(12, 124, 18, 10, "#3d573d")}
        {px(20, 121, 8, 6, "#46624a")}
        {px(6, 134, 6, 4, "#46624a")}
        {px(520, 156, 46, 24, "#2c4632")}
        {px(528, 150, 28, 10, "#33503a")}
        {px(536, 146, 14, 7, "#3d573d")}
        {px(1230, 148, 56, 32, "#2c4632")}
        {px(1240, 140, 32, 12, "#33503a")}
        {px(1250, 135, 16, 8, "#3d573d")}
        {/* concrete planter with marigolds */}
        {px(680, 162, 60, 18, "#8d8478")}
        {px(680, 162, 60, 3, "#9d9488")}
        {px(680, 176, 60, 4, "#7a7268")}
        {px(686, 156, 8, 7, "#e8a445")}
        {px(700, 154, 8, 8, "#e8c445")}
        {px(716, 156, 8, 7, "#d9832f")}
        {px(690, 160, 40, 3, "#3d573d")}
        {px(694, 152, 3, 6, "#4a6b4a")}
        {/* the parked crossover: nose, mirror, DRL */}
        {px(880, 164, 170, 16, "#1a1c20")}
        {px(906, 154, 130, 12, "#23262c")}
        {px(906, 154, 130, 2, "#31353d")}
        {px(914, 158, 10, 3, "#e8f0f8")}
        {px(1030, 150, 8, 6, "#23262c")}
        {px(940, 156, 60, 6, "#2c3038")}
        {/* a bollard and a sign post, very close to the lens */}
        {px(300, 150, 7, 30, "#4a4e52")}
        {px(300, 150, 7, 3, "#e8e2d2")}
        {px(300, 162, 7, 3, "#e8e2d2")}
        {/* and a car that goes past now and then */}
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="-420 0;-420 0;1560 0;1560 0"
            keyTimes="0;0.74;0.855;1"
            dur="54s"
            repeatCount="indefinite"
          />
          {px(0, 152, 210, 28, "#2b3a52")}
          {px(0, 152, 210, 3, "#3d5070")}
          {px(24, 140, 150, 13, "#22303f")}
          {px(30, 143, 60, 8, "#4a6076")}
          {px(100, 143, 60, 8, "#4a6076")}
          {px(0, 158, 6, 8, "#e8f0f8")}
          {px(204, 158, 6, 8, "#c94040")}
          {px(30, 176, 34, 4, "#141618")}
          {px(150, 176, 34, 4, "#141618")}
        </g>
      </g>
    </svg>
  ),
  idleLean: true,
};
