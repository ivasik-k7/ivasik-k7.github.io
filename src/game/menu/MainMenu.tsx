import { t } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelLabel, playSfx } from "@/engine";
import { buildStamp } from "@/lib/build";
import { CreditsScreen } from "./CreditsScreen";
import { MARK_W, MenuMark } from "./MenuMark";
import { MenuStage } from "./MenuStage";
import { handOffMenuAudio, startMenuAudio } from "./menuAudio";
import { MenuScaleProvider, useMenuScale } from "./menuScale";
import { PARCHMENT, PROSE, SIGNAL } from "./menuStyle";
import { SettingsScreen } from "./SettingsScreen";
import { readSave, type SaveSummary } from "./saveSummary";
import { applySettings, loadSettings, type Settings, saveSettings } from "./settings";
import { stepCursor, useMenuInput } from "./useMenuInput";

/**
 * The title screen.
 *
 * The brief was Fading Afternoon's mood rather than its furniture:
 * understated, a little worn, and mostly empty. So the composition gives the
 * screen over to the street and keeps the interface to a column of plain type
 * down the left — no cards, no boxes around the options, no glow. The only
 * decoration is a mark that grows beside whichever line is selected.
 *
 * The title is set in the game's own 3×5 glyph font, the one on the street
 * signs, because a title screen in a different typeface from the game is the
 * first thing that gives away a menu bolted on afterwards.
 *
 * Everything in the frame hangs off one measure. `GUTTER` is the axis the
 * wordmark, the option *labels*, the sub-screen headings and the build stamp
 * all start on; the selection marks hang into the space to its left, which is
 * what a set layout does with them. The first version positioned each element
 * independently and ended up with five different left edges (90, 94, 112, 134
 * and 149 px) and a build stamp on a 17 px margin while everything else sat on
 * 90 — which is the difference between a composition and things in corners.
 */

/** The one measure. Everything starts here; only marks hang left of it. */
const GUTTER = "7%";

type Screen = "title" | "settings" | "credits";

export type MenuAction = { kind: "new" } | { kind: "continue"; save: SaveSummary };

type Item = {
  id: string;
  label: string;
  /** the quiet line under it — what this actually does, in the world's voice */
  note?: string;
  /** a second, quieter line — only CONTINUE has one, and only when a save exists */
  detail?: string;
  disabled?: boolean;
  run: () => void;
};

export function MainMenu(props: { onStart: (action: MenuAction) => void }) {
  return (
    <MenuScaleProvider>
      <MainMenuInner {...props} />
    </MenuScaleProvider>
  );
}

function MainMenuInner({ onStart }: { onStart: (action: MenuAction) => void }) {
  const scale = useMenuScale();
  const [screen, setScreen] = useState<Screen>("title");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [save, setSave] = useState<SaveSummary | null>(null);
  const [cursor, setCursor] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setSave(readSave());
    applySettings(loadSettings());
  }, []);

  const still = settings.reducedMotion === "reduce";

  // the audio needs a gesture; `startMenuAudio` is idempotent, so every input
  // handler simply calls it rather than tracking whether it has happened
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const wake = useCallback(() => startMenuAudio(settingsRef.current), []);
  useEffect(() => {
    const once = () => wake();
    window.addEventListener("pointerdown", once, { once: true });
    return () => window.removeEventListener("pointerdown", once);
  }, [wake]);

  const changeSettings = useCallback((next: Settings) => {
    setSettings(next);
    applySettings(next);
    saveSettings(next);
  }, []);

  const begin = useCallback(
    (action: MenuAction) => {
      if (leaving) return;
      setLeaving(true);
      playSfx("chime");
      // the street bed goes; the track carries on into the flat
      handOffMenuAudio();
      // the fade is the transition into the game, not a loading screen: the
      // scene behind it is already the world the player is about to stand in
      window.setTimeout(() => onStart(action), still ? 0 : 900);
    },
    [leaving, onStart, still],
  );

  const items = useMemo<Item[]>(
    () => [
      {
        id: "continue",
        label: t("mainmenu.continue"),
        note: save ? save.line : t("notes.continueNone"),
        detail: save?.detail,
        disabled: !save,
        run: () => save && begin({ kind: "continue", save }),
      },
      {
        id: "new",
        label: t("mainmenu.newGame"),
        // Not "a Wednesday in October" — that is the subtitle, 350 px directly
        // above, and printing the same sentence twice on one screen made the
        // subtitle read as a caption for this option.
        note: save ? t("notes.newAgain") : t("notes.newFresh"),
        run: () => begin({ kind: "new" }),
      },
      {
        // Both of these carry a note as well. Not for the information — it is
        // obvious what SETTINGS does — but because the note's line is only
        // shown for the selected row, and a row with no note has no line to
        // reserve, so the rows below used to jump as the cursor passed.
        id: "settings",
        label: t("mainmenu.settings"),
        note: t("notes.settings"),
        run: () => setScreen("settings"),
      },
      {
        id: "credits",
        label: t("mainmenu.credits"),
        note: t("notes.credits"),
        run: () => setScreen("credits"),
      },
    ],
    [save, begin],
  );

  // the cursor starts on whichever option the player most likely wants
  useEffect(() => {
    setCursor(save ? 0 : 1);
  }, [save]);

  /** Sweeping a pointer down the list used to fire three clicks in one motion. */
  const lastClick = useRef(0);
  const tick = useCallback(() => {
    const now = performance.now();
    if (now - lastClick.current < 60) return;
    lastClick.current = now;
    playSfx("click");
  }, []);

  const move = useCallback(
    (delta: number) => {
      setCursor((c) => {
        const next = stepCursor(c, delta, items.length, (i) => Boolean(items[i].disabled));
        if (next !== c) tick();
        return next;
      });
    },
    [items, tick],
  );

  useMenuInput(screen === "title" && !leaving, {
    onAny: wake,
    onVertical: move,
    // left and right do the same as up and down on a single column: a player
    // holding a stick sideways still expects to get somewhere
    onHorizontal: move,
    onConfirm: () => {
      const item = items[cursor];
      if (item && !item.disabled) item.run();
    },
  });

  const back = useCallback(() => {
    playSfx("click");
    setScreen("title");
  }, []);

  const sub = screen !== "title";

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#06080d] font-mono select-none">
      <MenuStage still={still} />

      {/* A sub-screen is a page of type where the title screen is four lines, so
          the street goes further back under it. Sitting above the stage and
          below the title keeps the wordmark crisp — it dims by its own opacity
          instead, which is hierarchy rather than fog. */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ background: "rgba(6,8,13,0.58)", opacity: sub ? 1 : 0 }}
      />

      {/* the title, low-contrast and large, sitting in the sky */}
      <div
        className="pointer-events-none absolute top-[9%] flex flex-col gap-2 transition-opacity duration-500"
        style={{ left: GUTTER, opacity: sub ? 0.4 : 1 }}
      >
        <PixelLabel text="OSIEDLE" px={scale.title} fill={PARCHMENT} opacity={0.92} />
        <PixelLabel text={t("mainmenu.subtitle")} px={scale.sub} fill={PARCHMENT} opacity={0.5} />
      </div>

      {/* The nav and the sub-screens cross-fade instead of cutting. The content
          used to swap in one frame while the scrim behind it took half a second,
          so the atmosphere arrived after the page had already changed. */}
      <Fade show={screen === "title"}>
        <nav
          className="absolute bottom-[11%] flex flex-col"
          style={{ left: GUTTER, gap: scale.gap }}
        >
          {items.map((item, i) => (
            <MenuRow
              key={item.id}
              item={item}
              active={i === cursor}
              onHover={() => {
                if (!item.disabled && i !== cursor) {
                  setCursor(i);
                  tick();
                }
              }}
              onPick={() => {
                wake();
                if (!item.disabled) item.run();
              }}
            />
          ))}
        </nav>
      </Fade>

      <Fade show={screen === "settings"}>
        <SettingsScreen
          settings={settings}
          onChange={changeSettings}
          onBack={back}
          active={screen === "settings"}
        />
      </Fade>

      <Fade show={screen === "credits"}>
        <CreditsScreen onBack={back} still={still} active={screen === "credits"} />
      </Fade>

      {/* build stamp, bottom right, the way a game does it — on the same measure
          as everything else rather than jammed into the corner */}
      <div className="pointer-events-none absolute" style={{ right: GUTTER, bottom: "6vh" }}>
        <PixelLabel
          text={buildStamp().toUpperCase()}
          px={scale.chrome}
          fill={PARCHMENT}
          opacity={0.3}
        />
      </div>

      {/* the way out: a plain black fade, no spinner, no progress bar */}
      <div
        className="pointer-events-none absolute inset-0 bg-black transition-opacity"
        style={{
          opacity: leaving ? 1 : 0,
          transitionDuration: still ? "0ms" : "820ms",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 1, 1)",
        }}
      />
    </div>
  );
}

/**
 * Mount-and-fade. The child stays mounted for the length of the fade out, so
 * leaving a screen looks like leaving rather than like the screen being deleted;
 * after that it is unmounted, so nothing behind the title screen is running.
 */
function Fade({ show, children }: { show: boolean; children: React.ReactNode }) {
  const [render, setRender] = useState(show);
  useEffect(() => {
    if (show) {
      setRender(true);
      return;
    }
    const t = window.setTimeout(() => setRender(false), 220);
    return () => window.clearTimeout(t);
  }, [show]);
  if (!render) return null;
  return (
    <div
      className="absolute inset-0 transition-all duration-200 ease-out"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "none" : "translateY(6px)",
        pointerEvents: show ? undefined : "none",
      }}
    >
      {children}
    </div>
  );
}

/**
 * One line of the menu. Selection is a mark that grows beside the label — no
 * box, no fill, no glow.
 *
 * The mark lives in a fixed-width column and the label starts on the gutter, so
 * moving the cursor changes nothing about where any word sits. The first
 * version grew the rule from 10 px to 26 and also shifted the row 6 px right,
 * which slid the whole type column back and forth by 22 px four times as you
 * arrowed down it — the vertical version of that bug had been carefully avoided
 * and the horizontal one went unnoticed.
 *
 * A disabled line still shows, with its reason under it, because "there is no
 * save yet" is information and hiding the option is not. Its label is brighter
 * than its reason, which sounds obvious and was the wrong way round: CONTINUE
 * sat at 26% opacity under a caption at full strength, so you read the excuse
 * before the word it belonged to.
 */
function MenuRow({
  item,
  active,
  onHover,
  onPick,
}: {
  item: Item;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const scale = useMenuScale();
  return (
    <button
      type="button"
      disabled={item.disabled}
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onPick}
      aria-current={active}
      className="flex items-start text-left disabled:cursor-not-allowed"
      style={{ marginLeft: -MARK_W }}
    >
      <MenuMark active={active} disabled={Boolean(item.disabled)} px={scale.item} />
      <span className="flex flex-col gap-1">
        <PixelLabel
          text={item.label}
          px={scale.item}
          fill={active && !item.disabled ? SIGNAL : PARCHMENT}
          opacity={item.disabled ? 0.4 : active ? 1 : 0.78}
        />
        <span
          style={{
            ...PROSE.quiet(scale),
            opacity: active ? 1 : item.disabled ? 0.55 : 0,
            transition: "opacity 160ms",
          }}
        >
          {item.note ?? " "}
        </span>
        {/* The save card, such as it is: one more line, on the one row that has
            one, only while it is selected. There is a single save slot, so a
            grid of cards would be a grid of one — what actually helps is being
            reminded which afternoon this was, and the money in your pocket and
            the number of times you have stopped to pet the dog say so. */}
        {item.detail ? (
          <span
            style={{
              ...PROSE.quiet(scale),
              opacity: active ? 0.7 : 0,
              transition: "opacity 160ms",
              marginTop: -2,
            }}
          >
            {item.detail}
          </span>
        ) : null}
      </span>
    </button>
  );
}
