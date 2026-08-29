import { t } from "i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PixelLabel, playSfx } from "@/engine";
import { buildStamp } from "@/lib/build";
import { MARK_W, MenuMark } from "./MenuMark";
import { type MenuScale, MenuScaleProvider, useMenuScale } from "./menuScale";
import { PARCHMENT, PROSE, RULE, SIGNAL } from "./menuStyle";
import { SettingsScreen } from "./SettingsScreen";
import { applySettings, loadSettings, type Settings, saveSettings } from "./settings";
import { stepCursor, useMenuInput } from "./useMenuInput";

/**
 * The pause menu.
 *
 * Escape, with nothing else for Escape to cancel, stops the game and puts this
 * over it. Because it goes through the runtime's ordinary overlay mechanism, the
 * pause is real and free: the fixed-step simulation stops advancing, input stops
 * reaching the player, the animation gate closes and the SVG SMIL clock is
 * frozen, all of which the engine already does for any overlay.
 *
 * It deliberately does not repeat the title screen. There is no wordmark, no
 * street, no drifting camera — the game is still there behind it, dimmed, which
 * is the whole point of pausing rather than leaving. What it does share is the
 * language: the same marker, the same gutter, the same two prose styles, and the
 * same Settings screen, so changing the volume mid-game is the identical screen
 * to changing it before starting.
 */

export type PauseAction = "resume" | "title";

type Item = {
  id: string;
  label: string;
  note: string;
  run: () => void;
};

export function PauseMenu({
  onResume,
  onQuit,
  place,
  clock,
}: {
  onResume: () => void;
  /** back to the title screen — the caller decides whether to save first */
  onQuit: () => void;
  /** where the player is standing, for the line under the heading */
  place?: string;
  /** the in-world time, same as the HUD shows */
  clock?: string;
}) {
  return (
    <MenuScaleProvider>
      <PauseInner onResume={onResume} onQuit={onQuit} place={place} clock={clock} />
    </MenuScaleProvider>
  );
}

function PauseInner({
  onResume,
  onQuit,
  place,
  clock,
}: {
  onResume: () => void;
  onQuit: () => void;
  place?: string;
  clock?: string;
}) {
  const scale = useMenuScale();
  const [screen, setScreen] = useState<"pause" | "settings">("pause");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [cursor, setCursor] = useState(0);
  /** Two presses to leave, because leaving loses whatever is unsaved. */
  const [confirmQuit, setConfirmQuit] = useState(false);

  const changeSettings = useCallback((next: Settings) => {
    setSettings(next);
    applySettings(next);
    saveSettings(next);
  }, []);

  const items = useMemo<Item[]>(
    () => [
      {
        id: "resume",
        label: t("mainmenu.resume"),
        note: t("notes.resume"),
        run: () => {
          playSfx("click");
          onResume();
        },
      },
      {
        id: "settings",
        label: t("mainmenu.settings"),
        note: t("notes.settings"),
        run: () => {
          playSfx("click");
          setScreen("settings");
        },
      },
      {
        id: "title",
        label: confirmQuit ? t("mainmenu.leaveSure") : t("mainmenu.leave"),
        note: confirmQuit ? t("notes.leaveSure") : t("notes.leave"),
        run: () => {
          if (!confirmQuit) {
            setConfirmQuit(true);
            playSfx("click");
            return;
          }
          playSfx("doorshut");
          onQuit();
        },
      },
    ],
    [onResume, onQuit, confirmQuit],
  );

  // moving off LEAVE withdraws the question
  useEffect(() => {
    if (items[cursor]?.id !== "title" && confirmQuit) setConfirmQuit(false);
  }, [cursor, items, confirmQuit]);

  const move = useCallback(
    (delta: number) => {
      setCursor((c) => {
        const next = stepCursor(c, delta, items.length, () => false);
        if (next !== c) playSfx("click");
        return next;
      });
    },
    [items.length],
  );

  useMenuInput(screen === "pause", {
    onVertical: move,
    onHorizontal: move,
    onConfirm: () => items[cursor]?.run(),
    onCancel: onResume,
  });

  if (screen === "settings") {
    return (
      <div className="absolute inset-0" style={{ background: "rgba(6,8,13,0.86)" }}>
        <SettingsScreen
          settings={settings}
          onChange={changeSettings}
          onBack={() => {
            playSfx("click");
            setScreen("pause");
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex flex-col justify-center font-mono select-none"
      style={{ background: "rgba(6,8,13,0.72)", paddingLeft: "9%", paddingRight: "9%" }}
    >
      {/* Where you are and what time it is — the two things you want to be
          reminded of by a screen you opened by accident. */}
      <div className="flex items-baseline gap-4">
        <PixelLabel
          text={t("mainmenu.paused")}
          px={scale.heading + 1}
          fill={PARCHMENT}
          opacity={0.9}
        />
        {place ? <PixelLabel text={place} px={scale.sub} fill={SIGNAL} opacity={0.55} /> : null}
        {clock ? <PixelLabel text={clock} px={scale.sub} fill={PARCHMENT} opacity={0.4} /> : null}
      </div>
      <div className="mt-1 mb-7 h-px w-40" style={{ background: RULE }} />

      <nav className="flex flex-col" style={{ gap: scale.gap }}>
        {items.map((item, i) => (
          <PauseRow
            key={item.id}
            item={item}
            active={i === cursor}
            scale={scale}
            onHover={() => setCursor(i)}
            onPick={item.run}
          />
        ))}
      </nav>

      <div className="mt-10 flex items-center gap-6">
        <span style={PROSE.quiet(scale)}>{t("notes.pauseHint")}</span>
        <span className="flex-1" />
        <PixelLabel
          text={buildStamp().toUpperCase()}
          px={scale.chrome}
          fill={PARCHMENT}
          opacity={0.24}
        />
      </div>
    </div>
  );
}

/** The same row and the same mark as the title screen, at the same measure. */
function PauseRow({
  item,
  active,
  scale,
  onHover,
  onPick,
}: {
  item: Item;
  active: boolean;
  scale: MenuScale;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onPick}
      aria-current={active}
      className="flex items-start text-left"
      style={{ marginLeft: -MARK_W }}
    >
      <MenuMark active={active} px={scale.item} />
      <span className="flex flex-col gap-1">
        <PixelLabel
          text={item.label}
          px={scale.item}
          fill={active ? SIGNAL : PARCHMENT}
          opacity={active ? 1 : 0.78}
        />
        <span
          style={{
            ...PROSE.quiet(scale),
            opacity: active ? 1 : 0,
            transition: "opacity 160ms",
          }}
        >
          {item.note}
        </span>
      </span>
    </button>
  );
}
