import type { ReactNode } from "react";
import { px } from "./artkit";

/**
 * Prop library — post-Soviet street & stairwell furniture, hand-pixelled.
 * Every prop takes an `x` (left edge unless noted) and sits on the floor
 * line (y=150) or hangs at its natural height. Muted cinematic palette.
 */

const P = {
  concrete: "#9a958b",
  concreteDark: "#7d786e",
  concreteLight: "#b0aba0",
  panelSeam: "#6b665e",
  paintGreen: "#5f7a63",
  paintGreenDark: "#4d6350",
  whitewash: "#c9c4b6",
  rust: "#8a5a3a",
  metal: "#9aa0a8",
  metalDark: "#6d7278",
  wood: "#8a623f",
  woodDark: "#5d4128",
  glassDark: "#2a3138",
  glassLit: "#ffd98a",
  asphalt: "#5d5a55",
  zabkaGreen: "#0a6b3c",
  zabkaLight: "#e8f4ec",
  doorway: "#1a1520",
};

/** Five-storey panel block for far/middle backgrounds. ~90 wide. */
export function PanelBlock({
  x,
  y = 20,
  storeys = 5,
  litWindows = [],
}: {
  x: number;
  y?: number;
  storeys?: number;
  litWindows?: number[];
}) {
  const h = storeys * 22;
  const rows: ReactNode[] = [];
  for (let s = 0; s < storeys; s++) {
    const wy = y + 6 + s * 22;
    for (let c = 0; c < 4; c++) {
      const wx = x + 8 + c * 21;
      const idx = s * 4 + c;
      rows.push(px(wx, wy, 9, 12, litWindows.includes(idx) ? P.glassLit : P.glassDark, `w${idx}`));
      rows.push(px(wx, wy + 5, 9, 1, P.concreteDark, `wb${idx}`));
    }
    rows.push(px(x, y + s * 22, 90, 1, P.panelSeam, `seam${s}`));
  }
  return (
    <g>
      {px(x, y, 90, h, P.concrete)}
      {px(x, y, 3, h, P.concreteLight)}
      {px(x + 87, y, 3, h, P.concreteDark)}
      {rows}
      {px(x - 2, y - 4, 94, 4, P.concreteDark)}
    </g>
  );
}

/** Wooden bench on concrete legs. ~44 wide, seat at y=132. */
export function Bench({ x }: { x: number }) {
  return (
    <g>
      {px(x + 4, 128, 4, 22, P.concreteDark)}
      {px(x + 36, 128, 4, 22, P.concreteDark)}
      {px(x, 124, 44, 5, P.wood)}
      {px(x, 124, 44, 1, "#a1794f")}
      {px(x, 108, 44, 4, P.wood)}
      {px(x, 112, 44, 1, P.woodDark)}
      {px(x + 2, 112, 3, 12, P.woodDark)}
      {px(x + 39, 112, 3, 12, P.woodDark)}
    </g>
  );
}

/** Concrete street lamp, cone of light optional. Pole center = x. */
export function StreetLamp({ x, on = false }: { x: number; on?: boolean }) {
  return (
    <g>
      {px(x - 2, 40, 4, 110, P.concreteDark)}
      {px(x - 2, 40, 1, 110, P.concreteLight)}
      {px(x - 14, 36, 28, 5, P.metalDark)}
      {px(x - 12, 41, 24, 3, on ? P.glassLit : P.metal)}
      {on ? <rect x={x - 20} y={44} width={40} height={106} fill="url(#lampcone)" /> : null}
      {on ? (
        <defs>
          <linearGradient id="lampcone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd98a55" />
            <stop offset="100%" stopColor="#ffd98a00" />
          </linearGradient>
        </defs>
      ) : null}
    </g>
  );
}

/** Beat-up VAZ-2101 in profile, facing left. ~64 wide, sits on floor. */
export function Zhiguli({ x, body = "#7a3b35" }: { x: number; body?: string }) {
  const dark = "#5d2c27";
  return (
    <g>
      {px(x + 4, 126, 56, 12, body)}
      {px(x + 14, 116, 34, 10, body)}
      {px(x + 16, 118, 13, 7, P.glassDark)}
      {px(x + 32, 118, 13, 7, P.glassDark)}
      {px(x + 4, 126, 56, 2, "#96504a")}
      {px(x + 4, 136, 56, 2, dark)}
      {px(x + 2, 128, 4, 4, P.glassLit)}
      {px(x + 58, 128, 4, 4, "#a33a30")}
      {px(x + 12, 136, 10, 10, "#22201e")}
      {px(x + 14, 138, 6, 6, P.metal)}
      {px(x + 42, 136, 10, 10, "#22201e")}
      {px(x + 44, 138, 6, 6, P.metal)}
      {px(x + 20, 145, 26, 3, "#00000033")}
      {/* rust kiss on the sill */}
      {px(x + 26, 134, 8, 2, P.rust)}
    </g>
  );
}

/** Round-cornered press kiosk, boarded window. ~52 wide. */
export function Kiosk({ x, open = false }: { x: number; open?: boolean }) {
  return (
    <g>
      {px(x, 92, 52, 58, "#6b6458")}
      {px(x, 92, 52, 3, "#7d766a")}
      {px(x, 88, 56, 5, P.metalDark)}
      {px(x + 4, 100, 30, 22, open ? P.glassLit : P.glassDark)}
      {px(x + 4, 111, 30, 1, P.metalDark)}
      {open ? px(x + 8, 104, 8, 10, "#e3d9c2") : px(x + 4, 100, 30, 22, "#00000044")}
      {px(x + 38, 100, 10, 40, P.woodDark)}
      {px(x + 39, 116, 3, 6, P.metal)}
      {px(x + 4, 126, 30, 14, "#5d574d")}
      {/* ПРЕСА sign */}
      {px(x + 8, 94, 36, 4, "#8a3a34")}
    </g>
  );
}

/** Wall-mounted mailbox bank (3×2). ~34 wide, hangs at y=84. */
export function Mailboxes({ x }: { x: number }) {
  const boxes: ReactNode[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const bx = x + 2 + c * 16;
      const by = 86 + r * 12;
      boxes.push(px(bx, by, 14, 10, "#4a5460", `mb${r}${c}`));
      boxes.push(px(bx + 2, by + 3, 10, 1, "#2e343c", `ms${r}${c}`));
      boxes.push(px(bx + 10, by + 6, 2, 2, P.metal, `ml${r}${c}`));
    }
  }
  return (
    <g>
      {px(x, 84, 34, 40, P.metalDark)}
      {boxes}
    </g>
  );
}

/** Elevator: steel doors in a painted frame. ~40 wide, door center = x+20. */
export function ElevatorDoors({ x, open = false }: { x: number; open?: boolean }) {
  return (
    <g>
      {px(x - 4, 66, 48, 84, P.paintGreenDark)}
      {px(x, 70, 40, 80, P.metalDark)}
      {open ? (
        <g>
          {px(x + 2, 72, 36, 78, P.doorway)}
          {px(x + 2, 72, 4, 78, P.metal)}
          {px(x + 34, 72, 4, 78, P.metal)}
        </g>
      ) : (
        <g>
          {px(x + 2, 72, 17, 78, P.metal)}
          {px(x + 21, 72, 17, 78, P.metal)}
          {px(x + 19, 72, 2, 78, "#43464c")}
          {px(x + 4, 74, 13, 2, "#b3b8bf")}
          {px(x + 23, 74, 13, 2, "#b3b8bf")}
        </g>
      )}
      {/* floor indicator */}
      {px(x + 14, 60, 12, 5, "#22201e")}
      {px(x + 16, 61, 3, 3, P.glassLit)}
    </g>
  );
}

/** Notice board with pinned papers. ~30 wide, hangs at y=78. */
export function NoticeBoard({ x }: { x: number }) {
  return (
    <g>
      {px(x, 78, 30, 24, P.woodDark)}
      {px(x + 2, 80, 26, 20, "#8a7452")}
      {px(x + 4, 82, 7, 9, "#e3d9c2")}
      {px(x + 13, 83, 7, 8, "#d8cfb8")}
      {px(x + 22, 82, 5, 10, "#e3d9c2")}
      {px(x + 6, 84, 3, 1, "#5d4a37")}
      {px(x + 15, 85, 3, 1, "#5d4a37")}
    </g>
  );
}

/** Steel trash container, lid ajar. ~28 wide. */
export function TrashContainer({ x }: { x: number }) {
  return (
    <g>
      {px(x, 122, 28, 26, "#5a6a5e")}
      {px(x, 122, 28, 2, "#6d7d70")}
      {px(x - 2, 118, 32, 5, "#4d5a50")}
      {px(x + 24, 114, 8, 5, "#4d5a50")}
      {px(x + 4, 148, 4, 3, P.metalDark)}
      {px(x + 20, 148, 4, 3, P.metalDark)}
    </g>
  );
}

/** Żabka storefront: green fascia, glass door, window with posters. ~96 wide. */
export function ZabkaFront({ x, doorX }: { x: number; doorX: number }) {
  return (
    <g>
      {/* fascia with logo band */}
      {px(x, 58, 96, 16, P.zabkaGreen)}
      {px(x + 6, 62, 8, 8, "#ffffff")}
      {px(x + 8, 64, 4, 4, P.zabkaGreen)}
      {px(x + 18, 63, 44, 6, "#ffffff")}
      {/* window with promo posters */}
      {px(x + 4, 78, 52, 60, P.glassDark)}
      {px(x + 4, 78, 52, 2, "#3a4148")}
      {px(x + 8, 84, 14, 18, "#e8c445")}
      {px(x + 26, 84, 14, 18, "#c84b31")}
      {px(x + 8, 108, 32, 12, "#e8f4ec")}
      {/* glass door */}
      {px(doorX - 3, 74, 34, 76, P.zabkaGreen)}
      {px(doorX, 78, 28, 72, P.glassDark)}
      {px(doorX + 2, 80, 24, 68, "#39434c")}
      {px(doorX + 22, 110, 3, 10, P.metal)}
      {px(doorX + 4, 84, 20, 8, "#e8f4ec")}
    </g>
  );
}

/** Interior shop shelving unit with stocked rows. ~44 wide. */
export function ShopShelf({ x, tint = "#d4a574" }: { x: number; tint?: string }) {
  const items: ReactNode[] = [];
  const colors = ["#c84b31", "#e8c445", "#5f7a63", "#4a5460", "#a33a30", "#8a7452"];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5; c++) {
      items.push(
        px(x + 3 + c * 8, 78 + r * 22 + 8, 6, 12, colors[(r * 5 + c) % colors.length], `i${r}${c}`),
      );
    }
  }
  return (
    <g>
      {px(x, 72, 44, 78, tint)}
      {px(x, 72, 44, 2, "#e0c49a")}
      {items}
      {px(x, 96, 44, 3, "#b8935f")}
      {px(x, 118, 44, 3, "#b8935f")}
      {px(x, 146, 44, 4, "#a8845a")}
    </g>
  );
}

/** Drinks fridge with lit interior. ~30 wide. */
export function DrinkFridge({ x }: { x: number }) {
  const cans: ReactNode[] = [];
  const colors = ["#c84b31", "#4a90d9", "#e8c445", "#5f7a63"];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      cans.push(
        px(x + 5 + c * 7, 84 + r * 18, 5, 10, colors[(r + c) % colors.length], `c${r}${c}`),
      );
    }
  }
  return (
    <g>
      {px(x, 70, 30, 80, "#dfe5e8")}
      {px(x + 2, 76, 26, 66, "#b8e6ff")}
      {px(x + 2, 76, 26, 2, "#8fd4f5")}
      {cans}
      {px(x + 2, 100, 26, 2, "#9fc7d6")}
      {px(x + 2, 118, 26, 2, "#9fc7d6")}
      {px(x, 70, 30, 4, "#c84b31")}
    </g>
  );
}

/** Shop counter with a till. Player stands left; ~50 wide. */
export function ShopCounter({ x }: { x: number }) {
  return (
    <g>
      {px(x, 106, 50, 8, "#e0e5e2")}
      {px(x, 114, 50, 36, "#4d5a50")}
      {px(x, 114, 50, 2, "#5f7a63")}
      {/* till */}
      {px(x + 30, 88, 16, 18, "#3a4148")}
      {px(x + 32, 92, 12, 6, "#7ee08c")}
      {/* lottery stand */}
      {px(x + 4, 92, 10, 14, "#c84b31")}
      {px(x + 6, 95, 6, 3, "#ffffff")}
    </g>
  );
}
