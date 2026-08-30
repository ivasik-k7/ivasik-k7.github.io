import { t } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelSprite, playSfx } from "@/engine";
import {
  Bev,
  bevelPaths,
  dth,
  M,
  PixelText,
  pxPath,
  type Rect,
  textWidth,
} from "@/engine/scene/pixelKit";
import type { WorldState } from "@/lib/worldState";
import { MinigameShell } from "../minigames/kit";
import {
  APPEARANCE_GROUPS,
  APPEARANCE_SLOTS,
  type Appearance,
  type AppearanceSlot,
  activeOutfit,
  applyOutfit,
  cycleOption,
  hoodAllowed,
  normalizeAppearance,
  OUTFITS,
  paletteForAppearance,
  playerForAppearance,
  rollAppearance,
  swatchFor,
} from "./appearance";

/**
 * SZAFA — the hall wardrobe, close up.
 *
 * Drawn the way the bankomat is drawn: a piece of furniture on a logical
 * canvas, every box with its bevel edge-light, the mirror recessed into the
 * door with the man in it, and the rails on the open side with a cursor that
 * a keyboard moves. No buttons. The whole thing is played from the same
 * keys as the rest of the game — W/S for the rail, A/D for what hangs on it,
 * Q/E for which part of the wardrobe you are looking in, digits for a whole
 * outfit, R for whatever falls out, Space to see him move — and Escape is
 * the door closing, which the engine owns.
 *
 * The mirror is honest: it shows the compiled player for the look on the
 * rails, standing, walking or sitting, so a change is judged in motion.
 */

/* logical canvas */
const W = 300;
const H = 190;
const FLOOR_Y = 168;

/* the wardrobe body, its two doors, and the mirror set into the left one */
const BODY: Rect = [14, 6, 272, 162];
const PLINTH: Rect = [12, 160, 276, 8];
const MIRROR_FRAME: Rect = [26, 16, 84, 142];
const MIRROR: Rect = [30, 20, 76, 134];
const RAIL_X = 122;
const RAIL_W = 160;
const RAIL_Y0 = 38;
const RAIL_H = 22;
const TABS_Y = 24;

const GLASS = "#20262e";
const GLASS_HI = "#3a4450";
const CURSOR = "#e8c445";
const DIM = M.linen.deep;
const INK = M.linen.base;

type Pose = "stand" | "walk" | "sit";

/**
 * Colour options are named by what they paint, not by a key: the skin called
 * "default" is Warm, the shirt called "default" is Black. This resolves an
 * option to its catalogue key so the label can be translated; ids that are
 * already keys (every cut and body option) pass straight through.
 */
const DEFAULT_KEY: Partial<Record<keyof Appearance, string>> = {
  skin: "warm",
  hair: "chestnut",
  beard: "stubble",
  shirt: "black",
  trousers: "navy",
  shoes: "white",
};
const ALIAS_KEY: Record<string, string> = {
  "hoodie-grey": "grey",
  "hoodie-black": "black",
  sambo: "red",
  sambovki: "blue",
};
function optionLabel(slotKey: keyof Appearance, id: string, fallback: string): string {
  let key = id;
  if (id === "default") key = DEFAULT_KEY[slotKey] ?? id;
  else if (slotKey === "beard" && id === "none") key = "cleanShave";
  else key = ALIAS_KEY[id] ?? id;
  return t(`wardrobe.option.${key}`, { defaultValue: fallback });
}
const POSES: Pose[] = ["stand", "walk", "sit"];
const WALK_MS = 170;

/** Greedy word wrap for the note line, in the font's own widths, at most two lines. */
function wrapNote(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (textWidth(next) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

export function WardrobePanel({
  world,
  updateWorld,
  onClose,
}: {
  world: WorldState;
  updateWorld: (patch: Partial<WorldState> | ((w: WorldState) => WorldState)) => void;
  onClose: () => void;
}) {
  const appearance = useMemo(() => normalizeAppearance(world.appearance), [world.appearance]);
  const palette = useMemo(() => paletteForAppearance(appearance), [appearance]);
  const player = useMemo(() => playerForAppearance(appearance), [appearance]);

  const [group, setGroup] = useState(2); // WHAT HE WEARS
  const [row, setRow] = useState(0);
  const [pose, setPose] = useState<Pose>("stand");
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number>(0);
  const stageRef = useRef<SVGGElement | null>(null);

  const slots = APPEARANCE_SLOTS.filter((s) => s.group === APPEARANCE_GROUPS[group].id);
  const slot = slots[Math.min(row, slots.length - 1)];

  useEffect(() => {
    if (pose !== "walk") return;
    const id = window.setInterval(() => setTick((t) => t + 1), WALK_MS);
    return () => window.clearInterval(id);
  }, [pose]);
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);

  const say = useCallback((text: string) => {
    setNote(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 1800);
  }, []);
  const setAll = useCallback(
    (a: Appearance) => updateWorld((w) => ({ ...w, appearance: a })),
    [updateWorld],
  );

  /** Move the selected rail one stop; the hood/hat rules speak up when they apply. */
  const change = useCallback(
    (target: AppearanceSlot | undefined, dir: 1 | -1) => {
      if (!target) return;
      let next = cycleOption(target, appearance[target.key], dir);
      // a hood needs a hoodie: skip past it rather than collapsing the
      // choice to "nothing" behind the user's back
      if (target.key === "head" && next === "hood" && !hoodAllowed(appearance.top)) {
        next = cycleOption(target, "hood", dir);
        say(t("wardrobe.hoodNeedsHoodie"));
      }
      if (target.key === "hat" && appearance.head !== "cap" && appearance.head !== "beanie") {
        say(t("wardrobe.nothingOnHead"));
      }
      playSfx("click");
      updateWorld((w) => ({
        ...w,
        appearance: normalizeAppearance({ ...w.appearance, [target.key]: next }),
      }));
    },
    [appearance, say, updateWorld],
  );
  const wearOutfit = useCallback(
    (outfit: (typeof OUTFITS)[number]) => {
      playSfx("chime");
      setAll(applyOutfit(appearance, outfit));
      say(t(`wardrobe.note.${outfit.id}`, { defaultValue: outfit.note }).toUpperCase());
    },
    [appearance, say, setAll],
  );

  /* ------------------------------------------------------------ input --- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") return; // the overlay contract owns Escape
      e.stopPropagation();
      const code = e.code;
      if (code === "ArrowDown" || code === "KeyS") {
        playSfx("click");
        setRow((r) => (r + 1) % slots.length);
      } else if (code === "ArrowUp" || code === "KeyW") {
        playSfx("click");
        setRow((r) => (r + slots.length - 1) % slots.length);
      } else if (code === "KeyE" || code === "Tab" || code === "PageDown") {
        e.preventDefault();
        playSfx("click");
        setGroup((g) => (g + 1) % APPEARANCE_GROUPS.length);
        setRow(0);
      } else if (code === "KeyQ" || code === "PageUp") {
        e.preventDefault();
        playSfx("click");
        setGroup((g) => (g + APPEARANCE_GROUPS.length - 1) % APPEARANCE_GROUPS.length);
        setRow(0);
      } else if (
        code === "ArrowRight" ||
        code === "KeyD" ||
        code === "ArrowLeft" ||
        code === "KeyA" ||
        code === "Enter"
      ) {
        change(slot, code === "ArrowLeft" || code === "KeyA" ? -1 : 1);
      } else if (code === "Space") {
        e.preventDefault();
        playSfx("click");
        setPose((p) => POSES[(POSES.indexOf(p) + 1) % POSES.length]);
      } else if (code === "KeyR") {
        playSfx("chime");
        setAll(rollAppearance());
        say(t("wardrobe.fellOut"));
      } else if (code === "Backspace") {
        // the clothes he was drawn in; the man underneath is not a setting to reset
        playSfx("click");
        setAll(applyOutfit(appearance, OUTFITS[0]));
        say(t("wardrobe.asDrawn"));
      } else if (/^Digit[1-9]$/.test(code) || /^Numpad[1-9]$/.test(code)) {
        const outfit = OUTFITS[Number(code.slice(-1)) - 1];
        if (outfit) wearOutfit(outfit);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [appearance, slot, slots.length, say, setAll, change, wearOutfit]);

  /* ------------------------------------------------------------ mirror --- */
  const frame =
    pose === "walk"
      ? player.frames[player.walkCycle[tick % player.walkCycle.length]]
      : pose === "sit"
        ? (player.frames.sit ?? player.frames.stand)
        : player.frames.stand;
  const cell = 3;
  const spriteW = (player.width / (player.cell ?? 2)) * cell;
  const spriteH = (player.height / (player.cell ?? 2)) * cell;
  const spriteX = MIRROR[0] + Math.floor((MIRROR[2] - spriteW) / 2);
  const spriteY = MIRROR[1] + MIRROR[3] - spriteH - 6;

  const outfitOn = activeOutfit(appearance);
  const outfitLabel = outfitOn
    ? t(`wardrobe.outfit.${outfitOn}`, {
        defaultValue: OUTFITS.find((o) => o.id === outfitOn)?.label ?? "",
      })
    : t("wardrobe.ownMix");

  return (
    <MinigameShell
      w={W}
      h={H}
      bg="#0a0c10"
      stageRef={stageRef}
      verdict={null}
      hint={t("minigame.wardrobe")}
      maxWidth="max-w-2xl"
    >
      {/* the hall wall and its skirting */}
      <rect width={W} height={FLOOR_Y} fill="#231f1b" />
      <rect x={0} y={FLOOR_Y} width={W} height={H - FLOOR_Y} fill="#17151a" />
      <rect x={0} y={FLOOR_Y} width={W} height={2} fill="#2a262c" />
      <rect width={W} height={H} fill={dth("n", "25")} />
      {/* the wardrobe's stepped shadow onto the wall */}
      <path
        d={pxPath([
          [BODY[0] + BODY[2], BODY[1] + 6, 5, BODY[3] - 6],
          [BODY[0] + 4, BODY[1] + BODY[3], BODY[2] + 4, 4],
        ])}
        fill="#07080a"
        opacity={0.55}
      />
      {/* carcass: oak veneer, bevel edge-light on every box */}
      <rect x={BODY[0]} y={BODY[1]} width={BODY[2]} height={BODY[3]} fill={M.oak.base} />
      <Bev set={bevelPaths([BODY])} mat={M.oak} />
      {/* the grain: long faint lines the veneer would have */}
      {[30, 62, 94, 126, 150].map((y) => (
        <rect
          key={y}
          x={BODY[0] + 2}
          y={y}
          width={BODY[2] - 4}
          height={1}
          fill={M.oak.lo}
          opacity={0.5}
        />
      ))}
      <rect x={BODY[0]} y={BODY[1]} width={BODY[2]} height={BODY[3]} fill={dth("n", "12")} />
      {/* plinth */}
      <rect x={PLINTH[0]} y={PLINTH[1]} width={PLINTH[2]} height={PLINTH[3]} fill={M.oak.deep} />
      <Bev set={bevelPaths([PLINTH])} mat={M.oak} op={0.6} />

      {/* the mirror door: frame, recess, glass, the man */}
      <rect
        x={MIRROR_FRAME[0]}
        y={MIRROR_FRAME[1]}
        width={MIRROR_FRAME[2]}
        height={MIRROR_FRAME[3]}
        fill={M.oak.lo}
      />
      <Bev set={bevelPaths([MIRROR_FRAME])} mat={M.oak} />
      <path
        d={pxPath([
          [MIRROR[0] - 1, MIRROR[1] - 1, MIRROR[2] + 2, 1],
          [MIRROR[0] - 1, MIRROR[1], 1, MIRROR[3] + 1],
        ])}
        fill="#0e1014"
      />
      <rect x={MIRROR[0]} y={MIRROR[1]} width={MIRROR[2]} height={MIRROR[3]} fill={GLASS} />
      {/* the glass catches the hall light in one diagonal streak */}
      <path
        d={pxPath([
          [MIRROR[0] + 6, MIRROR[1] + 4, 3, 40],
          [MIRROR[0] + 9, MIRROR[1] + 14, 2, 30],
          [MIRROR[0] + 12, MIRROR[1] + 26, 1, 20],
        ])}
        fill={GLASS_HI}
        opacity={0.5}
      />
      {/* his shadow on the glass floor, then him */}
      <rect
        x={spriteX + 8}
        y={spriteY + spriteH - 2}
        width={spriteW - 16}
        height={3}
        fill="#0b0d11"
        opacity={0.6}
      />
      <g transform={`translate(${spriteX} ${spriteY})`}>
        <PixelSprite map={frame} palette={palette} cell={cell} />
      </g>
      <rect
        x={MIRROR[0]}
        y={MIRROR[1]}
        width={MIRROR[2]}
        height={MIRROR[3]}
        fill={dth("n", "12")}
      />
      {/* touch: the close plate on the door frame, and the glass cycles the pose */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape is the keyboard path */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: touch path */}
      <g onClick={onClose} style={{ cursor: "pointer" }}>
        <rect x={W - 26} y={2} width={22} height={9} fill={M.oak.deep} />
        <PixelText
          x={W - 26 + Math.floor((22 - textWidth("ESC")) / 2)}
          y={4}
          text="ESC"
          fill={M.brass.base}
        />
      </g>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Space is the keyboard path */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: touch path */}
      <rect
        x={MIRROR[0]}
        y={MIRROR[1]}
        width={MIRROR[2]}
        height={MIRROR[3]}
        fill="transparent"
        onClick={() => setPose((p) => POSES[(POSES.indexOf(p) + 1) % POSES.length])}
      />
      {/* the pose stamp, bottom of the glass */}
      <PixelText
        x={MIRROR[0] + Math.floor((MIRROR[2] - textWidth(t(`wardrobe.pose.${pose}`))) / 2)}
        y={MIRROR[1] + MIRROR[3] - 8}
        text={t(`wardrobe.pose.${pose}`)}
        fill={GLASS_HI}
      />
      {/* door handle */}
      <rect
        x={MIRROR_FRAME[0] + MIRROR_FRAME[2] - 2}
        y={84}
        width={2}
        height={12}
        fill={M.brass.base}
      />
      <rect
        x={MIRROR_FRAME[0] + MIRROR_FRAME[2] - 2}
        y={84}
        width={2}
        height={1}
        fill={M.brass.hi}
      />

      {/* the open side: a label plate, the shelves as tabs, the rails */}
      <rect x={RAIL_X - 6} y={12} width={RAIL_W + 12} height={144} fill={M.oak.deep} />
      <rect x={RAIL_X - 6} y={12} width={RAIL_W + 12} height={144} fill={dth("n", "25")} />
      <PixelText x={RAIL_X} y={14} text={t("wardrobe.title")} fill={M.brass.base} />
      <PixelText
        x={RAIL_X + RAIL_W - textWidth(outfitLabel)}
        y={14}
        text={outfitLabel}
        fill={outfitOn ? CURSOR : DIM}
      />

      {/* shelves: the four groups, the open one lit */}
      {APPEARANCE_GROUPS.map((g, i) => {
        const short = t(`wardrobe.group.${g.id}`);
        const x = RAIL_X + i * 40;
        const on = i === group;
        return (
          // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard path is the W/S/Q/E handler above; this is the touch path
          // biome-ignore lint/a11y/noStaticElementInteractions: same — touch path over an SVG group
          <g
            key={g.id}
            onClick={() => {
              playSfx("click");
              setGroup(i);
              setRow(0);
            }}
            style={{ cursor: "pointer" }}
          >
            <rect x={x} y={TABS_Y} width={38} height={9} fill={on ? M.oak.hi : M.oak.lo} />
            <rect
              x={x}
              y={TABS_Y}
              width={38}
              height={1}
              fill={on ? M.linen.hi : M.oak.base}
              opacity={0.8}
            />
            <PixelText
              x={x + Math.floor((38 - textWidth(short)) / 2)}
              y={TABS_Y + 2}
              text={short}
              fill={on ? M.oak.deep : M.oak.hi}
            />
          </g>
        );
      })}

      {/* rails */}
      {slots.map((s, i) => {
        const y = RAIL_Y0 + i * RAIL_H;
        const on = i === Math.min(row, slots.length - 1);
        const currentId = appearance[s.key];
        const current = s.options.find((o) => o.id === currentId) ?? s.options[0];
        const sw = swatchFor(s, current.id, appearance);
        const index = s.options.findIndex((o) => o.id === current.id);
        const muted = s.key === "hat" && appearance.head !== "cap" && appearance.head !== "beanie";
        return (
          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard path is the key handler; this is touch
          // biome-ignore lint/a11y/noStaticElementInteractions: touch path over an SVG group
          <g key={s.key} opacity={muted ? 0.45 : 1} onClick={() => setRow(i)}>
            {/* the rail itself: a steel bar with a highlight */}
            <rect x={RAIL_X} y={y + RAIL_H - 3} width={RAIL_W} height={2} fill={M.steel.lo} />
            <rect
              x={RAIL_X}
              y={y + RAIL_H - 3}
              width={RAIL_W}
              height={1}
              fill={M.steel.hi}
              opacity={0.6}
            />
            {on ? <PixelText x={RAIL_X} y={y + 8} text=">" fill={CURSOR} /> : null}
            <PixelText
              x={RAIL_X + 8}
              y={y + 1}
              text={t(`wardrobe.slot.${s.key}`, { defaultValue: s.label })}
              fill={on ? INK : DIM}
              op={0.7}
            />
            {/* what hangs there: a swatch lit the way the sprite is lit, or a numbered tag */}
            {sw ? (
              <g>
                <rect x={RAIL_X + 8} y={y + 8} width={8} height={8} fill={sw.base} />
                <path
                  d={pxPath([
                    [RAIL_X + 12, y + 12, 4, 4],
                    [RAIL_X + 8, y + 15, 8, 1],
                  ])}
                  fill={sw.shade}
                />
                <rect
                  x={RAIL_X + 8}
                  y={y + 8}
                  width={8}
                  height={8}
                  fill="none"
                  stroke={M.oak.deep}
                  strokeWidth={1}
                />
              </g>
            ) : (
              <g>
                <rect x={RAIL_X + 8} y={y + 8} width={8} height={8} fill={M.linen.deep} />
                <PixelText x={RAIL_X + 10} y={y + 10} text={String(index + 1)} fill={M.oak.deep} />
              </g>
            )}
            <PixelText
              x={RAIL_X + 20}
              y={y + 9}
              text={optionLabel(s.key, current.id, current.label).toUpperCase()}
              fill={on ? M.linen.hi : INK}
            />
            {on ? (
              <g>
                <PixelText x={RAIL_X + RAIL_W - 22} y={y + 9} text="<" fill={CURSOR} />
                <PixelText x={RAIL_X + RAIL_W - 6} y={y + 9} text=">" fill={CURSOR} />
                <PixelText x={RAIL_X + RAIL_W - 16} y={y + 9} text={`${index + 1}`} fill={DIM} />
                {/* touch: the two halves of the rail turn it either way */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: touch hit zone; keys handle the rest */}
                <rect
                  x={RAIL_X}
                  y={y}
                  width={RAIL_W / 2}
                  height={RAIL_H}
                  fill="transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    change(s, -1);
                  }}
                />
                {/* biome-ignore lint/a11y/noStaticElementInteractions: touch hit zone; keys handle the rest */}
                <rect
                  x={RAIL_X + RAIL_W / 2}
                  y={y}
                  width={RAIL_W / 2}
                  height={RAIL_H}
                  fill="transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    change(s, 1);
                  }}
                />
              </g>
            ) : null}
          </g>
        );
      })}

      {/* the note: what he thinks of it, briefly */}
      {note ? (
        wrapNote(note, RAIL_W).map((line, i) => (
          <PixelText
            key={line}
            x={RAIL_X + Math.max(0, Math.floor((RAIL_W - textWidth(line)) / 2))}
            y={RAIL_Y0 + 4 * RAIL_H + 8 + i * 8}
            text={line}
            fill={CURSOR}
          />
        ))
      ) : (
        <PixelText
          x={RAIL_X}
          y={RAIL_Y0 + 4 * RAIL_H + 8}
          text={`${t("wardrobe.frames", { count: Object.keys(player.frames).length })} · ${player.width / (player.cell ?? 2)}X${player.height / (player.cell ?? 2)}`}
          fill={DIM}
          op={0.7}
        />
      )}
    </MinigameShell>
  );
}
