import { motion } from "motion/react";
import { PixelSprite, playSfx } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { APPEARANCE_SLOTS, cycleOption, paletteForAppearance } from "./appearance";
import { PLAYER } from "./player";

/**
 * The wardrobe — a mirror with opinions. Live preview on the left,
 * one row per body zone on the right; changes apply to the world
 * immediately, so you walk out wearing what you picked.
 */
export function WardrobePanel({
  world,
  updateWorld,
  onClose,
}: {
  world: WorldState;
  updateWorld: (patch: Partial<WorldState> | ((w: WorldState) => WorldState)) => void;
  onClose: () => void;
}) {
  const appearance = world.appearance;
  const palette = paletteForAppearance(appearance);

  const set = (key: keyof WorldState["appearance"], id: string) => {
    playSfx("click");
    updateWorld((w) => ({ ...w, appearance: { ...w.appearance, [key]: id } }));
  };

  return (
    <motion.div
      key="wardrobe"
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: click only stops backdrop propagation; ESC close is handled by the engine */}
      <div
        className="flex max-h-[90vh] gap-6 overflow-y-auto border border-parchment/30 bg-[#12100e] p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Wardrobe"
      >
        {/* the mirror: live preview at 4× */}
        <div className="flex flex-col items-center gap-3 border border-parchment/15 bg-[#1a1713] px-6 py-4">
          <p className="font-mono text-parchment/50 text-xs tracking-[0.3em]">MIRROR</p>
          <svg
            aria-hidden="true"
            width={PLAYER.width * 4}
            height={PLAYER.height * 4}
            viewBox={`0 0 ${PLAYER.width} ${PLAYER.height}`}
            className="pixelated"
          >
            <PixelSprite map={PLAYER.frames.stand} palette={palette} cell={2} />
          </svg>
          <p className="max-w-36 text-center font-mono text-[10px] text-parchment/40 leading-relaxed">
            The mirror withholds judgement. Barely.
          </p>
        </div>

        {/* the rails: one row per zone */}
        <div className="flex min-w-64 flex-col gap-3">
          <p className="font-mono text-parchment text-sm tracking-[0.3em]">WARDROBE</p>
          {APPEARANCE_SLOTS.map((slot) => {
            const currentId = appearance[slot.key];
            const current = slot.options.find((o) => o.id === currentId) ?? slot.options[0];
            const swatch =
              (Object.values(current.colors).find((c) => c !== "") as string) ?? "#3a3d43";
            return (
              <div
                key={slot.key}
                className="flex items-center justify-between gap-3 border border-parchment/15 bg-black/40 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 border border-parchment/25"
                    style={{ backgroundColor: swatch }}
                  />
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-parchment/45 tracking-[0.25em]">
                      {slot.label}
                    </span>
                    <span className="font-mono text-parchment/90 text-xs">{current.label}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Previous ${slot.label}`}
                    className="border border-parchment/25 px-2 py-1 font-mono text-parchment/70 text-xs hover:border-signal hover:text-signal"
                    onClick={() => set(slot.key, cycleOption(slot, currentId, -1))}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label={`Next ${slot.label}`}
                    className="border border-parchment/25 px-2 py-1 font-mono text-parchment/70 text-xs hover:border-signal hover:text-signal"
                    onClick={() => set(slot.key, cycleOption(slot, currentId, 1))}
                  >
                    ›
                  </button>
                </div>
              </div>
            );
          })}
          <div className="mt-1 flex justify-between">
            <button
              type="button"
              className="border border-parchment/25 px-3 py-1 font-mono text-parchment/70 text-xs hover:border-signal hover:text-signal"
              onClick={() => {
                playSfx("chime");
                updateWorld((w) => ({
                  ...w,
                  appearance: Object.fromEntries(
                    APPEARANCE_SLOTS.map((s) => [
                      s.key,
                      s.options[Math.floor(Math.random() * s.options.length)].id,
                    ]),
                  ) as WorldState["appearance"],
                }));
              }}
            >
              SURPRISE ME
            </button>
            <button
              type="button"
              className="border border-signal/60 px-3 py-1 font-mono text-signal text-xs hover:bg-signal/10"
              onClick={onClose}
            >
              DONE [ESC]
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
