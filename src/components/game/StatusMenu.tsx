import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PixelSprite } from "@/engine";
import { paletteForAppearance } from "@/game/apartment/appearance";
import { PLAYER } from "@/game/apartment/player";
import { profile, stats } from "@/lib/resume";
import { ITEM_LABEL, type WorldState } from "@/lib/worldState";

/**
 * StatusMenu — the pause screen, redrawn in the game's own chrome:
 * chamfered corners, a scanlined near-black fill, signal section labels,
 * physical keycaps for the controls, and the resident himself rendered
 * live in whatever the wardrobe currently has him wearing.
 */

// one "menu pixel" — the chrome unit everything here is measured in
const u = 3;
const CHAMFER = [
  `${u * 2}px 0`,
  `calc(100% - ${u * 2}px) 0`,
  `calc(100% - ${u}px) ${u}px`,
  `100% ${u * 2}px`,
  `100% calc(100% - ${u * 2}px)`,
  `calc(100% - ${u}px) calc(100% - ${u}px)`,
  `calc(100% - ${u * 2}px) 100%`,
  `${u * 2}px 100%`,
  `${u}px calc(100% - ${u}px)`,
  `0 calc(100% - ${u * 2}px)`,
  `0 ${u * 2}px`,
  `${u}px ${u}px`,
].join(", ");
const CLIP = `polygon(${CHAMFER})`;
const SCAN = `repeating-linear-gradient(180deg, rgba(232,230,224,0.04) 0px, rgba(232,230,224,0.04) ${u}px, rgba(0,0,0,0) ${u}px, rgba(0,0,0,0) ${u * 2}px)`;

function Key({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center border border-signal/60 bg-[#141410] px-1.5 font-mono text-[10px] text-signal shadow-[inset_0_-2px_0_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)]">
      {children}
    </span>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] text-signal/80 tracking-[0.3em]">{label}</p>
      {children}
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs opacity-70">{label}</span>
      <span role="img" className="text-signal tracking-[-0.1em]" aria-label={`${value}/10`}>
        {"█".repeat(value)}
        <span className="opacity-25">{"█".repeat(10 - value)}</span>
      </span>
    </div>
  );
}

export function StatusMenu({
  world,
  visited,
  scenes,
  onClose,
}: {
  world: WorldState;
  /** Scene ids the player has stood in this run. */
  visited: string[];
  /** Every scene id in the game, in canonical order. */
  scenes: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const palette = paletteForAppearance(world.appearance);
  const fit =
    `${world.appearance.shirt} / ${world.appearance.trousers} / ${world.appearance.shoes}`.toUpperCase();

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0810f5] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* the frame: border layer, chamfered, fill inset one chrome pixel */}
      <div
        className="w-full max-w-2xl"
        style={{
          clipPath: CLIP,
          background: "rgba(232,230,224,0.3)",
          padding: u,
          filter: `drop-shadow(0 ${u}px 0 rgba(0,0,0,0.55))`,
        }}
      >
        <div
          className="max-h-[82vh] overflow-y-auto p-5 font-mono text-parchment text-sm"
          style={{
            clipPath: CLIP,
            backgroundColor: "rgba(11,14,20,0.97)",
            backgroundImage: SCAN,
            boxShadow: `inset 0 ${u}px 0 rgba(232,230,224,0.10)`,
          }}
        >
          {/* header */}
          <div className="mb-5 flex items-center justify-between border-parchment/20 border-b pb-3">
            <h2 className="tracking-[0.35em]">{t("menu.title")}</h2>
            <button
              type="button"
              className="flex items-center gap-2 text-parchment/50 text-xs tracking-[0.2em] hover:text-parchment"
              onClick={onClose}
              aria-label={t("ui.close")}
            >
              <Key>ESC</Key> CLOSE
            </button>
          </div>

          <div className="flex flex-col gap-7 sm:flex-row">
            {/* the resident, dressed as he currently is */}
            <div className="flex shrink-0 flex-col items-center gap-3">
              <div className="flex flex-col items-center gap-2 border border-parchment/15 bg-[#141210] px-6 py-4">
                <svg
                  aria-hidden="true"
                  width={PLAYER.width * 2.4}
                  height={PLAYER.height * 2.4}
                  viewBox={`0 0 ${PLAYER.width} ${PLAYER.height}`}
                  className="pixelated"
                >
                  <PixelSprite map={PLAYER.frames.stand} palette={palette} cell={2} />
                </svg>
                <p className="text-[9px] text-parchment/35 tracking-[0.2em]">{fit}</p>
              </div>
              <div className="text-center">
                <p className="text-parchment">{profile.name.toUpperCase()}</p>
                <p className="text-parchment/50 text-xs">{profile.title.toUpperCase()}</p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <Section label={t("menu.condition")}>
                <div className="flex flex-col gap-1.5">
                  {stats.map((stat) => (
                    <StatBar key={stat.label} label={stat.label} value={stat.value} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-parchment/70 text-xs">
                  <p>
                    {t("menu.condition")}:{" "}
                    <span className="text-ember">
                      {world.kettleOn ? t("menu.conditionTea") : t("menu.conditionOk")}
                    </span>
                  </p>
                  <p>
                    {t("menu.dogPets")}: <span className="text-ember">{world.dogPets}</span>
                  </p>
                </div>
              </Section>

              <Section label="POCKET">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border border-signal/50 bg-black/40 px-2 py-0.5 text-signal text-xs tracking-[0.15em]">
                    {world.money} ZŁ
                  </span>
                  {world.inventory.map((item) => (
                    <span
                      key={item.itemId}
                      className="border border-parchment/20 bg-black/40 px-2 py-0.5 text-parchment/80 text-xs tracking-[0.15em]"
                    >
                      {ITEM_LABEL[item.itemId] ?? item.itemId.toUpperCase()}
                      {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                    </span>
                  ))}
                  {world.inventory.length === 0 ? (
                    <span className="text-parchment/40 text-xs tracking-[0.15em]">
                      EMPTY POCKETS, CLEAR HEAD
                    </span>
                  ) : null}
                </div>
              </Section>

              <Section label="OSIEDLE">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {scenes.map((id) => (
                      <span
                        key={id}
                        title={id.toUpperCase()}
                        className={
                          visited.includes(id)
                            ? "h-2.5 w-2.5 border border-signal bg-signal/80"
                            : "h-2.5 w-2.5 border border-parchment/25"
                        }
                      />
                    ))}
                  </div>
                  <span className="text-parchment/60 text-xs tracking-[0.15em]">
                    {visited.length}/{scenes.length} EXPLORED
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-parchment/70 text-xs">
                  <p>
                    GOLF 7 R:{" "}
                    <span className={world.golfLocked ? "text-ice" : "text-ember"}>
                      {world.golfLocked ? "LOCKED" : "UNLOCKED"}
                    </span>
                  </p>
                  <p>
                    INPOST:{" "}
                    <span className={world.corridor.parcelTaken ? "text-ember" : "text-ice"}>
                      {world.corridor.parcelTaken ? "PARCEL TAKEN" : "PARCEL WAITING"}
                    </span>
                  </p>
                </div>
              </Section>

              <Section label="CONTROLS">
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-parchment/60 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Key>◀</Key>
                    <Key>▶</Key> WALK
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Key>E</Key> USE
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Key>▲</Key>
                    <Key>▼</Key> TARGET
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Key>TAB</Key> MENU
                  </span>
                </div>
              </Section>

              <div className="flex gap-5 text-xs">
                <a
                  className="text-ice hover:text-signal"
                  href={profile.github}
                  target="_blank"
                  rel="noreferrer"
                >
                  GITHUB
                </a>
                <a
                  className="text-ice hover:text-signal"
                  href={profile.linkedin}
                  target="_blank"
                  rel="noreferrer"
                >
                  LINKEDIN
                </a>
                <a className="text-ice hover:text-signal" href={`mailto:${profile.email}`}>
                  EMAIL
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
