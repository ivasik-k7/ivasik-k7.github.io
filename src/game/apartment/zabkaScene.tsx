import { DrinkFridge, LayeredScene, px, type SceneDef, ShopShelf, stripes } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import { NpcMonologue } from "./NpcMonologue";

/**
 * Żabka — the real osiedlowa kind. Six meters of everything: coffee
 * machine hissing, fridge doors that actually open, a freezer of lody,
 * a queue of exactly one Pan Zbyszek, a kid negotiating with the pudding
 * shelf, and the cashier announcing the till to nobody in particular.
 */

const ZW = 640;

const Z = {
  green: "#0a6b3c",
  greenHi: "#0d7d46",
  wallUp: "#eef2ee",
  wall: "#e4ece6",
  wainscot: "#c9d4cc",
  tile: "#d8dcd9",
  tileSeam: "#b8beba",
  steel: "#9aa0a8",
  steelDark: "#6d7278",
  wood: "#d4a574",
  woodHi: "#e0c49a",
  white: "#f2f2ee",
  glassCold: "#b8e6ff",
  glassColdHi: "#dff4ff",
  skin: "#e0b48c",
  skinShade: "#c79a72",
  shadow: "#00000030",
};

// ---------------------------------------------------------------------------
// people in the shop
// ---------------------------------------------------------------------------

/** Pan Zbyszek in the queue: basket, beer, bread, patience. */
function Zbyszek({ x }: { x: number }) {
  return (
    <g>
      {px(x - 3, 148, 26, 3, "#00000044")}
      {/* bald crown, honest ears */}
      {px(x + 4, 82, 12, 4, S(Z.skin, 0))}
      {px(x + 3, 85, 14, 9, Z.skin)}
      {px(x + 3, 90, 14, 3, Z.skinShade)}
      {px(x + 5, 87, 2, 2, "#3d2a1a")}
      {px(x + 11, 87, 2, 2, "#3d2a1a")}
      {px(x + 7, 92, 6, 1, "#b08668")}
      {/* fleece vest over flannel — the osiedle uniform */}
      {px(x + 1, 95, 18, 24, "#7a5a48")}
      {px(x + 1, 95, 18, 2, "#8a6a56")}
      {px(x + 4, 97, 12, 20, "#5d6b5d")}
      {px(x + 9, 97, 2, 18, "#4d5a50")}
      {px(x + 15, 97, 4, 20, "#6a4d3e")}
      {/* right arm holds the basket */}
      {px(x + 17, 108, 4, 8, Z.skin)}
      {/* trousers + shoes on the tile */}
      {px(x + 4, 119, 6, 26, "#4a4d52")}
      {px(x + 11, 119, 6, 26, "#4a4d52")}
      {px(x + 3, 145, 8, 5, "#2e3033")}
      {px(x + 11, 145, 8, 5, "#2e3033")}
      {/* the basket: green plastic, beer + bread visible */}
      {px(x + 16, 116, 20, 12, Z.green)}
      {px(x + 17, 118, 18, 2, Z.greenHi)}
      {px(x + 19, 110, 5, 8, "#c9a24b")}
      {px(x + 26, 111, 6, 7, "#a3542f")}
      {px(x + 15, 114, 22, 2, Z.greenHi)}
    </g>
  );
}

/** helper so biome doesn't fold the bald-crown line */
function S(color: string, _n: number) {
  return color;
}

/** The kid at the pudding shelf, mid-negotiation with fate. */
function Kid({ x }: { x: number }) {
  return (
    <g>
      {px(x - 2, 148, 20, 3, "#00000033")}
      {/* bowl cut + cap backwards */}
      {px(x + 2, 100, 12, 4, "#c94040")}
      {px(x + 12, 102, 4, 3, "#c94040")}
      {px(x + 3, 104, 10, 7, Z.skin)}
      {px(x + 3, 108, 10, 3, Z.skinShade)}
      {px(x + 5, 106, 2, 2, "#3d2a1a")}
      {px(x + 9, 106, 2, 2, "#3d2a1a")}
      {/* oversized hoodie */}
      {px(x, 111, 16, 16, "#4a90d9")}
      {px(x, 111, 16, 2, "#5a9ce0")}
      {px(x + 12, 113, 4, 14, "#3a7cbf")}
      {/* one arm reaching toward the shelf */}
      {px(x + 14, 114, 6, 4, "#4a90d9")}
      {px(x + 19, 114, 3, 4, Z.skin)}
      {/* little legs, light-up sneakers */}
      {px(x + 3, 127, 5, 18, "#2e3033")}
      {px(x + 9, 127, 5, 18, "#2e3033")}
      {px(x + 2, 145, 7, 5, Z.white)}
      {px(x + 9, 145, 7, 5, Z.white)}
      {px(x + 2, 148, 7, 1, "#4a90d9")}
      {px(x + 9, 148, 7, 1, "#c94040")}
    </g>
  );
}

/** The cashier at her post: green apron, scanning something eternal. */
function Cashier({ x }: { x: number }) {
  return (
    <g>
      {/* ponytail + tired kind face */}
      {px(x + 2, 76, 14, 5, "#5d4a37")}
      {px(x + 15, 79, 3, 8, "#5d4a37")}
      {px(x + 3, 81, 12, 9, Z.skin)}
      {px(x + 3, 86, 12, 3, Z.skinShade)}
      {px(x + 5, 83, 2, 2, "#3d2a1a")}
      {px(x + 10, 83, 2, 2, "#3d2a1a")}
      {px(x + 6, 88, 5, 1, "#b08668")}
      {/* green apron over stripes */}
      {px(x, 91, 18, 16, Z.green)}
      {px(x, 91, 18, 2, Z.greenHi)}
      {px(x + 7, 94, 4, 3, Z.white)}
      {/* arms at the scanner */}
      {px(x - 3, 95, 4, 9, Z.skin)}
      {px(x + 17, 95, 4, 9, Z.skin)}
      {/* the item in hand blinks across the red eye of the scanner */}
      <rect x={x - 5} y={100} width={5} height={4} fill="#c9a24b">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; -4 2; 0 0; 0 0"
          dur="5.2s"
          repeatCount="indefinite"
        />
      </rect>
    </g>
  );
}

// ---------------------------------------------------------------------------
// furniture with temperature
// ---------------------------------------------------------------------------

/** Upright drinks fridge with a door that actually swings. */
function OpenableFridge({ x, open }: { x: number; open: boolean }) {
  return (
    <g>
      {px(x - 2, 148, 36, 3, Z.shadow)}
      <DrinkFridge x={x} />
      {open ? (
        <g>
          {/* door swung: glass pane angled out to the left + cold spill */}
          {px(x - 14, 72, 12, 78, "#dfe5e8")}
          {px(x - 12, 76, 8, 66, Z.glassColdHi)}
          {px(x - 12, 76, 2, 66, Z.white)}
          {px(x - 1, 76, 3, 70, Z.steelDark)}
          {px(x - 10, 148, 44, 3, "#b8e6ff44")}
          <rect x={x + 2} y={76} width={26} height={66} fill="#dff4ff" opacity={0.25}>
            <animate
              attributeName="opacity"
              values="0.25;0.15;0.25"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : (
        <g>
          {/* closed: reflection + handle */}
          {px(x + 4, 78, 4, 62, "#ffffff44")}
          {px(x + 26, 100, 3, 14, Z.steelDark)}
        </g>
      )}
    </g>
  );
}

/** Chest freezer of lody — the shrine. Lid slides with state. */
function LodyFreezer({ x, open }: { x: number; open: boolean }) {
  return (
    <g>
      {px(x - 2, 148, 52, 3, Z.shadow)}
      {px(x, 112, 48, 38, Z.white)}
      {px(x, 112, 48, 2, "#ffffff")}
      {px(x + 2, 140, 44, 8, "#dfe5e8")}
      {/* branding: KORAL-ish waves */}
      {px(x + 6, 126, 36, 6, "#4a90d9")}
      {px(x + 8, 128, 8, 2, Z.white)}
      {px(x + 20, 128, 8, 2, Z.white)}
      {px(x + 32, 128, 8, 2, Z.white)}
      {open ? (
        <g>
          {/* lid slid back; frosty depths + lody sticking out */}
          {px(x + 2, 106, 44, 8, Z.glassCold)}
          {px(x + 4, 108, 40, 4, Z.glassColdHi)}
          {px(x + 8, 102, 6, 8, "#c94040")}
          {px(x + 18, 100, 6, 10, "#e8c445")}
          {px(x + 28, 103, 6, 7, "#7a5a48")}
          {px(x + 38, 112, 3, 3, Z.glassColdHi)}
          <rect x={x + 2} y={96} width={44} height={16} fill="#dff4ff" opacity={0.2}>
            <animate
              attributeName="opacity"
              values="0.2;0.08;0.2"
              dur="3s"
              repeatCount="indefinite"
            />
          </rect>
        </g>
      ) : (
        <g>
          {px(x + 2, 106, 44, 8, "#e8f4f8")}
          {px(x + 2, 106, 44, 2, Z.white)}
          {px(x + 20, 108, 8, 3, Z.steelDark)}
        </g>
      )}
    </g>
  );
}

/** Żabka Café corner: the machine that makes the whole shop smell right. */
function CoffeeMachine({ x }: { x: number }) {
  return (
    <g>
      {px(x, 82, 30, 34, "#2e3033")}
      {px(x, 82, 30, 3, "#3f4246")}
      {px(x + 4, 88, 22, 8, "#c94040")}
      {px(x + 7, 90, 16, 4, Z.white)}
      {px(x + 10, 100, 10, 6, Z.steelDark)}
      {px(x + 13, 106, 4, 4, Z.steel)}
      {/* cups pyramid */}
      {px(x + 34, 100, 6, 8, "#a3542f")}
      {px(x + 33, 98, 8, 3, "#c9863f")}
      {px(x + 42, 104, 5, 6, "#a3542f")}
      {/* counter under it */}
      {px(x - 4, 116, 54, 6, Z.wood)}
      {px(x - 4, 116, 54, 2, Z.woodHi)}
      {px(x - 2, 122, 6, 28, Z.steelDark)}
      {px(x + 42, 122, 6, 28, Z.steelDark)}
    </g>
  );
}

// ---------------------------------------------------------------------------
// the scene
// ---------------------------------------------------------------------------

function ZabkaScene({ world }: { world: WorldState }) {
  const z = world.zabka;
  return (
    <LayeredScene
      parallax={{ middleBackground: 1 }}
      middleBackground={
        <g>
          {/* bright ceiling, tubes, hanging promo boards */}
          {px(0, 0, ZW, 42, Z.wallUp)}
          {px(0, 42, ZW, 3, "#d0d8d2")}
          {px(70, 38, 60, 4, "#f5faf7")}
          {px(230, 38, 60, 4, "#f5faf7")}
          {px(390, 38, 60, 4, "#f5faf7")}
          {px(540, 38, 60, 4, "#f5faf7")}
          {/* hanging signs: HOT DOG / KAWA / LODY */}
          {px(150, 42, 2, 12, Z.steelDark)}
          {px(128, 54, 48, 14, Z.green)}
          {px(132, 58, 40, 3, Z.white)}
          {px(132, 63, 26, 2, Z.white)}
          {px(320, 42, 2, 12, Z.steelDark)}
          {px(300, 54, 44, 14, "#c94040")}
          {px(304, 58, 36, 3, Z.white)}
          {px(304, 63, 22, 2, Z.white)}
          {px(490, 42, 2, 12, Z.steelDark)}
          {px(470, 54, 44, 14, "#4a90d9")}
          {px(474, 58, 36, 3, Z.white)}
          {/* walls: white up top, green wainscot line, grey base */}
          {px(0, 45, ZW, 60, Z.wall)}
          {px(0, 102, ZW, 3, Z.green)}
          {px(0, 105, ZW, 45, Z.wainscot)}
          {/* back-wall poster strip behind the queue */}
          {px(430, 70, 30, 24, "#e8c445")}
          {px(434, 74, 22, 8, "#c94040")}
          {px(466, 70, 30, 24, "#4a90d9")}
          {px(470, 74, 22, 8, Z.white)}
        </g>
      }
      ground={
        <g>
          {px(0, 150, ZW, 30, Z.tile)}
          {px(0, 150, ZW, 2, "#00000022")}
          {stripes(ZW, 150, 30, 64, Z.tileSeam, 32)}
          {px(0, 165, ZW, 1, Z.tileSeam)}
          {/* mopped sheen by the door, wet in cold weather */}
          {px(40, 156, 70, 1, "#eef2ee")}
          {px(300, 161, 60, 1, "#eef2ee")}
        </g>
      }
      staticObjects={
        <g>
          {/* newspaper & lottery rack by the door */}
          {px(64, 100, 22, 50, Z.steel)}
          {px(66, 104, 18, 10, "#e3d9c2")}
          {px(66, 118, 18, 10, "#d8cfb8")}
          {px(66, 132, 18, 10, "#c94040")}
          {px(68, 134, 14, 4, Z.white)}
          {/* bread shelf: wicker baskets, the smell you can almost hear */}
          {px(96, 96, 40, 54, Z.wood)}
          {px(96, 96, 40, 2, Z.woodHi)}
          {px(100, 102, 32, 10, "#c9a24b")}
          {px(102, 104, 12, 6, "#a3542f")}
          {px(116, 104, 12, 6, "#c9863f")}
          {px(100, 120, 32, 10, "#c9a24b")}
          {px(104, 122, 10, 6, "#a3542f")}
          {px(100, 138, 32, 8, "#b8935f")}
          <CoffeeMachine x={150} />
          {/* pudding & sweets low shelf — the kid's opponent */}
          {px(216, 108, 44, 42, Z.wood)}
          {px(216, 108, 44, 2, Z.woodHi)}
          {px(220, 112, 8, 8, "#c94040")}
          {px(230, 112, 8, 8, "#e8c445")}
          {px(240, 112, 8, 8, "#d478a8")}
          {px(220, 126, 8, 8, "#4a90d9")}
          {px(230, 126, 8, 8, "#c94040")}
          {px(240, 126, 8, 8, "#5f7a63")}
          {px(216, 140, 44, 4, "#b8935f")}
          <Kid x={262} />
          {/* wet floor cone — Natalia's cousin works here */}
          {px(322, 128, 3, 22, "#e8c445")}
          {px(312, 148, 24, 2, "#e8c445")}
          {px(316, 132, 14, 8, "#3a3833")}
          <Zbyszek x={470} />
          <Cashier x={532} />
        </g>
      }
      gameplayObjects={
        <g>
          {/* glass door to the street, chime bell above */}
          {px(14, 68, 38, 82, Z.green)}
          {px(18, 72, 30, 78, "#39434c")}
          {px(20, 74, 26, 72, "#404b55")}
          {px(42, 106, 3, 9, Z.steel)}
          {px(24, 64, 8, 6, "#c9a24b")}
          {px(26, 70, 4, 2, "#8a6d2f")}
          <ShopShelf x={352} />
          <ShopShelf x={398} tint="#c9a06a" />
          <OpenableFridge x={186} open={z.fridgeOpen} />
          <LodyFreezer x={288} open={z.freezerOpen} />
          {/* kasa: belt, till, cigarette wall behind */}
          {px(506, 108, 60, 8, "#e0e5e2")}
          {px(506, 116, 60, 34, "#4d5a50")}
          {px(506, 116, 60, 2, "#5f7a63")}
          {px(548, 92, 16, 16, "#3a4148")}
          {px(550, 96, 12, 6, "#7ee08c")}
          {/* scanner's red eye */}
          {px(524, 104, 6, 4, "#2e3033")}
          <rect x={526} y={105} width={2} height={2} fill="#ff4050">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </rect>
          {/* cigarette cabinet + energy shots behind the till */}
          {px(576, 62, 52, 50, "#8a7452")}
          {px(578, 64, 48, 9, "#e3d9c2")}
          {px(578, 75, 48, 9, "#d8cfb8")}
          {px(578, 86, 48, 9, "#e3d9c2")}
          {px(578, 97, 48, 9, "#d8cfb8")}
          {px(576, 116, 52, 10, "#3a4148")}
          {px(580, 118, 8, 6, "#e8c445")}
          {px(592, 118, 8, 6, "#c94040")}
          {px(604, 118, 8, 6, "#4a90d9")}
        </g>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// effects: monologues + cold breath of the fridge aisle
// ---------------------------------------------------------------------------

const CASHIER_MONOLOGUES = [
  "Kasa numer dwa zaprasza... znaczy ta sama kasa.",
  "Paragon? Nikt nie chce paragonu. Nigdy.",
  "Zaraz przerwa. Za cztery godziny.",
] as const;

const ZBYSZEK_MONOLOGUES = [
  "Tylko piwo i chleb. No i może coś jeszcze.",
  "W promocji, nie w promocji... i tak wezmę.",
  "Kiedyś tu był warzywniak. Pomidory pachniały.",
] as const;

const KID_MONOLOGUES = [
  "Mama powiedziała nie... ale nie powiedziała ile razy nie.",
  "Budyń czekoladowy czy waniliowy... czekoladowy. Nie. Tak.",
  "Jak zjem przed domem, to się nie liczy.",
] as const;

function ZabkaEffects({
  scale,
  dialogueOpen,
}: {
  world: WorldState;
  phase: string;
  fx: import("@/engine").FxInstance[];
  scale: number;
  actionUi: string | null;
  moving: boolean;
  dialogueOpen: boolean;
}) {
  return (
    <>
      <NpcMonologue
        x={541}
        headY={72}
        scale={scale}
        speaker="Cashier"
        lines={CASHIER_MONOLOGUES}
        muted={dialogueOpen}
      />
      <NpcMonologue
        x={480}
        headY={78}
        scale={scale}
        speaker="Pan Zbyszek"
        lines={ZBYSZEK_MONOLOGUES}
        muted={dialogueOpen}
      />
      <NpcMonologue
        x={270}
        headY={96}
        scale={scale}
        speaker="Kid"
        lines={KID_MONOLOGUES}
        muted={dialogueOpen}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// scene definition
// ---------------------------------------------------------------------------

export const ZABKA_SCENE: SceneDef<WorldState> = {
  id: "zabka",
  width: ZW,
  objects: [
    { id: "shop-door", kind: "creakdoor", x: 33, range: 20, to: { scene: "outside", spawnX: 482 } },
    { id: "press-rack", kind: "flavor", x: 75, range: 12 },
    { id: "bread", kind: "flavor", x: 116, range: 16 },
    { id: "coffee", kind: "coffee", x: 165, range: 18 },
    { id: "drinks-fridge", kind: "zfridge", x: 201, range: 18 },
    { id: "sweets", kind: "flavor", x: 238, range: 14 },
    { id: "kid", kind: "flavor", x: 270, range: 14 },
    { id: "lody", kind: "zfreezer", x: 312, range: 18 },
    { id: "shelf-snacks", kind: "flavor", x: 374, range: 18 },
    { id: "shelf-grocery", kind: "flavor", x: 420, range: 18 },
    { id: "zbyszek", kind: "npc", x: 480, range: 18 },
    { id: "kasa", kind: "cashier", x: 520, range: 22, face: 1 },
  ],
  Component: ({ world }) => <ZabkaScene world={world} />,
  darkness: () => 0,
  Effects: ZabkaEffects,
  Foreground: () => (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox={`0 0 ${ZW} 180`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0"
    >
      <g shapeRendering="crispEdges">
        {/* a near-aisle endcap slides past the camera */}
        {px(96, 154, 60, 26, "#c9a06a")}
        {px(96, 154, 60, 3, "#e0c49a")}
        {px(102, 160, 12, 10, "#c94040")}
        {px(118, 160, 12, 10, "#e8c445")}
        {px(134, 160, 12, 10, "#4a90d9")}
        {px(470, 158, 80, 22, "#4d5a50")}
        {px(470, 158, 80, 3, "#5f7a63")}
      </g>
    </svg>
  ),
};
