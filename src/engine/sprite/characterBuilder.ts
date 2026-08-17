import type { ActionDef, PlayerConfig, SpriteMap, SpritePalette } from "../core/types";

/**
 * Character Builder — a typed, validated way to assemble a character:
 * named body parts, frames composed from parts + patches, derived frames
 * (mirror, blink, shift), palette skins, walk cycles and an action table.
 * `.build()` returns a PlayerConfig ready for GameRuntime, and throws
 * loudly at build time instead of rendering garbage at run time.
 *
 * The idioms are the ones pixel characters actually need:
 *  - stack:   body rows + legs rows concatenated vertically;
 *  - patch:   overlay rows at (row, col) — arms, held items, props;
 *  - mirrorRows: flip only the head rows (look over the shoulder);
 *  - replaceColor: palette-key surgery on a frame (blink = eye → skin);
 *  - shiftDown: the one-pixel breath.
 */

// --- pure frame operations (exported for ad-hoc use) --------------------------------

export type Patch = { r: number; c: number; rows: readonly string[] };

/** Overlay patch rows onto a map at (r, c); "." and " " are transparent. */
export function patchMap(map: SpriteMap, patch: Patch): string[] {
  const out = map.map((row) => row.split(""));
  patch.rows.forEach((prow, dr) => {
    [...prow].forEach((ch, dc) => {
      if (ch === "." || ch === " ") return;
      const rr = patch.r + dr;
      const cc = patch.c + dc;
      if (out[rr] && cc >= 0 && cc < out[rr].length) out[rr][cc] = ch;
    });
  });
  return out.map((row) => row.join(""));
}

/** Vertical concatenation: body on top, legs below. */
export function stackMaps(...parts: SpriteMap[]): string[] {
  return parts.flatMap((p) => [...p]);
}

/** Mirror the whole frame horizontally. */
export function mirrorMap(map: SpriteMap): string[] {
  return map.map((row) => [...row].reverse().join(""));
}

/** Mirror only rows [from..to] — the look-over-the-shoulder trick. */
export function mirrorRows(map: SpriteMap, from: number, to: number): string[] {
  return map.map((row, i) => (i >= from && i <= to ? [...row].reverse().join("") : row));
}

/** Swap one palette key for another inside a frame (blink: "e" → "s"). */
export function replaceColor(map: SpriteMap, fromKey: string, toKey: string): string[] {
  return map.map((row) => row.split(fromKey).join(toKey));
}

/** Push the frame down one pixel, dropping the last row — the breath. */
export function shiftDown(map: SpriteMap): string[] {
  const empty = ".".repeat(map[0]?.length ?? 0);
  return [empty, ...map.slice(0, map.length - 1)];
}

// --- the builder ---------------------------------------------------------------------

type FrameFactory = {
  /** Stack named parts vertically, then apply patches in order. */
  stack: (...partNames: string[]) => FrameFactory;
  patch: (p: Patch) => FrameFactory;
  /** Use a raw map instead of parts. */
  raw: (map: SpriteMap) => FrameFactory;
  /** Transform the accumulated frame (drop the body, bow the head…). */
  map: (fn: (m: SpriteMap) => string[]) => FrameFactory;
};

export class CharacterBuilder {
  private cellSize: number;
  private palette: SpritePalette;
  private parts = new Map<string, SpriteMap>();
  private frames = new Map<string, string[]>();
  private cycle: string[] = [];
  private actionTable: Record<string, ActionDef> = {};
  private speed?: number;

  constructor(opts: {
    palette: SpritePalette;
    cell?: number;
    walkSpeed?: number;
  }) {
    this.palette = opts.palette;
    this.cellSize = opts.cell ?? 2;
    this.speed = opts.walkSpeed;
  }

  /** Register a reusable body part (rows of palette keys). */
  part(name: string, map: SpriteMap): this {
    if (this.parts.has(name)) throw new Error(`character: part "${name}" already defined`);
    this.parts.set(name, map);
    return this;
  }

  /** Compose a frame from parts and patches. */
  frame(name: string, make: (f: FrameFactory) => FrameFactory): this {
    if (this.frames.has(name)) throw new Error(`character: frame "${name}" already defined`);
    let acc: string[] | null = null;
    const factory: FrameFactory = {
      stack: (...partNames) => {
        const maps = partNames.map((p) => {
          const m = this.parts.get(p);
          if (!m) throw new Error(`character: frame "${name}" wants unknown part "${p}"`);
          return m;
        });
        acc = stackMaps(...(acc ? [acc as SpriteMap, ...maps] : maps));
        return factory;
      },
      patch: (p) => {
        if (!acc) throw new Error(`character: frame "${name}" patches before stack/raw`);
        acc = patchMap(acc, p);
        return factory;
      },
      raw: (map) => {
        acc = [...map];
        return factory;
      },
      map: (fn) => {
        if (!acc) throw new Error(`character: frame "${name}" maps before stack/raw`);
        acc = fn(acc);
        return factory;
      },
    };
    make(factory);
    if (!acc) throw new Error(`character: frame "${name}" produced nothing`);
    this.frames.set(name, acc);
    return this;
  }

  /** Derive a frame from an existing one via a pure transform. */
  variant(name: string, from: string, transform: (map: SpriteMap) => string[]): this {
    const base = this.frames.get(from);
    if (!base) throw new Error(`character: variant "${name}" from unknown frame "${from}"`);
    if (this.frames.has(name)) throw new Error(`character: frame "${name}" already defined`);
    this.frames.set(name, transform(base));
    return this;
  }

  /** The looping walk frames, in order. */
  walkCycle(...frameNames: string[]): this {
    this.cycle = frameNames;
    return this;
  }

  /** Register an action animation (see ActionDef). */
  action(id: string, def: ActionDef): this {
    if (this.actionTable[id]) throw new Error(`character: action "${id}" already defined`);
    this.actionTable[id] = def;
    return this;
  }

  /** A palette-swapped twin (outfits, NPC recolors) sharing all frames. */
  skin(paletteOverrides: SpritePalette): CharacterBuilder {
    const twin = new CharacterBuilder({
      palette: { ...this.palette, ...paletteOverrides },
      cell: this.cellSize,
      walkSpeed: this.speed,
    });
    twin.parts = this.parts;
    twin.frames = new Map(this.frames);
    twin.cycle = [...this.cycle];
    twin.actionTable = { ...this.actionTable };
    return twin;
  }

  /** Validate everything and produce a PlayerConfig. */
  build(): PlayerConfig {
    if (this.frames.size === 0) throw new Error("character: no frames defined");
    // Hand-drawn maps trim trailing transparency, and some poses are a few
    // rows short (a stretch, a crouch) — the classic renderer top-aligned
    // them in a fixed box. Normalize instead of rejecting: pad every row to
    // the widest, pad every frame to the tallest with empty bottom rows.
    let cols = 0;
    let rows = 0;
    for (const map of this.frames.values()) {
      rows = Math.max(rows, map.length);
      for (const row of map) cols = Math.max(cols, row.length);
    }
    const emptyRow = ".".repeat(cols);
    for (const [name, map] of this.frames) {
      const padded = map.map((row) =>
        row.length < cols ? row + ".".repeat(cols - row.length) : row,
      );
      while (padded.length < rows) padded.push(emptyRow);
      this.frames.set(name, padded);
      for (const row of map) {
        for (const ch of row) {
          if (ch !== "." && ch !== " " && !(ch in this.palette)) {
            throw new Error(`character: frame "${name}" uses unknown palette key "${ch}"`);
          }
        }
      }
    }
    if (this.cycle.length === 0) throw new Error("character: walkCycle is empty");
    for (const f of this.cycle) {
      if (!this.frames.has(f)) throw new Error(`character: walkCycle frame "${f}" not defined`);
    }
    for (const [id, def] of Object.entries(this.actionTable)) {
      for (const f of def.frames) {
        if (!this.frames.has(f)) {
          throw new Error(`character: action "${id}" uses unknown frame "${f}"`);
        }
      }
    }
    return {
      width: cols * this.cellSize,
      height: rows * this.cellSize,
      palette: this.palette,
      frames: Object.fromEntries(this.frames),
      walkCycle: this.cycle,
      actions: this.actionTable,
      cell: this.cellSize,
      walkSpeed: this.speed,
    };
  }
}

/** Entry point: `createCharacter({ palette }).part(...).frame(...).build()`. */
export function createCharacter(opts: {
  palette: SpritePalette;
  cell?: number;
  walkSpeed?: number;
}): CharacterBuilder {
  return new CharacterBuilder(opts);
}
