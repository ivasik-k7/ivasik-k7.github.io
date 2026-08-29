import { t } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lofiPlayer, PixelLabel, playSfx } from "@/engine";
import { LANGUAGE_LABEL, LANGUAGES } from "@/i18n";
import { MARK_W, MenuMark } from "./MenuMark";
import { MenuPanel } from "./MenuPanel";
import { useMenuScale } from "./menuScale";
import { PARCHMENT, PROSE, SIGNAL } from "./menuStyle";
import type { Settings } from "./settings";
import { stepCursor, useMenuInput } from "./useMenuInput";

/**
 * Settings.
 *
 * Three things this screen has to get right, all of which the first version got
 * wrong:
 *
 *  – **Every row has to do something.** QUALITY, MOTION and TEXT SPEED used to
 *    write a value nothing read. They now go through `applySettings` into
 *    `engine/core/prefs`, which the quality governor, the reduced-motion hook
 *    and the speech panels obey. If a row cannot be honoured it is not here.
 *  – **It has to work without a mouse.** There was no cursor, no row selection
 *    and no left/right stepping, so a controller player could enter this screen
 *    and do nothing but leave. Up/down picks a row, left/right changes it —
 *    arrows, WASD or a pad.
 *  – **The label and its control have to read as one row.** They were 386 px
 *    apart across a 576 px measure, which is two columns, not a list. The
 *    measure is now 400 px and every control is the same width, so the steppers
 *    form one column instead of staggering by eleven pixels between row types.
 */

/** One control slot, so `<` and `>` line up down the screen whatever is between them. */
const SLOT = 112;
/** The volume meter's ten cells have to add up to exactly SLOT. */
const CELL_W = 8;
const CELL_GAP = 3;
const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const QUALITY = ["auto", "low", "medium", "high"] as const;
const MOTION = ["system", "reduce"] as const;
const SPEED = ["slow", "normal", "fast", "instant"] as const;

/** A row: what it is called, what it shows, and what left/right does to it. */
type Row =
  | { kind: "head"; label: string }
  | {
      kind: "meter";
      label: string;
      note?: string;
      value: number;
      step: (delta: number) => void;
    }
  | {
      kind: "choice";
      label: string;
      note?: string;
      shown: string;
      step: (delta: number) => void;
    };

export function SettingsScreen({
  settings,
  onChange,
  onBack,
  active = true,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onBack: () => void;
  /**
   * False while this screen is fading out. The screens cross-fade, so for the
   * ~200 ms of the transition both the outgoing and the incoming screen are
   * mounted — and if both are listening, one keypress steps a setting *and*
   * moves the title cursor.
   */
  active?: boolean;
}) {
  const scale = useMenuScale();
  const [cursor, setCursor] = useState(1);

  const set = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      onChange({ ...settings, [key]: value });
    },
    [settings, onChange],
  );

  /** A volume, in tenths, clamped. */
  const level = useCallback(
    (key: "master" | "music" | "ambience" | "sfx") => (delta: number) => {
      const next = Math.round(Math.min(1, Math.max(0, settings[key] + delta)) * 10) / 10;
      if (next === settings[key]) return;
      set(key, next);
      playSfx("click");
    },
    [settings, set],
  );

  /** Walk a fixed list of values, wrapping. */
  const cycle = useCallback(
    <K extends keyof Settings>(key: K, values: readonly Settings[K][]) =>
      (delta: number) => {
        const at = values.indexOf(settings[key]);
        set(key, values[(at + delta + values.length) % values.length]);
        playSfx("click");
      },
    [settings, set],
  );

  const toggle = useCallback(
    (key: "voice") => () => {
      set(key, !settings[key]);
      playSfx("click");
    },
    [settings, set],
  );

  /**
   * Fullscreen has to be requested from inside the gesture that asked for it,
   * so it is not routed through `applySettings` like everything else. The
   * displayed value comes from the browser rather than from our own state —
   * see the `fullscreenchange` listener below — because F11 and Escape change
   * it without ever passing through this screen.
   */
  const [isFull, setIsFull] = useState(
    () => typeof document !== "undefined" && document.fullscreenElement !== null,
  );
  useEffect(() => {
    const sync = () => setIsFull(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    sync();
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = useCallback(() => {
    playSfx("click");
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const rows = useMemo<Row[]>(
    () => [
      { kind: "head", label: t("settings.sound") },
      {
        kind: "meter",
        label: t("settings.overall"),
        value: settings.master,
        step: level("master"),
        note: t("settings.overallNote"),
      },
      {
        kind: "meter",
        label: t("settings.music"),
        value: settings.music,
        step: level("music"),
        note: lofiPlayer.track.mood,
      },
      {
        kind: "meter",
        label: t("settings.atmosphere"),
        value: settings.ambience,
        step: level("ambience"),
        note: t("settings.atmosphereNote"),
      },
      {
        kind: "meter",
        label: t("settings.effects"),
        value: settings.sfx,
        step: level("sfx"),
        note: t("settings.effectsNote"),
      },
      {
        kind: "choice",
        label: t("settings.voice"),
        shown: settings.voice ? t("settings.on") : t("settings.off"),
        step: toggle("voice"),
        note: t("settings.voiceNote"),
      },
      { kind: "head", label: t("settings.picture") },
      {
        kind: "choice",
        label: t("settings.detail"),
        shown: t(`settings.quality.${settings.quality}`),
        step: cycle("quality", QUALITY),
        note: t("settings.detailNote"),
      },
      {
        kind: "choice",
        label: t("settings.movement"),
        shown:
          settings.reducedMotion === "system"
            ? t("settings.movementSystem")
            : t("settings.movementStill"),
        step: cycle("reducedMotion", MOTION),
        note: t("settings.movementNote"),
      },
      {
        kind: "choice",
        label: t("settings.fullscreen"),
        shown: isFull ? t("settings.on") : t("settings.off"),
        step: toggleFullscreen,
        note: t("settings.fullscreenNote"),
      },
      { kind: "head", label: t("settings.reading") },
      {
        kind: "choice",
        label: t("settings.textSpeed"),
        shown: t(`settings.speed.${settings.textSpeed}`),
        step: cycle("textSpeed", SPEED),
        note: t("settings.textSpeedNote"),
      },
      {
        kind: "choice",
        label: t("settings.language"),
        shown: LANGUAGE_LABEL[settings.language],
        step: cycle("language", LANGUAGES),
        note: t("settings.languageNote"),
      },
    ],
    [settings, level, cycle, toggle, isFull, toggleFullscreen],
  );

  const skip = useCallback((i: number) => rows[i].kind === "head", [rows]);

  /**
   * Keep the cursor on screen. Without this, arrowing down past the fold moves
   * a selection the player cannot see — the one way a scrolling list can be
   * worse than an overflowing one.
   */
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-row="${cursor}"]`);
    if (!list || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 8;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight + 8;
    }
  }, [cursor]);

  // land on the first real row, whatever the headings do
  useEffect(() => {
    setCursor((c) => (rows[c]?.kind === "head" ? stepCursor(c, 1, rows.length, skip) : c));
  }, [rows, skip]);

  useMenuInput(active, {
    onVertical: (dy) => {
      setCursor((c) => {
        const next = stepCursor(c, dy, rows.length, skip);
        if (next !== c) playSfx("click");
        return next;
      });
    },
    onHorizontal: (dx) => {
      const row = rows[cursor];
      if (!row || row.kind === "head") return;
      // a meter moves in tenths; a choice moves one place along its list
      row.step(row.kind === "meter" ? dx * 0.1 : dx);
    },
    onConfirm: () => {
      const row = rows[cursor];
      // Enter on a choice is the same as pressing right — it is the only
      // sensible reading of "confirm" on a row that has no submit
      if (row && row.kind === "choice") row.step(1);
    },
    onCancel: onBack,
  });

  const note = rows[cursor]?.kind === "head" ? undefined : (rows[cursor] as { note?: string }).note;

  return (
    <MenuPanel title={t("settings.title")} onBack={onBack} hint={t("settings.hint")}>
      <div className="flex h-full flex-col" style={{ maxWidth: 400 + SLOT, marginLeft: -MARK_W }}>
        {/* The list scrolls when the window is too short for thirteen rows —
            with the machine's own scrollbar, not the operating system's. */}
        <div ref={listRef} className="pixel-scroll min-h-0 flex-1 overflow-y-auto pr-2">
          {rows.map((row, i) =>
            row.kind === "head" ? (
              <div key={row.label} className="flex items-center gap-3 pt-4 pb-1 first:pt-0">
                <PixelLabel text={row.label} px={scale.sub} fill={SIGNAL} opacity={0.5} />
                <span className="h-px flex-1" style={{ background: "rgba(227,217,194,0.14)" }} />
              </div>
            ) : (
              <SettingRow
                key={row.label}
                index={i}
                row={row}
                active={i === cursor}
                onPick={() => setCursor(i)}
              />
            ),
          )}
        </div>
        {/* One line, at full strength, saying what the selected row does.
            Eleven captions reserved under eleven rows cost 165 px of height —
            which is why the last section used to fall off the bottom of the
            screen — and at 9 px and 30% opacity none of them could be read
            anyway. A single line has room to be legible. */}
        <div
          className="mt-3 shrink-0 border-t pt-2"
          style={{ borderColor: "rgba(227,217,194,0.1)", minHeight: scale.note * 2.6 }}
        >
          <span style={PROSE.base(scale)}>{note ?? ""}</span>
        </div>
      </div>
    </MenuPanel>
  );
}

/**
 * One row. Selection is the same marker the main menu uses — a rule that grows
 * beside the label — so the two screens read as one system rather than as a
 * title screen and a form.
 */
function SettingRow({
  index,
  row,
  active,
  onPick,
}: {
  index: number;
  row: Extract<Row, { kind: "meter" | "choice" }>;
  active: boolean;
  onPick: () => void;
}) {
  const scale = useMenuScale();
  return (
    <div data-row={index} className="flex flex-col" style={{ paddingTop: 5, paddingBottom: 5 }}>
      <div className="flex items-center gap-3">
        {/* The label is the button that selects the row, so pointing at it does
            what arrowing to it does. The row itself carries no handler: a div
            that reacts to the mouse without a role is invisible to anyone not
            using one. */}
        <button
          type="button"
          onMouseEnter={onPick}
          onFocus={onPick}
          onClick={onPick}
          aria-current={active}
          className="flex shrink-0 items-center gap-3 text-left"
        >
          <MenuMark active={active} px={scale.heading - 1} />
          <PixelLabel
            text={row.label}
            px={scale.heading - 1}
            fill={PARCHMENT}
            opacity={active ? 0.95 : 0.6}
          />
        </button>
        <span className="h-px flex-1" style={{ background: "rgba(227,217,194,0.07)" }} />
        <Stepper dir="<" label={`${row.label} down`} dim={!active} onClick={() => row.step(-1)} />
        <span className="flex shrink-0 justify-center" style={{ width: SLOT }}>
          {row.kind === "meter" ? (
            <Meter label={row.label} value={row.value} active={active} />
          ) : (
            <PixelLabel
              text={row.shown.toUpperCase()}
              px={scale.heading - 1}
              fill={active ? SIGNAL : PARCHMENT}
              opacity={active ? 1 : 0.7}
            />
          )}
        </span>
        <Stepper dir=">" label={`${row.label} up`} dim={!active} onClick={() => row.step(1)} />
      </div>
    </div>
  );
}

function Stepper({
  dir,
  label,
  dim,
  onClick,
}: {
  dir: "<" | ">";
  label: string;
  dim: boolean;
  onClick: () => void;
}) {
  const scale = useMenuScale();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="shrink-0 px-1 transition-opacity hover:opacity-100"
      style={{ opacity: dim ? 0.3 : 0.8 }}
    >
      <PixelLabel text={dir} px={scale.heading - 1} fill={PARCHMENT} />
    </button>
  );
}

/** A level, drawn as ten cells — the meter idiom the HUD already uses. */
function Meter({ label, value, active }: { label: string; value: number; active: boolean }) {
  const filled = Math.round(value * 10);
  return (
    <>
      <span className="sr-only">{`${Math.round(value * 100)} percent`}</span>
      {/* Not a `<meter>` element: that paints its own bar, and the browser's
          green tube arrived on top of the pixels. The level is announced by the
          text above instead, so the cells are decoration and say so. */}
      <span aria-hidden="true" className="flex items-center" style={{ gap: CELL_GAP }}>
        {CELLS.map((cell) => (
          <span
            key={`${label}-${cell}`}
            style={{
              width: CELL_W,
              height: 12,
              background:
                cell < filled
                  ? active
                    ? SIGNAL
                    : "rgba(227,217,194,0.55)"
                  : "rgba(227,217,194,0.14)",
            }}
          />
        ))}
      </span>
    </>
  );
}
