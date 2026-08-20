import {
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ANIMAL_FURS,
  ANIMAL_TRIM,
  type AnimalCoat,
  type AnimalConfig,
  type AnimalDoing,
  type AnimalEars,
  type AnimalLook,
  type AnimalMuzzle,
  type AnimalPattern,
  type AnimalSize,
  type AnimalSpec,
  type AnimalSpecies,
  type AnimalTail,
  createAnimal,
  createNpc,
  type FabricName,
  type FurName,
  NPC_FABRICS,
  NPC_HAIRS,
  NPC_SKINS,
  type NpcAccent,
  type NpcBottom,
  type NpcBrow,
  type NpcBuild,
  type NpcConfig,
  type NpcEars,
  type NpcEyeShape,
  type NpcFace,
  type NpcHairStyle,
  type NpcHat,
  type NpcHeadShape,
  type NpcHeight,
  type NpcMouth,
  type NpcNose,
  type NpcProp,
  type NpcShoes,
  type NpcSpec,
  type NpcTexture,
  type NpcTop,
  PixelFrame,
  PixelLabel,
  PixelSprite,
  type TrimName,
  useAnimalFrame,
  useNpcFrame,
} from "@/engine";
import { ANIMAL_IDS, ANIMALS } from "./animals";
import { NPC_IDS, NPCS } from "./npcs";

/**
 * The casting studio — where a new neighbour gets made.
 *
 * Open with `?npcs`. On the left, the whole cast doing whatever they do, so
 * you can see at a glance that they read as different people. On the right, a
 * face you can dress: every dial the builder exposes, live, with the spec
 * printed underneath ready to paste into npcs.ts.
 *
 * The point is that inventing somebody should take a minute. Turn the dials
 * until they look like a person you have met on that street, hit COPY, and
 * they exist.
 *
 * The studio has two rooms and one set of furniture. CAST is the people;
 * KENNEL is the same bench with the animal rig on it, because a dog is
 * invented exactly the way a caretaker is — a dozen words about what it is —
 * and building it a second interface would mean fixing every layout bug twice.
 * The chrome, the dials, the takes strip and the spec block are shared; only
 * the knobs and the registry change.
 *
 * The studio is one screen and never more: the shell is pinned to the viewport
 * and every pane scrolls inside itself. A cast of thirty must not be able to
 * push the dials past the bottom of the monitor, which is exactly what a page
 * that grows with its content does.
 */

const U = 3;
const PARCHMENT = "#e3d9c2";
const SIGNAL = "#fcee0a";

/** Room for two dial columns on a laptop, never so wide the cast is a corridor. */
const DIAL_PANEL_W = "clamp(340px, 44vw, 560px)";
const SPEC_W = 248;
/** Above this the preview and the takes strip may spend height; below, the dials win. */
const ROOMY_HEIGHT = 700;
/** Every neighbour is drawn on the same 76px canvas, so one box fits them all. */
const SPRITE_H = 76;
const CAST_BOX = SPRITE_H + 12;
const CAST_SCALE = 1;
/** A person is drawn tall and narrow; an animal is the other way round. */
const CAST_TILE = 84;
const KENNEL_TILE = 124;
const KENNEL_SCALE = 1.4;

const BUILDS: NpcBuild[] = ["slim", "regular", "stout"];
const HEIGHTS: NpcHeight[] = ["short", "average", "tall"];
const HAIRSTYLES: NpcHairStyle[] = [
  "short",
  "crop",
  "bun",
  "long",
  "bald",
  "receding",
  "ponytail",
  "curly",
  "bob",
  "braid",
  "fringe",
  "mullet",
  "afro",
  "topknot",
  "undercut",
  "curtains",
  "spiky",
  "bowl",
  "shaved",
];
const TEXTURES: NpcTexture[] = ["none", "stripe", "pinstripe", "check", "knit", "worn", "flecked"];
const HATS: NpcHat[] = [
  "none",
  "cap",
  "beanie",
  "kerchief",
  "hood",
  "fedora",
  "hardhat",
  "ushanka",
  "beret",
];
const TOPS: NpcTop[] = [
  "tshirt",
  "shirt",
  "jumper",
  "hoodie",
  "jacket",
  "coat",
  "dress",
  "tracksuit",
  "overalls",
  "tank",
];
const HEADS: NpcHeadShape[] = ["oval", "round", "square", "long", "gaunt", "heart"];
const BROWS: NpcBrow[] = ["thin", "flat", "heavy", "arched", "worried", "raised"];
const EYESHAPES: NpcEyeShape[] = ["normal", "wide", "round", "narrow", "deep", "bright"];
const NOSES: NpcNose[] = ["small", "straight", "broad", "hook", "button", "long"];
const MOUTHS: NpcMouth[] = ["neutral", "wide", "thin", "smile", "frown", "set"];
const EARS: NpcEars[] = ["flat", "out"];
/** Most people have nothing on their face, so most rolls should not either. */
const rollFace = (): NpcFace | undefined => {
  const roll = FACES[Math.floor(Math.random() * FACES.length)];
  return roll === "none" ? undefined : roll;
};

/** The dial shows one feature; a spec that lists several shows the first. */
const faceDial = (face: NpcFace | readonly NpcFace[] | undefined): NpcFace | "none" =>
  Array.isArray(face) ? (face[0] ?? "none") : ((face as NpcFace | undefined) ?? "none");

const BOTTOMS: NpcBottom[] = ["trousers", "jeans", "skirt", "shorts", "workpants", "tracksuit"];
const SHOEKINDS: NpcShoes[] = ["shoes", "boots", "trainers", "sandals", "heels"];
/** "none" is the studio's way of saying "no feature", not a face. */
const FACES: (NpcFace | "none")[] = [
  "none",
  "stubble",
  "beard",
  "moustache",
  "glasses",
  "sunglasses",
  "old",
  "freckles",
];
const ACCENTS: NpcAccent[] = [
  "none",
  "apron",
  "vest",
  "scarf",
  "tie",
  "shawl",
  "lanyard",
  "backpack",
  "belt",
];
const PROPS: NpcProp[] = [
  "none",
  "mop",
  "broom",
  "bag",
  "shopping",
  "phone",
  "cigarette",
  "newspaper",
  "cane",
  "coffee",
  "clipboard",
  "umbrella",
  "flowers",
  "keys",
  "bottle",
];
const DOINGS: NonNullable<NpcSpec["doing"]>[] = [
  "standing",
  "working",
  "sitting",
  "leaning",
  "smoking",
  "waiting",
  "walking",
];
const SKINS = Object.keys(NPC_SKINS) as (keyof typeof NPC_SKINS)[];
const HAIRS = Object.keys(NPC_HAIRS) as (keyof typeof NPC_HAIRS)[];
const FABRICS = Object.keys(NPC_FABRICS) as FabricName[];

/** The animal knobs. Same shape as the people's, one rig further down. */
const SPECIES: AnimalSpecies[] = ["dog", "cat"];
const SIZES: AnimalSize[] = ["tiny", "small", "medium", "large"];
const BEHAVIOURS: AnimalDoing[] = [
  "standing",
  "sitting",
  "lying",
  "sleeping",
  "loafing",
  "prowling",
];
const EARSHAPES: AnimalEars[] = ["prick", "folded", "drop", "tufted"];
const TAILS: AnimalTail[] = ["curled", "plume", "whip", "stub", "bushy"];
const MUZZLES: AnimalMuzzle[] = ["short", "medium", "long"];
const COATS: AnimalCoat[] = ["short", "medium", "fluffy"];
const PATTERNS: AnimalPattern[] = ["solid", "tabby", "patched", "socks", "mask", "saddle"];
const FURS = Object.keys(ANIMAL_FURS) as FurName[];
const TRIMS = Object.keys(ANIMAL_TRIM) as TrimName[];
const COLLARS: (TrimName | "none")[] = ["none", ...TRIMS];
/** Most of the animals out there are nobody's, so most rolls wear nothing. */
const COLLAR_ODDS = 0.35;
const rollCollar = (): TrimName | undefined =>
  Math.random() < COLLAR_ODDS ? pick(TRIMS) : undefined;
/** A collar may be any colour at all; the dial only offers the trim table. */
const collarDial = (collar: AnimalLook["collar"]): TrimName | "none" =>
  collar && collar in ANIMAL_TRIM ? (collar as TrimName) : "none";

/**
 * The rosters are built when the studio opens, not when the module loads.
 * Enumerating either registry constructs every rig in it — 1.4 s for the
 * animals and 0.4 s for the cast on a production build — and this file is
 * only ever on screen when somebody asked for it.
 */
const kennelRoster = () => ANIMAL_IDS.map((id) => ANIMALS[id]);
const castRoster = () => NPC_IDS.map((id) => NPCS[id]);

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/**
 * The chrome PixelFrame cannot express on its own: panes that stretch to their
 * parent so a scroll region has something to be shorter than, the dial grid,
 * and a scrollbar cut from the same plate as the rest of the interface —
 * square, chunky, parchment on black, signal yellow under the thumb. It travels
 * with the component so the studio stays one file.
 */
const STUDIO_CSS = `
.studio-pane > span:last-child {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.studio-scroll { overscroll-behavior: contain; }
.studio-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
.studio-scroll::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
.studio-scroll::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.55);
  border-radius: 0;
  box-shadow: inset 1px 0 0 rgba(227,217,194,0.12), inset -1px 0 0 rgba(227,217,194,0.12);
}
.studio-scroll::-webkit-scrollbar-thumb {
  background: rgba(227,217,194,0.42);
  border-radius: 0;
  box-shadow: inset 0 2px 0 rgba(232,230,224,0.35), inset 0 -2px 0 rgba(0,0,0,0.55);
}
.studio-scroll::-webkit-scrollbar-thumb:hover { background: ${SIGNAL}; }
.studio-scroll::-webkit-scrollbar-corner { background: rgba(0,0,0,0.55); }
/* Chromium drops every ::-webkit-scrollbar rule the moment the standard
   properties appear on the same element, so Firefox gets its pair alone. */
@supports not selector(::-webkit-scrollbar) {
  .studio-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(227,217,194,0.42) rgba(0,0,0,0.55);
  }
}
.studio-dials {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 3px 14px;
}
.studio-group {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #090b10;
  padding: 3px 0 2px;
}
@media (min-height: ${ROOMY_HEIGHT}px) {
  .studio-dials { row-gap: 5px; }
  .studio-group { padding: 5px 0 3px; }
}
`;

/** PixelFrame's fill layer, turned into a column that can host a scroll region. */
const PANE_BODY: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flex: "1 1 auto",
  minHeight: 0,
};

/** Panel padding that clears the title plate straddling the top edge. */
const PANE_PAD = `${U * 6}px ${U * 3}px ${U * 3}px`;
const SMALL_PANE_PAD = "13px 8px 7px";

/** Short screens trade preview size for dial rows; a desk monitor gets both. */
function useRoomy() {
  const [roomy, setRoomy] = useState(() => window.innerHeight >= ROOMY_HEIGHT);
  useEffect(() => {
    const query = window.matchMedia(`(min-height: ${ROOMY_HEIGHT}px)`);
    const sync = () => setRoomy(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return roomy;
}

/** One NPC, animating, at whatever scale the caller has room for. */
function Portrait({ npc, scale = 2, action }: { npc: NpcConfig; scale?: number; action?: string }) {
  const frame = useNpcFrame(npc, action);
  return (
    <svg
      aria-hidden="true"
      width={npc.width * scale}
      height={npc.height * scale}
      viewBox={`0 0 ${npc.width} ${npc.height}`}
      className="pixelated block"
    >
      <PixelSprite map={frame} palette={npc.palette} cell={npc.cell ?? 2} />
    </svg>
  );
}

/**
 * The same, four-legged. A separate component and not a prop on `Portrait`
 * because the two rigs are separate all the way down: their frames come out of
 * different builders and are read by different hooks.
 */
function AnimalPortrait({
  animal,
  scale = 2,
  action,
}: {
  animal: AnimalConfig;
  scale?: number;
  action?: string;
}) {
  const frame = useAnimalFrame(animal, action);
  return (
    <svg
      aria-hidden="true"
      width={animal.width * scale}
      height={animal.height * scale}
      viewBox={`0 0 ${animal.width} ${animal.height}`}
      className="pixelated block"
    >
      <PixelSprite map={frame} palette={animal.palette} cell={animal.cell ?? 2} />
    </svg>
  );
}

/**
 * A portrait in a lit box, standing on the bottom of it. Every sprite in the
 * studio that is not the bare takes strip sits in one of these, so a tile in
 * the roster and a preview beside the dials are the same object at two sizes.
 */
function Stall({
  height,
  pad = 3,
  tone = "inset",
  onClick,
  ariaLabel,
  children,
}: {
  height: number;
  pad?: number;
  tone?: "inset" | "active";
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <PixelFrame
      u={2}
      tone={tone}
      rivets={false}
      scan={false}
      onClick={onClick}
      ariaLabel={ariaLabel}
    >
      <span
        className="flex items-end justify-center overflow-hidden"
        style={{ padding: pad, height }}
      >
        {children}
      </span>
    </PixelFrame>
  );
}

/** A labelled dial: ‹ value › — the whole interface of this studio. */
function Dial<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
}) {
  const step = (delta: number) => {
    const i = options.indexOf(value);
    onChange(options[(i + delta + options.length) % options.length]);
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <PixelLabel text={label} px={2} fill={PARCHMENT} opacity={0.5} />
      <div className="flex items-center gap-1">
        <PixelFrame
          u={2}
          tone="plate"
          rivets={false}
          scan={false}
          onClick={() => step(-1)}
          ariaLabel={`${label} previous`}
        >
          <span className="block" style={{ padding: "1px 5px" }}>
            <PixelLabel text="<" px={2} fill={PARCHMENT} />
          </span>
        </PixelFrame>
        <div style={{ minWidth: 74 }} className="text-center">
          <PixelLabel text={value.toUpperCase()} px={2} fill={SIGNAL} />
        </div>
        <PixelFrame
          u={2}
          tone="plate"
          rivets={false}
          scan={false}
          onClick={() => step(1)}
          ariaLabel={`${label} next`}
        >
          <span className="block" style={{ padding: "1px 5px" }}>
            <PixelLabel text=">" px={2} fill={PARCHMENT} />
          </span>
        </PixelFrame>
      </div>
    </div>
  );
}

/**
 * A drawer of the dial column. Twenty-five dials in one run is a list nobody
 * reads; in four named runs it is a form, and the heading stays put at the top
 * of the scroll so you always know which part of the person you are turning.
 */
function DialGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <div className="studio-group">
        <PixelLabel text={label} px={2} fill={SIGNAL} opacity={0.7} />
      </div>
      <div className="studio-dials">{children}</div>
    </section>
  );
}

/** How much of the left column a roster that hugs its content may ever take. */
const HUGGING_ROSTER_MAX = "42%";

/** The big pane on the left: everybody who already exists, doing their idle. */
function Roster({
  title,
  count,
  tile,
  fill = true,
  children,
}: {
  title: string;
  count: number;
  /** the narrowest a portrait tile may be — an animal is wider than a person */
  tile: number;
  /**
   * Whether the pane takes the whole column. Thirty people want all of it; five
   * animals in one row leave half the screen black, so the kennel hugs its
   * tiles and hands the height down to the takes.
   */
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <PixelFrame
      u={U}
      tone="panel"
      title={title}
      badge={`${count}`}
      className={`studio-pane flex min-h-0 flex-col ${fill ? "flex-1" : "shrink-0"}`}
      style={fill ? undefined : { maxHeight: HUGGING_ROSTER_MAX }}
      bodyStyle={PANE_BODY}
    >
      <div className="studio-scroll min-h-0 flex-1 overflow-y-auto" style={{ padding: PANE_PAD }}>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tile}px, 1fr))` }}
        >
          {children}
        </div>
      </div>
    </PixelFrame>
  );
}

/**
 * The strip under the roster: every animation the thing being built owns,
 * playing at once — the fastest way to see whether a new option broke a pose
 * somewhere — and beside it the spec, ready to paste.
 *
 * Both belong to the right-hand column by rights, but the dials need every
 * pixel of height they can get and a row of poses reads better wide than tall.
 */
function Readouts({
  height,
  wrap = false,
  takes,
  source,
  children,
}: {
  /** a fixed strip; left out, the row takes whatever the roster did not */
  height?: number;
  /** a tall pane fits a contact sheet, and an animal has twice the takes */
  wrap?: boolean;
  takes: number;
  source: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex gap-3 ${height === undefined ? "min-h-0 flex-1" : "shrink-0"}`}
      style={{ height }}
    >
      <PixelFrame
        u={2}
        tone="panel"
        title="TAKES"
        badge={`${takes}`}
        className="studio-pane flex min-w-0 grow flex-col"
        bodyStyle={PANE_BODY}
      >
        <div
          className={`studio-scroll flex min-h-0 flex-1 items-end gap-3 ${
            wrap ? "flex-wrap content-start overflow-y-auto" : "overflow-x-auto"
          }`}
          style={{ padding: SMALL_PANE_PAD }}
        >
          {children}
        </div>
      </PixelFrame>

      <PixelFrame
        u={2}
        tone="panel"
        title="SPEC"
        className="studio-pane flex shrink-0 flex-col"
        style={{ width: SPEC_W }}
        bodyStyle={PANE_BODY}
      >
        <pre
          className="studio-scroll min-h-0 flex-1 overflow-auto font-mono text-[9px] text-parchment/60 leading-tight"
          style={{ padding: SMALL_PANE_PAD }}
        >
          {source}
        </pre>
      </PixelFrame>
    </div>
  );
}

/**
 * The right-hand column: the thing being built at the top, the dials in the
 * one region allowed to be taller than the screen, and the two buttons pinned
 * to the bottom where a hand can always find them.
 */
function DialPanel({
  title,
  source,
  roll,
  rollLabel,
  preview,
  children,
}: {
  title: string;
  source: string;
  roll: () => void;
  rollLabel: string;
  preview: ReactNode;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <PixelFrame
      u={U}
      tone="panel"
      title={title}
      className="studio-pane flex shrink-0 flex-col"
      style={{ width: DIAL_PANEL_W }}
      bodyStyle={PANE_BODY}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2" style={{ padding: PANE_PAD }}>
        <div className="flex shrink-0 items-end justify-center gap-4">{preview}</div>

        {/* the one region that is allowed to be taller than the screen */}
        <div className="studio-scroll min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>

        <div className="flex shrink-0 gap-2">
          <PixelFrame
            u={2}
            tone="plate"
            rivets={false}
            scan={false}
            onClick={roll}
            ariaLabel="Random"
          >
            <span className="block" style={{ padding: "4px 10px" }}>
              <PixelLabel text={rollLabel} px={2} fill={SIGNAL} />
            </span>
          </PixelFrame>
          <PixelFrame
            u={2}
            tone="plate"
            rivets={false}
            scan={false}
            ariaLabel="Copy spec"
            onClick={() => {
              navigator.clipboard?.writeText(source);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            }}
          >
            <span className="block" style={{ padding: "4px 10px" }}>
              <PixelLabel text={copied ? "COPIED" : "COPY SPEC"} px={2} fill={PARCHMENT} />
            </span>
          </PixelFrame>
        </div>
      </div>
    </PixelFrame>
  );
}

const NEW_NEIGHBOUR: NpcSpec = {
  id: "nowy-sasiad",
  name: "Nowy Sąsiad",
  build: "regular",
  height: "average",
  doing: "standing",
  look: {
    skin: "fair",
    hair: "brown",
    hairStyle: "short",
    hat: "none",
    top: "tshirt",
    topColour: "navy",
    bottom: "trousers",
    bottomColour: "charcoal",
    shoes: "shoes",
    shoeColour: "black",
    accent: "none",
    accentColour: "cream",
    prop: "none",
  },
};

/**
 * A plain dog with nothing done to it. Every field the rig would default is
 * written out, so a dial always shows what the animal actually is rather than
 * a fallback that changes under it when the species does.
 */
const NEW_ANIMAL: AnimalSpec = {
  id: "nowy-zwierzak",
  name: "Zwierzak",
  species: "dog",
  size: "small",
  doing: "standing",
  look: {
    ears: "prick",
    tail: "plume",
    muzzle: "medium",
    coat: "short",
    fur: "sand",
    pattern: "solid",
    patch: "cream",
    belly: "cream",
    nose: "jet",
    eye: "hazel",
  },
};

/** The two rooms of the studio, and what the plate on the door says. */
const ROOMS = [
  { id: "cast", label: "CAST" },
  { id: "kennel", label: "KENNEL" },
] as const;
type Room = (typeof ROOMS)[number]["id"];

/** Two size tiers, one dial: what the preview and the takes strip may spend. */
function metrics(roomy: boolean) {
  return {
    previewBox: roomy ? 148 : SPRITE_H + 12,
    previewScale: roomy ? 1.8 : 1,
    takesRow: roomy ? 112 : 94,
    takeBox: roomy ? 58 : 44,
    takeScale: roomy ? 0.72 : 0.55,
    /**
     * The kennel is five animals and wants to be one row of them. A short
     * screen is also a narrow one, so the tiles come down until five of them
     * still stand side by side — a roster clipped through the middle of its
     * second row reads as a broken panel rather than as a scroll.
     */
    kennelTile: roomy ? KENNEL_TILE : 92,
    kennelScale: roomy ? KENNEL_SCALE : 1,
    kennelBox: roomy ? CAST_BOX : 60,
  };
}

/** The people. */
function CastFloor({
  roomy,
  spec,
  setSpec,
}: {
  roomy: boolean;
  spec: NpcSpec;
  setSpec: Dispatch<SetStateAction<NpcSpec>>;
}) {
  const cast = useMemo(castRoster, []);
  const npc = useMemo(() => createNpc(spec), [spec]);
  const actions = useMemo(() => Object.keys(npc.actions), [npc]);
  const set = useCallback(
    (patch: Partial<NpcSpec>) => setSpec((cur) => ({ ...cur, ...patch })),
    [setSpec],
  );
  const setLook = useCallback(
    (patch: Partial<NonNullable<NpcSpec["look"]>>) =>
      setSpec((cur) => ({ ...cur, look: { ...cur.look, ...patch } })),
    [setSpec],
  );

  const roll = () =>
    setSpec({
      id: NEW_NEIGHBOUR.id,
      name: NEW_NEIGHBOUR.name,
      build: pick(BUILDS),
      height: pick(HEIGHTS),
      doing: pick(DOINGS),
      look: {
        skin: pick(SKINS),
        hair: pick(HAIRS),
        hairStyle: pick(HAIRSTYLES),
        head: pick(HEADS),
        brow: pick(BROWS),
        eyeShape: pick(EYESHAPES),
        nose: pick(NOSES),
        mouth: pick(MOUTHS),
        ears: pick(EARS),
        face: rollFace(),
        hat: pick(HATS),
        hatColour: pick(FABRICS),
        top: pick(TOPS),
        topColour: pick(FABRICS),
        texture: pick(TEXTURES),
        bottom: pick(BOTTOMS),
        bottomColour: pick(FABRICS),
        shoes: pick(SHOEKINDS),
        shoeColour: pick(FABRICS),
        accent: pick(ACCENTS),
        accentColour: pick(FABRICS),
        prop: pick(PROPS),
      },
    });

  const source = useMemo(() => {
    const l = spec.look ?? {};
    const lines = Object.entries(l)
      .filter(([, v]) => v && v !== "none")
      .map(([k, v]) => `    ${k}: "${v}",`);
    return [
      `createNpc({`,
      `  id: "${spec.id}",`,
      `  name: "${spec.name}",`,
      `  build: "${spec.build}",`,
      `  height: "${spec.height}",`,
      `  doing: "${spec.doing}",`,
      `  look: {`,
      ...lines,
      `  },`,
      `})`,
    ].join("\n");
  }, [spec]);

  const { previewBox, previewScale, takesRow, takeBox, takeScale } = metrics(roomy);

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <Roster title="THE CAST" count={cast.length} tile={CAST_TILE}>
          {cast.map((member) => (
            <div key={member.id} className="flex flex-col items-center gap-1">
              <Stall height={CAST_BOX}>
                <Portrait npc={member} scale={CAST_SCALE} />
              </Stall>
              <PixelLabel text={member.name} px={1} fill={PARCHMENT} opacity={0.75} />
              <PixelLabel text={member.idleAction} px={1} fill={SIGNAL} opacity={0.55} />
            </div>
          ))}
        </Roster>

        <Readouts height={takesRow} takes={actions.length} source={source}>
          {actions.map((id) => (
            <div key={id} className="flex shrink-0 flex-col items-center gap-0.5">
              <span
                className="flex items-end justify-center overflow-hidden"
                style={{ height: takeBox }}
              >
                <Portrait npc={npc} scale={takeScale} action={id} />
              </span>
              <PixelLabel text={id} px={1} fill={PARCHMENT} opacity={0.55} />
            </div>
          ))}
        </Readouts>
      </div>

      <DialPanel
        title="NEW NEIGHBOUR"
        source={source}
        roll={roll}
        rollLabel="ROLL A STRANGER"
        preview={
          <>
            <Stall height={previewBox} pad={5}>
              <Portrait npc={npc} scale={previewScale} />
            </Stall>
            <Stall height={previewBox} pad={5}>
              <Portrait npc={npc} scale={previewScale} action="walk" />
            </Stall>
          </>
        }
      >
        <DialGroup label="BODY">
          <Dial
            label="BUILD"
            value={spec.build ?? "regular"}
            options={BUILDS}
            onChange={(v) => set({ build: v })}
          />
          <Dial
            label="HEIGHT"
            value={spec.height ?? "average"}
            options={HEIGHTS}
            onChange={(v) => set({ height: v })}
          />
          <Dial
            label="DOING"
            value={spec.doing ?? "standing"}
            options={DOINGS}
            onChange={(v) => set({ doing: v })}
          />
          <Dial
            label="SKIN"
            value={spec.look?.skin ?? "fair"}
            options={SKINS}
            onChange={(v) => setLook({ skin: v })}
          />
        </DialGroup>

        <DialGroup label="FACE">
          <Dial
            label="HAIR"
            value={spec.look?.hair ?? "brown"}
            options={HAIRS}
            onChange={(v) => setLook({ hair: v })}
          />
          <Dial
            label="STYLE"
            value={spec.look?.hairStyle ?? "short"}
            options={HAIRSTYLES}
            onChange={(v) => setLook({ hairStyle: v })}
          />
          <Dial
            label="HEAD"
            value={spec.look?.head ?? "oval"}
            options={HEADS}
            onChange={(v) => setLook({ head: v })}
          />
          <Dial
            label="BROW"
            value={spec.look?.brow ?? "flat"}
            options={BROWS}
            onChange={(v) => setLook({ brow: v })}
          />
          <Dial
            label="EYES"
            value={spec.look?.eyeShape ?? "normal"}
            options={EYESHAPES}
            onChange={(v) => setLook({ eyeShape: v })}
          />
          <Dial
            label="NOSE"
            value={spec.look?.nose ?? "straight"}
            options={NOSES}
            onChange={(v) => setLook({ nose: v })}
          />
          <Dial
            label="MOUTH"
            value={spec.look?.mouth ?? "neutral"}
            options={MOUTHS}
            onChange={(v) => setLook({ mouth: v })}
          />
          <Dial
            label="EARS"
            value={spec.look?.ears ?? "flat"}
            options={EARS}
            onChange={(v) => setLook({ ears: v })}
          />
          <Dial
            label="FACE"
            value={faceDial(spec.look?.face)}
            options={FACES}
            onChange={(v) => setLook({ face: v === "none" ? undefined : v })}
          />
        </DialGroup>

        <DialGroup label="CLOTHES">
          <Dial
            label="HAT"
            value={spec.look?.hat ?? "none"}
            options={HATS}
            onChange={(v) => setLook({ hat: v })}
          />
          <Dial
            label="HAT COL"
            value={spec.look?.hatColour ?? "navy"}
            options={FABRICS}
            onChange={(v) => setLook({ hatColour: v })}
          />
          <Dial
            label="TOP"
            value={spec.look?.top ?? "tshirt"}
            options={TOPS}
            onChange={(v) => setLook({ top: v })}
          />
          <Dial
            label="WEAVE"
            value={spec.look?.texture ?? "none"}
            options={TEXTURES}
            onChange={(v) => setLook({ texture: v })}
          />
          <Dial
            label="TOP COL"
            value={spec.look?.topColour ?? "navy"}
            options={FABRICS}
            onChange={(v) => setLook({ topColour: v })}
          />
          <Dial
            label="BOTTOM"
            value={spec.look?.bottom ?? "trousers"}
            options={BOTTOMS}
            onChange={(v) => setLook({ bottom: v })}
          />
          <Dial
            label="BOT COL"
            value={spec.look?.bottomColour ?? "charcoal"}
            options={FABRICS}
            onChange={(v) => setLook({ bottomColour: v })}
          />
          <Dial
            label="SHOES"
            value={spec.look?.shoes ?? "shoes"}
            options={SHOEKINDS}
            onChange={(v) => setLook({ shoes: v })}
          />
          <Dial
            label="SHOE COL"
            value={spec.look?.shoeColour ?? "black"}
            options={FABRICS}
            onChange={(v) => setLook({ shoeColour: v })}
          />
          <Dial
            label="ACCENT"
            value={spec.look?.accent ?? "none"}
            options={ACCENTS}
            onChange={(v) => setLook({ accent: v })}
          />
          <Dial
            label="ACC COL"
            value={spec.look?.accentColour ?? "cream"}
            options={FABRICS}
            onChange={(v) => setLook({ accentColour: v })}
          />
          <Dial
            label="PROP"
            value={spec.look?.prop ?? "none"}
            options={PROPS}
            onChange={(v) => setLook({ prop: v })}
          />
        </DialGroup>
      </DialPanel>
    </div>
  );
}

/** The animals. Same bench, four legs. */
function KennelFloor({
  roomy,
  spec,
  setSpec,
}: {
  roomy: boolean;
  spec: AnimalSpec;
  setSpec: Dispatch<SetStateAction<AnimalSpec>>;
}) {
  const kennel = useMemo(kennelRoster, []);
  /**
   * The take the second preview is playing. Kept as a wish rather than as a
   * fact: a cat has no `bark`, so what is actually shown is whatever this
   * animal can do, and flipping back to a dog finds the bark still selected.
   */
  const [wanted, setWanted] = useState("walk");

  const animal = useMemo(() => createAnimal(spec), [spec]);
  const actions = useMemo(() => Object.keys(animal.actions), [animal]);
  const take = animal.actions[wanted] ? wanted : animal.idleAction;

  const set = useCallback(
    (patch: Partial<AnimalSpec>) => setSpec((cur) => ({ ...cur, ...patch })),
    [setSpec],
  );
  const setLook = useCallback(
    (patch: Partial<AnimalLook>) => setSpec((cur) => ({ ...cur, look: { ...cur.look, ...patch } })),
    [setSpec],
  );

  const roll = () =>
    setSpec({
      id: NEW_ANIMAL.id,
      name: NEW_ANIMAL.name,
      species: pick(SPECIES),
      size: pick(SIZES),
      doing: pick(BEHAVIOURS),
      look: {
        ears: pick(EARSHAPES),
        tail: pick(TAILS),
        muzzle: pick(MUZZLES),
        coat: pick(COATS),
        fur: pick(FURS),
        pattern: pick(PATTERNS),
        patch: pick(FURS),
        belly: pick(FURS),
        nose: pick(TRIMS),
        eye: pick(TRIMS),
        collar: rollCollar(),
      },
    });

  const source = useMemo(() => {
    const l = spec.look ?? {};
    const lines = Object.entries(l)
      .filter(([, v]) => v && v !== "none")
      .map(([k, v]) => `    ${k}: "${v}",`);
    return [
      `createAnimal({`,
      `  id: "${spec.id}",`,
      `  name: "${spec.name}",`,
      `  species: "${spec.species}",`,
      `  size: "${spec.size}",`,
      `  doing: "${spec.doing}",`,
      `  look: {`,
      ...lines,
      `  },`,
      `})`,
    ].join("\n");
  }, [spec]);

  const { previewBox, previewScale, takeBox, takeScale, kennelTile, kennelScale, kennelBox } =
    metrics(roomy);

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <Roster title="THE KENNEL" count={kennel.length} tile={kennelTile} fill={false}>
          {kennel.map((member) => (
            <div key={member.id} className="flex flex-col items-center gap-1">
              <Stall height={kennelBox}>
                <AnimalPortrait animal={member} scale={kennelScale} />
              </Stall>
              <PixelLabel text={member.name} px={1} fill={PARCHMENT} opacity={0.75} />
              <PixelLabel text={member.idleAction} px={1} fill={SIGNAL} opacity={0.55} />
            </div>
          ))}
        </Roster>

        {/* the whole vocabulary of this animal, and a click puts one of them in
            the preview — a dog and a cat do not own the same list, so the strip
            is whatever the built config actually has. Thirty-seven of them do
            not fit in a strip, hence the sheet. */}
        <Readouts wrap takes={actions.length} source={source}>
          {actions.map((id) => (
            <div key={id} className="flex shrink-0 flex-col items-center gap-0.5">
              <Stall
                height={takeBox}
                tone={id === take ? "active" : "inset"}
                onClick={() => setWanted(id)}
                ariaLabel={`Take ${id}`}
              >
                <AnimalPortrait animal={animal} scale={takeScale} action={id} />
              </Stall>
              <PixelLabel
                text={id}
                px={1}
                fill={id === take ? SIGNAL : PARCHMENT}
                opacity={id === take ? 0.9 : 0.55}
              />
            </div>
          ))}
        </Readouts>
      </div>

      <DialPanel
        title="NEW ANIMAL"
        source={source}
        roll={roll}
        rollLabel="ROLL A STRAY"
        preview={
          <>
            <div className="flex flex-col items-center gap-1">
              <Stall height={previewBox} pad={5}>
                <AnimalPortrait animal={animal} scale={previewScale} />
              </Stall>
              <PixelLabel text={animal.idleAction} px={1} fill={PARCHMENT} opacity={0.55} />
            </div>
            <div className="flex flex-col items-center gap-1">
              <Stall height={previewBox} pad={5}>
                <AnimalPortrait animal={animal} scale={previewScale} action={take} />
              </Stall>
              <PixelLabel text={take} px={1} fill={SIGNAL} opacity={0.7} />
            </div>
          </>
        }
      >
        <DialGroup label="BODY">
          <Dial
            label="SPECIES"
            value={spec.species}
            options={SPECIES}
            onChange={(v) => set({ species: v })}
          />
          <Dial
            label="SIZE"
            value={spec.size ?? "small"}
            options={SIZES}
            onChange={(v) => set({ size: v })}
          />
          <Dial
            label="DOING"
            value={spec.doing ?? "standing"}
            options={BEHAVIOURS}
            onChange={(v) => set({ doing: v })}
          />
          <Dial
            label="EARS"
            value={spec.look?.ears ?? "prick"}
            options={EARSHAPES}
            onChange={(v) => setLook({ ears: v })}
          />
          <Dial
            label="TAIL"
            value={spec.look?.tail ?? "plume"}
            options={TAILS}
            onChange={(v) => setLook({ tail: v })}
          />
          <Dial
            label="MUZZLE"
            value={spec.look?.muzzle ?? "medium"}
            options={MUZZLES}
            onChange={(v) => setLook({ muzzle: v })}
          />
        </DialGroup>

        <DialGroup label="COAT">
          <Dial
            label="LENGTH"
            value={spec.look?.coat ?? "short"}
            options={COATS}
            onChange={(v) => setLook({ coat: v })}
          />
          <Dial
            label="PATTERN"
            value={spec.look?.pattern ?? "solid"}
            options={PATTERNS}
            onChange={(v) => setLook({ pattern: v })}
          />
          <Dial
            label="FUR"
            value={spec.look?.fur ?? "sand"}
            options={FURS}
            onChange={(v) => setLook({ fur: v })}
          />
          <Dial
            label="PATCH"
            value={spec.look?.patch ?? "cream"}
            options={FURS}
            onChange={(v) => setLook({ patch: v })}
          />
          <Dial
            label="BELLY"
            value={spec.look?.belly ?? "cream"}
            options={FURS}
            onChange={(v) => setLook({ belly: v })}
          />
        </DialGroup>

        <DialGroup label="TRIM">
          <Dial
            label="NOSE"
            value={spec.look?.nose ?? "jet"}
            options={TRIMS}
            onChange={(v) => setLook({ nose: v })}
          />
          <Dial
            label="EYE"
            value={spec.look?.eye ?? "hazel"}
            options={TRIMS}
            onChange={(v) => setLook({ eye: v })}
          />
          <Dial
            label="COLLAR"
            value={collarDial(spec.look?.collar)}
            options={COLLARS}
            onChange={(v) => setLook({ collar: v === "none" ? undefined : v })}
          />
        </DialGroup>
      </DialPanel>
    </div>
  );
}

export function NpcStudio({ onClose }: { onClose: () => void }) {
  const [room, setRoom] = useState<Room>("cast");
  /**
   * Both specs live up here so that walking into the other room and back does
   * not throw away twenty turned dials, which is a quarter of an hour's work.
   */
  const [npcSpec, setNpcSpec] = useState<NpcSpec>(NEW_NEIGHBOUR);
  const [animalSpec, setAnimalSpec] = useState<AnimalSpec>(NEW_ANIMAL);
  const roomy = useRoomy();

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col gap-2 overflow-hidden bg-[#05060a]/97"
      style={{ padding: U * 3 }}
    >
      <style>{STUDIO_CSS}</style>

      <div className="flex shrink-0 items-center gap-2">
        <PixelFrame u={U} tone="active" rivets={false} scan={false}>
          <span className="block" style={{ padding: `${U}px ${U * 3}px` }}>
            <PixelLabel text="CASTING STUDIO" px={2} fill={SIGNAL} />
          </span>
        </PixelFrame>

        {ROOMS.map((door) => {
          const here = door.id === room;
          return (
            <PixelFrame
              key={door.id}
              u={U}
              tone={here ? "active" : "plate"}
              rivets={false}
              scan={false}
              onClick={() => setRoom(door.id)}
              ariaLabel={door.label}
            >
              <span className="block" style={{ padding: `${U}px ${U * 3}px` }}>
                <PixelLabel
                  text={door.label}
                  px={2}
                  fill={here ? SIGNAL : PARCHMENT}
                  opacity={here ? 1 : 0.55}
                />
              </span>
            </PixelFrame>
          );
        })}

        <span className="grow" />
        <PixelFrame
          u={U}
          tone="plate"
          rivets={false}
          scan={false}
          onClick={onClose}
          ariaLabel="Close"
        >
          <span className="block" style={{ padding: `${U}px ${U * 3}px` }}>
            <PixelLabel text="CLOSE" px={2} fill={PARCHMENT} opacity={0.6} />
          </span>
        </PixelFrame>
      </div>

      {room === "cast" ? (
        <CastFloor roomy={roomy} spec={npcSpec} setSpec={setNpcSpec} />
      ) : (
        <KennelFloor roomy={roomy} spec={animalSpec} setSpec={setAnimalSpec} />
      )}
    </div>
  );
}
