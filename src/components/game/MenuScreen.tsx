import { motion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { CRISP, PixelFrame, PixelLabel, PixelMeter, PixelSprite, PixelText } from "@/engine";
import { paletteForAppearanceCached, playerForAppearance } from "@/game/apartment/appearance";
import { experience, profile, projects, skills, stats } from "@/lib/resume";
import { ITEM_LABEL, type WorldState } from "@/lib/worldState";

/**
 * The menu — one book with five pages, opened with TAB.
 *
 * Modelled on the pause screens in The Friends of Ringo Ishikawa and Fading
 * Afternoon: the world gets out of the way, a single framed object comes up,
 * and everything about the character lives inside it under tabs you flick
 * through. Nothing here is a web widget — every box is a PixelFrame, every
 * meter is whole cells, the map is drawn in the same 3x5 type as the street
 * signs, and the portrait is the actual player sprite wearing the actual
 * clothes the wardrobe put on him.
 *
 * Pages:
 *   PROFILE   who he is: portrait, the numbers, the summary, the links
 *   WORK      what he has done, and what he keeps building
 *   SKILLS    the four books off the shelf
 *   OSIEDLE   the map — every room and how they join, lit as you find them
 *   POCKET    what he is carrying, and how the day is going
 *
 * Objects in the world open this screen straight to a page: the bookshelf goes
 * to SKILLS, the bed to PROFILE, the laptop to WORK. That is the whole point of
 * a resume you can walk around in.
 */

export type MenuTab = "profile" | "work" | "skills" | "map" | "pocket";

const TABS: readonly { id: MenuTab; label: string }[] = [
  { id: "profile", label: "PROFILE" },
  { id: "work", label: "WORK" },
  { id: "skills", label: "SKILLS" },
  { id: "map", label: "OSIEDLE" },
  { id: "pocket", label: "POCKET" },
];

/** Which page a world object asks for. */
export const PANEL_TAB: Record<string, MenuTab> = {
  about: "profile",
  skills: "skills",
  links: "work",
  work: "work",
};

const U = 3; // one interface pixel

// ---------------------------------------------------------------------------
// small parts
// ---------------------------------------------------------------------------

function Line({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return (
    <p
      className={dim ? "text-parchment/50" : "text-parchment/85"}
      style={{ ...CRISP, fontSize: 12, lineHeight: "18px" }}
    >
      {children}
    </p>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span
      className="border border-parchment/20 bg-black/40 text-parchment/75"
      style={{ ...CRISP, padding: `${U / 2}px ${U * 2}px`, fontSize: 10, letterSpacing: "0.1em" }}
    >
      {children}
    </span>
  );
}

function Card({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return (
    <PixelFrame u={U} tone="inset" title={title} badge={badge} rivets={false} scan={false}>
      <div className="flex flex-col gap-2" style={{ padding: `${U * 4}px ${U * 3}px ${U * 3}px` }}>
        {children}
      </div>
    </PixelFrame>
  );
}

// ---------------------------------------------------------------------------
// the map — the building in section, drawn in street-sign type
// ---------------------------------------------------------------------------

type MapNode = { id: string; label: string; x: number; y: number; w?: number };

const NODE_H = 13;
const MAP_NODES: readonly MapNode[] = [
  { id: "balcony", label: "BALKON", x: 168, y: 8 },
  { id: "bath", label: "ŁAZIENKA", x: 24, y: 32, w: 44 },
  { id: "studio", label: "DOM", x: 96, y: 32 },
  { id: "study", label: "SYPIALNIA", x: 168, y: 32, w: 46 },
  { id: "corridor", label: "KLATKA", x: 96, y: 60 },
  { id: "parking", label: "PARKING", x: 24, y: 84, w: 40 },
  { id: "elevator", label: "WINDA", x: 96, y: 84 },
  { id: "gym", label: "SIŁKA", x: 24, y: 116 },
  { id: "outside", label: "ULICA", x: 96, y: 116 },
  { id: "zabka", label: "ŻABKA", x: 168, y: 116 },
  { id: "district", label: "OSIEDLE", x: 168, y: 144, w: 42 },
];

const MAP_EDGES: readonly (readonly [string, string])[] = [
  ["studio", "balcony"],
  ["studio", "bath"],
  ["studio", "study"],
  ["studio", "corridor"],
  ["corridor", "elevator"],
  ["elevator", "parking"],
  ["corridor", "outside"],
  ["outside", "zabka"],
  ["outside", "gym"],
  ["outside", "district"],
  ["district", "gym"],
];

const nodeW = (n: MapNode) => n.w ?? 38;
const cx = (n: MapNode) => n.x + nodeW(n) / 2;
const cy = (n: MapNode) => n.y + NODE_H / 2;

function MapPage({ visited, current }: { visited: readonly string[]; current: string }) {
  const byId = new Map(MAP_NODES.map((n) => [n.id, n]));
  const seen = MAP_NODES.filter((n) => visited.includes(n.id)).length;
  return (
    <div className="flex flex-col gap-3">
      <PixelFrame u={U} tone="inset" rivets={false} scan={false}>
        <svg
          aria-label="Map of the osiedle"
          role="img"
          viewBox="0 0 240 168"
          preserveAspectRatio="xMidYMid meet"
          className="block w-full"
          style={{ imageRendering: "pixelated", maxHeight: "48vh" }}
          shapeRendering="crispEdges"
        >
          {/* the joins first, so the plates sit on top of them */}
          {MAP_EDGES.map(([a, b]) => {
            const na = byId.get(a);
            const nb = byId.get(b);
            if (!na || !nb) return null;
            const live = visited.includes(a) && visited.includes(b);
            const fill = live ? "#e3d9c266" : "#e3d9c220";
            const x0 = cx(na);
            const y0 = cy(na);
            const x1 = cx(nb);
            const y1 = cy(nb);
            return (
              <g key={`${a}-${b}`} fill={fill}>
                {/* dog-leg: down first, then across — a plan, not a spider web */}
                <rect x={x0 - 1} y={Math.min(y0, y1)} width={2} height={Math.abs(y1 - y0)} />
                <rect x={Math.min(x0, x1)} y={y1 - 1} width={Math.abs(x1 - x0)} height={2} />
              </g>
            );
          })}

          {MAP_NODES.map((n) => {
            const here = n.id === current;
            const been = visited.includes(n.id);
            const w = nodeW(n);
            return (
              <g key={n.id}>
                <rect
                  x={n.x}
                  y={n.y}
                  width={w}
                  height={NODE_H}
                  fill={here ? "#2a2712" : been ? "#161a22" : "#0e1116"}
                />
                {/* top-left lit, bottom-right shaded: the kit's edge light */}
                <rect
                  x={n.x}
                  y={n.y}
                  width={w}
                  height={1}
                  fill={here ? "#fcee0a" : been ? "#e3d9c2aa" : "#e3d9c235"}
                />
                <rect
                  x={n.x}
                  y={n.y}
                  width={1}
                  height={NODE_H}
                  fill={here ? "#fcee0a" : been ? "#e3d9c288" : "#e3d9c225"}
                />
                <rect
                  x={n.x + w - 1}
                  y={n.y}
                  width={1}
                  height={NODE_H}
                  fill={here ? "#8a8206" : "#00000066"}
                />
                <rect
                  x={n.x}
                  y={n.y + NODE_H - 1}
                  width={w}
                  height={1}
                  fill={here ? "#8a8206" : "#00000066"}
                />
                <PixelText
                  x={n.x + Math.max(2, Math.round((w - n.label.length * 4) / 2))}
                  y={n.y + 4}
                  text={n.label}
                  fill={here ? "#fcee0a" : been ? "#e3d9c2" : "#e3d9c238"}
                />
                {here ? (
                  <rect x={n.x + w - 4} y={n.y + 3} width={2} height={2} fill="#fcee0a">
                    <animate
                      attributeName="opacity"
                      calcMode="discrete"
                      values="1;0;1"
                      dur="1.1s"
                      repeatCount="indefinite"
                    />
                  </rect>
                ) : null}
              </g>
            );
          })}
        </svg>
      </PixelFrame>
      <div className="flex items-center justify-between">
        <Line dim>
          {seen}/{MAP_NODES.length} rooms found · the lit plate is where you are standing
        </Line>
        <Chip>SŁONECZNA 14 / m. 14</Chip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// pages
// ---------------------------------------------------------------------------

function ProfilePage({ world }: { world: WorldState }) {
  const palette = paletteForAppearanceCached(world.appearance);
  const PLAYER = playerForAppearance(world.appearance);
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex shrink-0 flex-col items-center gap-3">
        <PixelFrame u={U} tone="inset" rivets={false} scan={false} title="AKTA">
          <div style={{ padding: `${U * 5}px ${U * 5}px ${U * 3}px` }}>
            <svg
              aria-hidden="true"
              width={PLAYER.width * 2.2}
              height={PLAYER.height * 2.2}
              viewBox={`0 0 ${PLAYER.width} ${PLAYER.height}`}
              className="pixelated block"
            >
              <PixelSprite map={PLAYER.frames.stand} palette={palette} cell={PLAYER.cell ?? 2} />
            </svg>
          </div>
        </PixelFrame>
        <div className="flex flex-col items-center gap-1">
          <PixelLabel text={profile.name} px={3} fill="#e3d9c2" />
          <PixelLabel text={profile.title} px={2} fill="#e3d9c2" opacity={0.6} />
          <PixelLabel text={profile.location} px={2} fill="#e3d9c2" opacity={0.4} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Card title="STATS">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {stats.map((stat) => (
              /* each stat keeps its own plate, so a label never reads across the
                 gutter into the neighbouring column's meter */
              <div
                key={stat.label}
                className="flex items-center justify-between gap-3 bg-black/30"
                style={{
                  padding: `${U}px ${U * 2}px`,
                  boxShadow: "inset 0 0 0 1px rgba(227,217,194,0.1)",
                }}
              >
                <PixelLabel text={stat.label} px={2} fill="#e3d9c2" opacity={0.65} />
                <PixelMeter value={stat.value} u={U} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="ABOUT">
          <Line>{profile.summary}</Line>
        </Card>

        <div className="flex flex-wrap gap-2">
          {[
            { label: "GITHUB", href: profile.github },
            { label: "LINKEDIN", href: profile.linkedin },
            { label: "EMAIL", href: `mailto:${profile.email}` },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noreferrer"
              className="group"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <PixelFrame u={U} tone="plate" rivets={false}>
                <span className="block" style={{ padding: `${U * 1.5}px ${U * 3}px` }}>
                  <PixelLabel text={`${link.label} >`} px={2} fill="#7fd4e4" />
                </span>
              </PixelFrame>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkPage() {
  return (
    <div className="flex flex-col gap-3">
      {experience.map((job) => (
        <Card key={`${job.company}-${job.period}`} title={job.role} badge={job.period}>
          <PixelLabel text={job.company} px={2} fill="#fcee0a" opacity={0.75} />
          {job.notes.map((note) => (
            <Line key={note} dim>
              — {note}
            </Line>
          ))}
        </Card>
      ))}
      <Card title="PROJECTS">
        {projects.map((project) => (
          <div key={project.name} className="flex flex-col gap-0.5">
            {project.link ? (
              <a
                href={project.link}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] text-ice tracking-[0.12em] hover:text-signal"
                style={CRISP}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {project.name} ↗
              </a>
            ) : (
              <p className="font-mono text-[11px] text-parchment tracking-[0.12em]" style={CRISP}>
                {project.name}
              </p>
            )}
            <Line dim>{project.description}</Line>
          </div>
        ))}
      </Card>
    </div>
  );
}

function SkillsPage() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {skills.map((book) => (
        <Card key={book.title} title={book.title} badge={`${book.items.length}`}>
          <div className="flex flex-wrap gap-1.5">
            {book.items.map((item) => (
              <Chip key={item}>{item}</Chip>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function PocketPage({ world }: { world: WorldState }) {
  const slots = 8;
  const items = world.inventory.map((item) => ({
    label: ITEM_LABEL[item.itemId] ?? item.itemId.toUpperCase(),
    qty: item.quantity,
  }));
  return (
    <div className="flex flex-col gap-3">
      <Card title="CARRIED" badge={`${world.money} ZŁ`}>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: slots }, (_, i) => {
            const item = items[i];
            return (
              <PixelFrame
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed pocket slots
                key={`slot${i * 1}`}
                u={U}
                tone={item ? "plate" : "inset"}
                rivets={false}
                scan={false}
              >
                <span
                  className="flex h-12 flex-col items-center justify-center gap-1 text-center"
                  style={{ padding: U }}
                >
                  {item ? (
                    <>
                      <span
                        className="font-mono text-[9px] text-parchment tracking-[0.1em]"
                        style={CRISP}
                      >
                        {item.label}
                      </span>
                      {item.qty > 1 ? (
                        <span className="font-mono text-[9px] text-signal" style={CRISP}>
                          ×{item.qty}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="font-mono text-[9px] text-parchment/20">—</span>
                  )}
                </span>
              </PixelFrame>
            );
          })}
        </div>
        {items.length === 0 ? <Line dim>Empty pockets, clear head.</Line> : null}
      </Card>

      <Card title="THE DAY">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {[
            ["GROSS PETTED", `${world.dogPets}×`],
            ["KETTLE", world.kettleOn ? "WARM" : "COLD"],
            ["GOLF 7 R", world.golfLocked ? "LOCKED" : "OPEN"],
            ["INPOST", world.corridor.parcelTaken ? "COLLECTED" : "WAITING"],
          ].map(([k, v]) => (
            /* each pair keeps its own plate, so a label never reads across the
               gutter into the neighbouring column's value */
            <div
              key={k}
              className="flex items-center justify-between gap-3 bg-black/30"
              style={{
                padding: `${U}px ${U * 2}px`,
                boxShadow: "inset 0 0 0 1px rgba(227,217,194,0.1)",
              }}
            >
              <PixelLabel text={k} px={2} fill="#e3d9c2" opacity={0.6} />
              <PixelLabel text={v} px={2} fill="#ffb454" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// the book
// ---------------------------------------------------------------------------

export function MenuScreen({
  world,
  visited,
  current,
  initialTab = "profile",
  onClose,
}: {
  world: WorldState;
  visited: readonly string[];
  current: string;
  initialTab?: MenuTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<MenuTab>(initialTab);
  const bodyRef = useRef<HTMLDivElement>(null);

  const move = useCallback((delta: number) => {
    setTab((cur) => {
      const i = TABS.findIndex((t) => t.id === cur);
      return TABS[(i + delta + TABS.length) % TABS.length].id;
    });
  }, []);

  // the page turns with the arrows; ESC and TAB are the runtime's business
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        event.preventDefault();
        move(1);
      } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
        event.preventDefault();
        move(-1);
      } else if (/^Digit[1-5]$/.test(event.code)) {
        event.preventDefault();
        setTab(TABS[Number(event.code.slice(5)) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  // a turned page always starts at the top
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, []);

  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[#05060a]/92 p-3 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex w-full max-w-3xl flex-col gap-2">
        {/* the tabs, as five little plates along the top of the book */}
        <div className="flex flex-wrap items-end gap-1.5">
          {TABS.map((t, i) => (
            <PixelFrame
              key={t.id}
              u={U}
              tone={t.id === tab ? "active" : "plate"}
              rivets={false}
              scan={false}
              onClick={() => setTab(t.id)}
              ariaLabel={t.label}
            >
              <span
                className="flex items-center gap-1.5"
                style={{ padding: `${U * 1.5}px ${U * 3}px` }}
              >
                <PixelLabel text={String(i + 1)} px={2} fill="#e3d9c2" opacity={0.35} />
                <PixelLabel
                  text={t.label}
                  px={2}
                  fill={t.id === tab ? "#fcee0a" : "#e3d9c2"}
                  opacity={t.id === tab ? 1 : 0.6}
                />
              </span>
            </PixelFrame>
          ))}
          <span className="grow" />
          <PixelFrame
            u={U}
            tone="plate"
            rivets={false}
            scan={false}
            onClick={onClose}
            ariaLabel="Close"
          >
            <span className="block" style={{ padding: `${U * 1.5}px ${U * 3}px` }}>
              <PixelLabel text="ESC CLOSE" px={2} fill="#e3d9c2" opacity={0.55} />
            </span>
          </PixelFrame>
        </div>

        {/* the page */}
        <PixelFrame
          u={U}
          tone="panel"
          title={TABS.find((t) => t.id === tab)?.label}
          badge={`${TABS.findIndex((t) => t.id === tab) + 1} / ${TABS.length}`}
        >
          <div
            ref={bodyRef}
            className="pixel-scroll max-h-[70vh] overflow-y-auto"
            style={{ padding: `${U * 6}px ${U * 4}px ${U * 4}px` }}
          >
            {tab === "profile" ? <ProfilePage world={world} /> : null}
            {tab === "work" ? <WorkPage /> : null}
            {tab === "skills" ? <SkillsPage /> : null}
            {tab === "map" ? <MapPage visited={visited} current={current} /> : null}
            {tab === "pocket" ? <PocketPage world={world} /> : null}
          </div>
        </PixelFrame>

        <div className="flex justify-center">
          <PixelLabel
            text="LEFT/RIGHT PAGE - 1-5 JUMP - ESC CLOSE"
            px={2}
            fill="#e3d9c2"
            opacity={0.3}
          />
        </div>
      </div>
    </motion.div>
  );
}
