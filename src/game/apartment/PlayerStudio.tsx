import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isDerivedFrame,
  type LiveState,
  PixelFrame,
  PixelLabel,
  type PlayerConfig,
  type RuntimeApi,
  type RuntimeStats,
  type SpriteMap,
  type SpritePalette,
  validateCharacter,
} from "@/engine";
import { initialWorld, type WorldState } from "@/lib/worldState";
import {
  APPEARANCE_SLOTS,
  normalizeAppearance,
  paletteForAppearanceCached,
  playerForAppearance,
} from "./appearance";
import { OUTSIDE_SCENES } from "./outsideScenes";
import { PLAYER_VALIDATION } from "./player";
import { APARTMENT_SCENES } from "./scenes";

/**
 * Player Studio — the developer bench for the character you actually play.
 *
 * `?npcs` is a casting studio: it builds a stranger from nothing and shows him
 * on a plinth. This is the opposite problem. There is exactly one player, he
 * is already standing in a real room with real light on him, and the questions
 * are about *him in motion*: does this action leave cleanly, does that pose
 * pop, is the walk still a walk after the last change.
 *
 * So the stage here is the game itself. The panels dock to the edges and the
 * middle of the screen is left transparent, which is why the container is
 * `pointer-events-none` and only the panels take input — you change a dial and
 * watch the answer on the character in the scene, rather than on a preview
 * that might not be telling the truth.
 *
 * Open with `?player`. It turns on the runtime's debug sampling, because
 * without it the frame rate reads zero.
 */

const U = 3;
const PARCHMENT = "#e3d9c2";
const SIGNAL = "#fcee0a";
const DIM = "#8a8577";
/** Below this the panels tighten up rather than scroll. */
const ROOMY_HEIGHT = 760;
/**
 * Diagnostics poll rate. Eight a second is quick enough to read a frame change
 * as it happens and slow enough that the panel is not what the frame budget is
 * being spent on — the requirement is that the instrument does not move the
 * needle it is reading.
 */
const POLL_MS = 125;
/** Over this and the frame budget is gone; the readout says so. */
const SLOW_FRAME_MS = 16.7;

const STUDIO_CSS = `
.pstudio-scroll { overscroll-behavior: contain; }
.pstudio-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.pstudio-scroll::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
.pstudio-scroll::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.55);
  box-shadow: inset 1px 0 0 rgba(227,217,194,0.12), inset -1px 0 0 rgba(227,217,194,0.12);
}
.pstudio-scroll::-webkit-scrollbar-thumb {
  background: rgba(227,217,194,0.42);
  box-shadow: inset 0 2px 0 rgba(232,230,224,0.35), inset 0 -2px 0 rgba(0,0,0,0.55);
}
.pstudio-scroll::-webkit-scrollbar-thumb:hover { background: ${SIGNAL}; }
.pstudio-scroll::-webkit-scrollbar-corner { background: rgba(0,0,0,0.55); }
/* Chromium throws away every ::-webkit-scrollbar rule the moment the standard
   properties appear on the same element, so Firefox gets its pair alone. */
@supports not selector(::-webkit-scrollbar) {
  .pstudio-scroll { scrollbar-width: thin; scrollbar-color: rgba(227,217,194,0.42) rgba(0,0,0,0.55); }
}
.pstudio-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 3px; }
.pstudio-acts { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 3px; }
.pstudio-pane > span:last-child {
  display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0;
}
`;

type Api = RuntimeApi<WorldState>;

const api = (): Api | null => (window as unknown as { __game?: Api }).__game ?? null;

/** Every action, with the duration the runtime will actually play it for. */
type ActionRow = {
  id: string;
  enter: number;
  loop: number;
  exit: number;
  ms: number;
  interruptible: boolean;
};

/** Field-by-field, so an unchanged frame does not re-render the contact sheet. */
function sameLive(a: LiveState, b: LiveState): boolean {
  return (
    a.frame === b.frame &&
    a.prevFrame === b.prevFrame &&
    a.action === b.action &&
    a.source === b.source &&
    a.moving === b.moving &&
    a.facing === b.facing &&
    a.x === b.x &&
    a.scene === b.scene &&
    Math.round(a.actionProgress * 20) === Math.round(b.actionProgress * 20)
  );
}

function actionRows(player: PlayerConfig): ActionRow[] {
  return Object.entries(player.actions)
    .map(([id, d]) => {
      const enter = (d.enter?.length ?? 0) * d.frameMs;
      const loop = d.frames.length * d.frameMs * d.loops;
      const exit = (d.exit?.length ?? 0) * d.frameMs;
      return {
        id,
        enter,
        loop,
        exit,
        ms: enter + loop + exit,
        interruptible: Boolean(d.interruptible),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function PlayerStudio({ onClose }: { onClose: () => void }) {
  const [live, setLive] = useState<LiveState | null>(null);
  const [stats, setStats] = useState<RuntimeStats | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [roomy, setRoomy] = useState(true);
  const [appearance, setAppearance] = useState<WorldState["appearance"] | null>(null);
  /** frames seen leading into the current one, newest last — the seam history */
  const trailRef = useRef<{ id: number; frame: string }[]>([]);
  const seqRef = useRef(0);
  const [trail, setTrail] = useState<{ id: number; frame: string }[]>([]);

  useEffect(() => {
    const mq = window.matchMedia(`(min-height: ${ROOMY_HEIGHT}px)`);
    const sync = () => setRoomy(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const g = api();
      if (!g) return;
      const l = g.getLive();
      // `getLive` hands back a fresh object every call, so setting it blindly
      // re-rendered the whole bench eight times a second whether or not
      // anything had changed. Only publish when a field actually moved.
      setLive((prev) => (prev && sameLive(prev, l) ? prev : l));
      setStats(g.getStats());
      setAppearance((prev) => {
        const next = g.getWorld().appearance;
        return prev === next ? prev : next;
      });
      const t = trailRef.current;
      if (t[t.length - 1]?.frame !== l.frame) {
        seqRef.current += 1;
        t.push({ id: seqRef.current, frame: l.frame });
        if (t.length > 12) t.shift();
        setTrail([...t]);
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  const player = useMemo(
    () => playerForAppearance(appearance ?? initialWorld.appearance),
    [appearance],
  );
  const acts = useMemo(() => actionRows(player), [player]);
  const rig = useMemo(() => {
    const names = Object.keys(player.frames);
    const twins = names.filter((n) => isDerivedFrame(player, n)).length;
    return {
      frames: names.length,
      authored: names.length - twins,
      twins,
      issues: validateCharacter(player, PLAYER_VALIDATION),
    };
  }, [player]);
  const places = useMemo(
    () => [...Object.keys(APARTMENT_SCENES), ...Object.keys(OUTSIDE_SCENES)].sort(),
    [],
  );
  const frames = useMemo(
    () =>
      Object.keys(player.frames)
        .filter((f) => !isDerivedFrame(player, f))
        .sort(),
    [player],
  );
  const palette = useMemo(
    () => (appearance ? paletteForAppearanceCached(appearance) : player.palette),
    [appearance, player.palette],
  );

  const play = useCallback((id: string) => api()?.startAction(id), []);
  const hold = useCallback((f: string | null) => {
    api()?.holdFrame(f);
    setHeld(f);
  }, []);

  /** Play one action and then the next, so the seam between them is watchable. */
  const chain = useCallback(() => {
    const g = api();
    if (!g || !from || !to) return;
    g.startAction(from);
    const d = acts.find((a) => a.id === from);
    window.setTimeout(() => g.startAction(to), (d?.ms ?? 400) + 40);
  }, [acts, from, to]);

  const setSlot = useCallback((key: keyof WorldState["appearance"], id: string) => {
    api()?.updateWorld((w) => ({
      ...w,
      appearance: normalizeAppearance({ ...w.appearance, [key]: id }),
    }));
  }, []);

  const slow = stats !== null && stats.frameMs > SLOW_FRAME_MS;

  return (
    // the container never takes a click: the middle of the screen is the game
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col font-mono">
      {/** biome-ignore lint/security/noDangerouslySetInnerHtml: scoped scrollbar chrome, no user input */}
      <style dangerouslySetInnerHTML={{ __html: STUDIO_CSS }} />

      <header className="pointer-events-auto flex shrink-0 items-center justify-between gap-2 px-2 py-1.5">
        <PixelFrame u={U} tone="active" rivets scan={false}>
          <span className="block px-2 py-1">
            <PixelLabel text="PLAYER STUDIO" px={U} fill="#0b0d12" />
          </span>
        </PixelFrame>
        <div className="pstudio-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2">
          {places.map((id) => (
            <Tile
              key={id}
              label={id}
              active={live?.scene === id}
              onClick={() => api()?.travel(id)}
            />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {slow ? (
            <PixelFrame u={2} tone="plate" rivets={false} scan={false}>
              <span className="block px-2 py-1">
                <PixelLabel text={`SLOW ${stats?.frameMs}MS`} px={2} fill={SIGNAL} />
              </span>
            </PixelFrame>
          ) : null}
          <PixelFrame
            u={2}
            tone="plate"
            rivets={false}
            scan={false}
            onClick={onClose}
            ariaLabel="close"
          >
            <span className="block px-3 py-1">
              <PixelLabel text="CLOSE" px={2} fill={PARCHMENT} />
            </span>
          </PixelFrame>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-stretch justify-between gap-2 px-2 pb-2">
        <Column width={roomy ? 320 : 288}>
          <Pane title="LIVE">
            <Readout live={live} stats={stats} />
          </Pane>
          <Pane title={`FRAMES · ${frames.length}`} cap="max-h-[38vh]">
            <div className="pstudio-grid">
              {frames.map((f) => (
                <FrameCell
                  key={f}
                  name={f}
                  map={player.frames[f]}
                  palette={palette}
                  held={held === f}
                  showing={live?.frame === f}
                  onHold={hold}
                />
              ))}
            </div>
          </Pane>
          <Pane title="TRAIL" cap="max-h-[26vh]">
            {/* the last dozen frames in order, so a pop is legible after the
                fact rather than only in the instant it happened */}
            <div>
              {trail.length === 0 ? (
                <Empty text="WAITING FOR MOTION" />
              ) : (
                [...trail].reverse().map((e, i) => (
                  <div key={e.id} className="flex items-center justify-between py-px">
                    <PixelLabel
                      text={e.frame}
                      px={2}
                      fill={i === 0 ? SIGNAL : PARCHMENT}
                      opacity={i === 0 ? 1 : 0.55}
                    />
                    {i === 0 ? <PixelLabel text="NOW" px={2} fill={SIGNAL} opacity={0.7} /> : null}
                  </div>
                ))
              )}
            </div>
          </Pane>
        </Column>

        {/* the stage: nothing here, on purpose. The game is behind it. */}
        <div className="min-w-0 flex-1" aria-hidden="true" />

        <Column width={roomy ? 360 : 316}>
          <Pane title={`ACTIONS · ${acts.length}`} cap="max-h-[30vh]">
            <div className="pstudio-acts">
              {acts.map((a) => (
                <Tile
                  key={a.id}
                  label={a.id}
                  sub={`${a.ms}ms${a.enter ? " ⟨" : ""}${a.exit ? "⟩" : ""}${a.interruptible ? " ·" : ""}`}
                  active={live?.action === a.id}
                  onClick={() => play(a.id)}
                />
              ))}
            </div>
          </Pane>

          <Pane title="TRANSITION">
            <div className="flex items-center gap-1">
              <Picker
                label="FROM"
                value={from}
                options={acts.map((a) => a.id)}
                onChange={setFrom}
              />
              <Picker label="TO" value={to} options={acts.map((a) => a.id)} onChange={setTo} />
              <Tile label="CHAIN" onClick={chain} wide />
            </div>
          </Pane>

          <Pane title="LOOK" cap="max-h-[24vh]">
            <div>
              {APPEARANCE_SLOTS.map((slot) => (
                <Rail
                  key={slot.key}
                  label={slot.label}
                  value={appearance?.[slot.key] ?? slot.options[0].id}
                  options={slot.options.map((o) => o.id)}
                  onChange={(v) => setSlot(slot.key, v)}
                />
              ))}
            </div>
          </Pane>

          <Pane title={`RIG · ${rig.frames} FRAMES`} cap="max-h-[18vh]">
            <div>
              <Row k="AUTHORED" v={String(rig.authored)} />
              <Row k="BLINK TWINS" v={String(rig.twins)} />
              <Row
                k="BOX"
                v={`${player.width / (player.cell ?? 2)}×${player.height / (player.cell ?? 2)}`}
              />
              {rig.issues.length === 0 ? (
                <Empty text="VALIDATOR CLEAN" />
              ) : (
                rig.issues.slice(0, 12).map((i) => (
                  <div key={`${i.frame}-${i.message}`} className="py-px">
                    <PixelLabel
                      text={`${i.severity === "error" ? "!" : "·"} ${i.frame ?? ""} ${i.message}`.toUpperCase()}
                      px={2}
                      fill={i.severity === "error" ? SIGNAL : PARCHMENT}
                      opacity={0.8}
                    />
                  </div>
                ))
              )}
            </div>
          </Pane>

          <Pane title="STATE">
            <div className="flex gap-1">
              <Tile label="RELEASE FRAME" onClick={() => hold(null)} wide />
              <Tile label="STOP ACTION" onClick={() => api()?.stopAction()} wide />
            </div>
          </Pane>
        </Column>
      </div>
    </div>
  );
}

// --- chrome ------------------------------------------------------------------

/**
 * One dock. The column scrolls as a whole and the panes inside it take their
 * natural height: letting several `flex-1` panes compete for the same space is
 * what had the action grid growing through the transition bar underneath it.
 */
function Column({ width, children }: { width: number; children: React.ReactNode }) {
  return (
    <div
      className="pstudio-scroll pointer-events-auto flex min-h-0 shrink-0 flex-col gap-2 overflow-y-auto pr-1"
      style={{ width }}
    >
      {children}
    </div>
  );
}

function Pane({
  title,
  cap,
  children,
}: {
  title: string;
  /** tallest this pane may get before its own contents scroll */
  cap?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shrink-0">
      <PixelFrame u={2} tone="panel" rivets={false} scan={false} className="pstudio-pane">
        <span className="flex flex-col gap-1 p-1.5">
          <PixelLabel text={title} px={2} fill={SIGNAL} opacity={0.75} />
          <div className={cap ? `pstudio-scroll overflow-y-auto pr-1 ${cap}` : undefined}>
            {children}
          </div>
        </span>
      </PixelFrame>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center py-3">
      <PixelLabel text={text} px={2} fill={DIM} opacity={0.6} />
    </div>
  );
}

function Row({ k, v, hot }: { k: string; v: string; hot?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <PixelLabel text={k} px={2} fill={PARCHMENT} opacity={0.45} />
      <PixelLabel text={v} px={2} fill={hot ? SIGNAL : PARCHMENT} />
    </div>
  );
}

function Readout({ live, stats }: { live: LiveState | null; stats: RuntimeStats | null }) {
  if (!live) return <Empty text="NO RUNTIME" />;
  return (
    <div className="flex flex-col gap-px">
      <Row k="FRAME" v={live.frame} hot />
      <Row k="WAS" v={live.prevFrame} />
      <Row k="WHY" v={live.source.toUpperCase()} />
      <Row
        k="ACTION"
        v={live.action ? `${live.action} ${Math.round(live.actionProgress * 100)}%` : "—"}
      />
      <Row k="WHERE" v={`${live.scene} @${live.x}`} />
      <Row k="FACING" v={live.facing > 0 ? "RIGHT" : "LEFT"} />
      <Row k="MOVING" v={live.moving ? "YES" : "NO"} />
      {stats ? (
        <>
          <Row k="FPS" v={String(stats.fps)} hot={stats.fps > 0 && stats.fps < 50} />
          <Row k="FRAME MS" v={`${stats.frameMs} (${stats.emaMs})`} />
          <Row k="QUALITY" v={String(stats.quality)} />
          <Row k="SPRITE" v={`${stats.spriteMode} ${stats.mountedFrames}`} />
          <Row k="DOM" v={`w${stats.domWrites} s${stats.domSkips}`} />
          {stats.heapMb === null ? null : <Row k="HEAP" v={`${stats.heapMb}MB`} />}
        </>
      ) : null}
    </div>
  );
}

const Tile = memo(function Tile({
  label,
  sub,
  active,
  wide,
  onClick,
}: {
  label: string;
  sub?: string;
  active?: boolean;
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <div className={wide ? "flex-1" : undefined}>
      <PixelFrame
        u={2}
        tone={active ? "active" : "plate"}
        rivets={false}
        scan={false}
        onClick={onClick}
        ariaLabel={label}
        className="h-full"
      >
        <span className="flex flex-col items-center justify-center gap-px px-1 py-1">
          <PixelLabel text={label} px={2} fill={active ? "#0b0d12" : PARCHMENT} />
          {sub ? (
            <PixelLabel text={sub} px={2} fill={active ? "#0b0d12" : DIM} opacity={0.7} />
          ) : null}
        </span>
      </PixelFrame>
    </div>
  );
});

/**
 * A frame thumbnail, drawn to a canvas rather than to SVG rects.
 *
 * The contact sheet is 94 frames and each one is a couple of hundred runs, so
 * as `<rect>`s it was ~15 000 extra nodes and it took the game from 60 fps to
 * 10 — the bench was measuring its own weight. A canvas is one node whatever
 * is painted on it, and it is painted once per palette change rather than per
 * React render.
 */
const THUMB_W = 44;
const THUMB_H = 36;

const FrameCell = memo(function FrameCell({
  name,
  map,
  palette,
  held,
  showing,
  onHold,
}: {
  name: string;
  map: SpriteMap | undefined;
  palette: SpritePalette;
  held: boolean;
  showing: boolean;
  /** stable across renders, so `memo` on this cell is not defeated by a new closure */
  onHold: (frame: string | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !map) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const rows = map.length;
    const cols = map[0]?.length ?? 0;
    const k = Math.max(1, Math.floor(Math.min(THUMB_W / cols, THUMB_H / rows)));
    c.width = THUMB_W;
    c.height = THUMB_H;
    ctx.clearRect(0, 0, THUMB_W, THUMB_H);
    const ox = Math.floor((THUMB_W - cols * k) / 2);
    const oy = THUMB_H - rows * k;
    for (let y = 0; y < rows; y++) {
      const row = map[y];
      let run = -1;
      let ch = "";
      const flush = (end: number) => {
        if (run >= 0 && palette[ch]) {
          ctx.fillStyle = palette[ch];
          ctx.fillRect(ox + run * k, oy + y * k, (end - run) * k, k);
        }
        run = -1;
        ch = "";
      };
      for (let x = 0; x < row.length; x++) {
        const c2 = row[x];
        if (c2 !== ch) {
          flush(x);
          if (c2 !== "." && c2 !== " ") {
            run = x;
            ch = c2;
          }
        }
      }
      flush(row.length);
    }
  }, [map, palette]);

  // A plain bordered button rather than a `PixelFrame`: the frame component
  // carries a clip path, rivets and a scanline layer, which is right for a
  // panel and is about ten nodes each — times ninety-four thumbnails it was
  // most of the bench's DOM. At this size a one-pixel edge reads the same.
  return (
    <button
      type="button"
      aria-label={name}
      onClick={() => onHold(held ? null : name)}
      className="flex flex-col items-center gap-px p-px transition-colors"
      style={{
        background: held ? SIGNAL : showing ? "rgba(252,238,10,0.10)" : "rgba(0,0,0,0.45)",
        boxShadow: `inset 0 0 0 1px ${held ? "#0b0d12" : showing ? SIGNAL : "rgba(227,217,194,0.22)"}`,
      }}
    >
      <canvas ref={ref} width={THUMB_W} height={THUMB_H} className="pixelated block" />
      <PixelLabel
        text={name.slice(0, 9)}
        px={2}
        fill={held ? "#0b0d12" : showing ? SIGNAL : PARCHMENT}
        opacity={held || showing ? 1 : 0.55}
      />
    </button>
  );
});

/** A compact `< value >` rail, the same idiom the casting studio uses. */
function Rail({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
}) {
  const step = (d: number) => {
    const i = Math.max(0, options.indexOf(value));
    onChange(options[(i + d + options.length) % options.length]);
  };
  return (
    <div className="flex items-center justify-between gap-2 py-px">
      <PixelLabel text={label} px={2} fill={PARCHMENT} opacity={0.5} />
      <div className="flex items-center gap-1">
        <Arrow dir="<" label={`${label} previous`} onClick={() => step(-1)} />
        <span className="w-[74px] text-center">
          <PixelLabel text={value.toUpperCase()} px={2} fill={SIGNAL} />
        </span>
        <Arrow dir=">" label={`${label} next`} onClick={() => step(1)} />
      </div>
    </div>
  );
}

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
}) {
  const step = (d: number) => {
    const i = options.indexOf(value);
    onChange(options[(i < 0 ? 0 : i + d + options.length) % options.length]);
  };
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <PixelLabel text={label} px={2} fill={PARCHMENT} opacity={0.5} />
      <Arrow dir="<" label={`${label} previous`} onClick={() => step(-1)} />
      <span className="min-w-0 flex-1 truncate text-center">
        <PixelLabel text={(value || "—").toUpperCase()} px={2} fill={SIGNAL} />
      </span>
      <Arrow dir=">" label={`${label} next`} onClick={() => step(1)} />
    </div>
  );
}

function Arrow({ dir, label, onClick }: { dir: "<" | ">"; label: string; onClick: () => void }) {
  return (
    <PixelFrame u={2} tone="plate" rivets={false} scan={false} onClick={onClick} ariaLabel={label}>
      <span className="block" style={{ padding: "1px 5px" }}>
        <PixelLabel text={dir} px={2} fill={PARCHMENT} />
      </span>
    </PixelFrame>
  );
}
