import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { lofiPlayer, PixelFrame, PixelLabel, useReducedMotion } from "@/engine";
import type { DayPhase } from "@/lib/worldState";

/**
 * HUD — two plates and a deck, all set in the game's own typeface.
 *
 * The rule comes from Ringo Ishikawa and Fading Afternoon: while you are
 * walking, the screen belongs to the street. Nothing overlays the world except
 * what a person actually keeps track of — the hour, what is in the pocket, and
 * whether the music is on. Everything else lives behind TAB, in the menu.
 *
 * Every character up here is drawn with the same 3x5 glyphs as the ŻABKA
 * fascia and the lift display, so the interface reads as part of the world
 * rather than as a browser sitting in front of it. Web type appears nowhere.
 *
 *   clock    hour, weekday, phase, room. Press it to open the menu.
 *   pocket   money, and a count of what is carried. Only when there is a pocket.
 *   deck     collapsed it is a speaker and a level; expanded it is the whole
 *            transport — previous, play, next, four tracks, eight volume cells.
 */

export type PanelId = "about" | "skills" | "links";

export interface HudProps {
  /** Scene id, shown through the hud.<id> i18n key (upper-cased fallback). */
  room: string;
  /** omit to derive from the wall clock */
  phase?: DayPhase;
  visited?: readonly string[];
  /** money line + carried item labels; the plate renders only when supplied */
  pocket?: { money: string; items: readonly string[] };
  /** opens the menu book — the clock plate is its door */
  onOpenMenu?: () => void;
  showAudio?: boolean;
}

const U = 3;
const PARCHMENT = "#e3d9c2";
const SIGNAL = "#fcee0a";
const EMBER = "#ffb454";

// ---------------------------------------------------------------------------

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const phaseOf = (h: number): DayPhase =>
  h < 6 ? "night" : h < 11 ? "morning" : h < 17 ? "day" : h < 21 ? "dusk" : "night";

// ---------------------------------------------------------------------------
// the deck
// ---------------------------------------------------------------------------

const audioSubscribe = (fn: () => void) => lofiPlayer.subscribe(fn);
const audioSnapshot = () => `${lofiPlayer.playing}:${lofiPlayer.track?.name}:${lofiPlayer.volume}`;

/** Transport glyphs, drawn rather than typed — the font has no triangles. */
function Transport({
  kind,
  fill,
  px = 3,
}: {
  kind: "prev" | "play" | "pause" | "next" | "note" | "mute";
  fill: string;
  px?: number;
}) {
  const shapes: Record<string, [number, number, number, number][]> = {
    // a triangle as four stepped columns, because that is how a pixel plays
    play: [
      [1, 0, 1, 7],
      [2, 1, 1, 5],
      [3, 2, 1, 3],
      [4, 3, 1, 1],
    ],
    pause: [
      [1, 0, 2, 7],
      [4, 0, 2, 7],
    ],
    next: [
      [0, 0, 1, 7],
      [1, 1, 1, 5],
      [2, 2, 1, 3],
      [3, 3, 1, 1],
      [5, 0, 1, 7],
    ],
    prev: [
      [6, 0, 1, 7],
      [5, 1, 1, 5],
      [4, 2, 1, 3],
      [3, 3, 1, 1],
      [1, 0, 1, 7],
    ],
    // a quaver: stem, flag, and the head that makes it read as music
    note: [
      [3, 0, 3, 1],
      [5, 1, 1, 2],
      [3, 1, 1, 4],
      [1, 4, 3, 3],
    ],
    mute: [
      [1, 2, 3, 3],
      [4, 1, 2, 5],
    ],
  };
  return (
    <svg
      aria-hidden="true"
      width={7 * px}
      height={7 * px}
      viewBox="0 0 7 7"
      shapeRendering="crispEdges"
      style={{ display: "block" }}
    >
      {shapes[kind].map(([x, y, w, h]) => (
        <rect key={`${x}:${y}`} x={x} y={y} width={w} height={h} fill={fill} />
      ))}
    </svg>
  );
}

function DeckButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <PixelFrame u={2} tone="plate" rivets={false} scan={false} onClick={onClick} ariaLabel={label}>
      <span className="flex items-center justify-center" style={{ padding: 4 }}>
        {children}
      </span>
    </PixelFrame>
  );
}

function Deck() {
  useSyncExternalStore(audioSubscribe, audioSnapshot, audioSnapshot);
  const [open, setOpen] = useState(false);
  const on = lofiPlayer.playing;
  const vol = lofiPlayer.volume;
  const cells = 8;
  const filled = Math.round(vol * cells);
  const track = lofiPlayer.track;

  if (!open) {
    return (
      <PixelFrame
        u={U}
        tone="plate"
        rivets={false}
        onClick={() => setOpen(true)}
        ariaLabel="Open the music deck"
      >
        <span className="flex items-end gap-[3px]" style={{ padding: `${U * 2}px ${U * 2.5}px` }}>
          <span style={{ opacity: on ? 1 : 0.45, marginRight: 2 }}>
            <Transport kind={on ? "note" : "mute"} fill={on ? SIGNAL : PARCHMENT} px={2} />
          </span>
          {Array.from({ length: 4 }, (_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: four fixed level bars
              key={`bar${i * 1}`}
              className={on ? "deck-eq" : undefined}
              style={{
                width: U,
                height: U * (i + 1),
                background: on && i < Math.round(vol * 4) ? SIGNAL : "rgba(227,217,194,0.16)",
                animationDelay: `${i * 0.13}s`,
              }}
            />
          ))}
        </span>
      </PixelFrame>
    );
  }

  return (
    <PixelFrame u={U} tone="panel" title="MUSIC" badge={on ? "ON AIR" : "PAUSED"}>
      <div
        className="flex flex-col gap-2"
        style={{ padding: `${U * 4}px ${U * 3}px ${U * 3}px`, minWidth: 190 }}
      >
        {/* what is playing, and where in the stack it sits */}
        <div className="flex items-center justify-between gap-3">
          <PixelLabel text={track?.name ?? "SILENCE"} px={2} fill={on ? SIGNAL : PARCHMENT} />
          <PixelLabel
            text={`${(lofiPlayer.trackIndex ?? 0) + 1}/${lofiPlayer.trackCount ?? 4}`}
            px={2}
            fill={PARCHMENT}
            opacity={0.4}
          />
        </div>

        {/* transport */}
        <div className="flex items-center gap-1.5">
          <DeckButton onClick={() => lofiPlayer.next(-1)} label="Previous track">
            <Transport kind="prev" fill={PARCHMENT} />
          </DeckButton>
          <DeckButton onClick={() => lofiPlayer.toggle()} label={on ? "Pause" : "Play"}>
            <Transport kind={on ? "pause" : "play"} fill={SIGNAL} />
          </DeckButton>
          <DeckButton onClick={() => lofiPlayer.next(1)} label="Next track">
            <Transport kind="next" fill={PARCHMENT} />
          </DeckButton>
          <span className="grow" />
          {/* the level meter dances only while something is coming out of it */}
          <span className="flex items-end gap-[2px]" style={{ height: U * 5 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: five fixed meter bars
                key={`eq${i * 1}`}
                className={on ? "deck-eq" : undefined}
                style={{
                  width: 2,
                  height: on ? U * (1 + (i % 3)) : 2,
                  background: on ? SIGNAL : "rgba(227,217,194,0.2)",
                  animationDelay: `${i * 0.11}s`,
                }}
              />
            ))}
          </span>
        </div>

        {/* volume: eight cells, and clicking one is how you set it */}
        <div className="flex items-center gap-2">
          <PixelLabel text="VOL" px={2} fill={PARCHMENT} opacity={0.45} />
          <span className="flex items-center gap-[3px]">
            {Array.from({ length: cells }, (_, i) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: eight fixed volume cells
                key={`vol${i * 1}`}
                type="button"
                aria-label={`Volume ${i + 1} of ${cells}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => lofiPlayer.setVolume((i + 1) / cells)}
                style={{
                  width: U * 2,
                  height: U * 3,
                  background: i < filled ? SIGNAL : "rgba(227,217,194,0.14)",
                  boxShadow: i < filled ? "inset 0 -3px 0 rgba(0,0,0,0.35)" : undefined,
                }}
              />
            ))}
          </span>
        </div>

        <TrackList />

        <button
          type="button"
          className="self-start"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setOpen(false)}
        >
          <PixelLabel text="- CLOSE" px={2} fill={PARCHMENT} opacity={0.4} />
        </button>
      </div>
    </PixelFrame>
  );
}

/**
 * The track list.
 *
 * This was a wrapped row of name plates, which is the right answer for the four
 * cassettes the deck used to hold and the wrong one for the eight it holds now,
 * let alone twenty: the plates wrapped to five lines and made the deck taller
 * than the flat.
 *
 * So it is a scrolling column, the way any music app does it — one row per
 * track, the playing one marked and named in signal yellow, the rest quiet.
 * Fixed height, `overflow-y: auto`, and the game's own scrollbar rather than the
 * operating system's.
 *
 * Deliberately *not* virtualised. A windowed list is the correct answer above a
 * few hundred rows and pure overhead below it: each row here is one `<button>`
 * and one `<path>`, so a hundred tracks is two hundred nodes inside a container
 * that clips them — cheaper than the machinery needed to avoid them. If this
 * ever holds a thousand tracks, that is the point to add windowing, and the row
 * height is fixed precisely so that it can be.
 */
const ROW_H = 18;

function TrackList() {
  const names = lofiPlayer.trackNames ?? [];
  const current = lofiPlayer.trackIndex ?? 0;
  const boxRef = useRef<HTMLDivElement | null>(null);

  /**
   * Keep what is playing on screen. Skipping to a track near the bottom of the
   * list and having the highlight scroll out of view is the one thing that makes
   * a list like this feel broken.
   */
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const top = current * ROW_H;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + ROW_H > box.scrollTop + box.clientHeight) {
      box.scrollTop = top + ROW_H - box.clientHeight;
    }
  }, [current]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <PixelLabel text="TRACKS" px={2} fill={PARCHMENT} opacity={0.45} />
        <PixelLabel text={`${names.length}`} px={2} fill={PARCHMENT} opacity={0.3} />
      </div>
      <div
        ref={boxRef}
        className="pixel-scroll flex flex-col overflow-y-auto"
        style={{ maxHeight: ROW_H * 6, minWidth: 168 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {names.map((name, i) => {
          const here = i === current;
          return (
            <button
              key={name}
              type="button"
              aria-current={here}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => lofiPlayer.playTrack(i)}
              className="flex shrink-0 items-center gap-2 text-left"
              style={{ height: ROW_H, paddingRight: 6 }}
            >
              {/* the marker column is a fixed width, so the names never shift */}
              <span className="flex shrink-0 justify-center" style={{ width: 10 }}>
                {here ? (
                  <span style={{ width: 4, height: 4, background: SIGNAL }} />
                ) : (
                  <span style={{ width: 2, height: 2, background: PARCHMENT, opacity: 0.25 }} />
                )}
              </span>
              <PixelLabel
                text={name}
                px={2}
                fill={here ? SIGNAL : PARCHMENT}
                opacity={here ? 1 : 0.55}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function HUD({ room, phase, pocket, onOpenMenu, showAudio = true }: HudProps) {
  const { t } = useTranslation();
  const now = useClock();
  const still = useReducedMotion();
  const [awake, setAwake] = useState(true);
  const lastRoom = useRef(room);

  useEffect(() => {
    if (lastRoom.current === room) return;
    lastRoom.current = room;
    if (still) return;
    setAwake(true);
    const timer = window.setTimeout(() => setAwake(false), 2200);
    return () => window.clearTimeout(timer);
  }, [room, still]);

  useEffect(() => {
    if (still) return;
    const timer = window.setTimeout(() => setAwake(false), 2600);
    return () => window.clearTimeout(timer);
  }, [still]);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const weekday = now.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
  const activePhase = phase ?? phaseOf(now.getHours());
  const phaseLabel = t(`hud.phase.${activePhase}`, { defaultValue: activePhase.toUpperCase() });
  const roomLabel = t(`hud.${room}`, { defaultValue: String(room).toUpperCase() });
  const carried = pocket?.items.length ?? 0;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* --- when, where, and the way into the menu.
             These two fade back while you walk; the deck below never does,
             because a control you cannot read is not a control. --- */}
      <div
        className="pointer-events-auto absolute top-3 left-3 flex flex-col items-start gap-2 transition-opacity duration-500"
        style={{ opacity: awake ? 1 : 0.8 }}
        onPointerEnter={() => setAwake(true)}
      >
        <PixelFrame u={U} tone="plate" onClick={onOpenMenu} ariaLabel="Open the menu">
          <span
            className="flex flex-col gap-1"
            style={{ padding: `${U * 2}px ${U * 3}px ${U * 2}px` }}
          >
            <span className="flex items-baseline gap-2">
              <PixelLabel text={`${hh}:${mm}`} px={4} fill={PARCHMENT} title={`${hh}:${mm}`} />
              <PixelLabel text={weekday} px={2} fill={PARCHMENT} opacity={0.45} />
              <PixelLabel text={phaseLabel} px={2} fill={EMBER} opacity={0.75} />
            </span>
            <PixelLabel text={roomLabel} px={3} fill={SIGNAL} opacity={0.9} />
            <PixelLabel text="TAB - MENU" px={2} fill={PARCHMENT} opacity={0.28} />
          </span>
        </PixelFrame>

        {/* --- the pocket --- */}
        {pocket ? (
          <PixelFrame u={U} tone="plate" rivets={false} onClick={onOpenMenu} ariaLabel="Pocket">
            <span
              className="flex items-center gap-2"
              style={{ padding: `${U * 1.5}px ${U * 3}px` }}
            >
              <PixelLabel text={pocket.money} px={3} fill={SIGNAL} />
              {carried > 0 ? (
                <PixelLabel
                  text={`+${carried} ${carried === 1 ? "THING" : "THINGS"}`}
                  px={2}
                  fill={PARCHMENT}
                  opacity={0.5}
                />
              ) : null}
            </span>
          </PixelFrame>
        ) : null}
      </div>

      {/* --- the deck --- */}
      {showAudio ? (
        <div className="pointer-events-auto absolute bottom-3 left-3 [@media(pointer:coarse)]:bottom-24">
          <Deck />
        </div>
      ) : null}
    </div>
  );
}

export { HUD as Hud };
