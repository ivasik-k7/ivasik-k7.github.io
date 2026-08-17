import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { lofiPlayer } from "@/engine";
import type { RoomId } from "@/lib/apartment";
import type { DayPhase } from "@/lib/worldState";

/**
 * HUD — one component, one mount, two rails.
 *
 * Left says *when* and *where*: clock, weekday, room, and the deck under it.
 * Right says *how far in*: the day's arc, the building with your cell lit, how
 * much of the flat you've touched, and what's worth opening.
 *
 * Rules this file holds to:
 *
 *   Nothing on screen is decoration. Every panel is driven by state the game
 *   actually owns, and anything the caller can't supply is not rendered — no
 *   zeroed meters, no language switcher with one language in it, no keyboard
 *   hints on a touch device, no progress bar unless there's progress to show.
 *
 *   Five panels, not eight. Plan and progress share a frame; the panel links
 *   and the language switch share a frame. Fewer boxes reads as more solid.
 *
 *   It gets out of the way. Both rails sit at 80% and come to full on hover or
 *   focus, and wake to full for two seconds when the room changes so the new
 *   label registers. Nothing pulses if the player asked for reduced motion.
 *
 *   It never eats input. The root is inset-0 / pointer-events-none; each panel
 *   re-enables them for itself, so the space between panels stays walkable and
 *   every control stops pointerdown before it reaches the scene.
 */

export type PanelId = "about" | "skills" | "links";

export interface PlanCell {
  /** must match the RoomId the game reports */
  id: string;
  col: number;
  row: number;
  /** width in cells, default 1 */
  w?: number;
}

export interface HudProps {
  room: RoomId;
  /** omit to derive from the wall clock */
  phase?: DayPhase;
  /** both numbers or nothing — the meter will not render half-known */
  progress?: { found: number; total: number };
  /** rooms the player has set foot in; unvisited cells draw as outlines */
  visited?: readonly string[];
  /** rendered only when onOpenPanel is supplied */
  panels?: readonly PanelId[];
  onOpenPanel?: (id: PanelId) => void;
  /** defaults to i18n's configured languages; hidden when there's only one */
  languages?: readonly string[];
  /** pass your real bindings, or false to hide; auto-hidden on touch */
  controls?: readonly { keys: string; label: string }[] | false;
  showAudio?: boolean;
  /** money line + carried item labels; the panel renders only when supplied */
  pocket?: { money: string; items: readonly string[] };
  plan?: readonly PlanCell[];
}

// ---------------------------------------------------------------------------
// environment
// ---------------------------------------------------------------------------

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// ---------------------------------------------------------------------------
// chrome
// ---------------------------------------------------------------------------

const FRAME =
  "pointer-events-auto relative border border-parchment/25 bg-black/60 px-2 py-1 font-mono text-[11px] uppercase leading-none tracking-[0.18em] text-parchment/70 shadow-[inset_0_1px_0_rgba(232,230,224,0.07),0_1px_0_rgba(0,0,0,0.55)]";

/** Four 3px brackets — the difference between a div and a game frame. */
function Corners() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-px -left-px size-[3px] border-parchment/70 border-t border-l"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-px -right-px size-[3px] border-parchment/70 border-t border-r"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-px -left-px size-[3px] border-parchment/70 border-b border-l"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-px -right-px size-[3px] border-parchment/70 border-b border-r"
      />
    </>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${FRAME} ${className}`} onPointerDown={(e) => e.stopPropagation()}>
      {children}
      <Corners />
    </div>
  );
}

function Glyph({
  label,
  active,
  onClick,
  className = "",
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className={`rounded-none transition-colors hover:text-signal focus-visible:text-signal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal/60 ${active ? "text-signal" : "text-parchment/60"} ${className}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Rule({ vertical = false }: { vertical?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={vertical ? "h-3 w-px bg-parchment/20" : "my-1 h-px w-full bg-parchment/15"}
    />
  );
}

function Meter({ value, max, cells = 10 }: { value: number; max: number; cells?: number }) {
  const filled = max <= 0 ? 0 : Math.min(cells, Math.max(0, Math.round((value / max) * cells)));
  return (
    <span aria-hidden="true" className="tracking-normal text-parchment/40">
      <span className="text-signal/85">{"▮".repeat(filled)}</span>
      {"▯".repeat(cells - filled)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// the day's arc
// ---------------------------------------------------------------------------

function phaseFromHour(h: number): DayPhase {
  if (h < 6 || h >= 22) return "night" as DayPhase;
  if (h < 9) return "dawn" as DayPhase;
  if (h < 18) return "day" as DayPhase;
  return "dusk" as DayPhase;
}

const DIAL: Record<string, { x: number; y: number; night: boolean; tint: string }> = {
  dawn: { x: 11, y: 12, night: false, tint: "#e8a86a" },
  morning: { x: 11, y: 12, night: false, tint: "#e8a86a" },
  day: { x: 27, y: 5, night: false, tint: "#ffd98a" },
  dusk: { x: 43, y: 12, night: false, tint: "#d9773f" },
  night: { x: 27, y: 8, night: true, tint: "#9fc7d6" },
};

/** 54×26: a dotted track, a ticked horizon, and the sun riding it. */
function PhaseDial({ phase, still }: { phase: DayPhase; still: boolean }) {
  const d = DIAL[phase as string] ?? DIAL.day;
  return (
    <svg
      aria-hidden="true"
      width="54"
      height="26"
      viewBox="0 0 54 26"
      shapeRendering="crispEdges"
      className="shrink-0"
    >
      {[6, 12, 18, 24, 30, 36, 42, 48].map((x, i) => {
        const y = 20 - Math.round(Math.sin((i + 0.5) * (Math.PI / 8)) * 13);
        return <rect key={x} x={x} y={y} width="1" height="1" fill="currentColor" opacity={0.2} />;
      })}
      <rect x="0" y="20" width="54" height="1" fill="currentColor" opacity={0.35} />
      {[2, 10, 18, 26, 34, 42, 50].map((x) => (
        <rect key={`t${x}`} x={x} y="21" width="1" height="2" fill="currentColor" opacity={0.16} />
      ))}
      {d.night ? (
        <g>
          <rect x={d.x - 4} y={d.y - 3} width="8" height="8" fill={d.tint} />
          <rect x={d.x - 5} y={d.y - 1} width="1" height="4" fill={d.tint} />
          <rect x={d.x + 4} y={d.y - 1} width="1" height="4" fill={d.tint} />
          <rect x={d.x - 1} y={d.y - 4} width="4" height="4" fill="#000" opacity={0.88} />
          <rect x={d.x + 1} y={d.y - 2} width="4" height="6" fill="#000" opacity={0.88} />
          <rect x="9" y="4" width="1" height="1" fill={d.tint} opacity={0.8} />
          <rect x="44" y="8" width="1" height="1" fill={d.tint} opacity={0.55} />
          <rect x="38" y="3" width="1" height="1" fill={d.tint} opacity={0.45} />
        </g>
      ) : (
        <g>
          <rect x={d.x - 3} y={d.y - 3} width="6" height="6" fill={d.tint} />
          <rect x={d.x - 4} y={d.y - 2} width="1" height="4" fill={d.tint} />
          <rect x={d.x + 3} y={d.y - 2} width="1" height="4" fill={d.tint} />
          <rect x={d.x - 2} y={d.y - 4} width="4" height="1" fill={d.tint} />
          <rect x={d.x - 2} y={d.y + 3} width="4" height="1" fill={d.tint} />
          <rect x={d.x - 3} y={d.y - 3} width="6" height="6" fill={d.tint} opacity={0.3}>
            {still ? null : (
              <animate
                attributeName="opacity"
                values="0.3;0.12;0.3"
                dur="6s"
                repeatCount="indefinite"
              />
            )}
          </rect>
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// the plan
// ---------------------------------------------------------------------------

/** Słoneczna 14 in nine cells: the flat, the ground, the level below. */
const DEFAULT_PLAN: readonly PlanCell[] = [
  { id: "balcony", col: 0, row: 0 },
  { id: "bath", col: 1, row: 0 },
  { id: "study", col: 2, row: 0 },
  { id: "studio", col: 3, row: 0, w: 2 },
  { id: "corridor", col: 5, row: 0 },
  { id: "elevator", col: 6, row: 0 },
  { id: "zabka", col: 1, row: 1, w: 2 },
  { id: "outside", col: 3, row: 1, w: 3 },
  { id: "parking", col: 2, row: 2, w: 4 },
];

const CELL = 9;
const GAP = 2;

function PlanMap({
  room,
  visited,
  plan,
  still,
}: {
  room: RoomId;
  visited: readonly string[];
  plan: readonly PlanCell[];
  still: boolean;
}) {
  const seen = new Set<string>([...visited, room as string]);
  const cols = plan.reduce((m, c) => Math.max(m, c.col + (c.w ?? 1)), 0);
  const rows = plan.reduce((m, c) => Math.max(m, c.row + 1), 0);
  const w = cols * (CELL + GAP) - GAP;
  const h = rows * (CELL + GAP) - GAP + 3;
  const shaft = plan.find((c) => c.id === "elevator");
  return (
    <svg
      aria-hidden="true"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className="shrink-0"
    >
      {Array.from({ length: rows }, (_, r) => r * (CELL + GAP) + CELL + 1).map((slabY) => (
        <rect
          key={`sl${slabY}`}
          x="0"
          y={slabY}
          width={w}
          height="1"
          fill="currentColor"
          opacity={0.16}
        />
      ))}
      {shaft ? (
        <rect
          x={shaft.col * (CELL + GAP)}
          y="0"
          width={CELL}
          height={rows * (CELL + GAP) - GAP}
          fill="currentColor"
          opacity={0.07}
        />
      ) : null}
      {plan.map((c) => {
        const cw = (c.w ?? 1) * CELL + ((c.w ?? 1) - 1) * GAP;
        const cx = c.col * (CELL + GAP);
        const cy = c.row * (CELL + GAP);
        const here = c.id === (room as string);
        const been = seen.has(c.id);
        return (
          <g key={c.id} className={here ? "text-signal" : undefined}>
            <rect
              x={cx}
              y={cy}
              width={cw}
              height={CELL}
              fill="currentColor"
              opacity={here ? 0.9 : been ? 0.24 : 0.09}
            />
            {here && !still ? (
              <rect x={cx} y={cy} width={cw} height={CELL} fill="currentColor" opacity={0.35}>
                <animate
                  attributeName="opacity"
                  values="0.35;0.08;0.35"
                  dur="2.4s"
                  repeatCount="indefinite"
                />
              </rect>
            ) : null}
            {!been ? (
              <rect
                x={cx}
                y={cy}
                width={cw}
                height={CELL}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                opacity={0.2}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// the deck
// ---------------------------------------------------------------------------

const subscribe = (fn: () => void) => lofiPlayer.subscribe(fn);
const snapshot = () => `${lofiPlayer.playing}:${lofiPlayer.track?.name ?? ""}:${lofiPlayer.volume}`;

function AudioDeck() {
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  void state;
  const track = lofiPlayer.track?.name;
  if (!track) return null;
  const bars = Math.max(0, Math.min(5, Math.round(lofiPlayer.volume * 5)));

  return (
    <Panel className="flex items-center gap-2 tracking-[0.14em]">
      <span aria-hidden="true" className={lofiPlayer.playing ? "text-signal" : "text-parchment/35"}>
        ♪
      </span>
      <Glyph
        label={lofiPlayer.playing ? "Pause music" : "Play music"}
        onClick={() => lofiPlayer.toggle()}
      >
        {lofiPlayer.playing ? "❚❚" : "▶"}
      </Glyph>
      <Glyph label="Next track" onClick={() => lofiPlayer.next()}>
        ⏭
      </Glyph>
      <span className="w-[8rem] truncate text-parchment/55 normal-case tracking-normal">
        {track}
      </span>
      <Rule vertical />
      <Glyph label="Volume down" onClick={() => lofiPlayer.setVolume(lofiPlayer.volume - 0.2)}>
        −
      </Glyph>
      <span aria-hidden="true" className="tracking-normal text-parchment/40">
        <span className="text-signal/85">{"▮".repeat(bars)}</span>
        {"▯".repeat(5 - bars)}
      </span>
      <Glyph label="Volume up" onClick={() => lofiPlayer.setVolume(lofiPlayer.volume + 0.2)}>
        +
      </Glyph>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// the HUD
// ---------------------------------------------------------------------------

const DEFAULT_CONTROLS = [
  { keys: "←→", label: "MOVE" },
  { keys: "E", label: "USE" },
  { keys: "ESC", label: "CLOSE" },
] as const;

export function HUD({
  room,
  phase,
  progress,
  visited = [],
  panels = ["about", "skills", "links"],
  onOpenPanel,
  languages,
  controls,
  showAudio = true,
  pocket,
  plan = DEFAULT_PLAN,
}: HudProps) {
  const { t, i18n } = useTranslation();
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const touch = useMediaQuery("(pointer: coarse)");

  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(true);
  const [wake, setWake] = useState(true);
  const first = useRef(true);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // the right rail starts closed on a phone, where the art matters more
  useEffect(() => {
    if (touch) setOpen(false);
  }, [touch]);

  // come to full opacity for two seconds when the room changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: `room` is the trigger; the timers close over nothing else
  useEffect(() => {
    if (first.current) {
      first.current = false;
      const t0 = window.setTimeout(() => setWake(false), 2000);
      return () => window.clearTimeout(t0);
    }
    setWake(true);
    const t1 = window.setTimeout(() => setWake(false), 2000);
    return () => window.clearTimeout(t1);
  }, [room]);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const weekday = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "en", {
    weekday: "short",
  }).format(now);

  const activePhase = phase ?? phaseFromHour(now.getHours());
  const phaseLabel = t(`hud.phase.${activePhase}`, {
    defaultValue: String(activePhase),
  }).toUpperCase();
  const roomLabel = t(`hud.${room}`, { defaultValue: String(room) });

  // only offer a switcher when there is something to switch between
  const configured = (i18n.options?.supportedLngs || []).filter(
    (l): l is string => typeof l === "string" && l !== "cimode",
  );
  const langs = (languages ?? configured).map((l) => l.slice(0, 2));
  const uniqueLangs = [...new Set(langs)];
  const current = (i18n.resolvedLanguage ?? "").slice(0, 2);

  const keyHints = controls === false ? [] : touch ? [] : (controls ?? DEFAULT_CONTROLS);
  const showPanels = Boolean(onOpenPanel) && panels.length > 0;
  const showLangs = uniqueLangs.length > 1;
  const rail = `flex flex-col gap-1.5 transition-opacity duration-500 ${wake ? "opacity-100" : "opacity-80"} hover:opacity-100 focus-within:opacity-100`;

  return (
    <div className="pointer-events-none absolute inset-0 select-none pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      {/* ------------------------- left: when / where ---------------------- */}
      <div className={`absolute top-3 left-3 items-start ${rail}`}>
        <Panel className="flex items-center gap-2">
          <time dateTime={`${hh}:${mm}`} className="tabular-nums text-parchment/85">
            {hh}
            <span className={`text-parchment/45 ${still ? "" : "animate-pulse"}`}>:</span>
            {mm}
          </time>
          <span className="text-parchment/45">{weekday.toUpperCase()}</span>
          <Rule vertical />
          <span className="text-parchment/75">{roomLabel}</span>
        </Panel>
        {pocket ? (
          <Panel className="flex items-center gap-2">
            <span className="text-signal/90">{pocket.money}</span>
            {pocket.items.map((item) => (
              <span key={item} className="flex items-center gap-2 text-parchment/55">
                <Rule vertical />
                {item}
              </span>
            ))}
          </Panel>
        ) : null}
        {showAudio ? <AudioDeck /> : null}
      </div>

      {/* ------------------------- right: how far in ----------------------- */}
      <div className={`absolute top-3 right-3 items-end ${rail}`}>
        <Panel className="flex items-center gap-2">
          <span className="text-parchment/60">{phaseLabel}</span>
          <PhaseDial phase={activePhase} still={still} />
          <Glyph
            label={open ? "Collapse details" : "Expand details"}
            onClick={() => setOpen((v) => !v)}
            className="text-parchment/40"
          >
            {open ? "▴" : "▾"}
          </Glyph>
        </Panel>

        {open ? (
          <>
            <Panel className="flex flex-col items-end">
              <PlanMap room={room} visited={visited} plan={plan} still={still} />
              {progress && progress.total > 0 ? (
                <>
                  <Rule />
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-parchment/40">
                      {t("hud.found", { defaultValue: "SEEN" })}
                    </span>
                    <Meter value={progress.found} max={progress.total} />
                    <span className="tabular-nums text-parchment/65">
                      {String(progress.found).padStart(2, "0")}/{progress.total}
                    </span>
                  </span>
                </>
              ) : null}
            </Panel>

            {showPanels || showLangs ? (
              <Panel className="flex items-center gap-3">
                {showPanels
                  ? panels.map((id) => (
                      <Glyph key={id} label={`Open ${id}`} onClick={() => onOpenPanel?.(id)}>
                        {t(`hud.panel.${id}`, { defaultValue: id }).toUpperCase()}
                      </Glyph>
                    ))
                  : null}
                {showPanels && showLangs ? <Rule vertical /> : null}
                {showLangs
                  ? uniqueLangs.map((l) => (
                      <Glyph
                        key={l}
                        label={`Switch language to ${l}`}
                        active={current === l}
                        onClick={() => void i18n.changeLanguage(l)}
                      >
                        {l.toUpperCase()}
                      </Glyph>
                    ))
                  : null}
              </Panel>
            ) : null}

            {keyHints.length > 0 ? (
              <Panel className="flex items-center gap-2 text-parchment/35">
                {keyHints.map((c, i) => (
                  <span key={c.keys} className="flex items-center gap-2">
                    {i > 0 ? <Rule vertical /> : null}
                    <span className="text-parchment/65">{c.keys}</span>
                    <span>{c.label}</span>
                  </span>
                ))}
              </Panel>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Back-compat: the old call site was `<Hud room={room} />`. */
export const Hud = HUD;
